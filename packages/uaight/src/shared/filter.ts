/**
 * Filter semantics. SPEC.md §3.6.
 *
 * Three forms, disambiguated by shape:
 *   string without `*`  — path prefix on SEGMENT BOUNDARIES
 *   string with `*`     — glob against the display path
 *   string[]            — any match wins; entries prefixed `!` exclude
 *   predicate           — called per file, not per fixture
 *
 * Filtering scopes the tree. It never prevents a `fixture` prop from
 * rendering (§5.3).
 */

import type { Filter } from "./types.ts";

/**
 * Minimal glob matcher over display paths. Supports `*` (within a segment),
 * `**` (across segments) and `?`. Shared by discovery and filtering so the two
 * cannot drift.
 */
export function globToRegExp(glob: string, caseSensitive = true): RegExp {
	let out = "";
	for (let i = 0; i < glob.length; i++) {
		const c = glob[i]!;
		if (c === "*") {
			if (glob[i + 1] === "*") {
				// `**/` consumes the separator so it can also match zero segments.
				if (glob[i + 2] === "/") {
					out += "(?:.*/)?";
					i += 2;
				} else {
					out += ".*";
					i += 1;
				}
			} else {
				out += "[^/]*";
			}
		} else if (c === "?") {
			out += "[^/]";
		} else if ("\\^$+.()|{}[]".includes(c)) {
			out += "\\" + c;
		} else {
			out += c;
		}
	}
	return new RegExp(`^${out}$`, caseSensitive ? "" : "i");
}

function matchesOne(path: string, pattern: string, caseSensitive: boolean): boolean {
	if (pattern.includes("*") || pattern.includes("?")) {
		return globToRegExp(pattern, caseSensitive).test(path);
	}
	const p = caseSensitive ? path : path.toLowerCase();
	const q = caseSensitive ? pattern : pattern.toLowerCase();
	// Prefix on segment boundaries: 'components/forms' matches
	// 'components/forms/Input' but not 'components/formsy/X'.
	return p === q || p.startsWith(q.endsWith("/") ? q : q + "/");
}

export function matchesFilter(
	path: string,
	filter: Filter | undefined,
	caseSensitive = true,
): boolean {
	if (filter === undefined) return true;
	if (typeof filter === "function") return filter(path);
	if (typeof filter === "string") return matchesOne(path, filter, caseSensitive);

	let included = false;
	let sawInclude = false;
	for (const entry of filter) {
		if (entry.startsWith("!")) {
			if (matchesOne(path, entry.slice(1), caseSensitive)) return false;
		} else {
			sawInclude = true;
			if (matchesOne(path, entry, caseSensitive)) included = true;
		}
	}
	return sawInclude ? included : true;
}
