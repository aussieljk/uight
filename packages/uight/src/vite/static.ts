/**
 * The static explorer build — `uight build`.
 *
 * §9 covers embedding the explorer in a production app. It does not cover
 * *publishing* one, and that is how a design system actually gets adopted
 * across an organisation: a URL everyone can open, linked from the docs, no
 * checkout and no dev server. Without it, §1.3's job 3 ("living design-system
 * documentation") stops at the edge of the machine it was built on.
 *
 * The build reuses the production path that already exists — `production:
 * 'include'` plus the emitted renderer (§9.2, Q7) — and only adds a document to
 * mount into. It deliberately runs the *user's own* Vite config, so the
 * explorer is built by the same resolver, aliases and plugins as their app;
 * a second config would be a second way for the build to be wrong.
 *
 * Writing files here is not the endpoint §1.4 cut. That was a dev-server route
 * accepting a path from a browser. This is a build command writing its own
 * output, invoked from a shell.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { PluginOption } from "vite";
import { FRAME_CHROME_ID, FRAME_ROOT_ID, ROOT_CLASS } from "../ui/constants.ts";
import { STATIC_ENV } from "./config.ts";

export { STATIC_ENV };

const HTML_NAME = "uight-explorer.html";
const ENTRY_NAME = "uight-explorer.entry.js";
/** The frame's document, emitted beside the explorer's. See `PREVIEW_NAME`'s use. */
const PREVIEW_NAME = "uight-preview.html";
/** Where it ends up in the output, and therefore what the frame's `src` is. */
const PREVIEW_OUTPUT = "preview.html";

/**
 * Where the scaffold lives. `node_modules/.uight/` rather than the project
 * root, because the root is the user's repository: a build that crashes between
 * writing the scaffold and the `finally` that removes it used to leave two
 * files in their working tree, which is the kind of mess a tool is not entitled
 * to make. `node_modules/.<tool>/` is the established place for exactly this —
 * `.vite`, `.cache`, `.bin` — it is already git-ignored everywhere, and a
 * leftover there is invisible and harmless.
 *
 * A virtual HTML input would remove the files entirely. It is not taken here:
 * Vite's HTML handling resolves `<script src>` against the document's real
 * location and rewrites asset URLs from it, so a virtual document has to
 * reimplement enough of that to be its own source of defects. Real files in a
 * directory that is not the user's is the smaller, provable fix.
 */
const SCAFFOLD_DIR = path.join("node_modules", ".uight");

export interface BuildStaticOptions {
	/** Project root. Defaults to the working directory. */
	root?: string;
	/** Where the site is written. Defaults to `dist-uight`. */
	outDir?: string;
	/** Public base path, for hosting under a sub-path. Defaults to `/`. */
	base?: string;
	/** Vite config file, or false to build without one. */
	configFile?: string | false;
	mode?: string;
	/** Page title. Defaults to the directory name. */
	title?: string;
	/** Suppress Vite's own build output. */
	quiet?: boolean;
	/**
	 * Plugins to leave out, by name. Added to `FRAMEWORK_PLUGINS` rather than
	 * replacing it; pass `[]` to change nothing.
	 */
	excludePlugins?: readonly (string | RegExp)[];
}

/**
 * Meta-framework plugins, which this build must not run.
 *
 * The explorer is built by the user's own Vite config on purpose (see the file
 * header): same resolver, same aliases, same transforms, so a fixture resolves
 * exactly as the app does. A meta-framework's plugins are the exception,
 * because they are not transforms — they *are* an application. They own the
 * document, the SSR entry, the route tree and the client manifest, and pointing
 * them at the explorer's document asks them to build an app that is not there.
 *
 * TanStack Start fails loudly: its manifest plugin counts entries, sees the
 * explorer's document and the emitted renderer chunk, and dies with "multiple
 * entries detected" naming two hashed filenames and no cause. The others in
 * this list are here because the same reasoning applies to them, not because
 * each has been seen to fail.
 *
 * Matched against `plugin.name` as a prefix, or by regex.
 */
