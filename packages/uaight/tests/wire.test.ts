/**
 * Wire helpers: path rejection, patch application, structural sharing.
 * SPEC.md §7.2, §7.3, §7.4, §20.1.
 *
 * Two properties are the whole reason this module exists separately from the
 * serializer. First, `__proto__` / `constructor` / `prototype` are rejected at
 * the transport boundary, *before* application — not sanitised afterwards.
 * Second, application is immutable with structural sharing, because §7.2's
 * overlay model only survives HMR if the renderer's fresh default is never
 * mutated.
 */

import { describe, expect, it } from "vitest";

import {
	applyPatches,
	isEditableWire,
	isSafePath,
	mergePatch,
	pathKey,
	wireAt,
	wireEqual,
	wireSet,
} from "../src/shared/wire.ts";
import type { EditableWire, Patch, Wire } from "../src/shared/types.ts";

// `EditableWire` so these double as patch values; every one is also a `Wire`.
const prim = (v: string | number | boolean | null): EditableWire => ({ t: "prim", v });
const obj = (entries: Array<[string, Wire]>): EditableWire => ({
	t: "object",
	v: entries,
});
const arr = (items: Wire[]): EditableWire => ({ t: "array", v: items });

/** { a: { b: 1, c: 2 }, list: [10, 20] } */
function sample(): Wire {
	return obj([
		[
			"a",
			obj([
				["b", prim(1)],
				["c", prim(2)],
			]),
		],
		["list", arr([prim(10), prim(20)])],
	]);
}

/* ------------------------------------------------------------------ *
 * §7.3 — path rejection
 * ------------------------------------------------------------------ */

describe("isSafePath", () => {
	it("rejects the prototype-pollution keys outright", () => {
		expect(isSafePath(["__proto__"])).toBe(false);
		expect(isSafePath(["constructor"])).toBe(false);
		expect(isSafePath(["prototype"])).toBe(false);
	});

	it("rejects them at any depth, not only at the root", () => {
		expect(isSafePath(["a", "b", "__proto__"])).toBe(false);
		expect(isSafePath(["a", "constructor", "b"])).toBe(false);
		expect(isSafePath([0, "prototype"])).toBe(false);
	});

	it("accepts ordinary keys and non-negative integer indices", () => {
		expect(isSafePath([])).toBe(true);
		expect(isSafePath(["a", "b"])).toBe(true);
		expect(isSafePath(["list", 0])).toBe(true);
		expect(isSafePath(["proto", "constructors", "__proto"])).toBe(true);
	});

	it("rejects an index that is not a non-negative integer", () => {
		expect(isSafePath([-1])).toBe(false);
		expect(isSafePath([1.5])).toBe(false);
		expect(isSafePath([Number.NaN])).toBe(false);
	});
});

describe("isEditableWire", () => {
	it("excludes opaque, which never travels in a patch (§7.2)", () => {
		expect(isEditableWire({ t: "opaque", id: 1, label: "fn" })).toBe(false);
		expect(isEditableWire(prim("x"))).toBe(true);
		expect(isEditableWire({ t: "undef" })).toBe(true);
		expect(isEditableWire({ t: "codec", codec: "date", v: "2026-01-01" })).toBe(true);
	});
});

describe("pathKey", () => {
	it("distinguishes a numeric index from a string key", () => {
		expect(pathKey(["a", 0, "b"])).toBe(".a[0].b");
		expect(pathKey(["a", "0", "b"])).toBe(".a.0.b");
		expect(pathKey([])).toBe("");
	});
});

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

describe("wireAt", () => {
	const root = sample();

	it("reads through objects and arrays", () => {
		expect(wireAt(root, ["a", "b"])).toEqual(prim(1));
		expect(wireAt(root, ["list", 1])).toEqual(prim(20));
		expect(wireAt(root, [])).toBe(root);
	});

	it("returns undefined rather than throwing for an absent path", () => {
		expect(wireAt(root, ["missing"])).toBeUndefined();
		expect(wireAt(root, ["a", "b", "deeper"])).toBeUndefined();
		expect(wireAt(root, ["list", 5])).toBeUndefined();
		expect(wireAt(root, ["list", -1])).toBeUndefined();
	});

	it("refuses a segment of the wrong kind", () => {
		expect(wireAt(root, ["list", "0"])).toBeUndefined();
		expect(wireAt(root, ["a", 0])).toBeUndefined();
	});
});

