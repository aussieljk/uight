/**
 * The explorer. SPEC.md §5.3 (selection precedence), §5.4 (routing), §3.5
 * (progressive disclosure), §6.5 (height and viewport), §7 (control state),
 * §10.1 (design), §12 (inventory), §19.3 (the chrome facade).
 *
 * This module is the lazy boundary: `entry.tsx` reaches it through
 * `React.lazy` behind the `__UAIGHT_ENABLED__` compile-time gate (§9.2), so
 * everything imported from here — the renderer, the chrome, the compiled CSS —
 * leaves the bundle entirely when the gate is false.
 */

import {
	Suspense,
	lazy,
	useCallback,
	useEffect,
	useId,
	useInsertionEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { config, fixtureModules } from "virtual:uaight/runtime";
import { rendererEntryUrl } from "virtual:uaight/renderer-url";

import {
	callSiteLabel,
	callSiteSummary,
	callSitesFor,
	formatFixtureModule,
} from "../shared/callsites.ts";
import { matchesFilter } from "../shared/filter.ts";
import {
	fixtureIdsEqual,
	fixtureLabel,
	parseFixtureId,
	serializeFixtureId,
} from "../shared/fixture-id.ts";
import { viewportFor } from "../shared/meta.ts";
import { buildTree, flattenRows, flattenSelectable, searchTree } from "../shared/tree.ts";
import { ALL_FIXTURES } from "../shared/types.ts";
import type {
	CallSite,
	CallSiteGroup,
	CommandPaletteItem,
	EditableWire,
	FixtureCodec,
	FixtureFileIndex,
	FixtureId,
	FixtureIndex,
	InputOverlay,
	InventoryItem,
	PathSegment,
	RendererError,
	TreeNode,
	UaightProps,
	ViewportPreset,
} from "../shared/types.ts";
import type { HostTransport } from "../runtime/index.ts";
import { fixtureHotRegistry, loadFixtureModule } from "../runtime/hot.ts";

import { ChipStrip } from "./ChipStrip.tsx";
import type { Chip } from "./ChipStrip.tsx";
import { UaightChromeContext } from "./chrome-context.ts";
import type { UaightChromeApiV1 } from "./chrome-context.ts";
import { ControlPanelSlots } from "./chrome/ControlPanel.tsx";
import { resolveComponents } from "./chrome/defaults.ts";
import {
	CONTROL_PANEL_WIDTH,
	GRID_RENDER_BUDGET,
	GRID_TILE_HEIGHT,
	PANE_MAX_WIDTH,
	PANE_MIN_WIDTH,
	SEARCH_ATTR,
	SIDEBAR_WIDTH,
	ROOT_CLASS,
	VIEWPORT_INLINE_REASON,
	VIEWPORT_PRESETS,
} from "./constants.ts";
import { FOCUS_RING, MOTION, QUIET_BUTTON, SECTION_LABEL, cx } from "./cx.ts";
import { CSP_BLOCKED_PREFIX, FrameHost } from "./FrameHost.tsx";
import { GridView } from "./chrome/GridView.tsx";
import { HelpDialog } from "./HelpDialog.tsx";
import { openInEditor } from "./open-in-editor.ts";
import { PaneResizer } from "./PaneResizer.tsx";
import { buildPaletteItems, rankPaletteItems } from "./palette.ts";
import { useUaightDefaults } from "./provider-context.ts";
import { useRouterBinding } from "./router.ts";
import { pushRecent, readSession, sessionKey, writeSession } from "./session.ts";
import { decodeOverlays, encodeOverlays } from "./share.ts";
import { createOverlayStore, useOverlayState } from "./store.ts";
import { ensureStyles, readNonce } from "./styles.ts";
import { themeVars, useResolvedTheme } from "./theme.ts";

const InlineHost = lazy(() =>
	import("./InlineHost.tsx").then((m) => ({ default: m.InlineHost })),
);

const isDev = process.env.NODE_ENV !== "production";

/* ------------------------------------------------------------------ *
 * Names — §3.4 reconciliation, §3.5 progressive disclosure and warm pass
 * ------------------------------------------------------------------ */

/**
 * A `null` entry is §3.4's marker for "the default export IS the fixture", so
 * `[null]` is a single-fixture file and `names: null` (the whole field) is an
 * undecidable one. They are different states and neither is an empty list.
 */
type IndexedNames = Array<string | null>;
const SINGLE_FIXTURE: IndexedNames = [null];

/** Cached by content hash, so a remount does not reload every undecidable module. */
const nameCache = new Map<string, IndexedNames>();

/**
 * Publish this realm's hot registry as soon as the explorer is loaded (§4.5).
 *
 * The code the plugin injects into `virtual:uaight/runtime` and into every
 * fixture module reaches for it through `globalThis` and skips silently when it
 * is absent — so it has to exist before the first edit, not on first use.
 */
fixtureHotRegistry();

function readNames(mod: unknown): IndexedNames {
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

function sameNames(
	a: readonly (string | null)[],
	b: readonly (string | null)[],
): boolean {
	return a.length === b.length && a.every((n, i) => n === b[i]);
}

interface HotLike {
	on(event: string, cb: (data: unknown) => void): void;
	off?(event: string, cb: (data: unknown) => void): void;
	send?(event: string, data?: unknown): void;
}

function viteHot(): HotLike | undefined {
	return (import.meta as unknown as { hot?: HotLike }).hot;
}

/* ------------------------------------------------------------------ *
 * Chrome options — §5.1
 * ------------------------------------------------------------------ */

interface ResolvedChrome {
	tree: boolean;
	toolbar: boolean;
	controls: boolean;
	viewport: boolean;
	search: boolean;
}

function resolveChrome(chrome: UaightProps["chrome"]): ResolvedChrome {
	if (chrome === false) {
		return { tree: false, toolbar: false, controls: false, viewport: false, search: false };
	}
	if (chrome === true || chrome === undefined) {
		return { tree: true, toolbar: true, controls: true, viewport: true, search: true };
	}
	return {
		tree: chrome.tree ?? true,
		toolbar: chrome.toolbar ?? true,
		controls: chrome.controls ?? true,
		viewport: chrome.viewport ?? true,
		search: chrome.search ?? true,
	};
}

/* ------------------------------------------------------------------ *
 * Selection resolution — §3.5, §5.4
 * ------------------------------------------------------------------ */

interface Resolution {
	/** What the renderer is asked to render. */
	target: FixtureId | null;
	/** §3.5 — the file node stays selected; say what is actually on screen. */
	note: string | null;
	empty: { title: string; description?: ReactNode } | null;
	/** An undecidable file whose module has to be loaded before we can resolve. */
	pendingFile: FixtureFileIndex | null;
}

function resolve(
	selection: FixtureId | null,
	files: readonly FixtureFileIndex[],
): Resolution {
	const base: Resolution = { target: null, note: null, empty: null, pendingFile: null };

	if (!selection) {
		return {
			...base,
			empty: {
				title: "Nothing selected",
				description: "Pick a fixture from the list, or press / to search.",
			},
		};
	}

	const file = files.find((f) => f.path === selection.path);
	if (!file) {
		// §5.4 — well-formed but unknown: the parameter is PRESERVED, because it
		// may become valid after HMR or a deploy.
		return {
			...base,
			empty: {
				title: "That fixture is not here",
				description: (
					<>
						Nothing in this project resolves to <code>{selection.path}</code>. The link is kept,
						so it will start working if the file appears.
					</>
				),
			},
		};
	}

	if (file.names === null) return { ...base, pendingFile: file };

	// Every fixture in the file, as one page. Not a name in the index by
	// construction, so it has to be admitted before the membership check.
	if (selection.name === ALL_FIXTURES) {
		return file.names.length > 0
			? { ...base, target: selection }
			: {
					...base,
					empty: { title: "This file has no fixtures", description: selection.path },
				};
	}

	if (selection.name === null) {
		const first = file.names[0] ?? null;
		// `[null]` — the default export is the fixture, so the selection is exact.
		if (first === null) return { ...base, target: selection };

		// §3.5 — do NOT auto-select a child. Render the first one and say so.
		return {
			...base,
			target: { path: selection.path, name: first },
			note: `Showing "${first === "" ? "(empty name)" : first}" — the first fixture in this file. Pick one to link to it.`,
		};
	}

	if (file.names.includes(selection.name)) return { ...base, target: selection };

	return {
		...base,
		empty: {
			title: "That fixture name is not in this file",
			description: (
				<>
					<code>{selection.path}</code> has no fixture called{" "}
					<code>{selection.name === "" ? "(empty name)" : selection.name}</code>. The link is
					kept in case it comes back.
				</>
			),
		},
	};
}

/* ------------------------------------------------------------------ *
 * The explorer
 * ------------------------------------------------------------------ */

export default function UaightUI(props: UaightProps): ReactElement {
	const defaults = useUaightDefaults();
	const components = useMemo(
		() => resolveComponents(defaults.components, props.components),
		[defaults.components, props.components],
	);

	const theme = useResolvedTheme(props.theme ?? defaults.theme ?? "system");
	const rootRef = useRef<HTMLDivElement | null>(null);
	const mountId = `uaight${useId().replace(/[^\w]/g, "")}`;

	const isolation = props.isolation ?? "frame";
	const chrome = resolveChrome(props.chrome);

	/* ---- where you were, for the length of the tab (`ui/session.ts`) ---- */
	const storeKey = useMemo(
		() =>
			sessionKey(
				typeof window === "undefined" ? "" : window.location.pathname,
				props.routerId ?? mountId,
			),
		[props.routerId, mountId],
	);
	// Read once. Everything below owns its slice of the session from here on, so
	// re-reading would fight the state that was seeded from it.
	const restored = useMemo(() => readSession(storeKey), [storeKey]);
	const remember = useCallback(
		(patch: Parameters<typeof writeSession>[1]) => {
			writeSession(storeKey, patch);
		},
		[storeKey],
	);

	/* ---- host document stylesheet (§10.3, §6.7) ---- */
	useInsertionEffect(() => {
		if (typeof document === "undefined") return;
		ensureStyles(document, readNonce(document));
	}, []);

	/* ---- index, kept live by the plugin's HMR event (§4.5) ---- */
	const [index, setIndex] = useState<{
		files: FixtureFileIndex[];
		inventory: InventoryItem[];
		callSites: CallSiteGroup[];
	}>(() => ({
		files: config.files,
		inventory: config.inventory,
		callSites: config.callSites ?? [],
	}));

	useEffect(() => {
		const hot = viteHot();
		if (!hot) return;
		const handler = (data: unknown) => {
			const next = data as Partial<FixtureIndex> | null;
			if (!next || !Array.isArray(next.files)) return;
			setIndex({
				files: next.files,
				inventory: Array.isArray(next.inventory) ? next.inventory : [],
				callSites: Array.isArray(next.callSites) ? next.callSites : [],
			});
		};
		hot.on("uaight:index", handler);
		// §4.5 — ask for the current index rather than only listening for the next
		// change. A custom event is delivered to the clients connected when it is
		// sent, and a mount whose page was loading while a file was added missed
		// it: its `config.files` came from a module generated before the rescan,
		// and nothing would ever correct it. It used to be corrected by accident,
		// because a topology change reloaded the page.
		hot.send?.("uaight:hello");
		return () => hot.off?.("uaight:index", handler);
	}, []);

	/* ---- names learned by loading a module (§3.4, §3.5) ---- */
	const [discovered, setDiscovered] = useState<ReadonlyMap<string, IndexedNames>>(
		() => new Map(),
	);

	const loadNames = useCallback(async (file: FixtureFileIndex) => {
		const cached = nameCache.get(file.hash);
		if (cached) {
			setDiscovered((prev) => new Map(prev).set(file.path, cached));
			return;
		}
		// The hot map, so a file added since load is loadable without a reload (§4.5).
		const load = loadFixtureModule(fixtureModules, file.globPath);
		if (!load) return;
		try {
			const names = readNames(await load);
			nameCache.set(file.hash, names);
			// §3.4 reconciliation — name the file and both lists.
			if (isDev && file.names && !sameNames(file.names, names)) {
				console.warn(
					`[uaight] the static index and ${file.globPath} disagree about fixture ` +
						`names.\n  indexed: ${JSON.stringify(file.names)}\n  actual:  ${JSON.stringify(names)}`,
				);
			}
			setDiscovered((prev) => new Map(prev).set(file.path, names));
		} catch (error) {
			console.error(`[uaight] could not load ${file.globPath} to read its names.`, error);
		}
	}, []);

	const files = useMemo(
		() =>
			index.files.map((file) => {
				const names = discovered.get(file.path) ?? file.names;
				// `[]` is not a legal value: §3.4 has `[null]` for a single fixture
				// and `null` for undecidable. Defended anyway, because an empty list
				// would leave an unselectable node in the tree rather than fail loudly.
				const normalized = names && names.length === 0 ? SINGLE_FIXTURE : names;
				return normalized === file.names ? file : { ...file, names: normalized };
			}),
		[index.files, discovered],
	);

	/* ---- §3.5 warm pass: development only, deferred past first paint ---- */
	useEffect(() => {
		if (config.index !== "warm" || config.command !== "serve") return;
		const pending = index.files.filter((f) => f.names === null && !discovered.has(f.path));
		if (!pending.length) return;
		let cancelled = false;
		const run = () => {
			for (const file of pending) {
				if (cancelled) return;
				void loadNames(file);
			}
		};
		const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
			.requestIdleCallback;
		const handle = idle ? idle(run) : window.setTimeout(run, 0);
		return () => {
			cancelled = true;
			if (!idle) window.clearTimeout(handle);
		};
	}, [index.files, discovered, loadNames]);

	/* ---- selection precedence — §5.3 ---- */
	const routerSpec = props.router ?? "none";
	const urlParam = props.urlParam ?? "fixture";
	const controlled = props.selected !== undefined;
	const pinnedInput = props.fixture;
	const pinned = useMemo(
		() => (pinnedInput === undefined ? null : parseFixtureId(pinnedInput)),
		[pinnedInput],
	);

	const mode: "controlled" | "pinned" | "router" | "local" = controlled
		? "controlled"
		: pinnedInput !== undefined
			? "pinned"
			: routerSpec !== "none"
				? "router"
				: "local";

	useEffect(() => {
		if (!isDev) return;
		if (props.selected !== undefined && props.fixture !== undefined) {
			console.error(
				"[uaight] `selected` and `fixture` were both given. `selected` wins and " +
					"`fixture` is ignored — one of them is not doing what you think.",
			);
		}
		if (
			props.selected !== undefined &&
			props.router !== undefined &&
			props.router !== "none"
		) {
			console.error(
				"[uaight] `selected` was given together with an explicit router. Controlled " +
					"selection ignores the router, so the URL will not be written. Drop " +
					"`router`, or drop `selected` and let uaight own the parameter.",
			);
		}
	}, [props.selected, props.fixture, props.router]);

	const binding = useRouterBinding({
		router: routerSpec,
		urlParam,
		routerId: props.routerId,
		active: mode === "router",
	});

	const [localSelection, setLocalSelection] = useState<FixtureId | null>(null);
	const [selectedComponent, setSelectedComponent] = useState<InventoryItem | null>(null);
	/** Which harvested usage of the selected component is on screen. */
	const [selectedSite, setSelectedSite] = useState<CallSite | null>(null);

	const routerSelection = binding.owned ? parseFixtureId(binding.value) : localSelection;
	const selection: FixtureId | null =
		mode === "controlled"
			? (props.selected ?? null)
			: mode === "pinned"
				? pinned
				: mode === "router"
					? binding.pending
						? null
						: routerSelection
					: localSelection;

	// §5.4 — malformed ids are removed with replace; well-formed ones are kept.
	const { owned: routerOwned, value: routerValue, write: routerWrite } = binding;
	useEffect(() => {
		if (!routerOwned || routerValue === null) return;
		if (parseFixtureId(routerValue) === null) routerWrite(null, { replace: true });
	}, [routerOwned, routerValue, routerWrite]);

	const onSelectProp = props.onSelect;
	const select = useCallback(
		(id: FixtureId | null) => {
			setSelectedComponent(null);
			setSelectedSite(null);
			// Legal without `selected` (§5.3), so it always fires.
			onSelectProp?.(id);
			if (mode === "controlled" || mode === "pinned") return;
			if (mode === "router" && routerOwned) {
				// User selection pushes; corrections replace (§5.4).
				routerWrite(id ? serializeFixtureId(id) : null, { replace: false });
			} else {
				setLocalSelection(id);
			}
		},
		[mode, routerOwned, routerWrite, onSelectProp],
	);

	/**
	 * §12 — selecting a detected component is the ONLY thing that renders one.
	 * It is not a `FixtureId`, so it cannot travel through `onSelect` or the
	 * URL; it clears the fixture selection and lives in local state.
	 */
	const selectComponent = useCallback(
		(item: InventoryItem, site: CallSite | null = null) => {
			setSelectedComponent(item);
			setSelectedSite(site);
			if (mode === "controlled" || mode === "pinned") return;
			if (mode === "router" && routerOwned) routerWrite(null, { replace: true });
			else setLocalSelection(null);
			onSelectProp?.(null);
		},
		[mode, routerOwned, routerWrite, onSelectProp],
	);

	/** `component.select(null)` on the facade — back to no component, no fixture. */
	const clearComponent = useCallback(() => {
		setSelectedComponent(null);
		setSelectedSite(null);
	}, []);

	/**
	 * Restore the last selection — once, and only into a vacuum.
	 *
	 * §5.4's precedence is untouched: `selected` and `fixture` are the caller's
	 * and are never overwritten; a router-owned URL parameter already names a
	 * fixture, so the deep link wins; and the restore is skipped entirely while
	 * the binding is still resolving, because "no parameter yet" and "no
	 * parameter" look identical for one render and guessing wrong would replace a
	 * shared link with yesterday's selection.
	 *
	 * It writes with `replace`, not `push`: reopening a tab is not a navigation,
	 * and a restored selection must not put an entry in the back button that
	 * takes the user to a blank explorer.
	 */
	const didRestore = useRef(false);
	useEffect(() => {
		if (didRestore.current) return;
		if (mode !== "local" && mode !== "router") {
			didRestore.current = true;
			return;
		}
		if (mode === "router" && binding.pending) return;
		didRestore.current = true;
		if (selection) return;
		const saved = restored.selection ? parseFixtureId(restored.selection) : null;
		if (!saved) return;
		if (mode === "router" && routerOwned) {
			routerWrite(serializeFixtureId(saved), { replace: true });
		} else {
			setLocalSelection(saved);
		}
	}, [mode, binding.pending, selection, restored.selection, routerOwned, routerWrite]);

	useEffect(() => {
		// A component selection is not a `FixtureId` and has no serialization
		// (§19.3), so it is not what gets remembered; the fixture underneath it is.
		if (!didRestore.current) return;
		remember({ selection: selection ? serializeFixtureId(selection) : null });
	}, [selection, remember]);

	/**
	 * The usages of the selected component, harvested from the project's own
	 * source. This is what turns §12's list of names into something worth
	 * selecting: a detected component with no props usually renders a crash, and
	 * its real props are already written down wherever the app uses it.
	 */
	const componentSites = useMemo(
		() => (selectedComponent ? callSitesFor(index.callSites, selectedComponent) : []),
		[index.callSites, selectedComponent],
	);

	// Land on the most distinct usage rather than an empty render. Selecting the
	// component itself stays available as "no props" in the toolbar.
	useEffect(() => {
		if (!selectedComponent || selectedSite || !componentSites.length) return;
		setSelectedSite(componentSites[0] ?? null);
	}, [selectedComponent, selectedSite, componentSites]);

	// §5.3 — a `fixture` outside `filter` renders anyway, with a warning.
	useEffect(() => {
		if (!isDev || !pinned || props.filter === undefined) return;
		if (!matchesFilter(pinned.path, props.filter)) {
			console.warn(
				`[uaight] the pinned fixture "${pinned.path}" is outside \`filter\`. It is ` +
					"rendered anyway — filter scopes the tree, it never blocks the `fixture` prop.",
			);
		}
	}, [pinned, props.filter]);

	/* ---- tree — §19.3 ---- */
	const inventoryEnabled = config.inventoryEnabled && index.inventory.length > 0;

	const fixtureNodes = useMemo(
		() => buildTree({ files, filter: props.filter }),
		[files, props.filter],
	);
	const mergedNodes = useMemo(
		() =>
			inventoryEnabled
				? buildTree({ files, inventory: index.inventory, filter: props.filter })
				: fixtureNodes,
		[inventoryEnabled, files, index.inventory, props.filter, fixtureNodes],
	);
	const inventoryItems = useMemo(
		() =>
			inventoryEnabled
				? index.inventory.filter((i) => matchesFilter(i.path, props.filter))
				: [],
		[inventoryEnabled, index.inventory, props.filter],
	);

	// Groups are expanded by default, so the backing state is what is CLOSED.
	// Restored from the session: a reload that re-opens every directory in an
	// 82-file corpus has thrown away work, and Q14's "not persisted" is an answer
	// about control VALUES, which HMR can reshape. A collapsed directory cannot
	// go stale — at worst it names a key that no longer exists, and an unknown
	// key in this set is inert.
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
		() => new Set(restored.collapsed),
	);
	useEffect(() => {
		remember({ collapsed: [...collapsed] });
	}, [collapsed, remember]);
	const expanded = useMemo(() => {
		const keys = new Set<string>();
		const walk = (nodes: readonly TreeNode[]) => {
			for (const node of nodes) {
				if (node.children?.length) {
					if (!collapsed.has(node.key)) keys.add(node.key);
					walk(node.children);
				}
			}
		};
		walk(mergedNodes);
		return keys;
	}, [mergedNodes, collapsed]);

	const toggle = useCallback((key: string) => {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	const selectable = useMemo(() => flattenSelectable(fixtureNodes), [fixtureNodes]);
	/** What ↑/↓ walks: one row per file, its variants left to ←/→. */
	const rows = useMemo(() => flattenRows(fixtureNodes), [fixtureNodes]);

	const step = useCallback(
		(delta: number) => {
			if (!rows.length) return;
			// A variant selection highlights its file's row, so when the exact id
			// is not itself a row, fall back to the file it belongs to.
			let index_ = rows.findIndex((n) => fixtureIdsEqual(n.fixture, selection));
			if (index_ < 0 && selection) {
				index_ = rows.findIndex((n) => n.fixture?.path === selection.path);
			}
			const next =
				rows[Math.max(0, Math.min(rows.length - 1, (index_ < 0 ? -1 : index_) + delta))];
			if (next?.fixture) select(next.fixture);
		},
		[rows, selection, select],
	);

	/**
	 * The fixtures of the selected file, listed in the toolbar rather than nested
	 * in the sidebar. `null` means the selection has no siblings worth showing.
	 */
	const variants = useMemo(() => {
		if (!selection) return null;
		const find = (list: readonly TreeNode[]): TreeNode | null => {
			for (const node of list) {
				if (node.kind === "file" && node.fixture?.path === selection.path) return node;
				const hit = node.children ? find(node.children) : null;
				if (hit) return hit;
			}
			return null;
		};
		const file = find(fixtureNodes);
		const children = file?.children?.filter((c) => c.fixture) ?? [];
		return children.length > 1 && file?.fixture ? { all: file.fixture, children } : null;
	}, [selection?.path, fixtureNodes]);

	/** ←/→ walk the ring the toolbar chips draw: "All", then each fixture. */
	const stepVariant = useCallback(
		(delta: number) => {
			if (!variants) return;
			const ring = [variants.all, ...variants.children.map((c) => c.fixture!)];
			const at = ring.findIndex((id) => fixtureIdsEqual(id, selection));
			const from = at < 0 ? 0 : at;
			const next = ring[(((from + delta) % ring.length) + ring.length) % ring.length];
			if (next) select(next);
		},
		[variants, selection, select],
	);

	/* ---- resolution and progressive disclosure — §3.5 ---- */
	const resolution = useMemo(() => resolve(selection, files), [selection, files]);

	useEffect(() => {
		if (resolution.pendingFile) void loadNames(resolution.pendingFile);
	}, [resolution.pendingFile, loadNames]);

	/* ---- overlay store and transport — §7.2, §8 ---- */
	const store = useMemo(() => createOverlayStore(), []);
	const overlayState = useOverlayState(store);
	const [transport, setTransport] = useState<HostTransport | null>(null);
	const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");
	const [error, setError] = useState<RendererError | null>(null);
	const [contentHeight, setContentHeight] = useState<number | null>(null);
	const [frameKey, setFrameKey] = useState(0);

	const selectRef = useRef(select);
	selectRef.current = select;

	const handleTransport = useCallback((next: HostTransport | null) => {
		setTransport(next);
		if (!next) setStatus("connecting");
	}, []);

	/**
	 * §6.7 step 5 — a message that names the violated directive is the answer;
	 * "the preview did not report READY" is the symptom.
	 *
	 * Three things notice a blocked renderer and the vaguest of them, the
	 * handshake timeout, always speaks last. Last-write-wins therefore threw away
	 * the only message the spec actually asks for, so a named directive is sticky
	 * until something clears the error outright (a fixture change, a reload).
	 */
	const reportError = useCallback((next: RendererError | null) => {
		setError((current) => {
			if (!next) return null;
			if (current?.message.startsWith(CSP_BLOCKED_PREFIX)) {
				return next.message.startsWith(CSP_BLOCKED_PREFIX) ? next : current;
			}
			return next;
		});
	}, []);

	useEffect(() => {
		if (!transport) return;
		setStatus(transport.status);
		reportError(transport.error);
		return transport.onStatusChange(() => {
			setStatus(transport.status);
			if (transport.error) reportError(transport.error);
		});
	}, [transport, reportError]);

	useEffect(() => {
		if (!transport) return;
		return transport.subscribe((message) => {
			switch (message.type) {
				case "INPUT_REGISTERED": {
					const overlay = store.register(message);
					if (overlay) {
						transport.send({
							type: "OVERLAY",
							name: overlay.input,
							revision: overlay.revision,
							patches: overlay.patches,
						});
					}
					break;
				}
				case "INPUTS_SETTLED":
					store.settle(message.names);
					break;
				case "RESYNC": {
					const overlay = store.resync(message);
					transport.send({
						type: "OVERLAY",
						name: message.name,
						revision: message.revision,
						patches: overlay?.patches ?? [],
					});
					break;
				}
				case "OVERLAY":
					// §7.3 — the fixture called its own setter.
					if (message.fromRenderer) store.adopt(message);
					break;
				case "RESIZE":
					setContentHeight(message.height);
					break;
				case "RENDERER_ERROR":
					setError(message.error);
					break;
				case "NAVIGATE":
					selectRef.current(message.fixture);
					break;
				default:
					break;
			}
		});
	}, [transport, store]);

	const target = resolution.target;
	const targetKey = target ? serializeFixtureId(target) : "";
	const siteKey = selectedSite
		? `${selectedSite.globPath}:${selectedSite.line}:${selectedSite.column}`
		: "";
	const componentKey = selectedComponent
		? `${selectedComponent.globPath}#${selectedComponent.exportName}#${siteKey}`
		: "";

	const selectMessage = useMemo(
		() => ({
			type: "SELECT_FIXTURE" as const,
			fixture: componentKey ? null : (parseFixtureId(targetKey) ?? null),
			component: selectedComponent
				? {
						globPath: selectedComponent.globPath,
						exportName: selectedComponent.exportName,
					}
				: null,
			// Harvested props travel with the selection. They are JSON by
			// construction — the harvester only records what it could read
			// statically — so nothing opaque can cross the realm boundary here.
			props: selectedSite ? selectedSite.props : null,
			children: selectedSite?.children ?? null,
			origin: selectedSite ? callSiteLabel(selectedSite) : null,
		}),
		// `targetKey`/`componentKey` are the identity; the objects are not stable.
		[targetKey, componentKey, selectedComponent, selectedSite],
	);

	/** A shared link's patches, kept so `store.clear()` cannot outrun them. */
	const seededOverlays = useRef<{ key: string; overlays: InputOverlay[] }>({
		key: "",
		overlays: [],
	});

	useEffect(() => {
		if (!transport) return;
		// Overlays are dropped on fixture change (§7.3) — but a link's patches are
		// not an overlay yet, they are waiting for the inputs they name, and they
		// belong to the fixture we are switching TO when the key matches.
		store.clear();
		const held = seededOverlays.current;
		if (held.key === targetKey && held.overlays.length) store.seed(held.overlays);
		setError(null);
		transport.send(selectMessage);
	}, [transport, selectMessage, store, targetKey]);

	/**
	 * §4.5 — hand the renderer the index we are showing.
	 *
	 * The renderer resolves a fixture id against its own `config.files`, which is
	 * whatever its realm booted with. Adding or renaming a file leaves it unable
	 * to resolve an id the tree is already offering, and the dev server cannot
	 * close that race on its own: Vite re-globs the moment the file lands, which
	 * is before the plugin's debounced rescan has produced the index that goes
	 * with it. The host has the reconciled one, so it says so.
	 */
	useEffect(() => {
		if (!transport || status !== "ready") return;
		transport.send({
			type: "SET_INDEX",
			files: index.files,
			decorators: config.decorators,
		});
	}, [transport, status, index.files]);

	// A frame reload re-runs the handshake; replay the current selection onto it.
	const selectMessageRef = useRef(selectMessage);
	selectMessageRef.current = selectMessage;
	useEffect(() => {
		if (!transport || status !== "ready") return;
		transport.send(selectMessageRef.current);
	}, [transport, status]);

	/* ---- shareable control state — §5.4, revisited ---- */

	const stateParam = props.stateParam ?? "state";
	const shareState = (props.shareState ?? true) && mode === "router";
	const {
		owned: stateOwned,
		value: stateValue,
		write: stateWrite,
	} = useRouterBinding({
		router: routerSpec,
		urlParam: stateParam,
		routerId: props.routerId,
		active: shareState,
	});

	// Seed once per fixture: a link's patches wait in the store until the inputs
	// they name register, and are pruned against the current shape like any
	// other patch (§7.3). Re-seeding on our own writes would be a loop, so the
	// guard is the fixture, not the parameter.
	//
	// Two things this has to get right, and neither is obvious:
	//
	//  - a token we wrote ourselves belongs to the fixture we wrote it FOR. On a
	//    fixture change the parameter is still in the URL for the commit or two
	//    before the effect below clears it, and seeding from it there would
	//    re-apply the previous fixture's edits to the next one — §7.3 says
	//    overlays are dropped on fixture change, so that is exactly wrong. A
	//    token identical to our last write is therefore never seeded; a token in
	//    the URL of a page we did not write is, which is the shared-link case;
	//  - `seed` is called unconditionally, including with nothing. Patches wait
	//    in the store until the input they name registers, so an empty seed is
	//    the only thing that discards ones that never found their input — and
	//    without it they lie in wait for a *later* fixture that happens to use
	//    the same input name.
	//
	// The guard is the fixture AND the token, not the fixture alone. Ownership
	// is arbitrated in a layout effect while the parameter is read through
	// `useSyncExternalStore`, so there is one commit — reliably reachable under
	// React 18 — where this mount owns the key and the snapshot is still the
	// `null` it returned while ownership was pending. Keying on the fixture
	// alone burned the one seed on that commit and the link's own patches, which
	// arrive on the next one, were never seeded at all.
	const seededFor = useRef<string | null>(null);
	useEffect(() => {
		if (!shareState || !stateOwned) return;
		const key = `${targetKey}\u0000${stateValue ?? ""}`;
		if (seededFor.current === key) return;
		seededFor.current = key;
		const ours =
			lastWrittenState.current !== null && stateValue === lastWrittenState.current;
		const seeded = ours ? [] : decodeOverlays(stateValue);
		// Held as well as seeded: the effect that drops overlays on fixture change
		// runs once more when the transport arrives, which is a commit LATER than
		// this one, and its `store.clear()` would otherwise take the link's
		// patches with it. Under React 19 the two happened to land together;
		// under React 18 they reliably did not, and the link silently did nothing.
		seededOverlays.current = { key: targetKey, overlays: seeded };
		store.seed(seeded);
	}, [shareState, stateOwned, stateValue, targetKey, store]);

	const lastWrittenState = useRef<string | null>(null);
	useEffect(() => {
		if (!shareState || !stateOwned) return;
		const encoded = encodeOverlays(overlayState.overlays);
		if (encoded === lastWrittenState.current) return;
		// Never clear a parameter we have not written: opening a shared link and
		// touching nothing has to leave the link intact.
		if (encoded === null && lastWrittenState.current === null) return;
		lastWrittenState.current = encoded;
		// State edits replace rather than push — twenty tweaks to a slider should
		// not be twenty entries in the back button.
		stateWrite(encoded, { replace: true });
	}, [shareState, stateOwned, stateWrite, overlayState.overlays]);

	/* ---- viewport — §6.5, §3.1 ---- */

	/**
	 * Two sources, and the rule between them is stickiness.
	 *
	 * `undefined` means the user has not chosen: the fixture's own `fileMeta` /
	 * `fixtureMeta` viewport applies (§3.1), and when it has none that is Fit,
	 * which is what the preview did before. `null` and a preset are both
	 * *choices* — including choosing Fit — and a choice survives changing
	 * fixture, because the whole reason to pin 375px is to walk a list of
	 * components at 375px. Resetting to Fit on every selection made the control
	 * useless for the one job it exists to do.
	 *
	 * The meta rides on the index rather than arriving as a message precisely so
	 * this is known before the first paint: under `index: "static"` no module is
	 * executed, and a viewport applied after the preview opened would be a resize
	 * the user watches happen.
	 */
	const [manualViewport, setManualViewport] = useState<ViewportPreset | null | undefined>(
		undefined,
	);
	const fixtureViewport = useMemo<ViewportPreset | null>(() => {
		const id = resolution.target ?? selection;
		if (!id) return null;
		const file = files.find((f) => f.path === id.path);
		const wanted = file ? viewportFor(file, id.name) : undefined;
		if (!wanted) return null;
		// Name it after the preset it matches, so the toolbar shows the row as
		// pressed rather than showing nothing pressed at a preset's dimensions.
		const preset = VIEWPORT_PRESETS.find(
			(p) => p.width === wanted.width && p.height === wanted.height,
		);
		return preset ?? { name: "Fixture", width: wanted.width, height: wanted.height };
	}, [resolution.target, selection, files]);

	const viewport = manualViewport === undefined ? fixtureViewport : manualViewport;
	const setViewport = useCallback((next: ViewportPreset | null) => {
		setManualViewport(next);
	}, []);
	const viewportSupported = isolation === "frame";
	const effectiveViewport = viewportSupported && chrome.viewport ? viewport : null;

	/* ---- controls ---- */
	const setInput = useCallback(
		(name: string, path: PathSegment[], value: EditableWire) => {
			const overlay = store.set(name, path, value);
			if (overlay && transport) {
				transport.send({
					type: "OVERLAY",
					name: overlay.input,
					revision: overlay.revision,
					patches: overlay.patches,
				});
			}
		},
		[store, transport],
	);

	/**
	 * Transient status, with one optional action. SPEC.md §10.1.
	 *
	 * Non-modal and in the layout rather than floating over the preview, because
	 * the preview is the thing the user is looking at; it is a `role="status"`
	 * region so a screen reader is told, and its action is a real button in the
	 * tab order rather than a gesture. `id` exists so an identical message shown
	 * twice restarts the timer instead of appearing not to have happened.
	 */
	interface Toast {
		id: number;
		message: string;
		tone: "info" | "danger";
		action?: { label: string; run: () => void };
	}
	const [toast, setToast] = useState<Toast | null>(null);
	const toastId = useRef(0);
	const showToast = useCallback((next: Omit<Toast, "id">) => {
		toastId.current += 1;
		setToast({ ...next, id: toastId.current });
	}, []);

	// Long enough to reach by keyboard from wherever focus happens to be, which
	// is the constraint a toast with an action has and a toast without one does
	// not. It never steals focus, so the only cost of the delay is a line of text.
	useEffect(() => {
		if (!toast) return;
		const handle = window.setTimeout(
			() => setToast((current) => (current?.id === toast.id ? null : current)),
			toast.action ? 12_000 : 4_000,
		);
		return () => window.clearTimeout(handle);
	}, [toast]);

	// Read at reset time rather than closed over, so the callback stays stable.
	const overlaysRef = useRef<InputOverlay[]>(overlayState.overlays);
	overlaysRef.current = overlayState.overlays;

	const sendOverlay = useCallback(
		(overlay: InputOverlay, patches = overlay.patches) => {
			transport?.send({
				type: "OVERLAY",
				name: overlay.input,
				revision: overlay.revision,
				patches,
			});
		},
		[transport],
	);

	/**
	 * `r` and "Reset all" both land here, and both used to be final: the values
	 * are not persisted (Q14) and nothing kept a history, so one mis-typed key
	 * over the tree destroyed however long the user had spent tuning. The snapshot
	 * is taken before the store is cleared and handed to the toast, which is the
	 * cheapest possible undo — one step, one action, gone when it expires.
	 */
	const resetInput = useCallback(
		(name?: string) => {
			const snapshot = overlaysRef.current
				.filter((o) => (name === undefined || o.input === name) && o.patches.length > 0)
				.map((o) => ({ ...o, patches: [...o.patches] }));

			const cleared = store.reset(name);
			if (transport) {
				if (name === undefined) transport.send({ type: "SET_OVERLAYS", overlays: [] });
				for (const overlay of cleared) sendOverlay(overlay, []);
			}
			if (snapshot.length === 0) return;

			const count = snapshot.reduce((total, o) => total + o.patches.length, 0);
			showToast({
				message:
					name === undefined
						? `Reset ${count} ${count === 1 ? "setting" : "settings"}.`
						: `Reset ${name}.`,
				tone: "info",
				action: {
					label: "Undo",
					run: () => {
						// §7.3 prunes the snapshot against the CURRENT registration, so an
						// undo after an HMR restores what still fits and silently drops
						// what does not — the alternative is patching a shape that is gone.
						for (const overlay of store.restore(snapshot)) sendOverlay(overlay);
						setToast(null);
					},
				},
			});
		},
		[store, transport, sendOverlay, showToast],
	);

	/* ---- clipboard, with an answer ---- */

	/**
	 * "Copy link" was fire-and-forget, and its `execCommand` fallback — which
	 * exists because a dev server on a LAN address is not a secure context and
	 * `navigator.clipboard` refuses there — could fail into the console and
	 * nowhere else. A copy button that does nothing visible is indistinguishable
	 * from a copy button that worked, so both outcomes are now stated: the label
	 * flips for a moment on success, and a failure says so in the status region
	 * with the reason, which is almost always the origin.
	 */
	const [copied, setCopied] = useState<string | null>(null);
	const copiedTimer = useRef(0);
	useEffect(
		() => () => {
			window.clearTimeout(copiedTimer.current);
		},
		[],
	);

	const copy = useCallback(
		async (key: string, text: string, what: string) => {
			if (await copyText(text)) {
				setCopied(key);
				window.clearTimeout(copiedTimer.current);
				copiedTimer.current = window.setTimeout(() => setCopied(null), 1500);
				return;
			}
			showToast({
				tone: "danger",
				message: `Could not copy ${what}. The clipboard needs a secure context — this page is ${window.location.protocol}//${window.location.host}.`,
			});
		},
		[showToast],
	);

	/**
	 * A call-site chip names a file, a line and a column, and until now that was
	 * where it stopped. Vite's dev server already mounts `/__open-in-editor`, so
	 * the chip can finish the sentence. The static build has no such endpoint and
	 * says so rather than failing quietly (`ui/open-in-editor.ts`).
	 */
	const openSite = useCallback(
		async (site: CallSite) => {
			const result = await openInEditor(site);
			if (result === "opened") return;
			showToast({
				tone: "danger",
				message:
					result === "unavailable"
						? `${callSiteLabel(site)} — opening in an editor needs the Vite dev server; this build does not have one.`
						: `${callSiteLabel(site)} — the dev server could not launch an editor. Set $EDITOR, or open the file yourself.`,
			});
		},
		[showToast],
	);

	/* ---- pane widths and the inventory disclosure — §10.1, `ui/session.ts` ---- */
	const [sidebarWidth, setSidebarWidth] = useState(
		() => restored.sidebarWidth ?? SIDEBAR_WIDTH,
	);
	const [panelWidth, setPanelWidth] = useState(
		() => restored.panelWidth ?? CONTROL_PANEL_WIDTH,
	);
	const [inventoryOpen, setInventoryOpen] = useState(() => restored.inventoryOpen);

	const resizeSidebar = useCallback(
		(width: number) => {
			setSidebarWidth(width);
			remember({ sidebarWidth: width });
		},
		[remember],
	);
	const resizePanel = useCallback(
		(width: number) => {
			setPanelWidth(width);
			remember({ panelWidth: width });
		},
		[remember],
	);
	const toggleInventory = useCallback(() => {
		setInventoryOpen((open) => {
			remember({ inventoryOpen: !open });
			return !open;
		});
	}, [remember]);

	/* ---- codecs (§7.7) — loaded lazily so editors stay out of the first paint ---- */
	const [loadedCodecs, setLoadedCodecs] = useState<FixtureCodec[] | undefined>(undefined);
	useEffect(() => {
		if (!config.hasCodecs) return;
		let live = true;
		import("virtual:uaight/codecs")
			.then((m) => {
				if (live) setLoadedCodecs(m.codecs);
			})
			.catch((e: unknown) => console.error("[uaight] the codec module failed to load.", e));
		return () => {
			live = false;
		};
	}, []);
	const codecs = useMemo(
		() => [...(defaults.codecs ?? []), ...(loadedCodecs ?? [])],
		[defaults.codecs, loadedCodecs],
	);

	/* ---- command palette — ⌘K ---- */

	const [paletteOpen, setPaletteOpen] = useState(false);
	const [paletteQuery, setPaletteQuery] = useState("");

	const paletteItems = useMemo(
		() =>
			buildPaletteItems({
				nodes: fixtureNodes,
				inventory: inventoryItems,
				callSites: index.callSites,
			}),
		[fixtureNodes, inventoryItems, index.callSites],
	);
	/**
	 * The MRU list behind an empty ⌘K. Persisted with the rest of the session, so
	 * it survives the reload that a fixture edit causes; a key naming something
	 * that no longer exists is skipped by the ranker rather than repaired here.
	 */
	const [recents, setRecents] = useState<string[]>(() => restored.recents);
	const rankedItems = useMemo(
		() => rankPaletteItems(paletteItems, paletteQuery, 50, recents),
		[paletteItems, paletteQuery, recents],
	);

	const closePalette = useCallback(() => {
		setPaletteOpen(false);
		setPaletteQuery("");
	}, []);

	const onPaletteSelect = useCallback(
		(item: CommandPaletteItem) => {
			closePalette();
			setRecents((prev) => {
				const next = pushRecent(prev, item.key);
				remember({ recents: next });
				return next;
			});
			if (item.kind === "fixture" && item.fixture) {
				select(item.fixture);
				return;
			}
			if (item.component) selectComponent(item.component, item.callSite ?? null);
		},
		[closePalette, select, selectComponent, remember],
	);

	/* ---- the facade — §19.3 ---- */
	const api = useMemo<UaightChromeApiV1>(
		() => ({
			fixtureTree: {
				nodes: mergedNodes,
				expanded,
				toggle,
				search: (q: string) => searchTree(mergedNodes, q),
			},
			inventory: { components: inventoryItems, enabled: inventoryEnabled },
			component: {
				current: selectedComponent
					? { component: selectedComponent, callSite: selectedSite }
					: null,
				select: (item, site) => {
					if (item) selectComponent(item, site ?? null);
					else clearComponent();
				},
				callSites: index.callSites,
			},
			palette: {
				open: paletteOpen,
				setOpen: setPaletteOpen,
				query: paletteQuery,
				setQuery: setPaletteQuery,
				items: rankedItems,
				select: onPaletteSelect,
			},
			selection: {
				current: selection,
				select,
				next: () => step(1),
				previous: () => step(-1),
			},
			inputs: {
				registered: overlayState.registered,
				overlay: overlayState.overlays,
				set: setInput,
				reset: resetInput,
			},
			viewport: {
				current: effectiveViewport,
				presets: [...VIEWPORT_PRESETS],
				set: setViewport,
				supported: viewportSupported,
			},
			status: {
				loading: status !== "ready",
				error,
				isolation,
				droppedPatches: overlayState.dropped,
				droppedInputs: overlayState.droppedInputs,
			},
		}),
		[
			mergedNodes,
			expanded,
			toggle,
			inventoryItems,
			inventoryEnabled,
			selectedComponent,
			selectedSite,
			selectComponent,
			clearComponent,
			index.callSites,
			paletteOpen,
			paletteQuery,
			rankedItems,
			onPaletteSelect,
			selection,
			select,
			step,
			overlayState,
			setInput,
			resetInput,
			effectiveViewport,
			viewportSupported,
			status,
			error,
			isolation,
		],
	);

	/* ---- grid mode ---- */

	/**
	 * Every fixture at once, instead of one.
	 *
	 * Local state rather than a route: the grid is a way of *looking* at the
	 * corpus, and a shared link is about a fixture. It is also off by default
	 * everywhere — a grid is many frames, and nobody should pay for one by
	 * opening the explorer.
	 */
	const [gridOpen, setGridOpen] = useState(false);

	/**
	 * What the grid shows: the same rows the sidebar is showing, so a search
	 * narrows the grid exactly as it narrows the tree. Detected components are
	 * left out — §12 renders one only on explicit selection, and forty tiles is
	 * not that.
	 */
	const gridTiles = useMemo(
		() =>
			selectable
				.filter((node) => node.fixture && node.kind !== "component")
				.map((node) => ({
					fixture: node.fixture!,
					label: node.label,
					path: node.fixture!.path,
				})),
		[selectable],
	);

	// Frame isolation is what a tile is; inline mode has one realm by definition.
	const gridSupported = isolation === "frame";
	const gridActive = gridOpen && gridSupported;

	/* ---- keyboard — §10.1 ---- */
	const [helpOpen, setHelpOpen] = useState(false);

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		// Scoped to this mount rather than the document, like every other
		// shortcut here: an embedded explorer must not take ⌘K from its host.
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			setPaletteOpen((open) => !open);
			return;
		}
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		const typing = !!target?.closest?.("input, textarea, select, [contenteditable='true']");

		if (event.key === "Escape" && helpOpen) {
			event.preventDefault();
			setHelpOpen(false);
			return;
		}
		if (typing) return;
		// The tree owns arrows while focus is inside it — there they rove and
		// expand — and it has already called preventDefault on the ones it took.
		if (event.defaultPrevented) return;

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				step(1);
				return;
			case "ArrowUp":
				event.preventDefault();
				step(-1);
				return;
			case "ArrowRight":
				if (!variants) return;
				event.preventDefault();
				stepVariant(1);
				return;
			case "ArrowLeft":
				if (!variants) return;
				event.preventDefault();
				stepVariant(-1);
				return;
			case "/":
				event.preventDefault();
				rootRef.current?.querySelector<HTMLInputElement>(`[${SEARCH_ATTR}]`)?.focus();
				return;
			case "?":
				event.preventDefault();
				setHelpOpen((v) => !v);
				return;
			case "j":
				event.preventDefault();
				step(1);
				return;
			case "k":
				event.preventDefault();
				step(-1);
				return;
			case "r":
				if (overlayState.overlays.length) {
					event.preventDefault();
					resetInput();
				}
				return;
			case "g":
				if (!gridSupported) return;
				event.preventDefault();
				setGridOpen((v) => !v);
				return;
			default:
				return;
		}
	};

	/* ---- layout ---- */
	const showTree = chrome.tree && mode !== "pinned";
	const showControls = chrome.controls && overlayState.registered.length > 0;
	const heightProp = props.height ?? (chrome.tree ? 560 : "auto");
	const autoHeight = heightProp === "auto";
	const height =
		heightProp === "auto"
			? contentHeight
				? `${contentHeight}px`
				: undefined
			: typeof heightProp === "number"
				? `${heightProp}px`
				: heightProp;

	const {
		PreviewShell,
		FixtureTree,
		ControlPanel,
		ControlPanelInputs,
		Toolbar,
		ViewportToolbar,
		EmptyState,
		ErrorState,
		InventoryList,
		CommandPalette,
	} = components;

	const panelSlots = useMemo(
		() => ({ codecs, Inputs: ControlPanelInputs }),
		[codecs, ControlPanelInputs],
	);

	const host =
		isolation === "inline" ? (
			<Suspense fallback={null}>
				<InlineHost codecs={codecs} theme={theme} onTransport={handleTransport} />
			</Suspense>
		) : (
			<FrameHost
				key={frameKey}
				mountId={mountId}
				rendererEntryUrl={rendererEntryUrl}
				dev={config.command === "serve"}
				initialFixture={resolution.target}
				initialOverlays={overlayState.overlays}
				previewDocumentUrl={props.previewDocumentUrl}
				title={selection ? `Preview: ${fixtureLabel(selection)}` : "Preview"}
				theme={theme}
				onTransport={handleTransport}
				onContentHeight={autoHeight ? setContentHeight : undefined}
				onBootstrapError={reportError}
			/>
		);

	const label = selectedComponent
		? selectedComponent.name
		: selection
			? fixtureLabel(selection)
			: "";

	/**
	 * §12's list of names, made selectable: each chip after the first is a real
	 * usage of this component found in the project's own source. "No props" stays
	 * first and reachable — it is the honest rendering of a component nobody has
	 * given props to — but it is no longer the default, because that default was
	 * a click, a crash and a regex over the stack trace.
	 */
	const siteChips = useMemo<Chip[]>(() => {
		if (!selectedComponent) return [];
		return [
			{
				key: "no-props",
				label: "No props",
				title: `Render ${selectedComponent.name} with nothing passed to it`,
				selected: selectedSite === null,
				onSelect: () => setSelectedSite(null),
			},
			...componentSites.map((site) => ({
				key: `${site.globPath}:${site.line}:${site.column}`,
				label: callSiteSummary(site),
				title: `${callSiteLabel(site)} — ${site.dynamic.length ? `${site.dynamic.length} prop(s) could not be read statically` : "all props read statically"}`,
				selected:
					selectedSite?.globPath === site.globPath &&
					selectedSite?.line === site.line &&
					selectedSite?.column === site.column,
				onSelect: () => setSelectedSite(site),
			})),
		];
	}, [selectedComponent, selectedSite, componentSites]);

	const variantChips = useMemo<Chip[]>(() => {
		if (!variants) return [];
		return [
			{
				key: "all",
				label: "All",
				title: "Every fixture in this file, as one page",
				selected: selection?.name === ALL_FIXTURES,
				onSelect: () => select(variants.all),
			},
			...variants.children.map((child) => ({
				key: child.key,
				label: child.label,
				selected: fixtureIdsEqual(child.fixture, selection),
				onSelect: () => {
					if (child.fixture) select(child.fixture);
				},
			})),
		];
	}, [variants, selection, select]);

	return (
		<UaightChromeContext.Provider value={api}>
			<ControlPanelSlots.Provider value={panelSlots}>
				<div
					ref={rootRef}
					onKeyDown={onKeyDown}
					data-theme={theme}
					data-uaight-isolation={isolation}
					className={cx(
						ROOT_CLASS,
						// The stylesheet resolves the palette from `.uaight-theme-*`; the
						// inline custom properties below are the same values, so a mount
						// with `theme="system"` cannot disagree with the media query.
						theme === "dark" ? "uaight-theme-dark" : "uaight-theme-light",
						"relative flex min-h-0 w-full flex-col bg-[var(--u-bg)] text-sm text-[var(--u-fg)] antialiased",
						props.className,
					)}
					style={{
						...themeVars(theme),
						height,
						minHeight: autoHeight && contentHeight === null ? 120 : undefined,
						...props.style,
					}}
				>
					<div className="flex min-h-0 w-full flex-1">
						{showTree ? (
							<>
								<aside
									style={{ width: sidebarWidth }}
									className="flex min-w-0 shrink-0 flex-col bg-[var(--u-bg-sunken)]"
								>
									<div className="flex h-9 shrink-0 items-center gap-2 px-3">
										<span className="text-sm font-medium text-[var(--u-fg)]">uaight</span>
										<span className="text-xs tabular-nums text-[var(--u-fg-subtle)]">
											{selectable.length}
										</span>
										<button
											type="button"
											aria-expanded={helpOpen}
											aria-haspopup="dialog"
											onClick={() => setHelpOpen((v) => !v)}
											title="Keyboard shortcuts (?)"
											className={cx(QUIET_BUTTON, "ml-auto")}
										>
											?
										</button>
									</div>

									<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
										<FixtureTree
											nodes={fixtureNodes}
											selected={selectedComponent ? null : selection}
											onSelect={select}
											search={chrome.search}
										/>

										{inventoryItems.length ? (
											// §12's detected components were a fixed-height scroll box
											// under the tree with a sticky label, which reads as a list
											// that has been cut off rather than as a section. A
											// disclosure with a count says how many there are and gets
											// out of the way of the tree when it is not wanted.
											<div className="shrink-0 border-t border-[var(--u-line)]">
												<button
													type="button"
													aria-expanded={inventoryOpen}
													aria-controls={`${mountId}-inventory`}
													onClick={toggleInventory}
													className={cx(
														"flex h-7 w-full cursor-pointer items-center gap-1.5 px-2 text-left",
														"hover:bg-[var(--u-bg-hover)]",
														FOCUS_RING,
														MOTION,
													)}
												>
													<svg
														viewBox="0 0 12 12"
														aria-hidden="true"
														className={cx(
															"size-3 shrink-0 fill-current text-[var(--u-fg-subtle)]",
															"motion-safe:transition-transform motion-safe:duration-100",
															inventoryOpen ? "rotate-90" : "",
														)}
													>
														<path d="M4.5 2.5 8 6l-3.5 3.5z" />
													</svg>
													<span className={SECTION_LABEL}>Components</span>
													<span className="ml-auto text-xs tabular-nums text-[var(--u-fg-subtle)]">
														{inventoryItems.length}
													</span>
												</button>
												{inventoryOpen ? (
													<div id={`${mountId}-inventory`} className="uaight-scroll max-h-64">
														<InventoryList components={inventoryItems} onSelect={selectComponent} />
													</div>
												) : null}
											</div>
										) : null}
									</div>
								</aside>
								<PaneResizer
									pane="left"
									width={sidebarWidth}
									min={PANE_MIN_WIDTH}
									max={PANE_MAX_WIDTH}
									initial={SIDEBAR_WIDTH}
									label="Sidebar width"
									onWidth={resizeSidebar}
								/>
							</>
						) : null}

						<PreviewShell
							loading={status !== "ready"}
							viewport={effectiveViewport}
							toolbar={
								chrome.toolbar ? (
									<Toolbar>
										<span
											className="min-w-0 truncate text-sm font-medium text-[var(--u-fg)]"
											title={selection ? selection.path : (selectedComponent?.path ?? undefined)}
										>
											{label || " "}
										</span>
										{selectedComponent ? (
											<span className="shrink-0 text-xs text-[var(--u-fg-subtle)]">
												detected component
											</span>
										) : null}
										<div className="ml-auto flex shrink-0 items-center gap-2">
											{gridSupported && gridTiles.length > 1 ? (
												<button
													type="button"
													onClick={() => setGridOpen((v) => !v)}
													aria-pressed={gridActive}
													title={`Show all ${gridTiles.length} fixtures at once (g)`}
													className={cx(QUIET_BUTTON, gridActive ? "text-[var(--u-accent)]" : "")}
												>
													{gridActive ? "Single" : "Grid"}
												</button>
											) : null}
											{shareState ? (
												<button
													type="button"
													onClick={() => void copy("link", window.location.href, "the link")}
													title="Copy a link to this fixture, including the current control values"
													className={cx(
														QUIET_BUTTON,
														copied === "link" ? "text-[var(--u-accent)]" : "",
													)}
												>
													{copied === "link" ? "Copied" : "Copy link"}
												</button>
											) : null}
											{chrome.viewport ? (
												<ViewportToolbar
													current={effectiveViewport}
													presets={[...VIEWPORT_PRESETS]}
													onChange={setViewport}
													supported={viewportSupported}
												/>
											) : null}
											{/* §5.2 — a bare lowercase "frame" read like debug output
											    while carrying the reason the viewport buttons beside it
											    are disabled. As a labelled badge it says what it is,
											    and points at that explanation. */}
											<span
												className={cx(
													"inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border px-1.5 text-xs",
													isolation === "frame"
														? "border-[var(--u-line)] text-[var(--u-fg-muted)]"
														: "border-[var(--u-line-strong)] text-[var(--u-fg)]",
												)}
												aria-describedby={
													isolation === "inline" && chrome.viewport
														? "uaight-viewport-hint"
														: undefined
												}
												title={
													isolation === "frame"
														? "Rendering in a separate realm. Same origin — this is isolation, not a sandbox."
														: VIEWPORT_INLINE_REASON
												}
											>
												<span className={SECTION_LABEL}>Isolation</span>
												<span className="font-medium">
													{isolation === "frame" ? "Frame" : "Inline"}
												</span>
											</span>
										</div>
									</Toolbar>
								) : undefined
							}
							subToolbar={
								chrome.toolbar && selectedComponent && componentSites.length ? (
									<ChipStrip
										label={`Usages of ${selectedComponent.name}`}
										chips={siteChips}
										dividerAfter={1}
										trailing={
											<>
												{selectedSite ? (
													<button
														type="button"
														onClick={() => void openSite(selectedSite)}
														title={`Open ${callSiteLabel(selectedSite)} in your editor`}
														className={QUIET_BUTTON}
													>
														Open source
													</button>
												) : null}
												<button
													type="button"
													onClick={() =>
														void copy(
															"fixture",
															formatFixtureModule(
																selectedComponent.name,
																selectedSite ? [selectedSite] : componentSites,
																{
																	importFrom: `./${selectedComponent.path.split("/").pop() ?? ""}`,
																},
															),
															"the fixture",
														)
													}
													title="Copy these usages as a fixture file. uaight never writes files itself (§1.4)."
													className={cx(
														QUIET_BUTTON,
														copied === "fixture" ? "text-[var(--u-accent)]" : "",
													)}
												>
													{copied === "fixture" ? "Copied" : "Copy as fixture"}
												</button>
											</>
										}
									/>
								) : chrome.toolbar && variants ? (
									<ChipStrip
										label={`Fixtures in ${selection?.path ?? ""}`}
										chips={variantChips}
										dividerAfter={1}
									/>
								) : undefined
							}
						>
							<div className="relative flex h-full min-h-0 w-full flex-col">
								{resolution.note ? (
									<p className="shrink-0 border-b border-[var(--u-line)] bg-[var(--u-bg-sunken)] px-3 py-1 text-xs text-[var(--u-fg-muted)]">
										{resolution.note}
									</p>
								) : null}

								<div className="relative min-h-0 flex-1">
									{/*
									 * The single host stays mounted underneath the grid. Leaving grid
									 * mode must not cost a fresh document, a fresh renderer and the
									 * fixture's own state, and hiding is the difference between the two.
									 */}
									<div className={gridActive ? "hidden" : "contents"}>{host}</div>

									{gridActive ? (
										<div className="absolute inset-0 z-10 bg-[var(--u-canvas)]">
											<GridView
												tiles={gridTiles}
												selected={selection}
												rendererEntryUrl={rendererEntryUrl}
												dev={config.command === "serve"}
												previewDocumentUrl={props.previewDocumentUrl}
												theme={theme}
												tileHeight={GRID_TILE_HEIGHT}
												budget={GRID_RENDER_BUDGET}
												onSelect={select}
												onOpen={() => setGridOpen(false)}
											/>
										</div>
									) : null}

									{error ? (
										<div className="absolute inset-0 z-20 overflow-auto bg-[var(--u-bg)]">
											<ErrorState
												error={error}
												onRetry={() => {
													setError(null);
													setFrameKey((k) => k + 1);
												}}
											/>
										</div>
									) : resolution.empty && !selectedComponent ? (
										<div className="absolute inset-0 z-10 bg-[var(--u-bg)]">
											<EmptyState
												title={resolution.empty.title}
												description={resolution.empty.description}
											/>
										</div>
									) : null}
								</div>
							</div>
						</PreviewShell>

						{showControls ? (
							<>
								<PaneResizer
									pane="right"
									width={panelWidth}
									min={PANE_MIN_WIDTH}
									max={PANE_MAX_WIDTH}
									initial={CONTROL_PANEL_WIDTH}
									label="Control panel width"
									onWidth={resizePanel}
								/>
								<aside
									style={{ width: panelWidth }}
									className="min-w-0 shrink-0 bg-[var(--u-bg-sunken)]"
								>
									<ControlPanel
										inputs={overlayState.registered}
										overlay={overlayState.overlays}
										onSet={setInput}
										onReset={resetInput}
										droppedPatches={overlayState.dropped}
										droppedInputs={overlayState.droppedInputs}
									/>
								</aside>
							</>
						) : null}
					</div>

					{/* Transient status. In the layout rather than over the preview, and
					    never focus-stealing: its action is a real button one Tab away. */}
					<div
						role="status"
						aria-live="polite"
						className={cx(
							"flex shrink-0 items-center gap-3 border-t border-[var(--u-line)] px-3",
							toast ? "h-7" : "h-0 overflow-hidden border-t-0",
						)}
					>
						{toast ? (
							<>
								<span
									className={cx(
										"min-w-0 flex-1 truncate text-xs",
										toast.tone === "danger" ? "text-[var(--u-danger)]" : "text-[var(--u-fg-muted)]",
									)}
								>
									{toast.message}
								</span>
								{toast.action ? (
									<button
										type="button"
										onClick={toast.action.run}
										className={cx(QUIET_BUTTON, "shrink-0 font-medium text-[var(--u-accent)]")}
									>
										{toast.action.label}
									</button>
								) : null}
								<button
									type="button"
									onClick={() => setToast(null)}
									aria-label="Dismiss"
									className={cx(QUIET_BUTTON, "shrink-0")}
								>
									×
								</button>
							</>
						) : null}
					</div>

					<CommandPalette
						open={paletteOpen}
						items={rankedItems}
						query={paletteQuery}
						onQueryChange={setPaletteQuery}
						onSelect={onPaletteSelect}
						onClose={closePalette}
					/>

					<HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
				</div>
			</ControlPanelSlots.Provider>
		</UaightChromeContext.Provider>
	);
}

/* ------------------------------------------------------------------ *
 * Clipboard
 * ------------------------------------------------------------------ */

/**
 * `navigator.clipboard` needs a secure context, which a dev server on a LAN
 * address is not. The textarea fallback is the only thing that works there.
 *
 * Returns whether it worked, because "copy" silently doing nothing is a bad way
 * to learn about origins — the caller turns the answer into something visible.
 * `execCommand` reports failure by returning `false` as well as by throwing, and
 * both were being ignored.
 */
async function copyText(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		/* fall through to the legacy path */
	}
	try {
		const area = document.createElement("textarea");
		area.value = text;
		area.setAttribute("readonly", "");
		area.style.position = "fixed";
		area.style.opacity = "0";
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(area);
		return ok;
	} catch (error) {
		console.error("[uaight] could not copy to the clipboard.", error);
		return false;
	}
}
