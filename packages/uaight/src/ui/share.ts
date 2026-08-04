/**
 * Shareable control state — the overlay in the URL.
 *
 * §5.4 kept control values out of links in v1, and §1.3's job 4 says "not in a
 * state". That was the right default when the overlay model was new; it is the
 * wrong one now that the model has held. A QA link that says *which fixture*
 * makes the reader reproduce the bug; a link that carries the props reproduces
 * it for them.
 *
 * Three properties make this safe rather than clever:
 *
 *  1. **A patch is JSON by construction.** `Patch.value` is `EditableWire`,
 *     which excludes `opaque` by type, so no function, element or DOM node can
 *     reach a URL even in principle — the same property that makes overlays
 *     survive HMR (§7.2).
 *  2. **Paths are re-validated on the way in.** A link is untrusted input, so
 *     `__proto__` and friends are rejected here as well as at the transport
 *     boundary (§7.3), and a malformed parameter is dropped rather than thrown.
 *  3. **Revisions are not carried.** A revision numbers *this* renderer's
 *     registration, so it means nothing in another tab. Seeded patches adopt
 *     whatever revision the input registers with, and any that no longer fit
 *     the shape are dropped by the store's own pruning (§7.3).
 */

import { isSafePath } from "../shared/wire.ts";
import type { InputOverlay, Patch, PathSegment } from "../shared/types.ts";

/**
 * Practical ceiling for a shared link. Browsers accept far more, but proxies,
 * chat clients and issue trackers truncate long URLs silently — and a link that
 * arrives cut in half is worse than one that never carried the state.
 */
export const MAX_STATE_LENGTH = 1800;

/** `[["input", [[path…], value]…]…]` — positional, because this goes in a URL. */
type WireState = Array<[string, Array<[PathSegment[], unknown]>]>;

function toBase64Url(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string | null {
	try {
		const padded = value.replace(/-/g, "+").replace(/_/g, "/");
		const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
		const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	} catch {
		return null;
	}
}

/**
 * Overlays → a URL-safe token, or `null` when there is nothing to share or the
 * result would be too long to survive being pasted somewhere.
 */
export function encodeOverlays(overlays: readonly InputOverlay[]): string | null {
	const state: WireState = [];
	for (const overlay of overlays) {
		if (!overlay.patches.length) continue;
		state.push([overlay.input, overlay.patches.map((p) => [p.path, p.value])]);
	}
	if (!state.length) return null;

	const token = toBase64Url(JSON.stringify(state));
	return token.length > MAX_STATE_LENGTH ? null : token;
}

/**
 * A URL token → overlays to seed. Total: anything malformed yields an empty
 * list, because a bad link should land you on the fixture rather than on an
 * error.
 */
export function decodeOverlays(value: string | null | undefined): InputOverlay[] {
	if (!value) return [];
	const json = fromBase64Url(value);
	if (json === null) return [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];

	const overlays: InputOverlay[] = [];
	for (const entry of parsed) {
		if (!Array.isArray(entry) || entry.length !== 2) continue;
		const [name, rawPatches] = entry as [unknown, unknown];
		if (typeof name !== "string" || !Array.isArray(rawPatches)) continue;

		const patches: Patch[] = [];
		for (const rawPatch of rawPatches) {
			if (!Array.isArray(rawPatch) || rawPatch.length !== 2) continue;
			const [path, value_] = rawPatch as [unknown, unknown];
			if (!Array.isArray(path)) continue;
			if (!path.every((seg) => typeof seg === "string" || typeof seg === "number")) continue;
			// A link is untrusted input; the transport check is not the only gate.
			if (!isSafePath(path as PathSegment[])) continue;
			patches.push({ path: path as PathSegment[], value: value_ as Patch["value"] });
		}

		// Revision 0 is a placeholder: the store rebases onto whatever revision the
		// input actually registers with.
		if (patches.length) overlays.push({ input: name, revision: 0, patches });
	}
	return overlays;
}

/** True when two overlay lists would produce the same link. */
export function sameState(a: readonly InputOverlay[], b: readonly InputOverlay[]): boolean {
	return encodeOverlays(a) === encodeOverlays(b);
}
