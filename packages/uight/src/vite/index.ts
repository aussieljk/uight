/**
 * The plugin. `@aussieljk/uight/vite`. SPEC.md §4.5, §19.4.
 *
 * Three v0.6 defects are fixed here, and each one is load-bearing:
 *
 *  1. **Options resolve in `config()`**, where Vite documents configuration
 *     changes and `env.command` is already available. `ResolvedConfig` is
 *     never mutated — the production flag travels through `define` instead.
 *  2. **Topology changes are told to the browser.** Invalidating a virtual
 *     module in the server graph does not by itself cause the browser to
 *     re-import it, so add/unlink go out as a namespaced `uight:index`
 *     custom event carrying the new index as data.
 *  3. **`ctx.read()` is the only read.** The raw file may be momentarily empty
 *     during an editor save; `handleHotUpdate` hands us a safe reader.
 *
 * Rescans are debounced and serialized, and a content change reparses one file
 * rather than the corpus.
 */

import fs from "node:fs";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import type { FixtureIndex, IndexProblem, UightPluginOptions } from "../shared/types.ts";
import { readOnlyApi } from "./api.ts";
import type { ResolvedUightConfig } from "./config.ts";
import { HOT_REGISTRY_KEY } from "../runtime/hot.ts";
import {
	isStructural,
	normalizeAliases,
	resolveUightConfig,
	safeReloadConfig,
	sameAliases,
	structuralDiff,
	toGlobPath,
} from "./config.ts";
import {
	DEV_ENTRY_URL,
	DEV_PREVIEW_URL,
	DEV_RENDERER_URL,
	devEntryHandler,
	devRouteHandler,
	previewDocumentHandler,
	rendererHandler,
} from "./dev-route.ts";
import { emitManifest, replaceRendererUrl } from "./manifest.ts";
import { checkMdxSupport } from "./mdx.ts";
import { parseFixtureFile } from "./parse.ts";
import {
	applyParse,
	isCsfFile,
	isDecoratorFile,
	isFixtureFile,
	isInventoryFile,
	namesChanged,
	rescanIncremental,
	scanFixtures,
	serializeIndex,
} from "./scan.ts";
import type { PreambleMode } from "./virtual.ts";
import {
	PREAMBLE_MODULE_ID,
	REACT_REFRESH_RUNTIME_ID,
	VIRTUAL_IDS,
	generateCodecs,
	generateDevEntry,
	generateInventory,
	generatePreviewEntry,
	generateRendererEntry,
	generateRendererUrl,
	generateRuntime,
	generateStorybookPreview,
	resolvedId,
} from "./virtual.ts";

/* ------------------------------------------------------------------ *
 * Public surface — §19.4
 * ------------------------------------------------------------------ */

export { defineUightConfig, resolveUightConfig } from "./config.ts";
export type { ResolvedUightConfig } from "./config.ts";
export { parseFixtureFile } from "./parse.ts";
export type { ParsedFixtureFile, NameSource } from "./parse.ts";
export { buildFixtureIndex, validateFixtures } from "./scan.ts";
export { groupCallSites, parseCallSites } from "./callsites.ts";
export { formatStorybookReport, storybookReport } from "./storybook-report.ts";
export { formatMigration, migrateFromStorybook, migrateProject } from "./init.ts";
export type { MigrateOptions, MigrationChange, MigrationResult } from "./init.ts";
export {
	cosmosReport,
	detectCosmos,
	formatCosmosReport,
	planFixtureRenames,
	readCosmosConfig,
	rewriteCosmosImports,
	translateCosmosConfig,
} from "./cosmos.ts";
export type {
	CosmosFileReport,
	CosmosReport,
	CosmosReportOptions,
	CosmosTranslation,
	FixtureRename,
	ImportRewrite,
} from "./cosmos.ts";
export type { StorybookReport, StorybookFileReport } from "./storybook-report.ts";
export { buildStatic } from "./static.ts";
export type { BuildStaticOptions, BuildStaticResult } from "./static.ts";
export { createBabelDocgenResolver } from "./docgen.ts";
export type { BabelDocgenOptions } from "./docgen.ts";
export { doctorReport, formatDoctorReport } from "./doctor.ts";
export type { DoctorReport } from "./doctor.ts";
export { checkMdxSupport } from "./mdx.ts";
export type { MdxAdvice } from "./mdx.ts";
export { DEV_RENDERER_URL, DEV_ENTRY_URL, DEV_PREVIEW_URL };

const V = VIRTUAL_IDS;
const ALL_VIRTUAL_IDS: string[] = Object.values(V);
const INDEX_EVENT = "uight:index";

