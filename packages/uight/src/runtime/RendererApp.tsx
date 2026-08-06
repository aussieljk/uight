/**
 * The renderer React tree — SPEC.md §6.2, §6.3, §3.3, §12.
 *
 * Module loading, decorator composition, the fixture runtime context, and the
 * error boundaries that tell a decorator error from a fixture error. Everything
 * here runs in the renderer realm, which in frame isolation is a different
 * `window` from the chrome.
 */

import * as React from "react";
import { fixtureLabel, serializeFixtureId } from "../shared/fixture-id.ts";
import type { MountedMessage } from "../shared/protocol.ts";
import { PROTOCOL_VERSION } from "../shared/protocol.ts";
import { ALL_FIXTURES } from "../shared/types.ts";
import type {
	DecoratorFileIndex,
	FixtureCodec,
	FixtureFileIndex,
	FixtureId,
	FixtureMeta,
	InputOverlay,
	RendererError,
	RuntimeConfig,
} from "../shared/types.ts";
import { UIGHT_VERSION } from "../shared/version.ts";
import type { LoadedDecorator } from "./decorators.ts";
import { composeDecorators, loadDecorators, selectDecorators } from "./decorators.ts";
import { ErrorPanel, RendererErrorBoundary, toRendererError } from "./error-boundary.tsx";
import type { StorybookPreview } from "./csf.ts";
import {
	fixtureHotRegistry,
	liveModuleMap,
	liveRuntimeConfig,
	loadFixtureModule,
} from "./hot.ts";
import type { FixtureRuntime } from "./fixture-context.tsx";
import {
	FixtureRuntimeProvider,
	createViewportSource,
	useFixtureInput,
} from "./fixture-context.tsx";
import type { NormalizedFixture } from "./normalize.ts";
import { normalizeModule, selectFixture } from "./normalize.ts";
import { OverlayStore } from "./overlay.ts";
import { createSerializer } from "./serialize.ts";
import type { RendererTransport } from "./transport.ts";

export type ModuleMap = Record<string, () => Promise<unknown>>;

export interface MountRendererOptions {
	root: HTMLElement;
	config: RuntimeConfig;
	fixtureModules: ModuleMap;
	decoratorModules: ModuleMap;
	inventoryModules: ModuleMap;
	codecs?: FixtureCodec[];
	Providers?: React.ComponentType<{ children: React.ReactNode }> | undefined;
	/** The consumer's `.storybook/preview`, when one was found (§13). */
	storybookPreview?: StorybookPreview | null;
}

export interface ComponentRef {
	globPath: string;
	exportName: string;
	/** Props from a harvested call site, when one was selected. */
	props?: Record<string, unknown> | null;
	children?: string | null;
	/** Where those props were written. */
	origin?: string | null;
}

export interface RendererAppProps extends Omit<MountRendererOptions, "root"> {
	transport: RendererTransport;
	/** Optional here: only the inline path has a host element to measure. */
	root?: HTMLElement | null;
	isolation?: "frame" | "inline";
	initialFixture?: FixtureId | null;
	initialComponent?: ComponentRef | null;
	initialOverlays?: InputOverlay[];
}

/* ------------------------------------------------------------------ *
 * Loading — §9.1, one lazy boundary per fixture *module*
 * ------------------------------------------------------------------ */

interface Selection {
	fixture: FixtureId | null;
	component: ComponentRef | null;
}

interface Loaded {
	status: "empty" | "loading" | "ready" | "error";
	/**
	 * The selection `fixture` belongs to, which during a load is the PREVIOUS
	 * one — see the render below, where it is React's key.
	 *
	 * Kept in state rather than derived from `selection`, because those two
	 * disagree for exactly as long as a load takes and the whole point is to
	 * keep rendering the tree that is still mounted. Deriving it would give the
	 * outgoing fixture the incoming fixture's key, which is an unmount.
	 */
	key: string;
	fixture: NormalizedFixture | null;
	/** Non-empty when ALL_FIXTURES is selected: every fixture in the file. */
	all?: NormalizedFixture[];
	standingInFor?: string | null;
	decorators: LoadedDecorator[];
	error: RendererError | null;
}

