/**
 * Value serialization and codecs. SPEC.md §7.3, §7.4, §7.7, §20.1.
 *
 * The rules that matter most are the refusals. Getters are never invoked; a
 * cycle becomes an opaque chip rather than a stack overflow; opaque ids are
 * valid only for the revision that minted them, which is the whole of §7.1's
 * fix — restoring an id across HMR would inject a stale reference into a fresh
 * fixture.
 *
 * `src/runtime/**` belongs to another agent. Absent means skipped, not passed.
 */

import { describe, expect, it, vi } from "vitest";

import type { FixtureCodec, Wire } from "../src/shared/types.ts";
import { optional, present } from "./helpers/optional.ts";

interface Serializer {
	serialize(value: unknown, revision: number, opts?: { name?: string }): Wire;
	deserialize(wire: Wire): unknown;
	resolveOpaque(id: number): unknown;
}

interface RuntimeModule {
	createSerializer(
		codecs?: FixtureCodec[],
		options?: { dev?: boolean; onWarn?: (m: string) => void },
	): Serializer;
	defineCodec?<T, S>(c: FixtureCodec<T, S>): FixtureCodec<T, S>;
	builtinCodecs?: FixtureCodec[];
}

const mod = await optional<RuntimeModule>(
	"../../src/runtime/index.ts",
	"../../src/runtime/serialize.ts",
);

const describeIf = present(mod) ? describe : describe.skip;

const silent = { dev: true, onWarn: (): void => {} };
const make = (codecs: FixtureCodec[] = []): Serializer =>
	mod!.createSerializer(codecs, silent);

/** Every opaque label in a wire tree, for assertions about truncation. */
function labels(wire: Wire): string[] {
	switch (wire.t) {
		case "opaque":
			return [wire.label];
		case "array":
			return wire.v.flatMap(labels);
		case "object":
			return wire.v.flatMap(([, child]) => labels(child));
		default:
			return [];
	}
}

describeIf("the wire format (§7.4)", () => {
	it("encodes primitives", () => {
		const s = make();
		expect(s.serialize("x", 1)).toEqual({ t: "prim", v: "x" });
		expect(s.serialize(1.5, 1)).toEqual({ t: "prim", v: 1.5 });
		expect(s.serialize(true, 1)).toEqual({ t: "prim", v: true });
		expect(s.serialize(null, 1)).toEqual({ t: "prim", v: null });
	});

	it("keeps undefined distinct from null", () => {
		const s = make();
		expect(s.serialize(undefined, 1)).toEqual({ t: "undef" });
		expect(s.serialize(null, 1)).toEqual({ t: "prim", v: null });
	});

	it("carries a bigint as a string, since JSON cannot hold one", () => {
		expect(make().serialize(90071992547409911n, 1)).toEqual({
			t: "bigint",
			v: "90071992547409911",
		});
	});

	it("preserves object key order, which is why objects are entry arrays", () => {
		const wire = make().serialize({ b: 1, a: 2, 0: 3 }, 1);
		expect(wire.t).toBe("object");
		// Integer-like keys sort first in JS; the point is that the wire records
		// whatever order the object actually has.
		expect((wire as Extract<Wire, { t: "object" }>).v.map(([k]) => k)).toEqual([
			"0",
			"b",
			"a",
		]);
	});

	it("round-trips a plain structure", () => {
		const s = make();
		const value = { a: [1, "two", false, null], b: { c: undefined } };
		expect(s.deserialize(s.serialize(value, 1))).toEqual(value);
	});
});