export function uight(options: UightPluginOptions = {}): Plugin {
	let cfg: ResolvedUightConfig;
	let index: FixtureIndex = {
		files: [],
		decorators: [],
		inventory: [],
		callSites: [],
		problems: [],
	};
	let rendererRef: string | undefined;
	let base = "/";
	let logger: { warn(msg: string): void; info(msg: string): void } = console;
	const disposers: Array<() => void> = [];

	return {
		name: "uight",

		/**
		 * Vite's documented plugin-to-plugin channel, used here for one thing:
		 * `uight doctor` loads the project's Vite config and needs to know what
		 * this call was given (see `load-config.ts`). Options written inline in
		 * `vite.config.ts` are otherwise an expression no shell tool can read,
		 * which is why the doctor used to report defaults for most projects.
		 *
		 * The raw options, not the resolved config: `config()` may not have run
		 * when this is read, and resolution is the doctor's job anyway.
		 */
		api: { options },

		// Config is resolved HERE, where Vite documents configuration changes.
		// `env.command` is already available, so nothing needs configResolved,
		// and ResolvedConfig is never mutated (§4.5).
		async config(userConfig, env) {
			cfg = resolveUightConfig({
				root: userConfig.root ?? process.cwd(),
				options,
				command: env.command,
				// The alias table the call-site pass needs. `configResolved` has the
				// authoritative one, but the initial scan runs here — `config()` is
				// where `production: "error"` and collisions have to be decided — so
				// this reads what the user wrote and `configResolved` reconciles.
				alias: userConfig.resolve?.alias,
				onProblem: (message) => console.warn(message),
			});
			index = await scanFixtures(cfg);

			if (env.command === "build" && cfg.production === "error" && index.files.length) {
				throw new Error(
					`[uight] production: "error" — ${index.files.length} fixture files present`,
				);
			}

			// §4.4: "two files normalizing to one display path is a build error
			// naming both". A dev server warns and carries on, because the user
			// is probably mid-rename; a build must not ship ambiguous ids.
			const collisions = index.problems.filter((p) => p.kind === "collision");
			if (env.command === "build" && collisions.length > 0) {
				throw new Error(collisions.map((p) => p.message).join("\n"));
			}

			const enabled = env.command === "serve" || cfg.production === "include";
			const input = previewHtmlInput(cfg, userConfig);
			return {
				define: { __UIGHT_ENABLED__: JSON.stringify(enabled) },
				...(input ? { build: { rollupOptions: { input } } } : {}),
			};
		},

		// Read-only. §4.5's objection is to *mutating* ResolvedConfig; `base`
		// and the logger cannot be known any earlier and are only read.
		async configResolved(resolved) {
			base = resolved.base;
			logger = resolved.logger;

			// Aliases decide whether `@/components/Button` and
			// `../components/Button` name the same component, and a plugin may have
			// added an entry between `config()` and here. Rescan only when the
			// *string* entries actually moved: Vite's own additions are all RegExp
			// and are dropped by `normalizeAliases`, so in the ordinary case this
			// compares equal and costs nothing.
			const resolvedAliases = normalizeAliases(resolved.resolve.alias);
			if (cfg.callSites && !sameAliases(cfg.aliases, resolvedAliases)) {
				cfg = { ...cfg, aliases: resolvedAliases };
				index = await scanFixtures(cfg);
			}

			// §14: nothing is injected and nothing is reordered — this only reads
			// the list the user assembled and says what is wrong with it, and only
			// when the project has `.mdx` fixtures for it to be wrong about.
			const advice = checkMdxSupport(
				resolved.plugins.map((plugin) => plugin.name),
				index,
			);
			if (advice) logger.warn(advice.message);
		},

		buildStart() {
			if (cfg.command === "build" && cfg.production === "include") {
				rendererRef = this.emitFile({
					type: "chunk",
					id: V.renderer,
					name: "uight-renderer",
				});
			}
		},

		configureServer(s) {
			if (cfg.route) {
				s.middlewares.use(
					cfg.route,
					devRouteHandler(s, () => cfg),
				);
			}
			s.middlewares.use(DEV_RENDERER_URL, rendererHandler(s));
			s.middlewares.use(DEV_ENTRY_URL, devEntryHandler(s));
			// Before the `/@uight` catch-all below, which would otherwise
			// answer this path with the read-only JSON API's 404.
			s.middlewares.use(DEV_PREVIEW_URL, previewDocumentHandler(s));
			// §19.6 — `devApi: false` removes the endpoints outright. The explorer
			// does not use them (the index reaches it through the virtual module
			// and the `uight:index` event), so this costs external tooling only.
			if (cfg.devApi !== false) {
				s.middlewares.use(
					"/@uight",
					readOnlyApi(
						s,
						() => cfg,
						() => index,
					),
				);
			}

			// Raw watcher events are used ONLY for topology: add and unlink.
			// Content changes go through handleHotUpdate, which provides
			// ctx.read() and avoids the empty-file race during editor saves.
			//
			// **Every file in the window is rescanned, not just the last one.**
			// The debounce used to carry the arguments of the call that armed it,
			// which silently made a rename half-work: `rename(2)` is one atomic
			// move that the watcher reports as `unlink(old)` then `add(new)`,
			// microseconds apart, so the unlink was discarded and the departed
			// path stayed in the tree — selectable, and deep-linking to a file
			// that no longer exists. A plain delete was unaffected, which is why
			// it looked like a rename-specific bug rather than the coalescing one
			// it is. Q9.
			const pending = new Set<string>();
			const flush = serialize(
				async () => {
					const batch = [...pending];
					pending.clear();
					let moved = false;
					for (const file of batch) {
						if (!isTopologyRelevant(file, cfg)) continue;
						index = await rescanIncremental(index, file, cfg);
						moved = true;
					}
					if (!moved) return;
					invalidate(s, [V.runtime, V.inventory]);
					s.hot.send({
						type: "custom",
						event: INDEX_EVENT,
						data: serializeIndex(index),
					});
				},
				// A silently failed rescan leaves a stale tree, which looks
				// like a uight bug rather than a filesystem problem.
				(err) => logger.warn(`[uight] index rescan failed: ${String(err)}`),
			);
			const onTopology = debounce(flush, 40);
			const enqueue = (file: string): void => {
				pending.add(file);
				onTopology();
			};

			// A mount that connected after the last topology change asks for the
			// index it missed (§4.5). Custom events reach the clients connected at
			// send time, and a page loading while a file lands is not one of them.
			s.hot.on(
				"uight:hello",
				(_data: unknown, client: { send: (event: string, payload?: unknown) => void }) => {
					client.send(INDEX_EVENT, serializeIndex(index));
				},
			);

			for (const ev of ["add", "unlink"] as const) {
				s.watcher.on(ev, enqueue);
				disposers.push(() => s.watcher.off(ev, enqueue));
			}
			disposers.push(() => onTopology.cancel());
			if (cfg.configFile) s.watcher.add(cfg.configFile);

			reportProblems(index, logger);
		},

		async handleHotUpdate(ctx) {
			if (cfg.configFile && ctx.file === cfg.configFile) {
				const next = safeReloadConfig(cfg, await ctx.read(), options, (message) =>
					logger.warn(message),
				);
				if (isStructural(cfg, next)) {
					logger.warn(
						`[uight] structural config change (${structuralDiff(cfg, next).join(", ")}) ` +
							`— restart the dev server to apply`,
					);
					return [];
				}
				cfg = next;
				index = await scanFixtures(cfg);
				invalidate(ctx.server, ALL_VIRTUAL_IDS);
				ctx.server.hot.send({ type: "full-reload" });
				return [];
			}

			if (isFixtureFile(ctx.file, cfg)) {
				// ctx.read() is the safe read; the raw file may be momentarily empty.
				const source = await ctx.read();
				const parsed = parseFixtureFile(source, ctx.file, {
					csf: isCsfFile(ctx.file, cfg),
				});
				if (namesChanged(index, ctx.file, parsed, cfg)) {
					index = applyParse(index, ctx.file, parsed, cfg, source);
					invalidate(ctx.server, [V.runtime]);
					ctx.server.hot.send({
						type: "custom",
						event: INDEX_EVENT,
						data: serializeIndex(index),
					});
				}
				return ctx.modules; // ordinary Fast Refresh for the fixture itself
			}

			return undefined;
		},

		buildEnd() {
			disposers.splice(0).forEach((d) => {
				d();
			});
		},

		resolveId(id) {
			if (ALL_VIRTUAL_IDS.includes(id)) return resolvedId(id);
			// The two public dev URLs are also resolvable ids. Without this the
			// dev document's `<script src="/@uight/dev-entry">` fails Vite's
			// pre-transform warm-up: the middleware would still serve it, but
			// every page load would log a "does the file exist?" error.
			if (cfg.command === "serve") {
				if (id === DEV_RENDERER_URL) return resolvedId(V.renderer);
				if (id === DEV_ENTRY_URL) return resolvedId(V.devEntry);
			}
			return undefined;
		},

		/**
		 * Make every fixture module its own HMR boundary — §4.5, Q9, §20.3.
		 *
		 * Without this, an edit to a fixture propagates through the
		 * `import.meta.glob` in `virtual:uight/runtime`, which both realms
		 * import and neither accepts, and Vite full-reloads the HOST document:
		 * a navigation, a fresh explorer chunk, a fresh frame and a fresh
		 * handshake for every save, plus the loss of every tuned control (Q14).
		 * `plugin-react` cannot supply the boundary, because §3.1 allows a
		 * fixture file whose exports are elements and an element module has no
		 * component for Fast Refresh to register.
		 *
		 * The appended callback hands the new namespace to `runtime/hot.ts`,
		 * which is the half Fast Refresh could not give us anyway: the glob's
		 * loader would return the browser's cached copy of the old URL. Where
		 * Fast Refresh IS in play — a fixture file exporting components — its
		 * own accept callback still runs, and the re-render below reconciles
		 * through the refresh family rather than remounting.
		 *
		 * `map: null` is honest: nothing above the appended lines moved.
		 */
		transform(code, id) {
			if (cfg.command !== "serve") return undefined;
			const file = id.split("?", 1)[0] ?? id;
			if (!isFixtureFile(file, cfg)) return undefined;
			const globPath = toGlobPath(cfg.root, file);
			return {
				code: `${code}\nif (import.meta.hot) {\n\timport.meta.hot.accept((mod) => {\n\t\tif (mod) globalThis[${JSON.stringify(HOT_REGISTRY_KEY)}]?.update(${JSON.stringify(globPath)}, mod);\n\t});\n}\n`,
				map: null,
			};
		},

		async load(id) {
			if (id === resolvedId(V.runtime)) return generateRuntime(cfg, index);
			if (id === resolvedId(V.rendererUrl)) {
				return generateRendererUrl(rendererRef !== undefined);
			}
			if (id === resolvedId(V.renderer)) {
				return generateRendererEntry(await detectPreamble(this, cfg));
			}
			if (id === resolvedId(V.preview)) return generatePreviewEntry(cfg);
			if (id === resolvedId(V.storybookPreview)) return generateStorybookPreview(cfg);
			if (id === resolvedId(V.codecs)) return generateCodecs(cfg);
			if (id === resolvedId(V.inventory)) return generateInventory(cfg, index);
			if (id === resolvedId(V.devEntry)) return generateDevEntry();
			return undefined;
		},

		generateBundle(_options, bundle) {
			if (rendererRef !== undefined) {
				replaceRendererUrl(bundle, this.getFileName(rendererRef), base);
			}
			const summary = emitManifest(bundle, index, cfg);
			if (summary) logger.info(`\n${summary}\n`);
		},
	};
}