const EMPTY: Loaded = {
	status: "empty",
	key: "empty",
	fixture: null,
	decorators: [],
	error: null,
};

function findFile(config: RuntimeConfig, path: string): FixtureFileIndex | undefined {
	return config.files.find((file) => file.path === path);
}

/**
 * Put the fixtures in the order they are written in the file.
 *
 * A module namespace object has its keys sorted by the spec, so anything derived
 * from `Object.keys(module)` at runtime comes out alphabetical — `Color` before
 * `Default`. The static index is parsed from the source and preserves
 * declaration order, and it is what the tree and the toolbar already show, so it
 * is the authority. Fixtures the index does not know about (a name that appeared
 * since the index was built) keep their relative order at the end.
 */
function orderByIndex(
	fixtures: readonly NormalizedFixture[],
	names: FixtureFileIndex["names"],
): NormalizedFixture[] {
	if (!names || names.length === 0) return [...fixtures];
	const rank = new Map(names.map((name, index) => [name, index]));
	return [...fixtures].sort((a, b) => {
		const ra = rank.get(a.name) ?? Number.MAX_SAFE_INTEGER;
		const rb = rank.get(b.name) ?? Number.MAX_SAFE_INTEGER;
		return ra - rb;
	});
}

function componentFixture(module: unknown, ref: ComponentRef): NormalizedFixture {
	const namespace = (module ?? {}) as Record<string, unknown>;
	const exported = namespace[ref.exportName];
	if (
		typeof exported !== "function" &&
		(typeof exported !== "object" || exported === null)
	) {
		throw new Error(`${ref.globPath} has no component export named "${ref.exportName}"`);
	}

	const component = exported as React.ComponentType<Record<string, unknown>>;
	const props = ref.props;
	if (!props) return { name: ref.exportName, render: component };

	const fixture: NormalizedFixture = {
		name: ref.exportName,
		render: createCallSiteComponent(component, props, ref.children ?? undefined),
	};
	if (ref.origin) fixture.meta = { description: `as used in ${ref.origin}` };
	return fixture;
}

/**
 * A harvested call site, rendered with its props as editable inputs.
 *
 * Registering each prop through `useFixtureInput` is what makes a found fixture
 * a real one: the control panel drives it, the overlay model backs it, and the
 * values it starts from are the ones written at the call site rather than
 * anything inferred. This does not conflict with D18 — nothing is derived from
 * a prop's *name*; the initial value is code the user wrote, and no control
 * metadata is invented for it.
 *
 * The key list is fixed when the component is created, and a different call
 * site creates a different component type, so React remounts rather than
 * running a changed hook order.
 */
function createCallSiteComponent(
	component: React.ComponentType<Record<string, unknown>>,
	props: Record<string, unknown>,
	children: string | undefined,
): React.ComponentType {
	const keys = Object.keys(props);

	function CallSiteFixture(): React.ReactNode {
		const next: Record<string, unknown> = { ...props };
		for (const key of keys) {
			// eslint-disable-next-line react-hooks/rules-of-hooks -- fixed-length list
			const [value] = useFixtureInput(key, props[key]);
			next[key] = value;
		}
		return children === undefined
			? React.createElement(component, next)
			: React.createElement(component, next, children);
	}

	CallSiteFixture.displayName = "CallSiteFixture";
	return CallSiteFixture;
}

/** This realm's hot registry, published before any update can arrive (§4.5). */
fixtureHotRegistry();

interface HostIndex {
	files: FixtureFileIndex[];
	decorators: DecoratorFileIndex[];
}