describeIf("opaque values (§7.3)", () => {
	it("makes a function opaque and labels it", () => {
		const wire = make().serialize(function greet() {}, 1);
		expect(wire.t).toBe("opaque");
		expect((wire as Extract<Wire, { t: "opaque" }>).label).toContain("greet");
	});

	it("resolves an opaque id back to the original value", () => {
		const s = make();
		const fn = (): void => {};
		const wire = s.serialize({ onClick: fn }, 1) as Extract<Wire, { t: "object" }>;
		const leaf = wire.v[0]![1] as Extract<Wire, { t: "opaque" }>;
		expect(s.resolveOpaque(leaf.id)).toBe(fn);
	});

	it("stops resolving an id once the revision moves on (§7.1, §7.2)", () => {
		const s = make();
		const fn = (): void => {};
		const wire = s.serialize({ onClick: fn }, 1, { name: "props" }) as Extract<
			Wire,
			{ t: "object" }
		>;
		const leaf = wire.v[0]![1] as Extract<Wire, { t: "opaque" }>;
		expect(s.resolveOpaque(leaf.id)).toBe(fn);

		// A fresh default for the same input, after HMR.
		s.serialize({ onClick: (): void => {} }, 2, { name: "props" });
		expect(s.resolveOpaque(leaf.id)).toBeUndefined();
	});

	it("emits [Circular] rather than recursing forever", () => {
		const value: Record<string, unknown> = { name: "root" };
		value.self = value;
		expect(labels(make().serialize(value, 1))).toContain("[Circular]");
	});

	it("truncates beyond the depth limit", () => {
		let deep: Record<string, unknown> = { leaf: true };
		for (let i = 0; i < 12; i++) deep = { next: deep };
		expect(labels(make().serialize(deep, 1))).toContain("[depth limit]");
	});

	it("never invokes a getter (§7.3)", () => {
		const get = vi.fn(() => "should not be read");
		const value = {};
		Object.defineProperty(value, "lazy", { get, enumerable: true, configurable: true });
		const wire = make().serialize(value, 1);
		expect(get).not.toHaveBeenCalled();
		expect(labels(wire)).toContain("[getter]");
	});

	it("makes a non-plain object opaque when no codec claims it", () => {
		class Money {
			constructor(readonly cents: number) {}
		}
		const wire = make().serialize(new Money(100), 1);
		expect(wire.t).toBe("opaque");
	});
});

describeIf("prototype safety (§7.3)", () => {
	it("never serializes a __proto__/constructor/prototype own key", () => {
		const value: Record<string, unknown> = { safe: 1 };
		Object.defineProperty(value, "constructor", {
			value: 2,
			enumerable: true,
			configurable: true,
		});
		const wire = make().serialize(value, 1) as Extract<Wire, { t: "object" }>;
		expect(wire.v.map(([k]) => k)).toEqual(["safe"]);
	});

	it("never writes through a prototype-shaped key when deserializing", () => {
		const wire: Wire = {
			t: "object",
			v: [["__proto__", { t: "object", v: [["polluted", { t: "prim", v: true }]] }]],
		};
		const out = make().deserialize(wire) as Record<string, unknown>;
		expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});
});

describeIf("codecs (§7.7)", () => {
	it("encodes a Date as an ISO instant in UTC", () => {
		const wire = make().serialize(new Date("2026-07-31T09:15:00.000Z"), 1);
		expect(wire).toEqual({ t: "codec", codec: "date", v: "2026-07-31T09:15:00.000Z" });
	});

	it("round-trips the built-ins through the same public interface", () => {
		const s = make();
		for (const value of [
			new Date("2026-01-01T00:00:00.000Z"),
			/ab+c/gi,
			new URL("https://example.test/path?q=1"),
			new Map<string, number>([["a", 1]]),
			new Set([1, 2, 3]),
		]) {
			const back = s.deserialize(s.serialize(value, 1));
			expect(back).toEqual(value);
		}
	});

	it("tests consumer codecs before built-ins, so Date can be overridden", () => {
		const epoch: FixtureCodec = {
			name: "date",
			test: (v): v is Date => v instanceof Date,
			serialize: (v) => (v as Date).getTime(),
			deserialize: (n) => new Date(n as number),
		};
		const wire = make([epoch]).serialize(new Date("2026-07-31T09:15:00.000Z"), 1);
		expect(wire).toEqual({ t: "codec", codec: "date", v: 1785489300000 });
	});

	it("falls through to opaque when no codec matches", () => {
		class Branded {}
		expect(make().serialize(new Branded(), 1).t).toBe("opaque");
	});

	it("degrades an unknown codec name on the wire instead of throwing", () => {
		const warn = vi.fn();
		const s = mod!.createSerializer([], { dev: true, onWarn: warn });
		expect(() => s.deserialize({ t: "codec", codec: "nope", v: 1 })).not.toThrow();
		expect(warn).toHaveBeenCalled();
	});

	it("survives a codec whose test() throws", () => {
		const hostile: FixtureCodec = {
			name: "hostile",
			test: (_value): _value is unknown => {
				throw new Error("boom");
			},
			serialize: (v) => v,
			deserialize: (v) => v,
		};
		expect(() => make([hostile]).serialize({ a: 1 }, 1)).not.toThrow();
	});
});
