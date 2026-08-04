/**
 * Filter semantics. SPEC.md §3.6, §20.1.
 *
 * The rule that earns its own test is the segment boundary: a bare string is a
 * path prefix, but `components/forms` must not swallow `components/formsy`.
 * Prefix matching without that rule is a bug users only find once they name a
 * second directory badly.
 */

import { describe, expect, it } from "vitest";

import { globToRegExp, matchesFilter } from "../src/shared/filter.ts";

describe("string without `*` — prefix on segment boundaries", () => {
	it("matches the directory and everything under it", () => {
		expect(matchesFilter("components/forms/Input", "components/forms")).toBe(true);
		expect(matchesFilter("components/forms/nested/Deep", "components/forms")).toBe(true);
	});

	it("matches the path itself", () => {
		expect(matchesFilter("components/forms", "components/forms")).toBe(true);
	});

	it("does not match a sibling that merely shares a prefix", () => {
		expect(matchesFilter("components/formsy/X", "components/forms")).toBe(false);
		expect(matchesFilter("components/forms-legacy/X", "components/forms")).toBe(false);
	});

	it("tolerates a trailing slash on the pattern", () => {
		expect(matchesFilter("components/forms/Input", "components/forms/")).toBe(true);
		expect(matchesFilter("components/formsy/X", "components/forms/")).toBe(false);
	});

	it("is anchored at the start, not a substring search", () => {
		expect(matchesFilter("src/components/forms/Input", "components/forms")).toBe(false);
	});
});

describe("string containing `*` — glob", () => {
	it("keeps `*` within one segment", () => {
		expect(matchesFilter("components/Button", "components/*")).toBe(true);
		expect(matchesFilter("components/forms/Input", "components/*")).toBe(false);
	});

	it("crosses segments with `**`", () => {
		expect(matchesFilter("components/forms/Input", "components/**")).toBe(true);
		expect(matchesFilter("a/b/c/Button", "**/Button")).toBe(true);
	});

	it("lets `**/` match zero segments", () => {
		expect(matchesFilter("Button", "**/Button")).toBe(true);
	});

	it("matches one character with `?`", () => {
		expect(matchesFilter("Button1", "Button?")).toBe(true);
		expect(matchesFilter("Button12", "Button?")).toBe(false);
		expect(matchesFilter("a/b", "a?b")).toBe(false);
	});
});

describe("string[] — any match wins, `!` excludes", () => {
	it("includes on any match", () => {
		expect(matchesFilter("a/X", ["a", "b"])).toBe(true);
		expect(matchesFilter("b/X", ["a", "b"])).toBe(true);
		expect(matchesFilter("c/X", ["a", "b"])).toBe(false);
	});

	it("lets an exclusion beat every inclusion", () => {
		expect(matchesFilter("a/legacy/X", ["a", "!a/legacy"])).toBe(false);
		expect(matchesFilter("a/current/X", ["a", "!a/legacy"])).toBe(true);
	});

	it("treats a list of only exclusions as allow-everything-else", () => {
		expect(matchesFilter("a/X", ["!b"])).toBe(true);
		expect(matchesFilter("b/X", ["!b"])).toBe(false);
	});

	it("applies segment boundaries and globs inside a list", () => {
		expect(matchesFilter("components/formsy/X", ["components/forms"])).toBe(false);
		expect(matchesFilter("components/formsy/X", ["components/**"])).toBe(true);
	});

	it("treats an empty list as no filter at all", () => {
		// There is no inclusion to fail, so nothing is scoped out.
		expect(matchesFilter("a", [])).toBe(true);
	});
});

describe("predicate", () => {
	it("is called with the display path", () => {
		const seen: string[] = [];
		const result = matchesFilter("components/Button", (p) => {
			seen.push(p);
			return p.endsWith("Button");
		});
		expect(result).toBe(true);
		expect(seen).toEqual(["components/Button"]);
	});
});

describe("undefined filter", () => {
	it("matches everything", () => {
		expect(matchesFilter("anything/at/all", undefined)).toBe(true);
	});
});

describe("caseSensitive", () => {
	it("is case-sensitive by default", () => {
		expect(matchesFilter("Components/Button", "components")).toBe(false);
		expect(matchesFilter("Components/Button", "components/*")).toBe(false);
	});

	it("folds case when asked", () => {
		expect(matchesFilter("Components/Button", "components", false)).toBe(true);
		expect(matchesFilter("Components/Button", "components/*", false)).toBe(true);
		expect(matchesFilter("Components/Formsy/X", "components/forms", false)).toBe(false);
	});
});

describe("globToRegExp", () => {
	it("escapes regex metacharacters in literal text", () => {
		expect(globToRegExp("a.b").test("a.b")).toBe(true);
		expect(globToRegExp("a.b").test("axb")).toBe(false);
		expect(globToRegExp("a+b(c)").test("a+b(c)")).toBe(true);
	});

	it("anchors both ends", () => {
		expect(globToRegExp("Button").test("MyButton")).toBe(false);
		expect(globToRegExp("Button").test("Buttons")).toBe(false);
	});

	it("is the same matcher discovery uses, so the two cannot drift", () => {
		// §3.6 — one implementation, shared by the glob filter and the scan.
		const re = globToRegExp("**/*.fixture");
		expect(re.test("a/b/Thing.fixture")).toBe(true);
		expect(re.test("Thing.fixture")).toBe(true);
	});
});
