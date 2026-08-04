/**
 * The plugin. `uaight/vite`. SPEC.md §4.5, §19.4.
 *
 * Three v0.6 defects are fixed here, and each one is load-bearing:
 *
 *  1. **Options resolve in `config()`**, where Vite documents configuration
 *     changes and `env.command` is already available. `ResolvedConfig` is
 *     never mutated — the production flag travels through `define` instead.
 *  2. **Topology changes are told to the browser.** Invalidating a virtual
 *     module in the server graph does not by itself cause the browser to
 *     re-import it, so add/unlink go out as a namespaced `uaight:index`
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
import type {
	FixtureIndex,
	IndexProblem,
	UaightPluginOptions,
} from "../shared/types.ts";
import { readOnlyApi } from "./api.ts";
import type { ResolvedUaightConfig } from "./config.ts";
import {
	isStructural,
	resolveUaightConfig,
	safeReloadConfig,
	structuralDiff,
} from "./config.ts";
import {
	DEV_ENTRY_URL,
	DEV_RENDERER_URL,
	devEntryHandler,
	devRouteHandler,
	rendererHandler,
} from "./dev-route.ts";
import { emitManifest, replaceRendererUrl } from "./manifest.ts";
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
	resolvedId,
} from "./virtual.ts";

/* ------------------------------------------------------------------ *
 * Public surface — §19.4
 * ------------------------------------------------------------------ */

export { defineUaightConfig, resolveUaightConfig } from "./config.ts";
export type { ResolvedUaightConfig } from "./config.ts";
export { parseFixtureFile } from "./parse.ts";
export type { ParsedFixtureFile, NameSource } from "./parse.ts";
export { buildFixtureIndex, validateFixtures } from "./scan.ts";
export { DEV_RENDERER_URL, DEV_ENTRY_URL };

const V = VIRTUAL_IDS;
const ALL_VIRTUAL_IDS: string[] = Object.values(V);
const INDEX_EVENT = "uaight:index";

export function uaight(options: UaightPluginOptions = {}): Plugin {
	let cfg: ResolvedUaightConfig;
	let index: FixtureIndex = {
		files: [],
		decorators: [],
		inventory: [],
		problems: [],
	};
	let rendererRef: string | undefined;
	let base = "/";
	let logger: { warn(msg: string): void; info(msg: string): void } = console;
	const disposers: Array<() => void> = [];

	return {
		name: "uaight",

		// Config is resolved HERE, where Vite documents configuration changes.
		// `env.command` is already available, so nothing needs configResolved,
		// and ResolvedConfig is never mutated (§4.5).
		async config(userConfig, env) {
			cfg = resolveUaightConfig({
				root: userConfig.root ?? process.cwd(),
				options,
				command: env.command,
				onProblem: (message) => console.warn(message),
			});
			index = await scanFixtures(cfg);

			if (
				env.command === "build" &&
				cfg.production === "error" &&
				index.files.length
			) {
				throw new Error(
					`[uaight] production: "error" — ${index.files.length} fixture files present`,
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
				define: { __UAIGHT_ENABLED__: JSON.stringify(enabled) },
				...(input ? { build: { rollupOptions: { input } } } : {}),
			};
		},

		// Read-only. §4.5's objection is to *mutating* ResolvedConfig; `base`
		// and the logger cannot be known any earlier and are only read.
		configResolved(resolved) {
			base = resolved.base;
			logger = resolved.logger;
		},

		buildStart() {
			if (cfg.command === "build" && cfg.production === "include") {
				rendererRef = this.emitFile({
					type: "chunk",
					id: V.renderer,
					name: "uaight-renderer",
				});
			}
		},

		configureServer(s) {
			if (cfg.route) {
				s.middlewares.use(cfg.route, devRouteHandler(s, () => cfg));
			}
			s.middlewares.use(DEV_RENDERER_URL, rendererHandler(s));
			s.middlewares.use(DEV_ENTRY_URL, devEntryHandler(s));
			s.middlewares.use(
				"/@uaight",
				readOnlyApi(
					s,
					() => cfg,
					() => index,
				),
			); // §19.6

			// Raw watcher events are used ONLY for topology: add and unlink.
			// Content changes go through handleHotUpdate, which provides
			// ctx.read() and avoids the empty-file race during editor saves.
			const onTopology = debounce(
				serialize(
					async (file: string) => {
						if (!isTopologyRelevant(file, cfg)) return;
						index = await rescanIncremental(index, file, cfg);
						invalidate(s, [V.runtime, V.inventory]);
						s.hot.send({
							type: "custom",
							event: INDEX_EVENT,
							data: serializeIndex(index),
						});
					},
					// A silently failed rescan leaves a stale tree, which looks
					// like a uaight bug rather than a filesystem problem.
					(err) => logger.warn(`[uaight] index rescan failed: ${String(err)}`),
				),
				40,
			);

			for (const ev of ["add", "unlink"] as const) {
				s.watcher.on(ev, onTopology);
				disposers.push(() => s.watcher.off(ev, onTopology));
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
						`[uaight] structural config change (${structuralDiff(cfg, next).join(", ")}) ` +
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
			// dev document's `<script src="/@uaight/dev-entry">` fails Vite's
			// pre-transform warm-up: the middleware would still serve it, but
			// every page load would log a "does the file exist?" error.
			if (cfg.command === "serve") {
				if (id === DEV_RENDERER_URL) return resolvedId(V.renderer);
				if (id === DEV_ENTRY_URL) return resolvedId(V.devEntry);
			}
			return undefined;
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
 * `{ uaightPreview: … }` outright, which silently drops the project's own
 * entry: Vite only falls back to `<root>/index.html` when `input` is unset, so
 * naming one input removes the default. Existing inputs are normalized to a
 * record so ours can join them, keeping each entry's basename as its name.
 */
function previewHtmlInput(
	cfg: ResolvedUaightConfig,
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

	entries.uaightPreview = cfg.previewHtmlPath;
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
	cfg: ResolvedUaightConfig,
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
function isTopologyRelevant(file: string, cfg: ResolvedUaightConfig): boolean {
	return (
		isFixtureFile(file, cfg) ||
		isDecoratorFile(file, cfg) ||
		isInventoryFile(file, cfg)
	);
}

function reportProblems(
	index: FixtureIndex,
	logger: { warn(msg: string): void },
): void {
	for (const problem of index.problems) logger.warn(problem.message);
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

export type { FixtureIndex, IndexProblem, UaightPluginOptions };
