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

import { matchesFilter } from "../shared/filter.ts";
import { fixtureIdsEqual, fixtureLabel, parseFixtureId, serializeFixtureId } from "../shared/fixture-id.ts";
import { buildTree, flattenSelectable, searchTree } from "../shared/tree.ts";
import { ALL_FIXTURES } from "../shared/types.ts";
import type {
	EditableWire,
	FixtureCodec,
	FixtureFileIndex,
	FixtureId,
	FixtureIndex,
	InventoryItem,
	PathSegment,
	RendererError,
	TreeNode,
	UaightProps,
	ViewportPreset,
} from "../shared/types.ts";
import type { HostTransport } from "../runtime/index.ts";

import { UaightChromeContext } from "./chrome-context.ts";
import type { UaightChromeApiV1 } from "./chrome-context.ts";
import { ControlPanelSlots } from "./chrome/ControlPanel.tsx";
import { resolveComponents } from "./chrome/defaults.ts";
import {
	INVENTORY_NOTICE_KEY,
	INVENTORY_SAFETY_NOTICE,
	KEYMAP,
	SEARCH_ATTR,
	ROOT_CLASS,
	VIEWPORT_PRESETS,
} from "./constants.ts";
import { FOCUS_RING, MOTION, QUIET_BUTTON, cx } from "./cx.ts";
import { FrameHost } from "./FrameHost.tsx";
import { useUaightDefaults } from "./provider-context.ts";
import { useRouterBinding } from "./router.ts";
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

function sameNames(a: readonly (string | null)[], b: readonly (string | null)[]): boolean {
	return a.length === b.length && a.every((n, i) => n === b[i]);
}

interface HotLike {
	on(event: string, cb: (data: unknown) => void): void;
	off?(event: string, cb: (data: unknown) => void): void;
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
						Nothing in this project resolves to <code>{selection.path}</code>. The link
						is kept, so it will start working if the file appears.
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
					<code>{selection.name === "" ? "(empty name)" : selection.name}</code>. The link
					is kept in case it comes back.
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

	/* ---- host document stylesheet (§10.3, §6.7) ---- */
	useInsertionEffect(() => {
		if (typeof document === "undefined") return;
		ensureStyles(document, readNonce(document));
	}, []);

	/* ---- index, kept live by the plugin's HMR event (§4.5) ---- */
	const [index, setIndex] = useState<{ files: FixtureFileIndex[]; inventory: InventoryItem[] }>(
		() => ({ files: config.files, inventory: config.inventory }),
	);

	useEffect(() => {
		const hot = viteHot();
		if (!hot) return;
		const handler = (data: unknown) => {
			const next = data as Partial<FixtureIndex> | null;
			if (!next || !Array.isArray(next.files)) return;
			setIndex({
				files: next.files,
				inventory: Array.isArray(next.inventory) ? next.inventory : [],
			});
		};
		hot.on("uaight:index", handler);
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
		const load = fixtureModules[file.globPath];
		if (!load) return;
		try {
			const names = readNames(await load());
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
		const idle = (
			window as unknown as { requestIdleCallback?: (cb: () => void) => number }
		).requestIdleCallback;
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
		(item: InventoryItem) => {
			setSelectedComponent(item);
			if (mode === "controlled" || mode === "pinned") return;
			if (mode === "router" && routerOwned) routerWrite(null, { replace: true });
			else setLocalSelection(null);
			onSelectProp?.(null);
		},
		[mode, routerOwned, routerWrite, onSelectProp],
	);

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
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
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

	const step = useCallback(
		(delta: number) => {
			if (!selectable.length) return;
			const index_ = selectable.findIndex((n) => fixtureIdsEqual(n.fixture, selection));
			const next =
				selectable[
					Math.max(0, Math.min(selectable.length - 1, (index_ < 0 ? -1 : index_) + delta))
				];
			if (next?.fixture) select(next.fixture);
		},
		[selectable, selection, select],
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

	useEffect(() => {
		if (!transport) return;
		setStatus(transport.status);
		setError(transport.error);
		return transport.onStatusChange(() => {
			setStatus(transport.status);
			if (transport.error) setError(transport.error);
		});
	}, [transport]);

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
	const componentKey = selectedComponent
		? `${selectedComponent.globPath}#${selectedComponent.exportName}`
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
		}),
		// `targetKey`/`componentKey` are the identity; the objects are not stable.
		[targetKey, componentKey, selectedComponent],
	);

	useEffect(() => {
		if (!transport) return;
		// Overlays are dropped on fixture change (§7.3).
		store.clear();
		setError(null);
		transport.send(selectMessage);
	}, [transport, selectMessage, store]);

