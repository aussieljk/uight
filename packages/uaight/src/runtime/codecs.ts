/**
 * Built-in value codecs — SPEC.md §7.7.
 *
 * These are written against the *public* `FixtureCodec` interface, which §7.7
 * names as the only honest test of whether that interface is sufficient. If a
 * built-in needed a private hook, the interface would be wrong.
 *
 * Editors are deliberately absent from this module. `editor` is optional on the
 * interface, and the UI attaches the built-in editors from `codec-editors.tsx`
 * (Q6) so that no editor component is reachable from the renderer chunk.
 *
 * `bigint` is not a codec: the wire format carries it natively as
 * `{ t: "bigint" }` (§7.4), so a codec could never be reached for it.
 */

import type { FixtureCodec } from "../shared/types.ts";

/** Identity, for type inference at a consumer's call site. §19.5 */
export function defineCodec<T, S>(codec: FixtureCodec<T, S>): FixtureCodec<T, S> {
	return codec;
}

/** Cross-realm safe brand check — `instanceof` fails across realms. */
function tagOf(value: unknown): string {
	return Object.prototype.toString.call(value);
}

/* ------------------------------------------------------------------ *
 * Date — an ISO instant in UTC. §7.3
 *
 * We store instants, not wall times. The editor (see codec-editors.tsx) shows
 * local time with a UTC toggle; the wire is always the instant.
 * ------------------------------------------------------------------ */

export const dateCodec: FixtureCodec<Date, string> = {
	name: "date",
	test: (value): value is Date => tagOf(value) === "[object Date]",
	serialize: (value) => {
		const time = value.getTime();
		return Number.isNaN(time) ? "" : new Date(time).toISOString();
	},
	deserialize: (data) => (data === "" ? new Date(Number.NaN) : new Date(data)),
	label: (value) => (Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString()),
};

/* ------------------------------------------------------------------ *
 * RegExp
 * ------------------------------------------------------------------ */

export interface RegExpData {
	source: string;
	flags: string;
}

export const regexpCodec: FixtureCodec<RegExp, RegExpData> = {
	name: "regexp",
	test: (value): value is RegExp => tagOf(value) === "[object RegExp]",
	serialize: (value) => ({ source: value.source, flags: value.flags }),
	deserialize: (data) => {
		try {
			return new RegExp(data.source, data.flags);
		} catch {
			// An unparseable source must not take the whole panel down.
			return new RegExp(data.source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "");
		}
	},
	label: (value) => value.toString(),
};

/* ------------------------------------------------------------------ *
 * URL
 * ------------------------------------------------------------------ */

export const urlCodec: FixtureCodec<URL, string> = {
	name: "url",
	test: (value): value is URL =>
		typeof URL !== "undefined" &&
		(value instanceof URL ||
			(tagOf(value) === "[object URL]" &&
				typeof (value as { href?: unknown }).href === "string")),
	serialize: (value) => value.href,
	deserialize: (data) => new URL(data),
	label: (value) => value.href,
};

/* ------------------------------------------------------------------ *
 * Map and Set
 *
 * `S` must be structured-cloneable. A Map of functions is therefore not
 * representable and falls through to an opaque chip with a development warning
 * naming the codec — which is the documented §7.7 behaviour, not a silent loss.
 * ------------------------------------------------------------------ */

export const mapCodec: FixtureCodec<Map<unknown, unknown>, Array<[unknown, unknown]>> = {
	name: "map",
	test: (value): value is Map<unknown, unknown> => tagOf(value) === "[object Map]",
	serialize: (value) => [...value.entries()],
	deserialize: (data) => new Map(data),
	label: (value) => `Map(${value.size})`,
};

export const setCodec: FixtureCodec<Set<unknown>, unknown[]> = {
	name: "set",
	test: (value): value is Set<unknown> => tagOf(value) === "[object Set]",
	serialize: (value) => [...value.values()],
	deserialize: (data) => new Set(data),
	label: (value) => `Set(${value.size})`,
};

/* ------------------------------------------------------------------ *
 * File — metadata only.
 *
 * The bytes stay in the renderer realm: shipping them through the panel would
 * put an arbitrary blob on the wire for a control nobody can meaningfully edit.
 * A round-trip therefore reconstructs an empty File with the same metadata,
 * which is documented rather than hidden.
 * ------------------------------------------------------------------ */

export interface FileData {
	name: string;
	size: number;
	type: string;
	lastModified: number;
}

export const fileCodec: FixtureCodec<File, FileData> = {
	name: "file",
	test: (value): value is File =>
		typeof File !== "undefined" &&
		(value instanceof File || tagOf(value) === "[object File]"),
	serialize: (value) => ({
		name: value.name,
		size: value.size,
		type: value.type,
		lastModified: value.lastModified,
	}),
	deserialize: (data) =>
		new File([], data.name, { type: data.type, lastModified: data.lastModified }),
	label: (value) => `${value.name} (${value.size} bytes)`,
};

/**
 * Registration order is also test order. Consumer codecs are prepended by
 * `createSerializer`, so any of these can be overridden by name (§7.7).
 */
export const builtinCodecs: FixtureCodec[] = [
	dateCodec as FixtureCodec,
	regexpCodec as FixtureCodec,
	urlCodec as FixtureCodec,
	mapCodec as FixtureCodec,
	setCodec as FixtureCodec,
	fileCodec as FixtureCodec,
];
