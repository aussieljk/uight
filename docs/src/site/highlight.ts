/**
 * Syntax highlighting, inside the frame realm.
 *
 * Shiki loads its grammars asynchronously and highlights synchronously
 * afterwards, which is the wrong shape for a render function and the right
 * shape for `use()`: one module-scope promise, awaited by every page, resolved
 * once. Building the highlighter per page would re-parse the grammars on every
 * navigation.
 *
 * Two choices here are about what ends up in the bundle, and both were made
 * after watching the alternative:
 *
 *  1. **The core, with the grammars named.** `shiki`'s convenience entry point
 *     reaches every language it ships. It code-splits them, so nothing unused
 *     is *downloaded* — but the build emitted 316 chunks including Wolfram and
 *     Emacs Lisp, and an output nobody can read is an output nobody checks.
 *     This site writes code in ten languages; those ten are listed.
 *  2. **The JavaScript engine, not Oniguruma.** Oniguruma is a 600 kB WASM
 *     binary. It is the right default for a highlighter that must accept any
 *     grammar; for a closed list that the JavaScript engine already compiles,
 *     it is 600 kB to render the same HTML.
 */

import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { HighlighterCore } from "shiki/core";

/**
 * One theme, dark, for every reader.
 *
 * This used to load both and emit both into the markup as CSS variables, so the
 * page could follow the explorer's theme without being re-highlighted. That
 * bought a real capability and charged for it twice over: shiki tokenizes and
 * serializes each theme separately, so every fence cost double, and every span
 * carried two colours into the HTML. Dark code blocks on a light page is a
 * choice most documentation sites make deliberately; here it also halves the
 * most expensive thing the site does.
 */
export const THEME = "github-dark";

/**
 * The fence languages this site actually writes, and the whole of what gets
 * bundled. A fence in an eleventh language renders as plain text rather than
 * as a build that grew by a megabyte to be ready for it.
 */
const LANGUAGES = {
	bash: () => import("@shikijs/langs/bash"),
	css: () => import("@shikijs/langs/css"),
	diff: () => import("@shikijs/langs/diff"),
	html: () => import("@shikijs/langs/html"),
	js: () => import("@shikijs/langs/javascript"),
	json: () => import("@shikijs/langs/json"),
	jsx: () => import("@shikijs/langs/jsx"),
	markdown: () => import("@shikijs/langs/markdown"),
	mdx: () => import("@shikijs/langs/mdx"),
	ts: () => import("@shikijs/langs/typescript"),
	tsx: () => import("@shikijs/langs/tsx"),
} as const;

let pending: Promise<HighlighterCore> | null = null;

/** The one highlighter, created on first use. Safe to call from render. */
export function highlighter(): Promise<HighlighterCore> {
	pending ??= createHighlighterCore({
		themes: [import("@shikijs/themes/github-dark")],
		langs: Object.values(LANGUAGES).map((load) => load()),
		engine: createJavaScriptRegexEngine(),
	});
	return pending;
}

/**
 * Whether a fence's info string names something we loaded.
 *
 * Asked of the highlighter rather than of `LANGUAGES`, because a grammar
 * registers its own aliases when it loads: ```` ```typescript ```` is the same
 * grammar as ```` ```ts ````, and only shiki knows that.
 */
export function isKnownLanguage(
	lang: string | undefined,
	shiki: HighlighterCore,
): boolean {
	return !!lang && shiki.getLoadedLanguages().includes(lang);
}
