/**
 * Prop tables — the join, the ordering and the caveat (§15.2, §20.1).
 *
 * The rendering is Playwright's (§20.2). What is decidable without a browser is
 * which doc attaches to which component, what order the rows come out in, and
 * whether the limitation a table cannot legally omit actually survives.
 */

import { describe, expect, it } from "vitest";

import { findDoc, limitationNotes, sortProps } from "../src/ui/docs.ts";
import type { ComponentDoc } from "../src/shared/types.ts";

function doc(exportName: string, extra: Partial<ComponentDoc> = {}): ComponentDoc {
	return {
		name: exportName,
		exportName,
		globPath: "/src/ui/Button.tsx",
		props: [],
		limitations: ["inherited-props"],
		...extra,
	};
}

describe("joining a component to its doc", () => {
	const docs = { "/src/ui/Button.tsx": [doc("Button"), doc("IconButton")] };

	it("matches on glob path and export name", () => {
		expect(
			findDoc(docs, { globPath: "/src/ui/Button.tsx", exportName: "IconButton" })?.name,
		).toBe("IconButton");
	});

	it("renders nothing rather than the wrong table", () => {
		// A file with two exports must not fall back to "the only doc here": a
		// prop table attached to the wrong component is worse than none.
		expect(
			findDoc(docs, { globPath: "/src/ui/Button.tsx", exportName: "Card" }),
		).toBeNull();
		expect(findDoc(docs, { globPath: "/src/ui/Card.tsx", exportName: "Card" })).toBeNull();
		expect(findDoc(undefined, { globPath: "/a", exportName: "A" })).toBeNull();
		expect(findDoc(docs, null)).toBeNull();
	});
});

describe("the prop rows", () => {
	it("puts required props first, then sorts by name", () => {
		const rows = sortProps([
			{ name: "size", required: false },
			{ name: "onClick", required: true },
			{ name: "children", required: true },
			{ name: "as", required: false },
		]);
		expect(rows.map((p) => p.name)).toEqual(["children", "onClick", "as", "size"]);
	});

	it("does not mutate the doc it was given", () => {
		const props = [
			{ name: "b", required: false },
			{ name: "a", required: false },
		];
		sortProps(props);
		expect(props.map((p) => p.name)).toEqual(["b", "a"]);
	});
});

describe("the limitations a table may not drop", () => {
	it("turns every known limitation into a readable sentence", () => {
		const notes = limitationNotes(["inherited-props", "generics", "unions"]);
		expect(notes).toHaveLength(3);
		expect(notes[0]).toMatch(/inherited/i);
	});

	it("deduplicates and survives an unknown value", () => {
		expect(limitationNotes(["generics", "generics"])).toHaveLength(1);
		// An index written by a newer plugin can carry a limitation this build has
		// never heard of; it is skipped, not rendered as `undefined`.
		expect(limitationNotes(["what" as "generics", "inherited-props"])).toEqual(
			limitationNotes(["inherited-props"]),
		);
	});

	it("is empty only when the doc genuinely claims none", () => {
		expect(limitationNotes(undefined)).toEqual([]);
		expect(limitationNotes([])).toEqual([]);
		// Docgen always reports `inherited-props`, so a real doc never is.
		expect(limitationNotes(doc("Button").limitations)).toHaveLength(1);
	});
});