function useLoadedFixture(
	selection: Selection,
	props: RendererAppProps,
	hostIndex: HostIndex | null,
): Loaded {
	const { fixtureModules, decoratorModules, inventoryModules } = props;
	// The index the RENDERER resolves ids against, in precedence order: what the
	// host is showing (§4.5), then a hot-updated module, then the one that came
	// with the mount.
	const booted = liveRuntimeConfig(props.config);
	const config = React.useMemo(
		() =>
			hostIndex
				? { ...booted, files: hostIndex.files, decorators: hostIndex.decorators }
				: booted,
		[booted, hostIndex],
	);
	const [state, setState] = React.useState<Loaded>(EMPTY);

	/**
	 * §4.5 — a fixture module that was hot-updated is re-read here rather than
	 * arriving as a page load. `hot.ts` says why the glob cannot do this itself;
	 * the version is a dependency of the load effect below, so an edit re-runs
	 * exactly the work a selection does and nothing more.
	 */
	const hot = React.useMemo(() => fixtureHotRegistry(), []);
	const hotVersion = React.useSyncExternalStore(
		hot.subscribe,
		() => hot.version,
		() => 0,
	);

	// One identity for the whole component selection, so switching between two
	// call sites of the same component reloads rather than reusing the first.
	const componentKey = selection.component
		? `${selection.component.globPath}#${selection.component.exportName}#${selection.component.origin ?? ""}`
		: "";

	/**
	 * React's key for the tree this selection will produce. Hoisted above the
	 * loader because `Loaded` records it: the key that is rendered is the loaded
	 * fixture's, not the selected one's, and they differ while a load is in
	 * flight. (The render below used to recompute this from `selection`.)
	 */
	const selectionKey = selection.component
		? `component:${componentKey}`
		: selection.fixture
			? serializeFixtureId(selection.fixture)
			: "empty";

	React.useEffect(() => {
		let cancelled = false;
		const fail = (error: unknown, file?: string): void => {
			if (cancelled) return;
			setState({
				status: "error",
				key: selectionKey,
				fixture: null,
				decorators: [],
				error: toRendererError(error, "module", file ? { file } : {}),
			});
		};

		async function run(): Promise<void> {
			if (selection.component) {
				const ref = selection.component;
				const load = liveModuleMap("inventoryModules", inventoryModules)[ref.globPath];
				if (!load) return fail(new Error(`no module for ${ref.globPath}`), ref.globPath);
				setState((prev) => ({ ...prev, status: "loading", error: null }));
				try {
					const module = await load();
					if (cancelled) return;
					setState({
						status: "ready",
						key: selectionKey,
						fixture: componentFixture(module, ref),
						decorators: [],
						error: null,
					});
				} catch (error) {
					fail(error, ref.globPath);
				}
				return;
			}

			if (!selection.fixture) {
				if (!cancelled) setState(EMPTY);
				return;
			}

			const id = selection.fixture;
			const file = findFile(config, id.path);
			if (!file) {
				return fail(new Error(`no fixture file indexed at "${id.path}"`), id.path);
			}
			const load = loadFixtureModule(fixtureModules, file.globPath);
			if (!load) {
				return fail(new Error(`no module registered for ${file.globPath}`), file.globPath);
			}

			setState((prev) => ({ ...prev, status: "loading", error: null }));
			try {
				const [module, decorators] = await Promise.all([
					load,
					loadDecorators(
						selectDecorators(config.decorators, id.path),
						liveModuleMap("decoratorModules", decoratorModules),
					),
				]);
				if (cancelled) return;
				const normalized = normalizeModule(
					module,
					file,
					config,
					props.storybookPreview ?? null,
				);

				if (id.name === ALL_FIXTURES) {
					const all = orderByIndex(normalized.fixtures, file.names);
					setState({
						status: "ready",
						key: selectionKey,
						fixture: all[0] ?? null,
						all,
						decorators,
						error: null,
					});
					return;
				}

				const picked = selectFixture(normalized.fixtures, id.name);
				const next: Loaded = {
					status: "ready",
					key: selectionKey,
					fixture: picked.fixture,
					decorators,
					error: null,
				};
				if (picked.standingInFor !== undefined) next.standingInFor = picked.standingInFor;
				setState(next);
			} catch (error) {
				fail(error, file.globPath);
			}
		}

		void run();
		return () => {
			cancelled = true;
		};
	}, [
		selection.fixture?.path,
		selection.fixture?.name,
		selectionKey,
		componentKey,
		hotVersion,
		config,
		fixtureModules,
		decoratorModules,
		inventoryModules,
	]);

	return state;
}