/* ------------------------------------------------------------------ *
 * §7.2 step 4 — immutable application with structural sharing
 * ------------------------------------------------------------------ */

describe("wireSet", () => {
	it("replaces the whole value at the root path", () => {
		expect(wireSet(sample(), [], prim("replaced"))).toEqual(prim("replaced"));
	});

	it("returns a new tree and leaves the original untouched", () => {
		const root = sample();
		const before = structuredClone(root);
		const next = wireSet(root, ["a", "b"], prim(99));
		expect(next).not.toBe(root);
		expect(root).toEqual(before);
		expect(wireAt(next!, ["a", "b"])).toEqual(prim(99));
	});

	it("shares structure: only nodes on the changed path are new", () => {
		const root = sample() as Extract<Wire, { t: "object" }>;
		const next = wireSet(root, ["a", "b"], prim(99)) as Extract<Wire, { t: "object" }>;

		// `list` was not touched, so it is the very same node.
		expect(next.v[1]![1]).toBe(root.v[1]![1]);
		// `a` is on the path, so it is rebuilt.
		expect(next.v[0]![1]).not.toBe(root.v[0]![1]);
		// …but `a.c`, a sibling of the change, is not.
		const a = root.v[0]![1] as Extract<Wire, { t: "object" }>;
		const a2 = next.v[0]![1] as Extract<Wire, { t: "object" }>;
		expect(a2.v[1]![1]).toBe(a.v[1]![1]);
	});

	it("shares untouched array elements", () => {
		const root = arr([obj([["x", prim(1)]]), obj([["y", prim(2)]])]) as Extract<
			Wire,
			{ t: "array" }
		>;
		const next = wireSet(root, [0, "x"], prim(9)) as Extract<Wire, { t: "array" }>;
		expect(next.v[1]).toBe(root.v[1]);
		expect(next.v[0]).not.toBe(root.v[0]);
	});

	it("preserves object key order", () => {
		const root = sample();
		const next = wireSet(root, ["a", "c"], prim(0)) as Extract<Wire, { t: "object" }>;
		const a = next.v[0]![1] as Extract<Wire, { t: "object" }>;
		expect(a.v.map(([k]) => k)).toEqual(["b", "c"]);
	});

	it("returns null when the path is not present in the current shape", () => {
		const root = sample();
		expect(wireSet(root, ["missing"], prim(1))).toBeNull();
		expect(wireSet(root, ["a", "b", "deeper"], prim(1))).toBeNull();
		expect(wireSet(root, ["list", 5], prim(1))).toBeNull();
		expect(wireSet(root, ["list", "0"], prim(1))).toBeNull();
		expect(wireSet(root, ["a", 0], prim(1))).toBeNull();
	});
});

/* ------------------------------------------------------------------ *
 * §7.3 — patch dropping
 * ------------------------------------------------------------------ */

describe("applyPatches", () => {
	it("applies patches in order and counts none dropped", () => {
		const { wire, dropped } = applyPatches(sample(), [
			{ path: ["a", "b"], value: prim(11) },
			{ path: ["list", 0], value: prim(100) },
		]);
		expect(dropped).toBe(0);
		expect(wireAt(wire, ["a", "b"])).toEqual(prim(11));
		expect(wireAt(wire, ["list", 0])).toEqual(prim(100));
	});

	it("drops a patch whose path is not present in the new shape", () => {
		const { wire, dropped } = applyPatches(sample(), [
			{ path: ["gone"], value: prim(1) },
			{ path: ["a", "b"], value: prim(2) },
		]);
		expect(dropped).toBe(1);
		expect(wireAt(wire, ["a", "b"])).toEqual(prim(2));
	});

	it("drops out-of-range indices when an array shrinks", () => {
		const shrunk = obj([["list", arr([prim(10)])]]);
		const { dropped } = applyPatches(shrunk, [
			{ path: ["list", 0], value: prim(1) },
			{ path: ["list", 1], value: prim(2) },
			{ path: ["list", 2], value: prim(3) },
		]);
		expect(dropped).toBe(2);
	});

	it("drops an unsafe path before applying it", () => {
		const base = sample();
		const { wire, dropped } = applyPatches(base, [
			{ path: ["__proto__", "polluted"], value: prim(true) },
			{ path: ["constructor"], value: prim(true) },
		]);
		expect(dropped).toBe(2);
		expect(wire).toBe(base);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});

	it("never mutates the base", () => {
		const base = sample();
		const before = structuredClone(base);
		applyPatches(base, [{ path: ["a", "b"], value: prim(42) }]);
		expect(base).toEqual(before);
	});

	it("returns the base unchanged for an empty patch list", () => {
		const base = sample();
		expect(applyPatches(base, []).wire).toBe(base);
	});
});

