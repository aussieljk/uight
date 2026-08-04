/**
 * Palette contents and ranking.
 *
 * Kept out of the component so a replacement palette (§11.3) receives a list
 * that is already filtered and ordered, and so the matcher can be tested
 * without rendering anything.
 *
 * The matcher is a subsequence match with bonuses, not a full fuzzy library:
 * `flx` finds `forms/FlexLayout`, a contiguous run scores above a scattered
 * one, and a match at a word boundary scores above one in the middle of a word.
 * Everything the palette searches is a short identifier or path, which is the
 * case that kind of matcher is good at.
 */

import { callSiteLabel, callSiteSummary } from "../shared/callsites.ts";
import { serializeFixtureId } from "../shared/fixture-id.ts";
import type {
	CallSiteGroup,
	CommandPaletteItem,
	InventoryItem,
	TreeNode,
} from "../shared/types.ts";

export interface PaletteSource {
	nodes: readonly TreeNode[];
	inventory: readonly InventoryItem[];
	callSites: readonly CallSiteGroup[];
}

/** Everything selectable, flattened once per index change. */
export function buildPaletteItems(source: PaletteSource): CommandPaletteItem[] {
	const items: CommandPaletteItem[] = [];
	const seen = new Set<string>();

	const push = (item: CommandPaletteItem): void => {
		if (seen.has(item.key)) return;
		seen.add(item.key);
		items.push(item);
	};

	const walk = (nodes: readonly TreeNode[]): void => {
		for (const node of nodes) {
			if (node.fixture && (node.kind === "fixture" || node.kind === "file")) {
				const id = node.fixture;
				push({
					key: `fixture:${serializeFixtureId(id)}`,
					label: node.label,
					hint: id.path,
					kind: "fixture",
					fixture: id,
				});
			}
			if (node.children) walk(node.children);
		}
	};
	walk(source.nodes);

	for (const item of source.inventory) {
		push({
			key: `component:${item.globPath}#${item.exportName}`,
			label: item.name,
			hint: item.path,
			kind: "component",
			component: item,
		});
	}

	// Call sites are listed under the component they instantiate, so typing a
	// component name surfaces both "the component" and "the ways it is used".
	for (const group of source.callSites) {
		const match = source.inventory.find((item) => item.name === group.component);
		if (!match) continue;
		for (const site of group.sites) {
			push({
				key: `call-site:${site.globPath}:${site.line}:${site.column}`,
				label: `${group.component} — ${callSiteSummary(site)}`,
				hint: callSiteLabel(site),
				kind: "call-site",
				component: match,
				callSite: site,
			});
		}
	}

	return items;
}

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

const BOUNDARY = /[\s/\-_.]/;

/**
 * Subsequence score, or `null` when `query` is not a subsequence of `text`.
 * Higher is better. Case-insensitive; an exact substring short-circuits to a
 * score no scattered match can reach.
 */
export function matchScore(text: string, query: string): number | null {
	if (query === "") return 0;
	const haystack = text.toLowerCase();
	const needle = query.toLowerCase();

	const direct = haystack.indexOf(needle);
	if (direct !== -1) {
		// Earlier is better, and a match at the start of a word better still.
		const boundary = direct === 0 || BOUNDARY.test(haystack[direct - 1] ?? "");
		return 1000 - direct + (boundary ? 200 : 0) + needle.length * 4;
	}

	let score = 0;
	let index = 0;
	let previous = -2;
	for (const character of needle) {
		const found = haystack.indexOf(character, index);
		if (found === -1) return null;
		if (found === previous + 1) score += 8; // contiguous run
		if (found === 0 || BOUNDARY.test(haystack[found - 1] ?? "")) score += 6;
		score -= Math.min(found - index, 8) * 0.5;
		previous = found;
		index = found + 1;
	}
	return score;
}

/** Kinds in the order they should break a score tie. */
const KIND_RANK: Record<CommandPaletteItem["kind"], number> = {
	fixture: 0,
	component: 1,
	"call-site": 2,
};

/**
 * Recency, blended in.
 *
 * An empty ⌘K used to be a static alphabetical list, which is the one ordering
 * that is never what the user wants: they opened the palette to go somewhere,
 * and the best guess about where is the set of places they have just been. So
 * an empty query is the MRU list first, then everything else in kind order.
 *
 * For a *short* query recency is a tiebreak rather than an ordering. Two or
 * three characters match dozens of things about equally well, and among equals
 * the one you opened five minutes ago is the better guess; by four characters
 * the match itself is discriminating enough that recency would start overriding
 * a better match, so the bonus is gone by then.
 */
const RECENCY_QUERY_LIMIT = 3;
const RECENCY_WEIGHT = 30;

function recencyBonus(recents: readonly string[], key: string, queryLength: number): number {
	if (queryLength > RECENCY_QUERY_LIMIT) return 0;
	const index = recents.indexOf(key);
	if (index < 0) return 0;
	// Linear decay across the MRU list: the most recent is worth the full weight
	// and the oldest is worth roughly a tenth of it.
	return (RECENCY_WEIGHT * (recents.length - index)) / recents.length;
}

export function rankPaletteItems(
	items: readonly CommandPaletteItem[],
	query: string,
	limit = 50,
	recents: readonly string[] = [],
): CommandPaletteItem[] {
	const trimmed = query.trim();
	if (trimmed === "") {
		const byKey = new Map(items.map((item) => [item.key, item]));
		const recent: CommandPaletteItem[] = [];
		const seen = new Set<string>();
		for (const key of recents) {
			const item = byKey.get(key);
			// A recent that no longer exists — a deleted fixture, a renamed
			// component — is simply not offered. The MRU list is a hint, not an
			// index, so a stale entry costs nothing and is never repaired.
			if (!item || seen.has(key)) continue;
			seen.add(key);
			recent.push(item);
		}
		const rest = [...items]
			.filter((item) => !seen.has(item.key))
			.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]);
		return [...recent, ...rest].slice(0, limit);
	}

	const scored: Array<{ item: CommandPaletteItem; score: number }> = [];
	for (const item of items) {
		// The label is what the user is looking at, so it outranks the path; the
		// path still matches, at a discount, so `forms/` finds a whole directory.
		const label = matchScore(item.label, trimmed);
		const hint = item.hint ? matchScore(item.hint, trimmed) : null;
		if (label === null && hint === null) continue;
		const score =
			Math.max(label ?? -Infinity, (hint ?? -Infinity) - 40) +
			recencyBonus(recents, item.key, trimmed.length);
		scored.push({ item, score });
	}

	scored.sort(
		(a, b) =>
			b.score - a.score ||
			KIND_RANK[a.item.kind] - KIND_RANK[b.item.kind] ||
			a.item.label.localeCompare(b.item.label),
	);
	return scored.slice(0, limit).map((entry) => entry.item);
}