/* ------------------------------------------------------------------ *
 * §6.6 — the custom preview document as a build input
 * ------------------------------------------------------------------ */

/**
 * Add `previewHtmlPath` to `build.rollupOptions.input` **without displacing
 * what is already there.** SPEC §4.5's sample assigns
 * `{ uightPreview: … }` outright, which silently drops the project's own
 * entry: Vite only falls back to `<root>/index.html` when `input` is unset, so
 * naming one input removes the default. Existing inputs are normalized to a
 * record so ours can join them, keeping each entry's basename as its name.
 */
function previewHtmlInput(
	cfg: ResolvedUightConfig,
	userConfig: { build?: { rollupOptions?: { input?: unknown } } },
): Record<string, string> | undefined {
	if (!cfg.previewHtmlPath || cfg.command !== "build") return undefined;

	const existing = userConfig.build?.rollupOptions?.input;
	const entries: Record<string, string> = {};

	if (existing === undefined) {
		const defaultHtml = path.resolve(cfg.root, "index.html");
		if (fs.existsSync(defaultHtml)) entries.index = defaultHtml;
	} else if (typeof existing === "string") {
		entries[inputName(existing)] = existing;
	} else if (Array.isArray(existing)) {
		for (const one of existing as string[]) entries[inputName(one)] = one;
	} else {
		Object.assign(entries, existing as Record<string, string>);
	}

	entries.uightPreview = cfg.previewHtmlPath;
	return entries;
}