/* ------------------------------------------------------------------ *
 * Rendering one fixture
 * ------------------------------------------------------------------ */

function FixtureRender(props: { fixture: NormalizedFixture }): React.ReactNode {
	const render = props.fixture.render;
	if (React.isValidElement(render)) return render;
	return React.createElement(render as React.ComponentType);
}

const noteStyle: React.CSSProperties = {
	font: "12px/1.4 ui-sans-serif, system-ui, sans-serif",
	color: "#737373",
	padding: "6px 10px",
};

const emptyStyle: React.CSSProperties = {
	font: "13px/1.5 ui-sans-serif, system-ui, sans-serif",
	color: "#737373",
	padding: 16,
};

/* ---------------- the all-fixtures overview page ---------------- */

const overviewStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 20,
	padding: 16,
	boxSizing: "border-box",
};

const overviewItemStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
	minWidth: 0,
};

const overviewHeadingStyle: React.CSSProperties = {
	margin: 0,
	font: "500 12px/1.4 ui-sans-serif, system-ui, sans-serif",
	letterSpacing: "0.01em",
	color: "#737373",
};

const overviewFrameStyle: React.CSSProperties = {
	border: "1px solid color-mix(in srgb, currentColor 12%, transparent)",
	borderRadius: 6,
	minWidth: 0,
	overflow: "auto",
};

/**
 * `FixtureMeta.layout` — how the fixture sits in the preview area (§13's
 * `parameters.layout`, adapted). `padded` is the default because a component
 * flush against the viewport edge is hard to read.
 *
 * `inOverview` bounds a `centered` fixture to a readable band instead of a full
 * viewport, so a file with twenty fixtures is a page you can scan rather than
 * twenty screens of whitespace.
 */
function layoutStyle(
	layout: FixtureMeta["layout"],
	inOverview = false,
): React.CSSProperties {
	if (layout === "fullscreen") return inOverview ? { minWidth: 0 } : {};
	if (layout === "centered" && inOverview) {
		return {
			minHeight: 96,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			padding: 16,
			boxSizing: "border-box",
		};
	}
	if (layout === "centered") {
		return {
			// `100%` cannot resolve here: `#uight-root` sets only `min-height`, so
			// its used height is `auto` and a percentage child collapses. The frame's
			// own viewport is the right reference anyway — "centred in the preview
			// area" is exactly what `100vh` means inside a frame realm.
			minHeight: "100vh",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			padding: 16,
			boxSizing: "border-box",
		};
	}
	return { padding: 16 };
}

/* ------------------------------------------------------------------ *
 * The app
 * ------------------------------------------------------------------ */