export const FRAMEWORK_PLUGINS: readonly (string | RegExp)[] = [
	// A framework's plugins are a set, and half of one is worse than none:
	// TanStack Start's router-generator reads the config context that its
	// `…-core:config` plugin installs, so dropping the manifest plugin alone
	// trades "multiple entries detected" for "Cannot get config before root is
	// resolved". Route generation is not wanted here anyway — it exists to
	// write the app's route tree, which is a side effect on the user's
	// repository during a build that was asked for an explorer.
	// One regex rather than four prefixes: `tanstack-start-core:…`,
	// `tanstack-react-start:…`, `tanstack:router-generator` and
	// `tanstack-router:code-splitter:…` are all contributed by one
	// `tanstackStart()` call, and a list of prefixes is a list of chances to
	// miss the next one they add.
	/^tanstack[-:]/,
	"react-router",
	"remix",
	"vite-plugin-sveltekit",
	"vike",
];

export interface BuildStaticResult {
	outDir: string;
	/** Emitted asset and chunk count, as Rollup reported it. */
	files: number;
	/** Names of the plugins left out, in config order. Never silently empty. */
	excluded: string[];
}

/**
 * Vite allows arrays, promises and falsy holes anywhere in `plugins`, and a
 * filter can only see names once all three are gone.
 */
async function flattenPlugins(input: unknown): Promise<PluginOption[]> {
	const one = await input;
	if (!one) return [];
	if (Array.isArray(one)) {
		const nested = await Promise.all(one.map(flattenPlugins));
		return nested.flat();
	}
	return [one as PluginOption];
}

function matches(name: string, patterns: readonly (string | RegExp)[]): boolean {
	return patterns.some((p) => (typeof p === "string" ? name.startsWith(p) : p.test(name)));
}

