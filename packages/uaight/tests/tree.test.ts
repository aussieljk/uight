/**
 * Tree construction and search. SPEC.md §3.4, §3.5, §3.6, §19.3, §20.1.
 *
 * `TreeNode` is stable; its production is not (§19.7). What is tested here is
 * therefore the shape a consumer can rely on — keys, kinds, ordering, and the
 * progressive-disclosure marker for a file whose names could not be decided.
 */

import { describe, expect, it } from "vitest";

import { serializeFixtureId } from "../src/shared/fixture-id.ts";
import { buildTree, flattenSelectable, searchTree } from "../src/shared/tree.ts";
import { ALL_FIXTURES } from "../src/shared/types.ts";
import type { FixtureFileIndex, InventoryItem, TreeNode } from "../src/shared/types.ts";

function file(
	path: string,
	names: string[] | null,
	extra: Partial<FixtureFileIndex> = {},
): FixtureFileIndex {
	return {
		path,
		globPath: `/src/${path}.fixture.tsx`,
		names,
		hash: "h",
		...extra,
	};
}

/**
 * §3.4's table encodes a single-fixture file as `names: [null]`, which the
 * published `string[]` type cannot express. The cast is deliberate and is the
 * reason NOTES.md records the divergence.
 */
const SINGLE = [null] as unknown as string[];

function component(path: string, name: string): InventoryItem {
	return {
		path,
		globPath: `/src/${path}.tsx`,
		name,
		exportName: name,
		kind: "function",
	};
}

function keys(nodes: readonly TreeNode[]): string[] {
	return nodes.map((n) => n.key);
}

describe("buildTree", () => {
	it("nests by directory and sorts directories before files", () => {
		const nodes = buildTree({
			files: [file("Root", SINGLE), file("components/Button", SINGLE)],
		});
		expect(keys(nodes)).toEqual(["dir:components", serializeFixtureId({ path: "Root", name: null })]);
		expect(nodes[0]!.kind).toBe("dir");
		expect(nodes[0]!.label).toBe("components");
	});

	it("sorts naturally, so Item10 follows Item9", () => {
		const nodes = buildTree({
			files: [file("Item10", SINGLE), file("Item9", SINGLE), file("Item1", SINGLE)],
		});
		expect(nodes.map((n) => n.label)).toEqual(["Item1", "Item9", "Item10"]);
	});

	it("gives a single-fixture file one selectable leaf", () => {
		const nodes = buildTree({ files: [file("Button", SINGLE)] });
		expect(nodes).toHaveLength(1);
		expect(nodes[0]!.kind).toBe("fixture");
		expect(nodes[0]!.fixture).toEqual({ path: "Button", name: null });
		expect(nodes[0]!.key).toBe(serializeFixtureId({ path: "Button", name: null }));
	});

	it("expands a multi-fixture file into named children", () => {
		const nodes = buildTree({ files: [file("Button", ["Primary", "Secondary"])] });
		expect(nodes[0]!.kind).toBe("file");
		expect(nodes[0]!.children).toHaveLength(2);
		expect(nodes[0]!.children!.map((c) => c.label)).toEqual(["Primary", "Secondary"]);
		expect(nodes[0]!.children![0]!.fixture).toEqual({ path: "Button", name: "Primary" });
	});

	it("labels the empty-string key rather than rendering a blank row", () => {
		// §3.2: `name: ''` is a legal multi-fixture key and must stay visible.
		const nodes = buildTree({ files: [file("Button", ["", "Other"])] });
		expect(nodes[0]!.children!.map((c) => c.label)).toEqual(["(empty name)", "Other"]);
		expect(nodes[0]!.children![0]!.fixture).toEqual({ path: "Button", name: "" });
	});

	it("collapses a file with exactly one named fixture", () => {
		const nodes = buildTree({ files: [file("Button", ["Primary"])] });
		expect(nodes).toHaveLength(1);
		expect(nodes[0]!.kind).toBe("fixture");
		expect(nodes[0]!.label).toBe("Button / Primary");
		expect(nodes[0]!.fixture).toEqual({ path: "Button", name: "Primary" });
	});

	it("marks an undecidable file and still lets it be selected (§3.5)", () => {
		const nodes = buildTree({ files: [file("Dynamic", null)] });
		expect(nodes[0]!.kind).toBe("file");
		expect(nodes[0]!.undecidable).toBe(true);
		// Selecting it renders the first fixture; it does not auto-select a child.
		expect(nodes[0]!.fixture).toEqual({ path: "Dynamic", name: null });
		expect(nodes[0]!.children).toBeUndefined();
	});

	it("places inventory components after files in the same directory (§12)", () => {
		const nodes = buildTree({
			files: [file("components/Button", SINGLE)],
			inventory: [component("components/Card", "Card")],
		});
		const dir = nodes[0]!;
		expect(dir.kind).toBe("dir");
		expect(dir.children!.map((c) => c.kind)).toEqual(["fixture", "component"]);
		expect(dir.children![1]!.key).toBe("component:/src/components/Card.tsx#Card");
	});

	it("scopes the tree by filter, on segment boundaries (§3.6)", () => {
		const files = [
			file("components/forms/Input", SINGLE),
			file("components/formsy/Legacy", SINGLE),
		];
		const nodes = buildTree({ files, filter: "components/forms" });
		const flat = flattenSelectable(nodes);
		expect(flat.map((n) => n.fixture!.path)).toEqual(["components/forms/Input"]);
	});

	it("filters inventory by the same rule", () => {
		const nodes = buildTree({
			files: [],
			inventory: [component("a/Keep", "Keep"), component("b/Drop", "Drop")],
			filter: "a",
		});
		expect(flattenSelectable(nodes).map((n) => n.label)).toEqual(["Keep"]);
	});

	it("drops a directory that filtering emptied", () => {
		const nodes = buildTree({
			files: [file("a/X", SINGLE), file("b/Y", SINGLE)],
			filter: "a",
		});
		expect(keys(nodes)).toEqual(["dir:a"]);
	});

	it("honours caseSensitive", () => {
		const files = [file("Components/Button", SINGLE)];
		expect(buildTree({ files, filter: "components" })).toHaveLength(0);
		expect(buildTree({ files, filter: "components", caseSensitive: false })).toHaveLength(1);
	});
});

