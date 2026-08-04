/**
 * The static explorer build — `uaight build`.
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
import { STATIC_ENV } from "./config.ts";

export { STATIC_ENV };

const HTML_NAME = "uaight-explorer.html";
const ENTRY_NAME = "uaight-explorer.entry.js";

export interface BuildStaticOptions {
	/** Project root. Defaults to the working directory. */
	root?: string;
	/** Where the site is written. Defaults to `dist-uaight`. */
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
}

export interface BuildStaticResult {
	outDir: string;
	/** Emitted asset and chunk count, as Rollup reported it. */
	files: number;
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
			html, body, #uaight-app { height: 100%; margin: 0; }
			body { background: #fff; }
			@media (prefers-color-scheme: dark) { body { background: #0a0a0a; } }
		</style>
	</head>
	<body>
		<div id="uaight-app"></div>
		<script type="module" src="./${ENTRY_NAME}"></script>
	</body>
</html>
`;
}

/**
 * `createElement` rather than JSX, for the same reason the dev entry uses it:
 * this file is generated, and nothing guarantees it passes through a JSX
 * transform before it is bundled.
 */
const entryJs = `import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { Uaight } from "uaight";

const container = document.getElementById("uaight-app");
if (!container) throw new Error('[uaight] the static document is missing <div id="uaight-app">');

createRoot(container).render(
	createElement(Uaight, { router: "history", height: "100%" }),
);
`;

/**
 * Build a deployable explorer.
 *
 * The scaffold is two files written next to the project's own `index.html` and
 * removed afterwards. They sit at the root rather than in a subdirectory
 * because Rollup names an HTML output by its path relative to the root, and a
 * nested input would emit `some/nested/index.html` into the site.
 */
export async function buildStatic(
	options: BuildStaticOptions = {},
): Promise<BuildStaticResult> {
	const root = path.resolve(options.root ?? process.cwd());
	const outDir = path.resolve(root, options.outDir ?? "dist-uaight");
	const title = options.title ?? `${path.basename(root)} — components`;

	const htmlPath = path.join(root, HTML_NAME);
	const entryPath = path.join(root, ENTRY_NAME);

	for (const file of [htmlPath, entryPath]) {
		if (fs.existsSync(file)) {
			throw new Error(
				`[uaight] ${path.relative(root, file)} already exists. The static build needs ` +
					`that name for a scaffold file it writes and removes; rename yours.`,
			);
		}
	}

	const previous = process.env[STATIC_ENV];
	process.env[STATIC_ENV] = "1";

	try {
		await fsp.writeFile(htmlPath, documentHtml(title));
		await fsp.writeFile(entryPath, entryJs);

		const { build } = await import("vite");
		const result = await build({
			root,
			base: options.base ?? "/",
			...(options.configFile !== undefined ? { configFile: options.configFile } : {}),
			...(options.mode ? { mode: options.mode } : {}),
			...(options.quiet ? { logLevel: "warn" as const } : {}),
			build: {
				outDir,
				emptyOutDir: true,
				rollupOptions: { input: htmlPath },
			},
		});

		const outputs = Array.isArray(result) ? result : [result];
		let files = 0;
		for (const one of outputs) {
			const output = (one as { output?: unknown[] }).output;
			if (Array.isArray(output)) files += output.length;
		}

		// Rollup named the document after the scaffold; the site wants an index.
		const emitted = path.join(outDir, HTML_NAME);
		if (fs.existsSync(emitted)) {
			await fsp.rename(emitted, path.join(outDir, "index.html"));
		}

		return { outDir, files };
	} finally {
		if (previous === undefined) delete process.env[STATIC_ENV];
		else process.env[STATIC_ENV] = previous;
		await fsp.rm(htmlPath, { force: true });
		await fsp.rm(entryPath, { force: true });
	}
}
