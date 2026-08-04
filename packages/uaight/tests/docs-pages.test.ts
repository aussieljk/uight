/**
 * MDX documentation pages. SPEC.md §14.
 *
 * A page is a fixture in every mechanical sense — globbed, indexed, selected
 * and rendered by the same machinery — and the whole design bet is that it
 * needs no second pipeline. So these tests are mostly about the two places the
 * difference *does* show: the suffix that gets stripped from the display path,
 * and the flag the tree reads to say "Doc" rather than nothing.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTree } from "../src/shared/tree.ts";
import { resolveUaightConfig } from "../src/vite/config.ts";
import { checkMdxSupport } from "../src/vite/mdx.ts";
import { docsPatterns, fixtureGlobPatterns, isFixtureFile, scanFixtures } from "../src/vite/scan.ts";

let root: string;

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), "uaight-docs-"));
	mkdirSync(path.join(root, "src"), { recursive: true });
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

function write(relative: string, source: string): void {
	const file = path.join(root, relative);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, source);
}

const PAGE = "# Getting started\n\nProse, not a component.\n";

function config(options: Record<string, unknown> = {}) {
	return resolveUaightConfig({ root, options, command: "serve" });
}

describe("docs pages", () => {
	it("are globbed by default, as MDX only", () => {
		expect(docsPatterns(config())).toEqual(["**/*.docs.mdx"]);
		expect(fixtureGlobPatterns(config()).join(" ")).toContain("docs.mdx");
	});

	it("index as one page, with the .docs suffix stripped from the display path", async () => {
		write("src/guide.docs.mdx", PAGE);
		const index = await scanFixtures(config());

		expect(index.files).toHaveLength(1);
		expect(index.files[0]?.path).toBe("guide");
		expect(index.files[0]?.docsPage).toBe(true);
		// §14's one-fixture rule, unchanged: the module's default export.
		expect(index.files[0]?.names).toEqual([null]);
	});

	it("does not flag ordinary fixtures as pages", async () => {
		write("src/Button.fixture.tsx", "export default <button />;\n");
		const index = await scanFixtures(config());
		expect(index.files[0]?.docsPage).toBeUndefined();
	});

	it("carries the flag into the tree, so a row can say what it is", async () => {
		write("src/guide.docs.mdx", PAGE);
		write("src/Button.fixture.tsx", "export default <button />;\n");
		const index = await scanFixtures(config());

		const nodes = buildTree({ files: index.files });
		const page = nodes.find((n) => n.label === "guide");
		const button = nodes.find((n) => n.label === "Button");

		expect(page?.docsPage).toBe(true);
		expect(button?.docsPage).toBeUndefined();
	});

	it("is watched like any other indexed file", () => {
		expect(isFixtureFile(path.join(root, "src/guide.docs.mdx"), config())).toBe(true);
	});

	it("honours a custom suffix", async () => {
		write("src/guide.page.mdx", PAGE);
		const index = await scanFixtures(config({ docs: { fileSuffix: "page" } }));
		expect(index.files[0]?.path).toBe("guide");
		expect(index.files[0]?.docsPage).toBe(true);
	});

	it("can be turned off, and then the file is not indexed at all", async () => {
		write("src/guide.docs.mdx", PAGE);
		const index = await scanFixtures(config({ docs: false }));
		expect(index.files).toHaveLength(0);
		expect(docsPatterns(config({ docs: false }))).toEqual([]);
	});

	it("names pages rather than fixtures when the MDX plugin is missing", async () => {
		write("src/guide.docs.mdx", PAGE);
		const index = await scanFixtures(config());

		const advice = checkMdxSupport([], index);

		expect(advice?.message).toContain("MDX documentation page");
		expect(advice?.message).not.toContain("MDX fixture");
	});

	it("says both when a project has both", async () => {
		write("src/guide.docs.mdx", PAGE);
		write("src/notes.fixture.mdx", PAGE);
		const index = await scanFixtures(config());

		const advice = checkMdxSupport([], index);

		expect(advice?.message).toContain("1 fixture");
		expect(advice?.message).toContain("1 docs page");
	});

	it("says nothing once an MDX plugin is present", async () => {
		write("src/guide.docs.mdx", PAGE);
		const index = await scanFixtures(config());
		expect(checkMdxSupport(["@mdx-js/rollup"], index)).toBeNull();
	});
});
