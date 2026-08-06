/**
 * Markdown → HTML, for the pages whose source is a `.md` file.
 *
 * Most of this site is written as MDX and needs none of this. The exception is
 * the four documents `scripts/sync.ts` copies in from the repository root —
 * SPEC, ARCHITECTURE, ROADMAP, CHANGELOG — which are maintained as plain
 * Markdown for the people changing the code, and are full of `{`, `<` and `|`
 * that MDX would read as expressions and JSX. Converting them would mean
 * escaping a document nobody wants to write escaped, so they stay Markdown and
 * are rendered rather than compiled. §14 draws the same line: MDX is for prose
 * that wants components in it.
 *
 * `marked` is used with its defaults plus two overrides that matter:
 * highlighting, and heading anchors so a section can be linked to.
 */

import { Marked } from "marked";
import type { HighlighterCore } from "shiki/core";
import { THEME, isKnownLanguage } from "./highlight.ts";

/** GitHub-style: lowercase, punctuation dropped, spaces to hyphens. */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/<[^>]+>/g, "")
		.replace(/[^\p{L}\p{N} -]/gu, "")
		.trim()
		.replace(/\s+/g, "-");
}

/**
 * The one renderer, built on first use and kept.
 *
 * It used to be constructed inside `renderMarkdown`, which rebuilt the
 * tokenizer, the renderer table and the options object for every page — small
 * next to the highlighting, and free to not do, since none of it depends on the
 * source.
 *
 * Lazy rather than a module-scope `const`, and that is not a detail: a build
 * renders every page ahead of time (`plugins/docs-markdown.ts`), so nothing in
 * the client bundle calls this, and rollup drops the module — but only if
 * evaluating it does nothing. A top-level `new Marked()` is a constructor call
 * no bundler will assume is pure, and it kept all of `marked` in the shipped
 * bundle for the sake of code that could never run.
 */
let instance: Marked | null = null;

function renderer(): Marked {
	return (instance ??= new Marked({
		gfm: true,
		renderer: {
			code({ text, lang }) {
				return highlight(text, lang, active());
			},
			/**
			 * An off-site link opened in the frame would replace the page with
			 * GitHub inside the preview pane, with the explorer still drawn
			 * around it. Root-relative links are this site's own and are caught
			 * by `Page`'s click handler instead.
			 */
			link({ href, title, tokens }) {
				const text = this.parser.parseInline(tokens);
				const external = /^[a-z]+:/i.test(href);
				const attrs =
					(title ? ` title="${title}"` : "") +
					(external ? ' target="_blank" rel="noreferrer"' : "");
				return `<a href="${href}"${attrs}>${text}</a>`;
			},
			heading({ tokens, depth }) {
				const inner = this.parser.parseInline(tokens);
				const id = slugify(inner);
				return (
					`<h${depth} id="${id}">` +
					`<a class="anchor" href="#${id}" aria-label="Permalink">#</a>` +
					`${inner}</h${depth}>\n`
				);
			},
		},
	}));
}

/**
 * The highlighter for the parse in progress.
 *
 * A module variable rather than a parameter because `marked`'s renderer table
 * is fixed when the instance is built, and the instance is what we are hoisting
 * out of the hot path. `parse` is synchronous and this module has no other
 * caller, so the window in which this is set is one call stack wide.
 */
let current: HighlighterCore | null = null;

function active(): HighlighterCore {
	if (!current) throw new Error("renderMarkdown: no highlighter for this parse");
	return current;
}

export function renderMarkdown(source: string, shiki: HighlighterCore): string {
	current = shiki;
	try {
		return renderer().parse(source, { async: false }) as string;
	} finally {
		current = null;
	}
}

/**
 * The `##` headings, which is the depth a contents list is useful at.
 *
 * Scanned here rather than in the page component so that the build-time render
 * produces it alongside the HTML — a page that ships its markup pre-rendered
 * should not still be re-splitting its own source in the browser to find out
 * what to put in the sidebar.
 */
export interface Heading {
	id: string;
	text: string;
}

export function outline(source: string): Heading[] {
	const headings: Heading[] = [];
	let fenced = false;

	for (const line of source.split("\n")) {
		if (line.startsWith("```")) fenced = !fenced;
		if (fenced) continue;
		const match = /^##\s+(.+?)\s*$/.exec(line);
		if (match?.[1]) headings.push({ id: slugify(match[1]), text: match[1] });
	}

	return headings;
}

/**
 * One fenced block. An unknown or missing language is rendered as plain text
 * through shiki anyway, so every code block on the site carries the same
 * padding, background and border regardless of whether we have its grammar.
 */
export function highlight(
	code: string,
	lang: string | undefined,
	shiki: HighlighterCore,
): string {
	return shiki.codeToHtml(code, {
		lang: isKnownLanguage(lang, shiki) ? (lang as string) : "text",
		theme: THEME,
	});
}