function inputName(file: string): string {
	return path.basename(file).replace(/\.[^.]+$/, "");
}

/* ------------------------------------------------------------------ *
 * Q2 — the React Refresh preamble (§6.3)
 * ------------------------------------------------------------------ */

/**
 * The frame document never passes through `transformIndexHtml`, so the React
 * plugin cannot inject its Fast Refresh preamble and transformed modules fail
 * with "can't detect preamble". `@vitejs/plugin-react` v6 does publish a
 * preamble module — `virtualPreamblePlugin` resolves the bare specifier
 * `@vitejs/plugin-react/preamble` and serves the bootstrap, returning an empty
 * module when Fast Refresh is off or Bundled Dev Mode is on. Asking the plugin
 * container to resolve it is therefore both the correct answer and the
 * version check: if it resolves, it is the right preamble for the installed
 * plugin.
 */
async function detectPreamble(
	ctx: { resolve(source: string): Promise<{ id: string } | null> },
	cfg: ResolvedUightConfig,
): Promise<PreambleMode> {
	if (cfg.command !== "serve") return "none";
	if (await canResolve(ctx, PREAMBLE_MODULE_ID)) return "module";
	// Some other React plugin (swc, or plugin-react v4/v5) still serves the
	// refresh runtime; fall back to inlining the standard bootstrap.
	if (await canResolve(ctx, REACT_REFRESH_RUNTIME_ID)) return "inline";
	return "none";
}

