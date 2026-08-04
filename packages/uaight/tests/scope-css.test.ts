/**
 * The §10.3 scoping transform.
 *
 * This is the pass that makes the packaged stylesheet safe to publish: every
 * rule is confined to `.uaight-root`, so the host's `@theme` cannot reach in and
 * our utilities cannot leak out. Getting it wrong is not a cosmetic bug — an
 * unscoped `*` rule from our build would restyle the consumer's application.
 */

import { describe, expect, it } from "vitest";

import { scopeCss, scopeSelector, splitSelectorList } from "../scripts/scope-css.ts";

const SELF = ":is(.uaight-root, .uaight-root *)";

/** Collapse whitespace so assertions read about selectors, not formatting. */
function tidy(css: string): string {
	return css.replace(/\s+/g, " ").trim();
}

describe("splitSelectorList", () => {
	it("splits on top-level commas only", () => {
		expect(splitSelectorList("a, b")).toEqual(["a", "b"]);
		expect(splitSelectorList(":is(a, b) c")).toEqual([":is(a, b) c"]);
		expect(splitSelectorList('[data-x="a,b"], c')).toEqual(['[data-x="a,b"]', "c"]);
	});

	it("keeps escaped Tailwind class names intact", () => {
		expect(splitSelectorList(".w-\\[calc\\(100\\%\\)\\], .b")).toEqual([
			".w-\\[calc\\(100\\%\\)\\]",
			".b",
		]);
	});
});

describe("scopeSelector", () => {
	it("confines an ordinary selector", () => {
		expect(scopeSelector(".flex")).toEqual([`${SELF}.flex`]);
		expect(scopeSelector(".a > .b")).toEqual([`${SELF}.a > .b`]);
	});

	it("maps :root and :host onto the scope, deduplicating the pair", () => {
		expect(scopeSelector(":root")).toEqual([".uaight-root"]);
		expect(scopeSelector(":host")).toEqual([".uaight-root"]);
	});

	it("drops :host(...), which only means anything in a shadow tree", () => {
		expect(scopeSelector(":host(.dark)")).toEqual([]);
	});

	it("absorbs a leading universal selector", () => {
		expect(scopeSelector("*")).toEqual([SELF]);
		expect(scopeSelector("*::before")).toEqual([`${SELF}::before`]);
	});

	it("attaches a leading pseudo-element to the scope", () => {
		expect(scopeSelector("::backdrop")).toEqual([`${SELF}::backdrop`]);
	});

	it("confines a type selector by descent, since a compound cannot start with one", () => {
		expect(scopeSelector("html .a")).toEqual([`${SELF} html .a`]);
		expect(scopeSelector("button")).toEqual([`${SELF} button`]);
	});

	it("leaves a selector that already names the scope exactly as authored", () => {
		expect(scopeSelector(".uaight-root")).toEqual([".uaight-root"]);
		expect(scopeSelector(".uaight-theme-dark .uaight-root")).toEqual([
			".uaight-theme-dark .uaight-root",
		]);
		expect(scopeSelector(".uaight-root :where(button)")).toEqual([
			".uaight-root :where(button)",
		]);
	});

	it("uses a plain descendant combinator when includeSelf is off", () => {
		expect(scopeSelector(".flex", { includeSelf: false })).toEqual([".uaight-root .flex"]);
		expect(scopeSelector("*", { includeSelf: false })).toEqual([
			".uaight-root",
			".uaight-root *",
		]);
	});

	it("honours a custom scope", () => {
		expect(scopeSelector(".flex", { scope: ".x", includeSelf: false })).toEqual([
			".x .flex",
		]);
	});
});

