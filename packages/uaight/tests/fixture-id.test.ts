/**
 * Fixture-id round-tripping. SPEC.md §3.2, §20.1.
 *
 * The two states that matter and that a naive `path:name` encoding conflates:
 * `name: null` is a single-fixture file, `name: ''` is a multi-fixture keyed by
 * the empty string. Both are legal, they are different, and the serialization
 * has to keep them apart.
 */

import { describe, expect, it } from "vitest";

import {
	fixtureIdsEqual,
	fixtureLabel,
	parseFixtureId,
	serializeFixtureId,
} from "../src/shared/fixture-id.ts";
import type { FixtureId } from "../src/shared/types.ts";

const PREFIX = "uaight:1|";

describe("serializeFixtureId", () => {
	it("emits the versioned canonical form", () => {
		expect(serializeFixtureId({ path: "Button", name: null })).toBe("uaight:1|Button");
		expect(serializeFixtureId({ path: "Button", name: "Primary" })).toBe(
			"uaight:1|Button|Primary",
		);
	});

	it("encodes both segments, so a path separator survives", () => {
		expect(serializeFixtureId({ path: "components/Button", name: null })).toBe(
			"uaight:1|components%2FButton",
		);
	});

	it("never emits the convenience form", () => {
		// §3.2: `path:name` is accepted on input only.
		const id: FixtureId = { path: "a/b", name: "c" };
		expect(serializeFixtureId(id).startsWith(PREFIX)).toBe(true);
	});
});

describe("the null / empty-string distinction", () => {
	it("null produces no third segment; '' produces an empty one", () => {
		expect(serializeFixtureId({ path: "x", name: null })).toBe("uaight:1|x");
		expect(serializeFixtureId({ path: "x", name: "" })).toBe("uaight:1|x|");
	});

	it("round-trips each back to itself", () => {
		const single: FixtureId = { path: "x", name: null };
		const empty: FixtureId = { path: "x", name: "" };
		expect(parseFixtureId(serializeFixtureId(single))).toEqual(single);
		expect(parseFixtureId(serializeFixtureId(empty))).toEqual(empty);
	});

	it("keeps them unequal", () => {
		expect(serializeFixtureId({ path: "x", name: null })).not.toBe(
			serializeFixtureId({ path: "x", name: "" }),
		);
		expect(fixtureIdsEqual({ path: "x", name: null }, { path: "x", name: "" })).toBe(false);
	});
});

describe("round-tripping", () => {
	const names: Array<string | null> = [
		null,
		"",
		"Primary",
		"Primary Disabled",
		"with|pipe",
		"with:colon",
		"with/slash",
		"with%percent",
		"with spaces and 汉字",
		"\0default",
		"0",
	];
	const paths = ["Button", "components/Button", "a b/c d", "deeply/nested/path/Thing"];

	for (const path of paths) {
		for (const name of names) {
			it(`${path} · ${name === null ? "<single>" : JSON.stringify(name)}`, () => {
				const id: FixtureId = { path, name };
				expect(parseFixtureId(serializeFixtureId(id))).toEqual(id);
			});
		}
	}
});

describe("parseFixtureId is total", () => {
	it("returns null for nullish and empty input", () => {
		expect(parseFixtureId(null)).toBeNull();
		expect(parseFixtureId(undefined)).toBeNull();
		expect(parseFixtureId("")).toBeNull();
	});

	it("rejects a missing or unknown version prefix", () => {
		// §3.2: a v2 encoding must be introducible without ambiguity, so anything
		// carrying a version we do not know is refused rather than guessed at.
		expect(parseFixtureId("uaight:2|Button")).toBeNull();
		expect(parseFixtureId("uaight:2|Button|Primary")).toBeNull();
		expect(parseFixtureId("uaight:11|Button")).toBeNull();
		expect(parseFixtureId("uaight:0|Button")).toBeNull();
	});

	it("rejects a bare pipe form, which is the canonical shape without its version", () => {
		expect(parseFixtureId("Button|Primary")).toBeNull();
	});

	it("rejects more than two canonical segments", () => {
		expect(parseFixtureId("uaight:1|a|b|c")).toBeNull();
	});

	it("rejects an empty path", () => {
		expect(parseFixtureId("uaight:1|")).toBeNull();
		expect(parseFixtureId("uaight:1||name")).toBeNull();
	});

	it("rejects malformed percent-encoding rather than throwing", () => {
		expect(parseFixtureId("uaight:1|%E0%A4%A")).toBeNull();
		expect(parseFixtureId("uaight:1|ok|%")).toBeNull();
	});
});

describe("the convenience form, input only", () => {
	it("accepts path:name and normalizes it", () => {
		expect(parseFixtureId("components/Button:Primary")).toEqual({
			path: "components/Button",
			name: "Primary",
		});
	});

	it("treats a bare path as a single fixture", () => {
		expect(parseFixtureId("components/Button")).toEqual({
			path: "components/Button",
			name: null,
		});
	});

	it("rejects a colon in the path segment", () => {
		// Only the first colon splits, so a name may contain one; a path may not.
		expect(parseFixtureId(":Primary")).toBeNull();
		expect(parseFixtureId("a:b:c")).toEqual({ path: "a", name: "b:c" });
	});

	it("reads an empty name after the colon as the empty-string key", () => {
		expect(parseFixtureId("Button:")).toEqual({ path: "Button", name: "" });
	});
});

describe("object input", () => {
	it("passes a well-formed id through", () => {
		expect(parseFixtureId({ path: "x", name: null })).toEqual({ path: "x", name: null });
		expect(parseFixtureId({ path: "x", name: "" })).toEqual({ path: "x", name: "" });
	});

	it("rejects a malformed one", () => {
		expect(parseFixtureId({ path: 1, name: null } as unknown as FixtureId)).toBeNull();
		expect(parseFixtureId({ path: "x", name: 2 } as unknown as FixtureId)).toBeNull();
	});
});

describe("fixtureIdsEqual", () => {
	it("compares both fields and handles nullish", () => {
		expect(fixtureIdsEqual({ path: "a", name: "b" }, { path: "a", name: "b" })).toBe(true);
		expect(fixtureIdsEqual({ path: "a", name: "b" }, { path: "a", name: "c" })).toBe(false);
		expect(fixtureIdsEqual(null, null)).toBe(true);
		expect(fixtureIdsEqual(null, { path: "a", name: null })).toBe(false);
		expect(fixtureIdsEqual(undefined, null)).toBe(true);
	});
});

describe("fixtureLabel", () => {
	it("is human-facing and never an identity", () => {
		expect(fixtureLabel({ path: "components/Button", name: null })).toBe("Button");
		expect(fixtureLabel({ path: "components/Button", name: "Primary" })).toBe(
			"Button / Primary",
		);
		expect(fixtureLabel({ path: "Button", name: "" })).toBe("Button / ");
	});
});