function documentHtml(title: string): string {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="robots" content="noindex" />
		<title>${title}</title>
		<style>
			html, body, #uight-app { height: 100%; margin: 0; }
			body { background: #fff; }
			@media (prefers-color-scheme: dark) { body { background: #0a0a0a; } }
		</style>
	</head>
	<body>
		<div id="uight-app"></div>
		<script type="module" src="./${ENTRY_NAME}"></script>
	</body>
</html>
`;
}

/**
 * The frame's document, so the published explorer's frame has a real URL for
 * the same reasons the dev server's does — see `DEV_PREVIEW_URL`. A fixture
 * that mocks its network works in `bun dev` and in the deployed site, or the
 * asymmetry costs someone an afternoon.
 *
 * It carries no script: `adoptCustomDocument` injects the stylesheet and the
 * renderer into whatever document it finds at this URL.
 */
function previewHtml(): string {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="robots" content="noindex" />
		<title>uight preview</title>
		<style>
			html, body { margin: 0; padding: 0; min-height: 100% }
			#${FRAME_ROOT_ID} { min-height: 100vh }
		</style>
	</head>
	<body>
		<div id="${FRAME_ROOT_ID}"></div>
		<div id="${FRAME_CHROME_ID}" class="${ROOT_CLASS}"></div>
	</body>
</html>
`;
}

/**
 * `createElement` rather than JSX, for the same reason the dev entry uses it:
 * this file is generated, and nothing guarantees it passes through a JSX
 * transform before it is bundled.
 */
const entryJs = (previewUrl: string) => `import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { Uight } from "@aussieljk/uight";

const container = document.getElementById("uight-app");
if (!container) throw new Error('[uight] the static document is missing <div id="uight-app">');

createRoot(container).render(
	createElement(Uight, {
		router: "history",
		height: "100%",
		previewDocumentUrl: ${JSON.stringify(previewUrl)},
	}),
);
`;

/**
 * Build a deployable explorer.
 *
 * The scaffold is two files under `node_modules/.uight/`, removed afterwards.
 * Rollup names an HTML output by its path relative to the root, so the emitted
 * document lands at `node_modules/.uight/uight-explorer.html` inside the
 * output directory and is moved to `index.html` — which is what the previous
 * root-level scaffold needed a rename for too, one directory shallower.
 */
export async function buildStatic(
	options: BuildStaticOptions = {},
): Promise<BuildStaticResult> {
	const root = path.resolve(options.root ?? process.cwd());
	const outDir = path.resolve(root, options.outDir ?? "dist-uight");
	const title = options.title ?? `${path.basename(root)} — components`;

	const scaffoldDir = path.join(root, SCAFFOLD_DIR);
	const htmlPath = path.join(scaffoldDir, HTML_NAME);
	const entryPath = path.join(scaffoldDir, ENTRY_NAME);
	const previewPath = path.join(scaffoldDir, PREVIEW_NAME);
	// Absolute, so the frame resolves it from the site root rather than from
	// whatever path the explorer's history router happens to be showing.
	const base = options.base ?? "/";
	const previewUrl = `${base.endsWith("/") ? base : `${base}/`}${PREVIEW_OUTPUT}`;

	const previous = process.env[STATIC_ENV];
	process.env[STATIC_ENV] = "1";

	try {
		await fsp.mkdir(scaffoldDir, { recursive: true });
		await fsp.writeFile(htmlPath, documentHtml(title));
		await fsp.writeFile(entryPath, entryJs(previewUrl));
		await fsp.writeFile(previewPath, previewHtml());

		const { build, loadConfigFromFile } = await import("vite");
		const mode = options.mode ?? "production";

		// The user's config is loaded here rather than left to `build()` because
		// filtering it is the whole point: a plugin cannot remove another
		// plugin, so the only place a meta-framework's plugins can be dropped is
		// before the config reaches Vite. `configFile: false` afterwards stops
		// it being read a second time.
		const exclude = [...FRAMEWORK_PLUGINS, ...(options.excludePlugins ?? [])];
		const loaded =
			options.configFile === false
				? null
				: await loadConfigFromFile(
						{ command: "build", mode, isSsrBuild: false },
						options.configFile,
						root,
						options.quiet ? "warn" : undefined,
					);

		const excluded: string[] = [];
		const plugins: PluginOption[] = (await flattenPlugins(loaded?.config.plugins)).filter(
			(plugin) => {
				const name =
					plugin && typeof plugin === "object" && "name" in plugin ? plugin.name : "";
				if (!name || !matches(name, exclude)) return true;
				excluded.push(name);
				return false;
			},
		);

		const result = await build({
			...loaded?.config,
			configFile: false,
			root,
			base,
			mode,
			...(options.quiet ? { logLevel: "warn" as const } : {}),
			...(loaded ? { plugins } : {}),
			build: {
				...loaded?.config.build,
				outDir,
				emptyOutDir: true,
				// A record, not an array. A plugin in the user's own config may
				// append its entry to `input`, and appending to an array of
				// strings is how `{ index: "virtual:…" }` ends up as `input.2`
				// and the build dies on a type error naming neither plugin.
				rollupOptions: {
					...loaded?.config.build?.rollupOptions,
					input: { uightExplorer: htmlPath, uightPreview: previewPath },
				},
			},
		});

		const outputs = Array.isArray(result) ? result : [result];
		let files = 0;
		for (const one of outputs) {
			const output = (one as { output?: unknown[] }).output;
			if (Array.isArray(output)) files += output.length;
		}

		// Rollup named the document after the scaffold's path relative to the
		// root; the site wants an index at the top. The now-empty scaffold
		// directory goes with it, so the output holds no trace of how it was made.
		const emitted = path.join(outDir, SCAFFOLD_DIR, HTML_NAME);
		if (fs.existsSync(emitted)) {
			await fsp.rename(emitted, path.join(outDir, "index.html"));
		}
		const emittedPreview = path.join(outDir, SCAFFOLD_DIR, PREVIEW_NAME);
		if (fs.existsSync(emittedPreview)) {
			await fsp.rename(emittedPreview, path.join(outDir, PREVIEW_OUTPUT));
		}
		await fsp.rm(path.join(outDir, "node_modules"), { recursive: true, force: true });

		return { outDir, files, excluded };
	} finally {
		if (previous === undefined) delete process.env[STATIC_ENV];
		else process.env[STATIC_ENV] = previous;
		// The directory too: it is ours, so leaving it behind empty is litter.
		await fsp.rm(scaffoldDir, { recursive: true, force: true });
	}
}