async function canResolve(
	ctx: { resolve(source: string): Promise<{ id: string } | null> },
	source: string,
): Promise<boolean> {
	try {
		return (await ctx.resolve(source)) !== null;
	} catch {
		return false;
	}
}

/* ------------------------------------------------------------------ *
 * Server plumbing
 * ------------------------------------------------------------------ */

function invalidate(server: ViteDevServer, ids: string[]): void {
	for (const id of ids) {
		const mod = server.moduleGraph.getModuleById(resolvedId(id));
		if (mod) server.moduleGraph.invalidateModule(mod);
	}
}

/** Topology relevance: a fixture, a decorator, or an inventory candidate. */
function isTopologyRelevant(file: string, cfg: ResolvedUightConfig): boolean {
	return (
		isFixtureFile(file, cfg) || isDecoratorFile(file, cfg) || isInventoryFile(file, cfg)
	);
}

/**
 * One line at dev-server startup, when there is something to say.
 *
 * A user who never opens `/uight` currently never learns their `fixturesDir`
 * was unreadable — the problems exist, but only on a JSON endpoint and in a UI
 * they have no reason to visit. This is the smallest fix that closes that: a
 * count per kind and the *first* offender's message in full, because a summary
 * without an example tells nobody which file to look at, and a summary with
 * eleven of them is scrollback nobody reads.
 *
 * `uight doctor` prints the rest.
 */
export function formatProblemSummary(problems: IndexProblem[]): string | null {
	if (problems.length === 0) return null;

	const counts = new Map<IndexProblem["kind"], number>();
	for (const problem of problems) {
		counts.set(problem.kind, (counts.get(problem.kind) ?? 0) + 1);
	}
	const breakdown = [...counts]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([kind, count]) => `${count} ${kind}`)
		.join(", ");

	const first = problems[0] as IndexProblem;
	const rest = problems.length - 1;
	return (
		`[uight] ${problems.length} index problem${problems.length === 1 ? "" : "s"} ` +
		`(${breakdown}). ${first.message.replace(/^\[uight\] /, "")}` +
		`${rest > 0 ? ` (+${rest} more — run \`uight doctor\`)` : ""}`
	);
}

function reportProblems(index: FixtureIndex, logger: { warn(msg: string): void }): void {
	const summary = formatProblemSummary(index.problems);
	if (summary) logger.warn(summary);
}

interface Debounced<A extends unknown[]> {
	(...args: A): void;
	cancel(): void;
}

function debounce<A extends unknown[]>(
	fn: (...args: A) => void,
	ms: number,
): Debounced<A> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const wrapped = (...args: A): void => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			fn(...args);
		}, ms);
	};
	wrapped.cancel = (): void => {
		if (timer) clearTimeout(timer);
		timer = undefined;
	};
	return wrapped;
}

/**
 * One rescan at a time. Two overlapping rescans would race to publish the
 * index, and the loser's stale copy could win.
 */
function serialize<A extends unknown[]>(
	fn: (...args: A) => Promise<void>,
	onError: (err: unknown) => void,
): (...args: A) => void {
	let tail: Promise<void> = Promise.resolve();
	return (...args: A): void => {
		tail = tail.then(() => fn(...args)).catch(onError);
	};
}

/* ------------------------------------------------------------------ *
 * Re-exported types
 * ------------------------------------------------------------------ */

export type { FixtureIndex, IndexProblem, UightPluginOptions };
