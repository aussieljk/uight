/**
 * Shareable control state — the overlay in a URL.
 *
 * A link is untrusted input, so the decoder is the interesting half: it has to
 * survive garbage without throwing, and it must not be a second way to get a
 * `__proto__` patch past §7.3.
 */

import { describe, expect, it } from "vitest";

import {
	MAX_STATE_LENGTH,
	decodeOverlays,
	encodeOverlays,
	sameState,
} from "../src/ui/share.ts";
import type { InputOverlay } from "../src/shared/types.ts";

const overlay = (input: string, patches: InputOverlay["patches"]): InputOverlay => ({
	input,
	revision: 7,
	patches,
});

describe("round trip", () => {
	it("carries patches through a link", () => {
		const state = [
			overlay("label", [{ path: [], value: { t: "prim", v: "Buy" } }]),
			overlay("size", [{ path: ["width"], value: { t: "prim", v: 320 } }]),
		];

		const decoded = decodeOverlays(encodeOverlays(state));

		expect(decoded).toHaveLength(2);
		expect(decoded[0]?.input).toBe("label");
		expect(decoded[0]?.patches[0]?.value).toEqual({ t: "prim", v: "Buy" });
		expect(decoded[1]?.patches[0]?.path).toEqual(["width"]);
	});

	it("does not carry the revision, because it means nothing in another tab", () => {
		const decoded = decodeOverlays(
			encodeOverlays([overlay("label", [{ path: [], value: { t: "prim", v: 1 } }])]),
		);

		// Seeded patches adopt whatever revision the input registers with.
		expect(decoded[0]?.revision).toBe(0);
	});

	it("produces a URL-safe token", () => {
		const token = encodeOverlays([
			overlay("label", [{ path: [], value: { t: "prim", v: "a+b/c?d=e&f" } }]),
		]);

		expect(token).not.toBeNull();
		expect(token).toMatch(/^[A-Za-z0-9\-_]+$/);
	});

	it("encodes nothing when there is nothing to share", () => {
		expect(encodeOverlays([])).toBeNull();
		expect(encodeOverlays([overlay("label", [])])).toBeNull();
	});

	it("refuses a token too long to survive being pasted", () => {
		const huge = overlay("label", [
			{ path: [], value: { t: "prim", v: "x".repeat(MAX_STATE_LENGTH * 2) } },
		]);

		expect(encodeOverlays([huge])).toBeNull();
	});
});

describe("decoding untrusted input", () => {
	it("returns nothing for garbage rather than throwing", () => {
		expect(decodeOverlays("not-base64!!")).toEqual([]);
		expect(decodeOverlays("")).toEqual([]);
		expect(decodeOverlays(null)).toEqual([]);
		expect(decodeOverlays(undefined)).toEqual([]);
		expect(decodeOverlays(btoa("[[1,2,3]]"))).toEqual([]);
	});

	it("rejects a prototype-pollution path from a link", () => {
		// §7.3 rejects these at the transport boundary; a link is a second door
		// into the same room, so it is checked here too.
		const forged = btoa(
			JSON.stringify([["label", [[["__proto__", "polluted"], { t: "prim", v: 1 }]]]]),
		)
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");

		expect(decodeOverlays(forged)).toEqual([]);
	});

	it("keeps the safe patches from a partly malformed payload", () => {
		const mixed = btoa(
			JSON.stringify([
				["label", [[["constructor"], { t: "prim", v: 1 }]]],
				["size", [[["width"], { t: "prim", v: 2 }]]],
			]),
		)
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");

		const decoded = decodeOverlays(mixed);
		expect(decoded).toHaveLength(1);
		expect(decoded[0]?.input).toBe("size");
	});
});

describe("sameState", () => {
	it("is true for lists that would produce the same link", () => {
		const a = [overlay("label", [{ path: [], value: { t: "prim", v: 1 } }])];
		const b = [overlay("label", [{ path: [], value: { t: "prim", v: 1 } }])];

		expect(sameState(a, b)).toBe(true);
	});

	it("is false when a value changed", () => {
		const a = [overlay("label", [{ path: [], value: { t: "prim", v: 1 } }])];
		const b = [overlay("label", [{ path: [], value: { t: "prim", v: 2 } }])];

		expect(sameState(a, b)).toBe(false);
	});
});