export function RendererApp(props: RendererAppProps): React.ReactElement {
	const { config, transport, fixtureModules } = props;
	const isolation = props.isolation ?? "frame";
	const dev = config.command === "serve";

	const send = React.useCallback(
		(message: MountedMessage) => {
			transport.send(message);
		},
		[transport],
	);

	const serializer = React.useMemo(
		() => createSerializer(props.codecs ?? [], { dev }),
		[props.codecs, dev],
	);
	const store = React.useMemo(
		() => new OverlayStore(serializer, send, dev),
		[serializer, send, dev],
	);

	/**
	 * The index the host is showing, when it has told us (§4.5). A frame that
	 * booted before a file existed cannot resolve an id the tree already offers,
	 * and no amount of module re-importing fixes that race — the host is the one
	 * that knows.
	 */
	const [hostIndex, setHostIndex] = React.useState<HostIndex | null>(null);

	const [selection, setSelection] = React.useState<Selection>(() => ({
		fixture: props.initialFixture ?? null,
		component: props.initialComponent ?? null,
	}));

	// The host's initial overlays arrive with INIT, before the first render.
	const seeded = React.useRef(false);
	if (!seeded.current) {
		seeded.current = true;
		if (props.initialOverlays?.length) store.setOverlays(props.initialOverlays);
	}

	/* ---------------- inbound messages ---------------- */

	React.useEffect(() => {
		return transport.subscribe((message) => {
			switch (message.type) {
				case "SELECT_FIXTURE": {
					store.clearForFixture();
					setSelection({
						fixture: message.fixture ?? null,
						component: message.component
							? {
									...message.component,
									props: message.props ?? null,
									children: message.children ?? null,
									origin: message.origin ?? null,
								}
							: null,
					});
					break;
				}
				case "SET_INDEX":
					// §4.5 — the host's index outranks the one this realm booted with.
					setHostIndex({ files: message.files, decorators: message.decorators });
					break;
				case "PREFETCH": {
					// Warm the chunk and throw the module away: the browser keeps it,
					// and the selection that follows resolves from cache. Failures are
					// the selection's to report — a prefetch that 404s must not put an
					// error on screen for a fixture nobody has opened.
					const file = findFile(liveRuntimeConfig(config), message.path);
					if (file) void loadFixtureModule(fixtureModules, file.globPath)?.catch(() => {});
					break;
				}
				case "SET_OVERLAYS":
					store.setOverlays(message.overlays);
					break;
				case "OVERLAY":
					store.receiveOverlay(message);
					break;
				case "RESYNC":
					// The host asking us to resend: the next commit does it.
					break;
				default:
					break;
			}
		});
	}, [transport, store, config, fixtureModules]);

	/* ---------------- viewport and size reporting ---------------- */

	const viewport = React.useMemo(
		() =>
			createViewportSource(
				isolation === "frame"
					? typeof window === "undefined"
						? null
						: window
					: (props.root ?? null),
			),
		[isolation, props.root],
	);

	React.useEffect(() => {
		if (isolation !== "frame" || typeof ResizeObserver === "undefined") return;
		const element = document.documentElement;
		const observer = new ResizeObserver(() => {
			send({
				type: "RESIZE",
				width: element.scrollWidth,
				height: element.scrollHeight,
			});
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [isolation, send]);

	/* ---------------- errors ---------------- */

	const reportError = React.useCallback(
		(error: RendererError) => {
			send({ type: "RENDERER_ERROR", error });
		},
		[send],
	);

	const loaded = useLoadedFixture(selection, props, hostIndex);

	React.useEffect(() => {
		if (loaded.status === "error" && loaded.error)
			send({ type: "RENDERER_ERROR", error: loaded.error });
		else if (loaded.status === "ready") send({ type: "RENDERER_ERROR", error: null });
	}, [loaded.status, loaded.error, send]);

	/* ---------------- runtime context ---------------- */

	const fixtureId: FixtureId = selection.component
		? { path: selection.component.globPath, name: selection.component.exportName }
		: (selection.fixture ?? { path: "", name: null });

	const runtime = React.useMemo<FixtureRuntime>(
		() => ({
			fixtureId,
			isolation,
			config,
			store,
			serializer,
			viewport,
			send,
			dev,
		}),
		[
			fixtureId.path,
			fixtureId.name,
			isolation,
			config,
			store,
			serializer,
			viewport,
			send,
			dev,
		],
	);

	React.useEffect(() => {
		store.fixtureLabel = selection.fixture ? fixtureLabel(selection.fixture) : "";
	}, [store, selection.fixture]);

	/* ---------------- version compatibility — §16.2 ---------------- */

	const mismatch = React.useMemo<RendererError | null>(() => {
		if (config.protocolVersion !== PROTOCOL_VERSION) {
			return {
				kind: "protocol",
				message: `protocol mismatch: the plugin speaks version ${config.protocolVersion}, this runtime speaks ${PROTOCOL_VERSION}. Rebuild or restart the dev server.`,
			};
		}
		if (config.version !== UIGHT_VERSION) {
			return {
				kind: "protocol",
				message: `version mismatch: plugin uight ${config.version}, runtime uight ${UIGHT_VERSION}. One of them is a stale build artefact.`,
			};
		}
		return null;
	}, [config.protocolVersion, config.version]);

	React.useEffect(() => {
		if (mismatch) send({ type: "RENDERER_ERROR", error: mismatch });
	}, [mismatch, send]);

	/* ---------------- the tree ---------------- */

	/**
	 * The key of what is on screen — the LOADED selection, not the selected one.
	 *
	 * While the next fixture's module is in flight the previous one keeps
	 * rendering (see the `loading` branch), and it has to keep rendering under
	 * the key it mounted with or React unmounts it and we are back to the blank
	 * frame this exists to remove.
	 */
	const key = loaded.key;

	let content: React.ReactNode;
	if (mismatch) {
		content = <ErrorPanel error={mismatch} />;
	} else if (loaded.status === "error" && loaded.error) {
		content = <ErrorPanel error={loaded.error} />;
	} else if (loaded.status === "loading" && !loaded.fixture) {
		// Nothing to hold over — this is the first load of the realm, and a blank
		// frame is the honest picture. Every later load falls through and keeps
		// the outgoing fixture up until the incoming one is ready.
		content = null;
	} else if (!loaded.fixture) {
		content = (
			<div style={emptyStyle}>
				{selection.fixture
					? `No fixture named ${JSON.stringify(selection.fixture.name)} in ${selection.fixture.path}.`
					: "No fixture selected."}
			</div>
		);
	} else if (loaded.all && loaded.all.length > 1) {
		// Every fixture in the file, one page. Each gets its own error boundary so
		// one broken fixture does not take the page with it.
		content = (
			<div key={key} style={overviewStyle}>
				{loaded.all.map((fixture, index) => (
					<section key={`${fixture.name ?? index}`} style={overviewItemStyle}>
						<h2 style={overviewHeadingStyle}>
							{fixture.meta?.title ?? fixture.name ?? "Default"}
						</h2>
						<div style={overviewFrameStyle}>
							<div style={layoutStyle(fixture.meta?.layout, true)}>
								{composeDecorators(
									<RendererErrorBoundary
										kind="fixture"
										label={fixture.name ?? undefined}
										onError={reportError}
										resetKey={`${key}:${fixture.name ?? index}`}
									>
										<FixtureRender fixture={fixture} />
									</RendererErrorBoundary>,
									loaded.decorators,
									{ onError: reportError, resetKey: key },
								)}
							</div>
						</div>
					</section>
				))}
			</div>
		);
	} else {
		const fixture = loaded.fixture;
		const tree = composeDecorators(
			<RendererErrorBoundary
				kind="fixture"
				label={selection.fixture ? fixtureLabel(selection.fixture) : undefined}
				onError={reportError}
				resetKey={key}
			>
				<FixtureRender fixture={fixture} />
			</RendererErrorBoundary>,
			loaded.decorators,
			{ onError: reportError, resetKey: key },
		);
		content = (
			<React.Fragment key={key}>
				{loaded.standingInFor !== undefined && loaded.standingInFor !== null ? (
					// §3.5: a file node renders its first fixture and says which.
					<div style={noteStyle}>
						Showing “{loaded.standingInFor}”, the first fixture in this file.
					</div>
				) : null}
				<div style={layoutStyle(fixture.meta?.layout)}>{tree}</div>
			</React.Fragment>
		);
	}

	const Providers = props.Providers;
	const overview = Boolean(loaded.all && loaded.all.length > 1);
	const inner = (
		<FixtureRuntimeProvider runtime={overview ? { ...runtime, overview: true } : runtime}>
			{content}
		</FixtureRuntimeProvider>
	);

	return (
		<RendererErrorBoundary kind="bootstrap" label="preview entry" onError={reportError}>
			{Providers ? <Providers>{inner}</Providers> : inner}
		</RendererErrorBoundary>
	);
}
