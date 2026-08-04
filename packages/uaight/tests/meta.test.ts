/**
 * Fixture metadata on the index — SPEC.md §3.1, §20.1.
 *
 * `fileMeta` and `fixtureMeta` are named exports the static index used never to
 * see, so the viewport always started at Fit. They now ride on
 * `FixtureFileIndex` because the answer is needed before the first paint, and
 * under `index: "static"` no module is ever executed to send a message from.
 *
 * One rule decides which wins, and it is asserted here rather than in each of
 * the three consumers that ask.
 */

import { describe, expect, it } from "vitest";

import { fixtureMetaFor, viewportFor } from "../src/shared/meta.ts";
import { buildTree } from "../src/shared/tree.ts";
import { ALL_FIXTURES, DEFAULT_FIXTURE } from "../src/shared/types.ts";
import type { FixtureFileIndex } from "../src/shared/types.ts";

const file = (over: Partial<FixtureFileIndex> = {}): FixtureFileIndex => ({
	path: "components/Button",
	globPath: "/src/components/Button.fixture.tsx",
	names: ["Primary", "Disabled"],
	hash: "h",
	...over,
});

describe("fixtureMetaFor", () => {
	it("keys a single-fixture file by DEFAULT_FIXTURE, exactly as §3.1 documents", () => {
		const f = file({
			names: [null],
			fixtureMeta: { [DEFAULT_FIXTURE]: { title: "The one" } },
		});
		expect(fixtureMetaFor(f, null)?.title).toBe("The one");
	});

	it("has nothing for the whole-file selection, which is not one fixture", () => {
		const f = file({ fixtureMeta: { [ALL_FIXTURES]: { title: "impossible" } } });
		expect(fixtureMetaFor(f, ALL_FIXTURES)).toBeUndefined();
	});

	it("is absent when the parser could not read the exports", () => {
		expect(fixtureMetaFor(file(), "Primary")).toBeUndefined();
	});
});

describe("viewportFor", () => {
	const f = file({
		fileMeta: { viewport: { width: 1024, height: 768 } },
		fixtureMeta: { Disabled: { viewport: { width: 375, height: 667 } } },
	});

	it("prefers the fixture's own viewport over the file's", () => {
		expect(viewportFor(f, "Disabled")).toEqual({ width: 375, height: 667 });
	});

	it("falls back to the file's", () => {
		expect(viewportFor(f, "Primary")).toEqual({ width: 1024, height: 768 });
	});

	it("is undefined when neither declares one, which is Fit", () => {
		expect(viewportFor(file(), "Primary")).toBeUndefined();
	});
});

describe("buildTree", () => {
	it("carries per-fixture meta onto the node, so the tree needs no second lookup", () => {
		const nodes = buildTree({
			files: [file({ fixtureMeta: { Primary: { title: "Primary button" } } })],
		});
		const fixtures: Array<{ label: string; meta?: { title?: string } }> = [];
		const walk = (list: typeof nodes): void => {
			for (const node of list) {
				if (node.kind === "fixture") fixtures.push(node);
				if (node.children) walk(node.children);
			}
		};
		walk(nodes);
		expect(fixtures.find((n) => n.label === "Primary")?.meta?.title).toBe("Primary button");
		expect(fixtures.find((n) => n.label === "Disabled")?.meta).toBeUndefined();
	});
});
