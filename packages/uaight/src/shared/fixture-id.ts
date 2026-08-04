/**
 * Fixture identity serialization. SPEC.md §3.2.
 *
 * Canonical encoding, not address-bar readability:
 *
 *   single → uaight:1|<encodedPath>
 *   named  → uaight:1|<encodedPath>|<encodedName>
 *
 * `name: null` (single fixture) produces no third segment at all;
 * `name: ''` (a multi-fixture keyed by the empty string) produces an empty
 * third segment. These are different states and both must round-trip.
 */

import type { FixtureId } from "./types.ts";
import { ALL_FIXTURES } from "./types.ts";

const PREFIX = "uaight:1|";

export function serializeFixtureId(id: FixtureId): string {
	const path = encodeURIComponent(id.path);
	return id.name === null
		? `${PREFIX}${path}`
		: `${PREFIX}${path}|${encodeURIComponent(id.name)}`;
}

/**
 * Total: returns `null` on anything malformed, including a missing or
 * unknown version prefix.
 *
 * The convenience form `path:name` is accepted on input only (§3.2) and is
 * normalized to canonical form immediately. It rejects `:` in the path
 * segment. It is never emitted.
 */
export function parseFixtureId(
	value: string | FixtureId | null | undefined,
): FixtureId | null {
	if (value == null) return null;
	if (typeof value === "object") {
		if (typeof value.path !== "string") return null;
		if (value.name !== null && typeof value.name !== "string") return null;
		return { path: value.path, name: value.name };
	}
	if (value === "") return null;

	if (value.startsWith(PREFIX)) {
		const rest = value.slice(PREFIX.length);
		const segments = rest.split("|");
		if (segments.length > 2) return null;
		let path: string;
		let name: string | null;
		try {
			path = decodeURIComponent(segments[0] ?? "");
			name = segments.length === 2 ? decodeURIComponent(segments[1] ?? "") : null;
		} catch {
			return null;
		}
		if (path === "") return null;
		return { path, name };
	}

	// Unknown version prefix — `uaight:<n>|` where n is not 1.
	if (/^uaight:\d+\|/.test(value)) return null;

	// Convenience form, input only.
	const colon = value.indexOf(":");
	if (colon === -1) return value.includes("|") ? null : { path: value, name: null };
	const path = value.slice(0, colon);
	const name = value.slice(colon + 1);
	if (path === "" || path.includes(":")) return null;
	return { path, name };
}

export function fixtureIdsEqual(
	a: FixtureId | null | undefined,
	b: FixtureId | null | undefined,
): boolean {
	if (a == null || b == null) return a == null && b == null;
	return a.path === b.path && a.name === b.name;
}

/** Human-facing label. Never used as an identity. */
export function fixtureLabel(id: FixtureId): string {
	const leaf = id.path.split("/").pop() ?? id.path;
	if (id.name === null) return leaf;
	if (id.name === ALL_FIXTURES) return leaf;
	return `${leaf} / ${id.name}`;
}
