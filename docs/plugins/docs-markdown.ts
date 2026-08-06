/**
 * `import doc from "./page.md?docs"` — a Markdown file as a rendered page.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Every page on this site was `?raw` plus `renderMarkdown` in a `useMemo`.
 * Selecting a page unmounts the previous one, which takes the memo with it, so
 * the whole document was re-tokenized and re-highlighted on arrival — and again
 * every time anyone came back to it. Measured with this site's own shiki
 * configuration, `reference/spec.md` cost 2.8 seconds of synchronous main-thread
 * work per switch, and it was doing it inside the preview frame, where it
 * blocks the thing the reader is waiting for.
 *
 * None of that work depends on anything only the browser knows. So in a build
 * it happens here, once per file, and the module the page imports is finished
 * HTML. The highlighter and its grammars stop being a client dependency at all.
 *
 * ── Why development is different ────────────────────────────────────────────
 * In `serve` the module carries the source and the browser renders it, exactly
 * as before, but through a cache in `Page.tsx` keyed by source — so the second
 * visit to a page is free even though the first is not. That keeps the dev loop
 * honest about what editing a `.md` feels like (Vite invalidates `?docs`, the
 * page re-renders, no server-side work to wait on), and it keeps this plugin
 * from being on the path of every keystroke. The build is where the reader is.
 *
 * The two paths render through the same `renderMarkdown` in `src/site/`, so
 * there is one definition of what this site's Markdown means.
 */

import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { highlighter } from "../src/site/highlight.ts";
import { outline, renderMarkdown } from "../src/site/markdown.ts";

/** What `?docs` resolves to, in both modes. See `src/site/doc.ts`. */
const QUERY = "?docs";

export function docsMarkdown(): Plugin {
	let build = false;

	return {
		name: "uight-docs-markdown",
		enforce: "pre",

		configResolved(config) {
			build = config.command === "build";
		},

		/**
		 * Vite's own `?raw` and friends are handled in `load`, and a query it does
		 * not recognize would otherwise reach the default resolver as part of the
		 * path. Marking the id resolved keeps the file watched under its real path
		 * — which is what makes an edit to the `.md` invalidate the page.
		 */
		resolveId(id, importer) {
			if (!id.endsWith(QUERY)) return null;
			return this.resolve(id.slice(0, -QUERY.length), importer, {
				skipSelf: true,
			}).then((resolved) => (resolved ? resolved.id + QUERY : null));
		},

		async load(id) {
			if (!id.endsWith(QUERY)) return null;
			const file = id.slice(0, -QUERY.length);
			const source = readFileSync(file, "utf8");

			if (!build) {
				// The browser renders it. `html`/`headings` absent is the signal.
				return `export default ${JSON.stringify({ source })};\n`;
			}

			const shiki = await highlighter();
			return `export default ${JSON.stringify({
				source: "",
				html: renderMarkdown(source, shiki),
				headings: outline(source),
			})};\n`;
		},
	};
}
