/**
 * The explorer. SPEC.md §5.3 (selection precedence), §5.4 (routing), §3.5
 * (progressive disclosure), §6.5 (height and viewport), §7 (control state),
 * §10.1 (design), §12 (inventory), §19.3 (the chrome facade).
 *
 * This module is the lazy boundary: `entry.tsx` reaches it through
 * `React.lazy` behind the `__UIGHT_ENABLED__` compile-time gate (§9.2), so
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
import type { KeyboardEvent, ReactElement } from "react";
import { Badge, Button, IconButton, Theme, Tooltip, Typography } from "ljkui";
import { config, fixtureModules } from "virtual:uight/runtime";
import { rendererEntryUrl, rendererStyleUrls } from "virtual:uight/renderer-url";

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
import {
	buildTree,
	flattenRows,
	flattenSelectable,
	isCovered,
	searchTree,
} from "../shared/tree.ts";
import { ALL_FIXTURES } from "../shared/types.ts";
import type {
	CallSite,
	CallSiteGroup,
	ComponentDoc,
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
	UightProps,
} from "../shared/types.ts";
import type { HostTransport } from "../runtime/index.ts";
import { loadFixtureModule } from "../runtime/hot.ts";

import { ChipStrip } from "./ChipStrip.tsx";
import { useCompactLayout } from "./compact.ts";
import type { Chip } from "./ChipStrip.tsx";
import { UightChromeContext } from "./chrome-context.ts";
import type { UightChromeApiV1 } from "./chrome-context.ts";
import { ControlPanelSlots } from "./chrome/ControlPanel.tsx";
import { resolveComponents } from "./chrome/defaults.ts";
import {
	CONTROL_PANEL_WIDTH,
	GRID_RENDER_BUDGET,
	GRID_TILE_HEIGHT,
	PANE_MAX_WIDTH,
	PANE_MIN_WIDTH,
	SIDEBAR_WIDTH,
	ROOT_CLASS,
	VIEWPORT_INLINE_REASON,
	VIEWPORT_PRESETS,
} from "./constants.ts";
import { FOCUS_RING, MOTION, SECTION_LABEL, cx } from "./cx.ts";
import { docControls, findDoc, resolveInputDoc } from "./docs.ts";
import { CSP_BLOCKED_PREFIX, FrameHost } from "./FrameHost.tsx";
import { GridView } from "./chrome/GridView.tsx";
import { HelpDialog } from "./HelpDialog.tsx";
import { PaneResizer } from "./PaneResizer.tsx";
import { useUightDefaults } from "./provider-context.ts";
import { useRouterBinding } from "./router.ts";
import { UightRootContext } from "./root-context.ts";
import { readSession, sessionKey, writeSession } from "./session.ts";
import { decodeOverlays, encodeOverlays } from "./share.ts";
import { SINGLE_FIXTURE, nameCache, readNames, sameNames, viteHot } from "./names.ts";
import type { IndexedNames } from "./names.ts";
import { resolve, resolveChrome } from "./resolution.tsx";
import { createOverlayStore, useOverlayState } from "./store.ts";
import { ensureStyles, readNonce } from "./styles.ts";
import { useClipboard } from "./use-clipboard.ts";
import { usePaneLayout } from "./use-pane-layout.ts";
import { handleKeyDown } from "./keyboard.ts";
import { useCommandPalette } from "./use-command-palette.ts";
import { useViewport } from "./use-viewport.ts";
import { useResolvedTheme } from "./theme.ts";

const InlineHost = lazy(() =>
	import("./InlineHost.tsx").then((m) => ({ default: m.InlineHost })),
);

const isDev = process.env.NODE_ENV !== "production";

/* ------------------------------------------------------------------ *
 * The explorer
 * ------------------------------------------------------------------ */

