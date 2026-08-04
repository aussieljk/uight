/**
 * Overlay application and patch dropping. SPEC.md §7.2, §7.3, §20.1.
 *
 * D17's model in one line: the UI owns an editable overlay, the renderer owns
 * the value. Per render the renderer produces a *fresh* default, serializes it,
 * and applies the UI's patches immutably. Everything below is a consequence:
 * opaque leaves always come from the current module, so HMR is correct by
 * construction; and a patch whose path is not in the new shape is dropped —
 * and named, so the panel can say which setting was lost — rather than forced.
 *
 * `src/runtime/**` belongs to another agent. Absent means skipped, not passed.
 */

import { describe, expect, it } from "vitest";

import type {
	EditableWire,
	FixtureCodec,
	Patch,
	PathSegment,
	Wire,
} from "../src/shared/types.ts";
import { optional, present } from "./helpers/optional.ts";

interface Serializer {
	serialize(value: unknown, revision: number, opts?: { name?: string }): Wire;
	deserialize(wire: Wire): unknown;
	tryDeserialize?(wire: Wire): { ok: boolean; value: unknown };
	resolveOpaque(id: number): unknown;
}

interface OverlayModule {
	applyOverlayToValue(
		base: unknown,
		baseWire: Wire,
		patches: readonly Patch[],
		deserialize: (wire: Wire) => { ok: boolean; value: unknown },
	): { value: unknown; dropped: PathSegment[][] };
}

interface SerializerModule {
	createSerializer(
		codecs?: FixtureCodec[],
		options?: { dev?: boolean; onWarn?: (m: string) => void },
	): Serializer;
}

const overlayMod = await optional<OverlayModule>(
	"../../src/runtime/index.ts",
	"../../src/runtime/overlay.ts",
);
const serializerMod = await optional<SerializerModule>(
	"../../src/runtime/index.ts",
	"../../src/runtime/serialize.ts",
);

const ready =
	present(overlayMod) &&
	present(serializerMod) &&
	typeof overlayMod?.applyOverlayToValue === "function";
const describeIf = ready ? describe : describe.skip;

function serializer(): Serializer {
	return serializerMod!.createSerializer([], { dev: true, onWarn: () => {} });
}

/** The §7.2 loop: fresh default in, patched value out. */
function apply(
	base: unknown,
	patches: readonly Patch[],
	revision = 1,
): { value: unknown; dropped: PathSegment[][] } {
	const s = serializer();
	const wire = s.serialize(base, revision, { name: "props" });
	const deserialize = (w: Wire): { ok: boolean; value: unknown } =>
		s.tryDeserialize ? s.tryDeserialize(w) : { ok: true, value: s.deserialize(w) };
	return overlayMod!.applyOverlayToValue(base, wire, patches, deserialize);
}

const prim = (v: string | number | boolean | null): EditableWire => ({ t: "prim", v });

describeIf("applyOverlayToValue", () => {
	it("applies a patch to the fresh default", () => {
		const { value, dropped } = apply({ label: "Hi", count: 1 }, [
			{ path: ["label"], value: prim("Edited") },
		]);
		expect(value).toEqual({ label: "Edited", count: 1 });
		expect(dropped).toHaveLength(0);
	});

	it("replaces the whole value on a root-path patch (§7.3, the fixture's own setter)", () => {
		const { value } = apply("original", [{ path: [], value: prim("set by the fixture") }]);
		expect(value).toBe("set by the fixture");
	});

	it("does not mutate the default it was given", () => {
		const base = { nested: { label: "Hi" } };
		const { value } = apply(base, [{ path: ["nested", "label"], value: prim("Edited") }]);
		expect(base.nested.label).toBe("Hi");
		expect(value).not.toBe(base);
	});

	it("shares structure: untouched branches keep their identity", () => {
		const base = { a: { keep: true }, b: { change: 1 } };
		const { value } = apply(base, [{ path: ["b", "change"], value: prim(2) }]);
		const next = value as typeof base;
		expect(next.a).toBe(base.a);
		expect(next.b).not.toBe(base.b);
		expect(next.b.change).toBe(2);
	});

	it("keeps an opaque sibling coming from the current module (§7.2)", () => {
		const onClick = (): void => {};
		const base = { onClick, label: "Hi" };
		const { value } = apply(base, [{ path: ["label"], value: prim("Edited") }]);
		expect((value as typeof base).onClick).toBe(onClick);
	});

	it("drops a patch whose path is not in the new shape, and counts it", () => {
		const { value, dropped } = apply({ label: "Hi" }, [
			{ path: ["gone"], value: prim(1) },
			{ path: ["label"], value: prim("Edited") },
		]);
		expect(dropped).toHaveLength(1);
		expect(value).toEqual({ label: "Edited" });
	});

	it("drops out-of-range index patches when an array shrinks", () => {
		const { value, dropped } = apply({ items: [1] }, [
			{ path: ["items", 0], value: prim(9) },
			{ path: ["items", 1], value: prim(9) },
		]);
		expect(dropped).toHaveLength(1);
		expect(value).toEqual({ items: [9] });
	});

	it("rejects __proto__, constructor and prototype outright (§7.3)", () => {
		const { value, dropped } = apply({ safe: 1 }, [
			{ path: ["__proto__", "polluted"], value: prim(true) },
			{ path: ["constructor", "prototype", "polluted"], value: prim(true) },
			{ path: ["prototype"], value: prim(true) },
		]);
		expect(dropped).toHaveLength(3);
		expect(value).toEqual({ safe: 1 });
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		expect(
			(Object.prototype as unknown as Record<string, unknown>).polluted,
		).toBeUndefined();
	});

	it("refuses a patch carrying an opaque value, which never travels (§7.2)", () => {
		const { dropped } = apply({ label: "Hi" }, [
			{
				path: ["label"],
				// Deliberately ill-formed: `EditableWire` excludes this by type, so
				// the only way it arrives is from a peer that should not be trusted.
				value: { t: "opaque", id: 1, label: "ƒ ()" } as unknown as Patch["value"],
			},
		]);
		expect(dropped).toHaveLength(1);
	});

	it("cannot reach inside an opaque leaf", () => {
		const { dropped } = apply({ onClick: () => {} }, [
			{ path: ["onClick", "anything"], value: prim(1) },
		]);
		expect(dropped).toHaveLength(1);
	});

	it("applies patches in list order, so a later one wins", () => {
		const { value } = apply({ label: "Hi" }, [
			{ path: ["label"], value: prim("first") },
			{ path: ["label"], value: prim("second") },
		]);
		expect(value).toEqual({ label: "second" });
	});

	it("names each dropped patch by the path it pointed at (§7.3)", () => {
		// One of each reason a patch is dropped, so the panel can name all three.
		const { dropped } = apply({ label: "Hi", items: [1] }, [
			{ path: ["gone"], value: prim("x") },
			{ path: ["items", 4], value: prim(2) },
			{ path: ["__proto__", "polluted"], value: prim(true) },
		]);
		expect(dropped).toEqual([["gone"], ["items", 4], ["__proto__", "polluted"]]);
	});

	it("returns the default untouched when there is nothing to apply", () => {
		const base = { label: "Hi" };
		const { value, dropped } = apply(base, []);
		expect(value).toBe(base);
		expect(dropped).toHaveLength(0);
	});
});
