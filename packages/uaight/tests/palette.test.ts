/**
 * The command palette's contents and ranking.
 *
 * The palette is the entry point for a corpus the tree cannot show at once
 * (the demo has 589 fixtures), so the ranking is the feature: an exact
 * substring has to beat a scattered subsequence, and a label has to beat a path.
 */

import { describe, expect, it } from "vitest";

import { buildPaletteItems, matchScore, rankPaletteItems } from "../src/ui/palette.ts";
import type { CallSiteGroup, InventoryItem, TreeNode } from "../src/shared/types.ts";

const nodes: TreeNode[] = [
	{
		key: "dir:forms",
		label: "forms",
		kind: "dir",
		children: [
			{
				key: "uaight:1|forms%2FInput",
				label: "Input",
				kind: "fixture",
				fixture: { path: "forms/Input", name: null },
			},
			{
				key: "forms/Select",
				label: "Select",
				kind: "file",
				fixture: { path: "forms/Select", name: "\0all" },
				children: [
					{
						key: "uaight:1|forms%2FSelect|Default",
						label: "Default",
						kind: "fixture",
						fixture: { path: "forms/Select", name: "Default" },
					},
				],
			},
		],
	},
];

const inventory: InventoryItem[] = [
	{
		path: "components/Button",
		globPath: "/src/components/Button.tsx",
		name: "Button",
		exportName: "Button",
		kind: "function",
	},
];

const callSites: CallSiteGroup[] = [
	{
		component: "Button",
		total: 4,
		sites: [
			{
				component: "Button",
				props: { variant: "primary" },
				path: "pages/Checkout",
				globPath: "/src/pages/Checkout.tsx",
				line: 42,
				column: 5,
				dynamic: [],
			},
		],
	},
];

describe("contents", () => {
	it("includes fixtures, files, components and call sites", () => {
		const items = buildPaletteItems({ nodes, inventory, callSites });
		const kinds = items.map((item) => item.kind);

		expect(kinds).toContain("fixture");
		expect(kinds).toContain("component");
		expect(kinds).toContain("call-site");
	});

	it("reaches a fixture nested inside a file node", () => {
		const items = buildPaletteItems({ nodes, inventory, callSites });

		expect(items.some((item) => item.fixture?.name === "Default")).toBe(true);
	});

	it("labels a call site with what makes it distinct, and where it is", () => {
		const items = buildPaletteItems({ nodes, inventory, callSites });
		const site = items.find((item) => item.kind === "call-site");

		expect(site?.label).toBe("Button — variant");
		expect(site?.hint).toBe("Checkout:42");
	});

	it("drops call sites for a component that is not in the inventory", () => {
		const items = buildPaletteItems({ nodes, inventory: [], callSites });

		expect(items.some((item) => item.kind === "call-site")).toBe(false);
	});
});

describe("matching", () => {
	it("scores an exact substring above a scattered subsequence", () => {
		const exact = matchScore("Button", "utt");
		const scattered = matchScore("BackUnitTest", "utt");

		expect(exact).not.toBeNull();
		expect(scattered).not.toBeNull();
		expect(exact!).toBeGreaterThan(scattered!);
	});

	it("rewards a match at a word boundary", () => {
		const boundary = matchScore("forms/select", "select");
		const middle = matchScore("preselected", "select");

		expect(boundary!).toBeGreaterThan(middle!);
	});

	it("returns null when the query is not a subsequence", () => {
		expect(matchScore("Button", "zzz")).toBeNull();
	});

	it("matches an empty query", () => {
		expect(matchScore("Button", "")).toBe(0);
	});
});

describe("ranking", () => {
	const items = buildPaletteItems({ nodes, inventory, callSites });

	it("puts a label match ahead of a path match", () => {
		const ranked = rankPaletteItems(items, "Button");

		expect(ranked[0]?.label).toBe("Button");
	});

	it("finds a fixture by its directory", () => {
		const ranked = rankPaletteItems(items, "forms");

		expect(ranked.length).toBeGreaterThan(0);
		expect(ranked.every((item) => item.hint?.startsWith("forms"))).toBe(true);
	});

	it("returns everything, fixtures first, for an empty query", () => {
		const ranked = rankPaletteItems(items, "");

		expect(ranked).toHaveLength(items.length);
		expect(ranked[0]?.kind).toBe("fixture");
	});

	it("respects the limit", () => {
		expect(rankPaletteItems(items, "", 2)).toHaveLength(2);
	});

	it("returns nothing when nothing matches", () => {
		expect(rankPaletteItems(items, "zzzzz")).toEqual([]);
	});
});