describe("scopeCss", () => {
	it("rewrites a rule and leaves declarations alone", () => {
		expect(tidy(scopeCss(".flex { display: flex; }"))).toBe(
			`${SELF}.flex { display: flex; }`,
		);
	});

	it("rewrites every selector in a list and drops the duplicate :root/:host pair", () => {
		expect(tidy(scopeCss(":root, :host { --a: 1; }"))).toBe(".uaight-root { --a: 1; }");
	});

	it("scopes the universal reset Tailwind emits for its custom properties", () => {
		const out = tidy(scopeCss("*, ::before, ::after, ::backdrop { --tw-blur: initial; }"));
		expect(out).toBe(
			`${SELF}, ${SELF}::before, ${SELF}::after, ${SELF}::backdrop { --tw-blur: initial; }`,
		);
	});

	it("recurses into @media, @supports, @layer and @container", () => {
		for (const prelude of [
			"@media (min-width: 40rem)",
			"@supports (display: grid)",
			"@layer utilities",
			"@container (min-width: 20rem)",
		]) {
			const out = tidy(scopeCss(`${prelude} { .a { color: red; } }`));
			expect(out).toBe(`${prelude} { ${SELF}.a { color: red; } }`);
		}
	});

	it("recurses through nested wrappers", () => {
		const out = tidy(
			scopeCss("@layer utilities { @media (min-width:1px) { .a { color: red } } }"),
		);
		expect(out).toContain(`${SELF}.a`);
		expect(out).not.toContain(" .a {");
	});

	it("leaves @keyframes alone — a keyframe selector is not a selector", () => {
		const css = "@keyframes spin { from { rotate: 0deg } to { rotate: 360deg } }";
		expect(tidy(scopeCss(css))).toBe(tidy(css));
	});

	it("leaves @property alone, since a registration is global by definition", () => {
		const css = '@property --tw-blur { syntax: "*"; inherits: false; }';
		expect(tidy(scopeCss(css))).toBe(tidy(css));
	});

	it("leaves @font-face alone", () => {
		const css = '@font-face { font-family: "X"; src: url(x.woff2); }';
		expect(tidy(scopeCss(css))).toBe(tidy(css));
	});

	it("passes statement at-rules through untouched", () => {
		const css = '@layer theme, base, components, utilities;\n@charset "utf-8";';
		expect(tidy(scopeCss(css))).toBe(tidy(css));
	});

	it("does not desynchronise on a brace inside a string", () => {
		const out = tidy(scopeCss('.a { content: "} .evil { color: red; }"; }'));
		expect(out).toBe(`${SELF}.a { content: "} .evil { color: red; }"; }`);
	});

	it("does not desynchronise on escaped parens in a class name", () => {
		const out = tidy(scopeCss(".w-\\[calc\\(100\\%-1px\\)\\] { width: 1px }"));
		expect(out).toBe(`${SELF}.w-\\[calc\\(100\\%-1px\\)\\] { width: 1px }`);
	});

	it("leaves a nested rule body alone, because it is relative to a scoped parent", () => {
		const out = tidy(scopeCss(".a { color: red; &:hover { color: blue } }"));
		expect(out).toBe(`${SELF}.a { color: red; &:hover { color: blue } }`);
	});

	it("keeps a comment out of the selector it precedes", () => {
		expect(tidy(scopeCss("/*! banner */\n.a{color:red}"))).toBe(
			`/*! banner */ ${SELF}.a {color:red}`,
		);
	});

	it("is idempotent — a second pass changes nothing", () => {
		const once = scopeCss(":root{--a:1}\n.b{color:red}\n@media print{.c{color:blue}}");
		expect(scopeCss(once)).toBe(once);
	});

	it("emits no selector that can match outside the scope", () => {
		const css = [
			":root, :host { --a: 1 }",
			"*, ::before, ::backdrop { --b: 2 }",
			".c:hover { color: red }",
			"html .d { color: red }",
			"@media (min-width: 1px) { .e { color: red } }",
			"@layer utilities { @supports (display: grid) { .f { color: red } } }",
		].join("\n");
		const out = scopeCss(css);
		// Every prelude that is not an at-rule is a selector list; each must name
		// the scope, or the packaged stylesheet reaches into the host's page.
		const preludes = (out.match(/[^{};]+(?=\{)/g) ?? [])
			.map((p) => p.trim())
			.filter((p) => p.length > 0 && !p.startsWith("@"));
		expect(preludes.length).toBe(6);
		for (const selector of preludes) expect(selector).toContain(".uaight-root");
	});
});
