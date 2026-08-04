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
 * **Two lifetimes, not one.** That argument is about *navigation*: where you
 * were is worth remembering for as long as you are still going there, and a new
 * tab deserves a clean slate. It does not cover *preferences*. A pane width and
 * the inventory disclosure are not a place you were; they are how you like the
 * tool set up, and re-dragging the sidebar in every new tab is not a clean
 * slate, it is an amnesiac one. So the record is split by lifetime:
 *
 * | Field                                | Store            | Why |
 * | ------------------------------------ | ---------------- | --- |
 * | `collapsed`, `selection`, `recents`  | `sessionStorage` | Navigation: where you were, and the MRU that follows from it. |
 * | `sidebarWidth`, `panelWidth`, `inventoryOpen` | `localStorage` | Preferences: how the tool is set up. |
 *
 * Both halves keep the same `uaight:…:<route>:<mountId>` namespacing, so two
 * mounts and two routes stay independent in both stores, and both halves keep
 * the same best-effort behaviour — private mode throws on `localStorage` just as
 * readily, and neither read nor write may ever surface that.
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

/**
 * The preference half of the same key. A distinct prefix rather than the same
 * one in a different store, so a stray `localStorage` dump is readable and the
 * two records can never be mistaken for each other by a future migration.
 */
export function prefsKey(sessionStorageKey: string): string {
	return sessionStorageKey.replace(/^uaight:session:/, "uaight:prefs:");
}

/** Which fields live in `localStorage`. Everything else stays per-tab. */
const PREFERENCE_FIELDS = ["sidebarWidth", "panelWidth", "inventoryOpen"] as const;
type PreferenceField = (typeof PREFERENCE_FIELDS)[number];

function isPreference(field: string): field is PreferenceField {
	return (PREFERENCE_FIELDS as readonly string[]).includes(field);
}

function storage(): SessionStorageLike | null {
	try {
		return typeof window === "undefined" ? null : window.sessionStorage;
	} catch {
		return null;
	}
}

/** Same contract as `storage()`: any access may throw, and `null` is fine. */
function prefsStorage(): SessionStorageLike | null {
	try {
		return typeof window === "undefined" ? null : window.localStorage;
	} catch {
		return null;
	}
}

function stringArray(value: unknown, limit: number): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((entry): entry is string => typeof entry === "string")
		.slice(0, limit);
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

/**
 * Resolves the two backends.
 *
 * Omitting both arguments uses the real stores. Passing only `store` — which is
 * how the tests and any embedder inject a fake — makes that one object stand in
 * for *both* halves, so a single in-memory map still round-trips a whole
 * `ExplorerSession`. Pass both to exercise the split itself.
 */
function stores(
	store: SessionStorageLike | null | undefined,
	prefs: SessionStorageLike | null | undefined,
): [SessionStorageLike | null, SessionStorageLike | null] {
	const nav = store === undefined ? storage() : store;
	const pref = prefs !== undefined ? prefs : store === undefined ? prefsStorage() : store;
	return [nav, pref];
}

function readRecord(store: SessionStorageLike | null, key: string): ExplorerSession {
	if (!store) return EMPTY_SESSION;
	try {
		return parseSession(store.getItem(key));
	} catch {
		return EMPTY_SESSION;
	}
}

export function readSession(
	key: string,
	store?: SessionStorageLike | null,
	prefs?: SessionStorageLike | null,
): ExplorerSession {
	const [nav, pref] = stores(store, prefs);
	const navigation = readRecord(nav, key);
	// Same key when one store stands in for both; reading it twice is harmless.
	const preferences = readRecord(pref, prefsKey(key));
	return {
		...navigation,
		sidebarWidth: preferences.sidebarWidth,
		panelWidth: preferences.panelWidth,
		inventoryOpen: preferences.inventoryOpen,
	};
}

function put(store: SessionStorageLike | null, key: string, value: unknown): void {
	if (!store) return;
	try {
		store.setItem(key, JSON.stringify(value));
	} catch {
		/* quota or private mode; the record simply does not persist */
	}
}

/**
 * Merges a partial over what is stored and writes it back. Never throws.
 *
 * Writes only the half a patch actually touches: a pane drag must not rewrite
 * the navigation record (and re-persist a selection the user has since left),
 * and remembering a selection must not touch the preferences.
 */
export function writeSession(
	key: string,
	patch: Partial<ExplorerSession>,
	store?: SessionStorageLike | null,
	prefs?: SessionStorageLike | null,
): ExplorerSession {
	const [nav, pref] = stores(store, prefs);
	const next = { ...readSession(key, nav, pref), ...patch };
	const fields = Object.keys(patch);
	if (fields.some((field) => !isPreference(field))) put(nav, key, next);
	if (fields.some(isPreference)) put(pref, prefsKey(key), next);
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