export default function UightUI(props: UightProps): ReactElement {
	const defaults = useUightDefaults();
	const components = useMemo(
		() => resolveComponents(defaults.components, props.components),
		[defaults.components, props.components],
	);

	const theme = useResolvedTheme(props.theme ?? defaults.theme ?? "system");
	const rootRef = useRef<HTMLDivElement | null>(null);
	const mountId = `uight${useId().replace(/[^\w]/g, "")}`;

	/**
	 * The mount element, for the overlays to portal into (`ui/root-context.ts`).
	 * A ref cannot be read during the render that creates it, so this is state:
	 * the first pass publishes `null` — no overlay is open on it — and the
	 * callback ref fills it in before anything can open one.
	 */
	const [rootEl, setRootEl] = useState<HTMLElement | null>(null);
	const setRoot = useCallback((node: HTMLDivElement | null) => {
		rootRef.current = node;
		setRootEl(node);
	}, []);

	/**
	 * Narrow enough that the three panes have to become one (`ui/compact.ts`).
	 * The tree turns into a drawer over the preview, the control panel drops
	 * below it, and the resizers go away — there is nothing to trade width with.
	 */
	const compact = useCompactLayout(rootRef);
	const [drawerOpen, setDrawerOpen] = useState(false);
	// Wide again — a drawer left open would be a pane nobody asked to reopen.
	useEffect(() => {
		if (!compact) setDrawerOpen(false);
	}, [compact]);

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
		/** §15.2 — prop docs keyed by glob path. Empty unless `docgen` is on. */
		docs: Record<string, ComponentDoc[]>;
	}>(() => ({
		files: config.files,
		inventory: config.inventory,
		callSites: config.callSites ?? [],
		docs: config.docs ?? {},
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
				// An index rebuilt without docgen carries no `docs`; the prop table
				// then disappears rather than going stale.
				docs: next.docs && typeof next.docs === "object" ? next.docs : {},
			});
		};
		hot.on("uight:index", handler);
		// §4.5 — ask for the current index rather than only listening for the next
		// change. A custom event is delivered to the clients connected when it is
		// sent, and a mount whose page was loading while a file was added missed
		// it: its `config.files` came from a module generated before the rescan,
		// and nothing would ever correct it. It used to be corrected by accident,
		// because a topology change reloaded the page.
		hot.send?.("uight:hello");
		return () => hot.off?.("uight:index", handler);
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
					`[uight] the static index and ${file.globPath} disagree about fixture ` +
						`names.\n  indexed: ${JSON.stringify(file.names)}\n  actual:  ${JSON.stringify(names)}`,
				);
			}
			setDiscovered((prev) => new Map(prev).set(file.path, names));
		} catch (error) {
			console.error(`[uight] could not load ${file.globPath} to read its names.`, error);
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
				"[uight] `selected` and `fixture` were both given. `selected` wins and " +
					"`fixture` is ignored — one of them is not doing what you think.",
			);
		}
		if (
			props.selected !== undefined &&
			props.router !== undefined &&
			props.router !== "none"
		) {
			console.error(
				"[uight] `selected` was given together with an explicit router. Controlled " +
					"selection ignores the router, so the URL will not be written. Drop " +
					"`router`, or drop `selected` and let uight own the parameter.",
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
			// Compact: the drawer is over the preview, so picking something means
			// getting out of the way of it.
			setDrawerOpen(false);
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
			setDrawerOpen(false);
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
				`[uight] the pinned fixture "${pinned.path}" is outside \`filter\`. It is ` +
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
				? buildTree({
						files,
						inventory: index.inventory,
						filter: props.filter,
						mergeInventory: true,
					})
				: fixtureNodes,
		[inventoryEnabled, files, index.inventory, props.filter, fixtureNodes],
	);
	/*
	 * The same coverage rule the tree uses, or the two disagree: without it a
	 * component with fixtures is listed BOTH as a fixture in the tree and as an
	 * un-fixtured component in the panel below it, which is what §12 says the
	 * inventory is not.
	 */
	const inventoryItems = useMemo(() => {
		if (!inventoryEnabled) return [];
		const paths = files.map((f) => f.path);
		return index.inventory.filter(
			(i) => matchesFilter(i.path, props.filter) && !isCovered(i.path, paths),
		);
	}, [inventoryEnabled, files, index.inventory, props.filter]);

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

	/**
	 * §7.6 — inputs with `from` filled in from the prop they named.
	 *
	 * Applied here, above both the facade and the packaged panel, so an ejected
	 * `ControlPanel` reading `useUightChrome().inputs.registered` sees exactly
	 * what ours does. Doing it inside the panel would make the resolution a
	 * private feature of the copy we happen to ship.
	 *
	 * A no-op in the overwhelmingly common case: `docgen` is off by default
	 * (§15.1), and an input without `from` is returned unchanged and by
	 * identity, so this costs one pass over a short list.
	 */
	const registeredInputs = useMemo(() => {
		if (!index.docs || !overlayState.registered.some((input) => input.options?.from)) {
			return overlayState.registered;
		}
		return overlayState.registered.map((input) => {
			const options = resolveInputDoc(input.options, index.docs);
			return options === input.options ? input : { ...input, options };
		});
	}, [overlayState.registered, index.docs]);
	const [transport, setTransport] = useState<HostTransport | null>(null);
	const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");
	const [error, setError] = useState<RendererError | null>(null);
	const [contentHeight, setContentHeight] = useState<number | null>(null);
	const [frameKey, setFrameKey] = useState(0);

	const selectRef = useRef(select);
	selectRef.current = select;

	/**
	 * §9.1 — warm a file's chunk while the pointer is still on its row.
	 *
	 * The host knows what is being hovered; the renderer holds the loaders. Sent
	 * once per file per realm: a `Set` rather than a debounce, because the point
	 * is not to rate-limit hovering but to never ask twice for something the
	 * browser has already cached. It is cleared with the transport, since a new
	 * realm has a cold module registry again.
	 */
	const transportRef = useRef<HostTransport | null>(null);
	transportRef.current = transport;
	const prefetched = useRef<Set<string>>(new Set());
	useEffect(() => {
		prefetched.current = new Set();
	}, [transport]);
	const prefetch = useCallback((path: string) => {
		if (prefetched.current.has(path)) return;
		prefetched.current.add(path);
		transportRef.current?.send({ type: "PREFETCH", path });
	}, []);

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

	// A detected component with no call site to start from gets controls
	// synthesized from its prop types instead of rendering bare (D18 revised —
	// see `docControls`). Inert unless `docgen` is on: no docs, no synthesis.
	const derivedControls = useMemo(
		() =>
			selectedComponent && !selectedSite
				? docControls(findDoc(index.docs, selectedComponent))
				: null,
		[index.docs, selectedComponent, selectedSite],
	);

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
			// Docgen-derived props are literals by the same construction.
			props: selectedSite ? selectedSite.props : (derivedControls?.props ?? null),
			children: selectedSite?.children ?? null,
			origin: selectedSite ? callSiteLabel(selectedSite) : null,
			propOptions: derivedControls?.options ?? null,
		}),
		// `targetKey`/`componentKey` are the identity; the objects are not stable.
		[targetKey, componentKey, selectedComponent, selectedSite, derivedControls],
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
	const { viewport, setViewport } = useViewport(resolution.target, selection, files);
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

	/* ---- clipboard, and opening a call site in an editor ---- */
	const { copied, copy, openSite } = useClipboard(showToast);

	/* ---- pane widths and the inventory disclosure ---- */
	const {
		sidebarWidth,
		panelWidth,
		inventoryOpen,
		resizeSidebar,
		resizePanel,
		toggleInventory,
	} = usePaneLayout(restored, remember);

	/* ---- codecs (§7.7) — loaded lazily so editors stay out of the first paint ---- */
	const [loadedCodecs, setLoadedCodecs] = useState<FixtureCodec[] | undefined>(undefined);
	useEffect(() => {
		if (!config.hasCodecs) return;
		let live = true;
		import("virtual:uight/codecs")
			.then((m) => {
				if (live) setLoadedCodecs(m.codecs);
			})
			.catch((e: unknown) => console.error("[uight] the codec module failed to load.", e));
		return () => {
			live = false;
		};
	}, []);
	const codecs = useMemo(
		() => [...(defaults.codecs ?? []), ...(loadedCodecs ?? [])],
		[defaults.codecs, loadedCodecs],
	);

	/* ---- command palette — ⌘K ---- */
	const palette = useCommandPalette({
		nodes: fixtureNodes,
		inventory: inventoryItems,
		callSites: index.callSites,
		restored,
		remember,
		select,
		selectComponent,
	});

	/* ---- the facade — §19.3 ---- */
	const api = useMemo<UightChromeApiV1>(
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
				open: palette.open,
				setOpen: palette.setOpen,
				query: palette.query,
				setQuery: palette.setQuery,
				items: palette.items,
				select: palette.onSelect,
			},
			selection: {
				current: selection,
				select,
				next: () => step(1),
				previous: () => step(-1),
			},
			inputs: {
				registered: registeredInputs,
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
			palette.open,
			palette.query,
			palette.items,
			palette.onSelect,
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
		handleKeyDown(event, {
			rootRef,
			step,
			stepVariant,
			variants: Boolean(variants),
			compact,
			drawerOpen,
			setDrawerOpen,
			helpOpen,
			setHelpOpen,
			togglePalette: () => palette.setOpen((open) => !open),
			gridSupported,
			setGridOpen,
			hasOverlays: overlayState.overlays.length > 0,
			resetInput,
		});
	};

	/* ---- layout ---- */
	const showTree = chrome.tree && mode !== "pinned";
	const showControls = chrome.controls && registeredInputs.length > 0;

	/*
	 * §15.2 — the prop table for the selected detected component.
	 *
	 * Only detected components (§12) have a doc: docgen reads component source,
	 * and a fixture file is not one. For fixtures D18 keeps this strictly
	 * beside the control panel — the panel's inputs come from the call site
	 * (§7.6). The one exception is `derivedControls` above: a bare detected
	 * component's controls are synthesized from this same doc.
	 */
	const propDoc = useMemo(
		() => findDoc(index.docs, selectedComponent),
		[index.docs, selectedComponent],
	);
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
		PropTable,
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
				rendererStyleUrls={rendererStyleUrls}
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
		<UightChromeContext.Provider value={api}>
			<UightRootContext.Provider value={rootEl}>
				<ControlPanelSlots.Provider value={panelSlots}>
					{/*
					 * The mount is the ljkui theme root and the CSS scope in one element.
					 * They have to be the same node: `styles/uight.css` maps `--uight-*`
					 * onto ljkui's scales, and a `var()` only resolves where the scale is
					 * declared — put `<Theme>` inside `.uight-root` and every token on the
					 * scope element falls back to the pre-ljkui palette instead.
					 *
					 * `appearance` is the *resolved* theme, never `"inherit"`: inheriting
					 * would read the host document's appearance, which says nothing about
					 * what `theme="system"` asked for (§5.1).
					 *
					 * The `light`/`dark` class is ours to write. ljkui only stamps it on
					 * its own element for a *nested* theme; with no `<Theme>` above us it
					 * takes itself for the document root and puts the class on `<html>`
					 * instead — which our scoped stylesheet (§10.3) can never match, so
					 * the dark scales would never come on and the chrome would sit in
					 * light whatever `appearance` said.
					 */}
					<Theme
						render={<div ref={setRoot} />}
						appearance={theme}
						accentColor="blue"
						grayColor="neutral"
						hasBackground={false}
						onKeyDown={onKeyDown}
						data-theme={theme}
						data-uight-isolation={isolation}
						className={cx(
							ROOT_CLASS,
							theme,
							"relative flex min-h-0 w-full flex-col bg-[var(--uight-surface)] text-sm text-[var(--uight-fg)] antialiased",
							props.className,
						)}
						style={{
							// Native widgets (scrollbars, date pickers, the host's own form
							// controls) follow this, so they match the chrome around them.
							colorScheme: theme,
							height,
							minHeight: autoHeight && contentHeight === null ? 120 : undefined,
							...props.style,
						}}
					>
						<div
							className={cx(
								"relative flex min-h-0 w-full flex-1",
								// Compact: the panes stack instead of standing side by side.
								compact ? "flex-col" : "",
							)}
						>
							{/* The drawer's backdrop. A button rather than a div, so the
						    tap that dismisses it is also a key press. */}
							{compact && drawerOpen ? (
								<button
									type="button"
									aria-label="Close the fixture list"
									onClick={() => setDrawerOpen(false)}
									className="absolute inset-0 z-30 cursor-default bg-[color-mix(in_srgb,var(--uight-surface)_70%,transparent)]"
								/>
							) : null}
							{showTree && (!compact || drawerOpen) ? (
								<>
									<aside
										style={compact ? undefined : { width: sidebarWidth }}
										className={cx(
											"flex min-w-0 shrink-0 flex-col bg-[var(--uight-sunken)]",
											compact
												? "absolute inset-y-0 left-0 z-40 w-[min(17rem,85%)] border-r border-[var(--uight-line)]"
												: "",
										)}
									>
										<div className="flex h-9 shrink-0 items-center gap-2 px-3">
											<Typography.Text size="1" weight="medium">
												uight
											</Typography.Text>
											<Typography.Text size="1" color="gray" className="tabular-nums">
												{selectable.length}
											</Typography.Text>
											<Tooltip content="Keyboard shortcuts (?)">
												<IconButton
													size="1"
													variant="ghost"
													color="gray"
													aria-expanded={helpOpen}
													aria-haspopup="dialog"
													aria-label="Keyboard shortcuts"
													onClick={() => setHelpOpen((v) => !v)}
													className="ml-auto"
												>
													?
												</IconButton>
											</Tooltip>
										</div>

										<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
											<FixtureTree
												nodes={fixtureNodes}
												selected={selectedComponent ? null : selection}
												onSelect={select}
												onPrefetch={prefetch}
												search={chrome.search}
											/>

											{inventoryItems.length ? (
												// §12's detected components were a fixed-height scroll box
												// under the tree with a sticky label, which reads as a list
												// that has been cut off rather than as a section. A
												// disclosure with a count says how many there are and gets
												// out of the way of the tree when it is not wanted.
												<div className="shrink-0 border-t border-[var(--uight-line)]">
													<button
														type="button"
														aria-expanded={inventoryOpen}
														aria-controls={`${mountId}-inventory`}
														onClick={toggleInventory}
														className={cx(
															"flex h-7 w-full cursor-pointer items-center gap-1.5 px-2 text-left",
															"hover:bg-[var(--uight-hover)]",
															FOCUS_RING,
															MOTION,
														)}
													>
														<svg
															viewBox="0 0 12 12"
															aria-hidden="true"
															className={cx(
																"size-3 shrink-0 fill-current text-[var(--uight-subtle)]",
																"motion-safe:transition-transform motion-safe:duration-100",
																inventoryOpen ? "rotate-90" : "",
															)}
														>
															<path d="M4.5 2.5 8 6l-3.5 3.5z" />
														</svg>
														<span className={SECTION_LABEL}>Components</span>
														<Typography.Text size="1" color="gray" className="ml-auto tabular-nums">
															{inventoryItems.length}
														</Typography.Text>
													</button>
													{inventoryOpen ? (
														<div id={`${mountId}-inventory`} className="uight-scroll max-h-64">
															<InventoryList components={inventoryItems} onSelect={selectComponent} />
														</div>
													) : null}
												</div>
											) : null}
										</div>
									</aside>
									{/* Nothing to trade width with when the drawer floats. */}
									{compact ? null : (
										<PaneResizer
											pane="left"
											width={sidebarWidth}
											min={PANE_MIN_WIDTH}
											max={PANE_MAX_WIDTH}
											initial={SIDEBAR_WIDTH}
											label="Sidebar width"
											onWidth={resizeSidebar}
										/>
									)}
								</>
							) : null}

							<PreviewShell
								loading={status !== "ready"}
								viewport={effectiveViewport}
								toolbar={
									chrome.toolbar ? (
										<Toolbar>
											{/* Compact: the only way back to the tree, so it leads the bar. */}
											{compact && showTree ? (
												<IconButton
													size="1"
													variant="ghost"
													color="gray"
													aria-expanded={drawerOpen}
													aria-label="Fixtures"
													onClick={() => setDrawerOpen((open) => !open)}
													className="shrink-0"
												>
													<svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 fill-current">
														<path d="M1 2.5h10v1H1zM1 5.5h10v1H1zM1 8.5h10v1H1z" />
													</svg>
												</IconButton>
											) : null}
											<Typography.Text
												size="1"
												weight="medium"
												className="min-w-0 truncate"
												title={selection ? selection.path : (selectedComponent?.path ?? undefined)}
											>
												{label || " "}
											</Typography.Text>
											{selectedComponent ? (
												<Badge size="1" variant="soft" color="gray" className="shrink-0">
													detected component
												</Badge>
											) : null}
											<div className="ml-auto flex shrink-0 items-center gap-2">
												{gridSupported && gridTiles.length > 1 ? (
													<Tooltip content={`Show all ${gridTiles.length} fixtures at once (g)`}>
														<Button
															size="1"
															variant={gridActive ? "soft" : "ghost"}
															color={gridActive ? undefined : "gray"}
															aria-pressed={gridActive}
															onClick={() => setGridOpen((v) => !v)}
														>
															{gridActive ? "Single" : "Grid"}
														</Button>
													</Tooltip>
												) : null}
												{shareState ? (
													/* The link carries the fixture AND the control values, which
													   makes it a reproduction, not a bookmark — worth a button
													   that reads as a feature rather than a ghost in the
													   overflow cluster. */
													<Tooltip content="Copy a link to this fixture, including the current control values — it reproduces exactly what is on screen">
														<Button
															size="1"
															variant="soft"
															onClick={() => void copy("link", window.location.href, "the link")}
														>
															<svg
																viewBox="0 0 12 12"
																aria-hidden="true"
																className="size-3 fill-none stroke-current"
																strokeWidth="1.2"
																strokeLinecap="round"
															>
																<path d="M5 7l3.2-3.2a1.7 1.7 0 012.4 2.4L9.2 7.6" />
																<path d="M7 5L3.8 8.2a1.7 1.7 0 002.4 2.4L7.6 9.2" />
															</svg>
															{copied === "link" ? "Copied" : "Share"}
														</Button>
													</Tooltip>
												) : null}
												{/* Six device presets and an isolation badge do not fit beside
											    a fixture name on a phone, and neither is what someone is
											    there for. They come back with the width. */}
												{chrome.viewport && !compact ? (
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
												{compact ? null : (
													<Badge
														size="1"
														variant="outline"
														color={isolation === "frame" ? "gray" : undefined}
														className="shrink-0 gap-1"
														aria-describedby={
															isolation === "inline" && chrome.viewport
																? "uight-viewport-hint"
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
													</Badge>
												)}
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
														<Button
															size="1"
															variant="ghost"
															color="gray"
															onClick={() => void openSite(selectedSite)}
															title={`Open ${callSiteLabel(selectedSite)} in your editor`}
														>
															Open source
														</Button>
													) : null}
													<Button
														size="1"
														variant="ghost"
														color={copied === "fixture" ? undefined : "gray"}
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
														title="Copy these usages as a fixture file. uight never writes files itself (§1.4)."
													>
														{copied === "fixture" ? "Copied" : "Copy as fixture"}
													</Button>
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
										<Typography.Text
											render={<p />}
											size="1"
											color="gray"
											className="shrink-0 border-b border-[var(--uight-line)] bg-[var(--uight-sunken)] px-3 py-1"
										>
											{resolution.note}
										</Typography.Text>
									) : null}

									<div className="relative min-h-0 flex-1">
										{/*
										 * The single host stays mounted underneath the grid. Leaving grid
										 * mode must not cost a fresh document, a fresh renderer and the
										 * fixture's own state, and hiding is the difference between the two.
										 */}
										<div className={gridActive ? "hidden" : "contents"}>{host}</div>

										{gridActive ? (
											<div className="absolute inset-0 z-10 bg-[var(--uight-canvas)]">
												<GridView
													tiles={gridTiles}
													selected={selection}
													rendererEntryUrl={rendererEntryUrl}
													rendererStyleUrls={rendererStyleUrls}
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
											<div className="absolute inset-0 z-20 overflow-auto bg-[var(--uight-surface)]">
												<ErrorState
													error={error}
													onRetry={() => {
														setError(null);
														setFrameKey((k) => k + 1);
													}}
												/>
											</div>
										) : resolution.empty && !selectedComponent ? (
											<div className="absolute inset-0 z-10 bg-[var(--uight-surface)]">
												<EmptyState
													title={resolution.empty.title}
													description={resolution.empty.description}
												/>
											</div>
										) : null}
									</div>
								</div>
							</PreviewShell>

							{showControls || propDoc ? (
								<>
									{compact ? null : (
										<PaneResizer
											pane="right"
											width={panelWidth}
											min={PANE_MIN_WIDTH}
											max={PANE_MAX_WIDTH}
											initial={CONTROL_PANEL_WIDTH}
											label="Control panel width"
											onWidth={resizePanel}
										/>
									)}
									{/* Compact: below the preview rather than beside it, and capped,
								    so the fixture keeps most of the screen. */}
									<aside
										style={compact ? undefined : { width: panelWidth }}
										className={cx(
											"min-w-0 shrink-0 overflow-y-auto bg-[var(--uight-sunken)]",
											compact ? "max-h-[45%] w-full border-t border-[var(--uight-line)]" : "",
										)}
									>
										{showControls ? (
											<ControlPanel
												inputs={registeredInputs}
												overlay={overlayState.overlays}
												onSet={setInput}
												onReset={resetInput}
												droppedPatches={overlayState.dropped}
												droppedInputs={overlayState.droppedInputs}
											/>
										) : null}
										{/* Below the controls, never merged into them — D18. */}
										<PropTable doc={propDoc} />
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
								"flex shrink-0 items-center gap-3 border-t border-[var(--uight-line)] px-3",
								toast ? "h-7" : "h-0 overflow-hidden border-t-0",
							)}
						>
							{toast ? (
								<>
									<Typography.Text
										size="1"
										color={toast.tone === "danger" ? "danger" : "gray"}
										className="min-w-0 flex-1 truncate"
									>
										{toast.message}
									</Typography.Text>
									{toast.action ? (
										<Button
											size="1"
											variant="ghost"
											onClick={toast.action.run}
											className="shrink-0"
										>
											{toast.action.label}
										</Button>
									) : null}
									<IconButton
										size="1"
										variant="ghost"
										color="gray"
										onClick={() => setToast(null)}
										aria-label="Dismiss"
										className="shrink-0"
									>
										×
									</IconButton>
								</>
							) : null}
						</div>

						<CommandPalette
							open={palette.open}
							items={palette.items}
							query={palette.query}
							onQueryChange={palette.setQuery}
							onSelect={palette.onSelect}
							onClose={palette.close}
						/>

						<HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
					</Theme>
				</ControlPanelSlots.Provider>
			</UightRootContext.Provider>
		</UightChromeContext.Provider>
	);
}
