/**
 * Rendering Markdown in the browser — the development path, and only that.
 *
 * A build renders every page ahead of time (`plugins/docs-markdown.ts`), so
 * none of this ships. Getting it to actually not ship took its own module:
 * `Page` selects between the two paths with `import.meta.env.DEV`, which the
 * bundler folds, but a *static* import of `marked` survives that fold anyway —
 * the package does not declare itself side-effect-free, so rollup keeps its
 * module body even with nothing left referencing it. Reached through a dynamic
 * import inside the dead branch, there is no edge to keep.
 *
 * ── The cache ───────────────────────────────────────────────────────────────
 * Module scope, keyed by source, never evicted. Switching pages unmounts the
 * component, so anything held in a hook is thrown away exactly when it would
 * next be useful: nobody renders the same page twice without leaving it in
 * between, which is the one case a `useMemo` cannot serve. Twenty pages of
 * HTML is a few hundred kilobytes in a dev server that is already holding the
 * whole module graph.
 */

import type { Rendered } from "./doc.ts";
import { highlighter } from "./highlight.ts";
import { outline, renderMarkdown } from "./markdown.ts";

export type Render = (source: string) => Rendered;

const cache = new Map<string, Rendered>();

/**
 * The renderer, once the grammars are in. One module-scope promise, so the
 * whole realm suspends once — on the first page anyone opens — and never again.
 */
export const ready: Promise<Render> = highlighter().then((shiki) => (source) => {
	const hit = cache.get(source);
	if (hit) return hit;
	const rendered: Rendered = {
		html: renderMarkdown(source, shiki),
		headings: outline(source),
	};
	cache.set(source, rendered);
	return rendered;
});