describe("flattenSelectable", () => {
	it("is depth-first and includes only selectable nodes", () => {
		// A multi-fixture file is itself selectable: it renders every fixture in
		// the file as one page (ALL_FIXTURES), so it precedes its own children.
		const nodes = buildTree({
			files: [
				file("a/Multi", ["One", "Two"]),
				file("a/Single", SINGLE),
				file("Undecidable", null),
			],
			inventory: [component("Detected", "Detected")],
		});
		expect(flattenSelectable(nodes).map((n) => n.label)).toEqual([
			"Multi",
			"One",
			"Two",
			"Single",
			"Undecidable",
			"Detected",
		]);
	});

	it("skips directory nodes", () => {
		const nodes = buildTree({ files: [file("a/b/C", SINGLE)] });
		const flat = flattenSelectable(nodes);
		expect(flat).toHaveLength(1);
		expect(flat[0]!.kind).toBe("fixture");
	});
});

describe("a directory and a same-named file collapse into one node", () => {
	it("collapses components/accordion/accordion into one row", () => {
		const nodes = buildTree({
			files: [file("components/accordion/accordion", ["Single", "Multiple"])],
		});
		// One "accordion", not a directory containing a file of the same name.
		expect(nodes).toHaveLength(1);
		const dir = nodes[0]!;
		expect(dir.label).toBe("components");
		const accordion = dir.children![0]!;
		expect(accordion.label).toBe("accordion");
		expect(accordion.kind).toBe("file");
		expect(accordion.children!.map((c) => c.label)).toEqual(["Single", "Multiple"]);
		// Selecting it renders every fixture in the file as one page.
		expect(accordion.fixture).toEqual({
			path: "components/accordion/accordion",
			name: ALL_FIXTURES,
		});
	});

	it("collapses a self-titled file with a single story too", () => {
		// components/quote/quote.stories.tsx exporting only `Default` was showing
		// "quote" and then "quote / Default" beneath it.
		const nodes = buildTree({ files: [file("components/quote/quote", ["Default"])] });
		const quote = nodes[0]!.children![0]!;
		expect(quote.label).toBe("quote");
		expect(quote.kind).toBe("fixture");
		expect(quote.fixture).toEqual({ path: "components/quote/quote", name: "Default" });
	});

	it("keeps the file name when the file is not self-titled", () => {
		const nodes = buildTree({ files: [file("forms/Input", ["Primary"])] });
		const leaf = nodes[0]!.children![0]!;
		expect(leaf.label).toBe("Input / Primary");
	});

	it("does not collapse when the names differ", () => {
		const nodes = buildTree({ files: [file("components/accordion/panel", ["A", "B"])] });
		const accordionDir = nodes[0]!.children![0]!;
		expect(accordionDir.kind).toBe("dir");
		expect(accordionDir.label).toBe("accordion");
		expect(accordionDir.children![0]!.label).toBe("panel");
	});

	it("does not collapse when the directory holds more than one file", () => {
		const nodes = buildTree({
			files: [
				file("components/accordion/accordion", ["A"]),
				file("components/accordion/other", ["B"]),
			],
		});
		const accordionDir = nodes[0]!.children![0]!;
		expect(accordionDir.kind).toBe("dir");
		expect(accordionDir.children).toHaveLength(2);
	});
});

describe("searchTree", () => {
	const nodes = buildTree({
		files: [
			file("components/Button", ["Primary", "Secondary"]),
			file("components/Card", SINGLE),
			file("forms/Input", SINGLE),
		],
	});

	it("returns everything for an empty query", () => {
		expect(searchTree(nodes, "")).toBe(nodes);
		expect(searchTree(nodes, "   ")).toBe(nodes);
	});

	it("is case-insensitive and matches labels", () => {
		const hit = searchTree(nodes, "primary");
		// The file survives as the match's container and is selectable in its own
		// right, so it is listed alongside the fixture that matched.
		expect(flattenSelectable(hit).map((n) => n.label)).toEqual(["Button", "Primary"]);
	});

	it("matches the full path, not only the leaf label", () => {
		const hit = searchTree(nodes, "forms/");
		expect(flattenSelectable(hit).map((n) => n.fixture!.path)).toEqual(["forms/Input"]);
	});

	it("keeps ancestors of a match so the path stays navigable", () => {
		const hit = searchTree(nodes, "Card");
		expect(hit).toHaveLength(1);
		expect(hit[0]!.kind).toBe("dir");
		expect(hit[0]!.label).toBe("components");
	});

	it("returns nothing when nothing matches", () => {
		expect(searchTree(nodes, "zzz-nothing")).toEqual([]);
	});
});