	// A frame reload re-runs the handshake; replay the current selection onto it.
	const selectMessageRef = useRef(selectMessage);
	selectMessageRef.current = selectMessage;
	useEffect(() => {
		if (!transport || status !== "ready") return;
		transport.send(selectMessageRef.current);
	}, [transport, status]);

	/* ---- viewport — §6.5 ---- */
	const [viewport, setViewport] = useState<ViewportPreset | null>(null);
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

	const resetInput = useCallback(
		(name?: string) => {
			const cleared = store.reset(name);
			if (!transport) return;
			if (name === undefined) {
				transport.send({ type: "SET_OVERLAYS", overlays: [] });
			}
			for (const overlay of cleared) {
				transport.send({
					type: "OVERLAY",
					name: overlay.input,
					revision: overlay.revision,
					patches: [],
				});
			}
		},
		[store, transport],
	);

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
			},
		}),
		[
			mergedNodes,
			expanded,
			toggle,
			inventoryItems,
			inventoryEnabled,
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

	/* ---- first-run inventory notice — §12 ---- */
	const [noticeDismissed, setNoticeDismissed] = useState(() => {
		try {
			return window.localStorage.getItem(INVENTORY_NOTICE_KEY) === "seen";
		} catch {
			return false;
		}
	});
	const dismissNotice = () => {
		setNoticeDismissed(true);
		try {
			window.localStorage.setItem(INVENTORY_NOTICE_KEY, "seen");
		} catch {
			/* private mode; the notice simply reappears */
		}
	};

	/* ---- keyboard — §10.1 ---- */
	const [helpOpen, setHelpOpen] = useState(false);

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		const typing = !!target?.closest?.(
			"input, textarea, select, [contenteditable='true']",
		);

		if (event.key === "Escape" && helpOpen) {
			event.preventDefault();
			setHelpOpen(false);
			return;
		}
		if (typing) return;

		switch (event.key) {
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
	} = components;

	const panelSlots = useMemo(
		() => ({ codecs, Inputs: ControlPanelInputs }),
		[codecs, ControlPanelInputs],
	);

	const host =
		isolation === "inline" ? (
			<Suspense fallback={null}>
				<InlineHost codecs={codecs} onTransport={handleTransport} />
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
				onTransport={handleTransport}
				onContentHeight={autoHeight ? setContentHeight : undefined}
				onBootstrapError={setError}
			/>
		);

	const label = selectedComponent
		? selectedComponent.name
		: selection
			? fixtureLabel(selection)
			: "";

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
						"relative flex min-h-0 w-full flex-col bg-[var(--u-bg)] text-[12px] text-[var(--u-fg)] antialiased",
						props.className,
					)}
					style={{
						...themeVars(theme),
						height,
						minHeight: autoHeight && contentHeight === null ? 120 : undefined,
						...props.style,
					}}
				>
					{inventoryEnabled && !noticeDismissed ? (
						<div className="flex shrink-0 items-start gap-3 border-b border-[var(--u-line)] bg-[var(--u-bg-sunken)] px-3 py-2">
							{/* §12 — verbatim. */}
							<p className="min-w-0 flex-1 text-[11px] leading-4 text-[var(--u-fg-muted)]">
								{INVENTORY_SAFETY_NOTICE}
							</p>
							<button type="button" onClick={dismissNotice} className={QUIET_BUTTON}>
								Got it
							</button>
						</div>
					) : null}

					<div className="flex min-h-0 w-full flex-1">
						{showTree ? (
							<aside className="flex w-60 shrink-0 flex-col border-r border-[var(--u-line)] bg-[var(--u-bg-sunken)]">
								<div className="flex h-9 shrink-0 items-center gap-2 px-3">
									<span className="text-[12px] font-medium text-[var(--u-fg)]">uaight</span>
									<span className="text-[11px] tabular-nums text-[var(--u-fg-subtle)]">
										{selectable.length}
									</span>
									<button
										type="button"
										aria-expanded={helpOpen}
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
										<div className="max-h-56 shrink-0 overflow-auto border-t border-[var(--u-line)]">
											<p className="sticky top-0 bg-[var(--u-bg-sunken)] px-2 pt-2 pb-1 text-[11px] font-medium text-[var(--u-fg-muted)]">
												Components
											</p>
											<InventoryList
												components={inventoryItems}
												onSelect={selectComponent}
											/>
										</div>
									) : null}
								</div>
							</aside>
						) : null}

						<PreviewShell
							loading={status !== "ready"}
							viewport={effectiveViewport}
							toolbar={
								chrome.toolbar ? (
									<Toolbar>
										<span
											className="min-w-0 truncate text-[12px] text-[var(--u-fg)]"
											title={
												selection
													? selection.path
													: (selectedComponent?.path ?? undefined)
											}
										>
											{label || " "}
										</span>
										{selectedComponent ? (
											<span className="shrink-0 text-[11px] text-[var(--u-fg-subtle)]">
												detected component
											</span>
										) : null}
										<div className="ml-auto flex shrink-0 items-center gap-2">
											{chrome.viewport ? (
												<ViewportToolbar
													current={effectiveViewport}
													presets={[...VIEWPORT_PRESETS]}
													onChange={setViewport}
													supported={viewportSupported}
												/>
											) : null}
											<span
												className="text-[11px] text-[var(--u-fg-subtle)]"
												title={
													isolation === "frame"
														? "Rendering in a separate realm. Same origin — this is isolation, not a sandbox."
														: "Rendering in this page's realm."
												}
											>
												{isolation}
											</span>
										</div>
										</Toolbar>
								) : undefined
							}
							subToolbar={
								chrome.toolbar && variants ? (
									<div
										role="tablist"
										aria-label={`Fixtures in ${selection?.path ?? ""}`}
										className="flex items-center gap-1 overflow-x-auto px-3 py-1"
									>
										<VariantChip
											label="All"
											selected={selection?.name === ALL_FIXTURES}
											onSelect={() => select(variants.all)}
										/>
										<span className="mx-1 h-3 w-px shrink-0 bg-[var(--u-line)]" />
										{variants.children.map((child) => (
											<VariantChip
												key={child.key}
												label={child.label}
												selected={fixtureIdsEqual(child.fixture, selection)}
												onSelect={() => child.fixture && select(child.fixture)}
											/>
										))}
									</div>
								) : undefined
							}
						>
							<div className="relative flex h-full min-h-0 w-full flex-col">
								{resolution.note ? (
									<p className="shrink-0 border-b border-[var(--u-line)] bg-[var(--u-bg-sunken)] px-3 py-1 text-[11px] text-[var(--u-fg-muted)]">
										{resolution.note}
									</p>
								) : null}

								<div className="relative min-h-0 flex-1">
									{host}

									{error ? (
										<div className="absolute inset-0 z-20 overflow-auto bg-[var(--u-bg)]">
											<ErrorState error={error} onRetry={() => {
												setError(null);
												setFrameKey((k) => k + 1);
											}} />
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
							<aside className="w-72 shrink-0 border-l border-[var(--u-line)] bg-[var(--u-bg-sunken)]">
								<ControlPanel
									inputs={overlayState.registered}
									overlay={overlayState.overlays}
									onSet={setInput}
									onReset={resetInput}
									droppedPatches={overlayState.dropped}
								/>
							</aside>
						) : null}
					</div>

					{helpOpen ? (
						<div className="absolute right-3 bottom-3 z-30 w-64 rounded-sm border border-[var(--u-line-strong)] bg-[var(--u-bg)] p-3">
							<p className="mb-2 text-[12px] font-medium text-[var(--u-fg)]">Keyboard</p>
							<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
								{KEYMAP.map((item) => (
									<div key={item.keys} className="contents">
										<dt className="text-[11px] whitespace-nowrap text-[var(--u-fg)]">
											{item.keys}
										</dt>
										<dd className="text-[11px] text-[var(--u-fg-muted)]">{item.action}</dd>
									</div>
								))}
							</dl>
							<button
								type="button"
								onClick={() => setHelpOpen(false)}
								className={cx(QUIET_BUTTON, "mt-2", FOCUS_RING, MOTION)}
							>
								Close
							</button>
						</div>
					) : null}
				</div>
			</ControlPanelSlots.Provider>
		</UaightChromeContext.Provider>
	);
}

/* ------------------------------------------------------------------ *
 * Variant chips — the fixtures of the selected file, in the toolbar
 * ------------------------------------------------------------------ */

function VariantChip(props: {
	label: string;
	selected: boolean;
	onSelect: () => void;
}): ReactElement {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={props.selected}
			onClick={props.onSelect}
			title={props.label}
			className={cx(
				"h-5 shrink-0 rounded-sm px-1.5 text-[11px] whitespace-nowrap",
				props.selected
					? "bg-[var(--u-accent-soft)] text-[var(--u-accent)]"
					: "text-[var(--u-fg-muted)] hover:bg-[var(--u-bg-hover)]",
				FOCUS_RING,
				MOTION,
			)}
		>
			{props.label}
		</button>
	);
}