/* ------------------------------------------------------------------ *
 * Overlay bookkeeping
 * ------------------------------------------------------------------ */

describe("mergePatch", () => {
	it("replaces a patch at the same path", () => {
		const existing: Patch[] = [{ path: ["a"], value: prim(1) }];
		const merged = mergePatch(existing, { path: ["a"], value: prim(2) });
		expect(merged).toHaveLength(1);
		expect(merged[0]!.value).toEqual(prim(2));
	});

	it("discards patches beneath the new one, whose subtree it now owns", () => {
		const existing: Patch[] = [
			{ path: ["a", "b"], value: prim(1) },
			{ path: ["a", 0], value: prim(2) },
			{ path: ["other"], value: prim(3) },
		];
		const merged = mergePatch(existing, { path: ["a"], value: prim(9) });
		expect(merged.map((p) => pathKey(p.path))).toEqual([".other", ".a"]);
	});

	it("keeps a deeper patch after a shallower one, so it applies last", () => {
		const existing: Patch[] = [{ path: ["a"], value: obj([["b", prim(1)]]) }];
		const merged = mergePatch(existing, { path: ["a", "b"], value: prim(2) });
		expect(merged.map((p) => pathKey(p.path))).toEqual([".a", ".a.b"]);
		const { wire } = applyPatches(sample(), merged);
		expect(wireAt(wire, ["a", "b"])).toEqual(prim(2));
	});

	it("lets a root patch supersede everything (§7.3, the fixture's own setter)", () => {
		const existing: Patch[] = [
			{ path: ["a", "b"], value: prim(1) },
			{ path: ["list"], value: prim(2) },
		];
		const merged = mergePatch(existing, { path: [], value: prim("all of it") });
		expect(merged).toEqual([{ path: [], value: prim("all of it") }]);
	});

	it("does not confuse a sibling that shares a prefix", () => {
		const existing: Patch[] = [{ path: ["ab"], value: prim(1) }];
		const merged = mergePatch(existing, { path: ["a"], value: prim(2) });
		expect(merged.map((p) => pathKey(p.path))).toEqual([".ab", ".a"]);
	});
});

describe("wireEqual", () => {
	it("compares structurally", () => {
		expect(wireEqual(sample(), sample())).toBe(true);
		expect(wireEqual(prim(1), prim("1"))).toBe(false);
		expect(wireEqual({ t: "undef" }, { t: "undef" })).toBe(true);
		expect(wireEqual({ t: "bigint", v: "1" }, { t: "bigint", v: "2" })).toBe(false);
	});

	it("treats key order as significant, because the wire preserves it (§7.4)", () => {
		const a = obj([
			["x", prim(1)],
			["y", prim(2)],
		]);
		const b = obj([
			["y", prim(2)],
			["x", prim(1)],
		]);
		expect(wireEqual(a, b)).toBe(false);
	});

	it("compares codec payloads and opaque labels", () => {
		expect(
			wireEqual(
				{ t: "codec", codec: "date", v: "2026-01-01" },
				{ t: "codec", codec: "date", v: "2026-01-01" },
			),
		).toBe(true);
		expect(
			wireEqual(
				{ t: "codec", codec: "date", v: "2026-01-01" },
				{ t: "codec", codec: "url", v: "2026-01-01" },
			),
		).toBe(false);
		// Opaque ids are per-revision, so only the label can be compared.
		expect(
			wireEqual({ t: "opaque", id: 1, label: "fn" }, { t: "opaque", id: 7, label: "fn" }),
		).toBe(true);
	});

	it("detects a length change", () => {
		expect(wireEqual(arr([prim(1)]), arr([prim(1), prim(2)]))).toBe(false);
	});
});
