/**
 * Where you were, remembered for the length of the tab.
 *
 * Q14 settled that *overlay values* are not persisted: a control value is a
 * property of a fixture module that HMR can reshape underneath it, and reviving
 * one across a reload would resurrect state the module no longer has. That
 * answer is about values. It says nothing about navigation, and navigation is
 * the thing a reload actually destroys — the tree collapses, the selection is
 * gone, and a `bun run dev` restart costs the user their place in an 82-file
 * corpus.
 *
 * So: `sessionStorage`, not `localStorage`. A tab is the right lifetime — long
 * enough to survive HMR, a restart and a refresh, short enough that a new tab
 * is a clean slate and nothing accumulates on the user's machine forever.
 *
 * Everything here is best-effort. Private mode throws on access, and the
 * explorer must open anyway; every read falls back to the default and every
 * write is swallowed.
 *
 * **URL parameters still win** (§5.4). This module only supplies a selection
 * when the router and the props have not already named one — restoring over a
 * deep link would break the one guarantee a shareable link has.
 */

/** One tab's memory of one mount. */
export interface ExplorerSession {
	/** Tree groups the user closed. Expanded is the default, so this is the delta. */
	collapsed: string[];
	/** `serializeFixtureId` of the last selection, or `null`. */
	selection: string | null;
	/** Palette keys, most recently opened first (§ command palette, MRU). */
	recents: string[];
	/** Sidebar and control-panel widths in pixels, `null` for the default. */
	sidebarWidth: number | null;
	panelWidth: number | null;
	/** Whether the inventory disclosure is open. */
	inventoryOpen: boolean;
}

export const EMPTY_SESSION: ExplorerSession = {
	collapsed: [],
	selection: null,
	recents: [],
	sidebarWidth: null,
	panelWidth: null,
	inventoryOpen: true,
};

/** How many palette items the MRU list remembers. */
export const MAX_RECENTS = 12;

export type SessionStorageLike = Pick<Storage, "getItem" | "setItem">;

/**
 * Keyed by route AND mount: two `<Uaight />` mounts on one page are two
 * explorers with two selections (§5.4 makes the same distinction for the URL,
 * via `routerId`), and the same mount on `/uaight` and on `/design/buttons` is
 * two different places to be.
 */
export function sessionKey(route: string, mountId: string): string {
	return `uaight:session:${route}:${mountId}`;
}

function storage(): SessionStorageLike | null {
	try {
		return typeof window === "undefined" ? null : window.sessionStorage;
	} catch {
		return null;
	}
}

function stringArray(value: unknown, limit: number): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((entry): entry is string => typeof entry === "string").slice(0, limit);
}

function width(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Parses defensively rather than trusting the shape. The value is written by a
 * previous *version* of this file as much as by a previous session, so a field
 * that has changed shape has to degrade to its default instead of reaching a
 * component as the wrong type.
 */
export function parseSession(raw: string | null): ExplorerSession {
	if (!raw) return EMPTY_SESSION;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return EMPTY_SESSION;
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return EMPTY_SESSION;
	const record = parsed as Record<string, unknown>;
	return {
		collapsed: stringArray(record.collapsed, 2000),
		selection: typeof record.selection === "string" ? record.selection : null,
		recents: stringArray(record.recents, MAX_RECENTS),
		sidebarWidth: width(record.sidebarWidth),
		panelWidth: width(record.panelWidth),
		inventoryOpen: record.inventoryOpen !== false,
	};
}

export function readSession(key: string, store: SessionStorageLike | null = storage()): ExplorerSession {
	if (!store) return EMPTY_SESSION;
	try {
		return parseSession(store.getItem(key));
	} catch {
		return EMPTY_SESSION;
	}
}

/** Merges a partial over what is stored and writes it back. Never throws. */
export function writeSession(
	key: string,
	patch: Partial<ExplorerSession>,
	store: SessionStorageLike | null = storage(),
): ExplorerSession {
	const next = { ...readSession(key, store), ...patch };
	if (store) {
		try {
			store.setItem(key, JSON.stringify(next));
		} catch {
			/* quota or private mode; the session simply does not persist */
		}
	}
	return next;
}

/**
 * Most-recently-used, newest first, deduplicated and capped.
 *
 * A pure function so the palette's ordering can be tested without a DOM and
 * without a storage backend.
 */
export function pushRecent(
	recents: readonly string[],
	key: string,
	limit = MAX_RECENTS,
): string[] {
	return [key, ...recents.filter((entry) => entry !== key)].slice(0, limit);
}
