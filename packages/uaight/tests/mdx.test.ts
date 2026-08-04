/**
 * MDX fixtures. SPEC.md §14.
 *
 * Two halves. The plugin's: `.mdx` is globbed and an MDX module is exactly one
 * fixture. The host's: a plugin that compiles it. We do the first and diagnose
 * the absence of the second — §14 rules out *inferring* the host's
 * configuration, not telling them what is missing from it.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveUaightConfig } from "../src/vite/config.ts";
import { checkMdxSupport } from "../src/vite/mdx.ts";
import { parseFixtureFile } from "../src/vite/parse.ts";
import { fixtureGlobPatterns, scanFixtures } from "../src/vite/scan.ts";
import type { FixtureIndex } from "../src/shared/types.ts";

let root: string;

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), "uaight-mdx-"));
	mkdirSync(path.join(root, "src"), { recursive: true });
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

const MDX = `import { Button } from "frosted-ui";

# Notes

<Button variant="solid">Primary</Button>
`;

describe("the plugin half", () => {
	it("globs .mdx alongside the code extensions", () => {
		const cfg = resolveUaightConfig({ root, options: {}, command: "serve" });
		expect(fixtureGlobPatterns(cfg)[0]).toContain("mdx");
	});

	it("indexes an .mdx module as exactly one fixture", async () => {
		writeFileSync(path.join(root, "src", "Notes.fixture.mdx"), MDX);
		const index = await scanFixtures(
			resolveUaightConfig({ root, options: {}, command: "serve" }),
		);

		expect(index.files).toHaveLength(1);
		expect(index.files[0]?.path).toBe("Notes");
		// `[null]` — one fixture, whose name is null because the module's default
		// export is the fixture. Prose has no named states.
		expect(index.files[0]?.names).toEqual([null]);
		expect(index.problems).toEqual([]);
	});

	it("never tries to parse MDX as JavaScript", () => {
		// It is not JavaScript, and reporting a syntax error for valid MDX would
		// put a problem on the index for a file that is perfectly fine.
		const parsed = parseFixtureFile(MDX, "/src/Notes.fixture.mdx");
		expect(parsed.errors).toEqual([]);
		expect(parsed.names).toEqual([null]);
	});
});

/* ------------------------------------------------------------------ *
 * The host half — diagnosed, never inferred
 * ------------------------------------------------------------------ */

function indexWith(globPaths: string[]): FixtureIndex {
	return {
		files: globPaths.map((globPath) => ({
			path: globPath,
			globPath,
			names: [null],
			hash: "x",
		})),
		decorators: [],
		inventory: [],
		callSites: [],
		problems: [],
	};
}

describe("checkMdxSupport", () => {
	const withMdx = indexWith(["/src/Notes.fixture.mdx"]);
	const withoutMdx = indexWith(["/src/Button.fixture.tsx"]);

	it("says nothing when the project has no MDX fixtures", () => {
		// Not everyone wants MDX. Advising a project that never asked for it
		// would be exactly the inference §14 rules out.
		expect(checkMdxSupport(["vite:react-babel", "uaight"], withoutMdx)).toBeNull();
	});

	it("says nothing when an MDX plugin is present", () => {
		expect(
			checkMdxSupport(["@mdx-js/rollup", "vite:react-babel", "uaight"], withMdx),
		).toBeNull();
	});

	it("names the plugin, the install and the example config when there is none", () => {
		const advice = checkMdxSupport(["vite:react-babel", "uaight"], withMdx);

		expect(advice?.kind).toBe("missing");
		expect(advice?.message).toContain("@mdx-js/rollup");
		expect(advice?.message).toContain("/src/Notes.fixture.mdx");
		expect(advice?.message).toContain("mdx(), react(), uaight()");
		expect(advice?.message).toContain("§14");
	});

	/*
	 * Ordering is deliberately not checked, and the reason is worth recording
	 * here as well as in the source: Vite sorts by `enforce` before array order,
	 * and `vite:react-babel` is a `pre` plugin, so a plain `mdx()` always
	 * resolves *after* it however the user wrote their array. `.mdx` compiles
	 * correctly anyway — verified against the demo. A check for the "wrong"
	 * order would fire on every correctly configured project.
	 */
	it("does not complain about an order Vite itself produced", () => {
		expect(
			checkMdxSupport(
				["vite:react-babel", "vite:react-refresh", "@mdx-js/rollup", "uaight"],
				withMdx,
			),
		).toBeNull();
	});

	it("counts the fixtures it is advising about", () => {
		const advice = checkMdxSupport(
			["uaight"],
			indexWith(["/src/A.fixture.mdx", "/src/B.fixture.mdx"]),
		);
		expect(advice?.message).toContain("2 MDX fixtures");
	});
});
