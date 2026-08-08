/**
 * Names — §3.4 reconciliation, §3.5 progressive disclosure and the warm pass.
 *
 * Reading fixture names off a loaded module, and the Vite hot handle the
 * explorer listens on. Everything here is realm-level state: the cache and the
 * registry are shared by every mount in the document, which is the point.
 */

import { fixtureHotRegistry } from "../runtime/hot.ts";

/**
 * A `null` entry is §3.4's marker for "the default export IS the fixture", so
 * `[null]` is a single-fixture file and `names: null` (the whole field) is an
 * undecidable one. They are different states and neither is an empty list.
 */
export type IndexedNames = Array<string | null>;

export const SINGLE_FIXTURE: IndexedNames = [null];

/** Cached by content hash, so a remount does not reload every undecidable module. */
export const nameCache = new Map<string, IndexedNames>();

/**
 * Publish this realm's hot registry as soon as the explorer is loaded (§4.5).
 *
 * The code the plugin injects into `virtual:uight/runtime` and into every
 * fixture module reaches for it through `globalThis` and skips silently when it
 * is absent — so it has to exist before the first edit, not on first use.
 */
fixtureHotRegistry();

export function readNames(mod: unknown): IndexedNames {
	const record = (mod ?? {}) as Record<string, unknown>;
	const declared = record.fixtureNames;
	if (Array.isArray(declared) && declared.every((n) => typeof n === "string")) {
		return declared;
	}
	const value = record.default;
	if (
		value !== null &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		!("$$typeof" in value)
	) {
		return Object.keys(value);
	}
	return SINGLE_FIXTURE;
}

export function sameNames(
	a: readonly (string | null)[],
	b: readonly (string | null)[],
): boolean {
	return a.length === b.length && a.every((n, i) => n === b[i]);
}

export interface HotLike {
	on(event: string, cb: (data: unknown) => void): void;
	off?(event: string, cb: (data: unknown) => void): void;
	send?(event: string, data?: unknown): void;
}

export function viteHot(): HotLike | undefined {
	return (import.meta as unknown as { hot?: HotLike }).hot;
}
