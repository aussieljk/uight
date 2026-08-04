/**
 * Fixture-side React context and hooks — SPEC.md §19.2, §7.2, §7.6.
 *
 * The overlay contract, per render (§7.2):
 *
 *   1. the hook produces a **fresh** default;
 *   2. it serializes that default to `Wire`;
 *   3. it posts `INPUT_REGISTERED { name, revision, wire }` — from an effect,
 *      because registration is not a side effect of rendering;
 *   4. the host's patches for `name` are applied to the fresh default
 *      immutably, with structural sharing;
 *   5. the result is what the hook returns.
 *
 * Opaque leaves never travel in a patch, so functions, elements and class
 * instances always come from the current module and HMR is correct by
 * construction rather than by cleanup.
 */

import * as React from "react";
import { parseFixtureId } from "../shared/fixture-id.ts";
import type { MountedMessage } from "../shared/protocol.ts";
import type {
	FixtureId,
	InputOptions,
	InputOptionsWire,
	RuntimeConfig,
	Viewport,
	Wire,
} from "../shared/types.ts";
import { wireEqual } from "../shared/wire.ts";
import { applyOverlayToValue } from "./overlay.ts";
import type { OverlayEntry, OverlayStore } from "./overlay.ts";
import type { Serializer } from "./serialize.ts";

/* ------------------------------------------------------------------ *
 * Viewport source — §6.5, §19.2
 * ------------------------------------------------------------------ */

export interface ViewportSource {
	getSnapshot(): Viewport;
	subscribe(listener: () => void): () => void;
}

/**
 * In frame isolation this is the frame's own window, which is the viewport the
 * fixture's media queries see. Inline, it is the host element's box — and the
 * fixture's media queries still see the page, which §5.2 documents rather than
 * papers over.
 */
export function createViewportSource(
	target: Window | HTMLElement | null,
): ViewportSource {
	const measure = (): Viewport => {
		if (!target) return { width: 0, height: 0 };
		if ("innerWidth" in target) {
			return { width: target.innerWidth, height: target.innerHeight };
		}
		const rect = target.getBoundingClientRect();
		return { width: Math.round(rect.width), height: Math.round(rect.height) };
	};

	let snapshot = measure();
	const listeners = new Set<() => void>();

	const update = (): void => {
		const next = measure();
		if (next.width === snapshot.width && next.height === snapshot.height) return;
		snapshot = next;
		for (const listener of [...listeners]) listener();
	};

	return {
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			let detach = (): void => {};
			if (listeners.size === 1 && target) {
				if ("innerWidth" in target) {
					target.addEventListener("resize", update);
					detach = () => target.removeEventListener("resize", update);
				} else if (typeof ResizeObserver !== "undefined") {
					const observer = new ResizeObserver(update);
					observer.observe(target);
					detach = () => observer.disconnect();
				}
			}
			return () => {
				listeners.delete(listener);
				if (listeners.size === 0) detach();
			};
		},
	};
}

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

export interface FixtureRuntime {
	fixtureId: FixtureId;
	isolation: "frame" | "inline";
	config: RuntimeConfig;
	store: OverlayStore;
	serializer: Serializer;
	viewport: ViewportSource;
	send: (message: MountedMessage) => void;
	dev: boolean;
	/**
	 * True while every fixture in a file renders together as one page. Inputs do
	 * not register: a dozen fixtures declaring `useFixtureInput("size", …)` would
	 * otherwise collide on one name (§7.3's duplicate rule) and the panel would
	 * drive all of them at once. Select a single fixture to get its controls.
	 */
	overview?: boolean;
}

const FixtureRuntimeContext = React.createContext<FixtureRuntime | null>(null);

export function FixtureRuntimeProvider(props: {
	runtime: FixtureRuntime;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<FixtureRuntimeContext.Provider value={props.runtime}>
			{props.children}
		</FixtureRuntimeContext.Provider>
	);
}

function useFixtureRuntime(hook: string): FixtureRuntime {
	const runtime = React.useContext(FixtureRuntimeContext);
	if (!runtime) {
		throw new Error(
			`[uaight] ${hook}() was called outside a fixture. Fixture hooks only work inside a fixture rendered by <Uaight /> or the uaight renderer.`,
		);
	}
	return runtime;
}

/* ------------------------------------------------------------------ *
 * Input options — §7.6, declared at the call site, never inferred
 * ------------------------------------------------------------------ */

function toOptionsWire(
	options: InputOptions<unknown> | undefined,
	serializer: Serializer,
	revision: number,
	name: string,
): InputOptionsWire | undefined {
	if (!options) return undefined;
	const wire: InputOptionsWire = {};
	if (options.label !== undefined) wire.label = options.label;
	if (options.description !== undefined) wire.description = options.description;
	if (options.control !== undefined) wire.control = options.control;
	if (options.min !== undefined) wire.min = options.min;
	if (options.max !== undefined) wire.max = options.max;
	if (options.step !== undefined) wire.step = options.step;
	if (options.options) {
		wire.options = options.options.map((option) =>
			serializer.serialize(option, revision, { name }),
		);
	}
	return wire;
}

/* ------------------------------------------------------------------ *
 * useFixtureInput — §19.2
 * ------------------------------------------------------------------ */

export function useFixtureInput<T>(
	name: string,
	initial: T,
	options?: InputOptions<T>,
): [T, (value: T) => void] {
	const runtime = useFixtureRuntime("useFixtureInput");
	const { store, serializer } = runtime;
	const slot = React.useId();

	const readEntry = (): OverlayEntry | undefined => store.getEntry(name);
	const entry = React.useSyncExternalStore(store.subscribe, readEntry, readEntry);

	// ---- during render: a fresh default, serialized, at a stable revision ----
	const record = store.getRegistration(name);
	let revision = record?.revision ?? 0;
	let wire: Wire = serializer.serialize(initial, revision, { name });
	if (record && !wireEqual(record.wire, wire)) {
		// The module's default moved (an edit, or HMR). A new revision makes the
		// host's patches stale, and the host recomputes against the new wire.
		revision = record.revision + 1;
		wire = serializer.serialize(initial, revision, { name });
	}

	const optionsWire = toOptionsWire(
		options as InputOptions<unknown> | undefined,
		serializer,
		revision,
		name,
	);

	// ---- apply the overlay immutably ----
	const stale = !entry || entry.revision < revision;
	const override =
		!stale && entry?.override && entry.override.revision === revision
			? entry.override
			: undefined;
	const base = override ? override.value : initial;
	const baseWire = override ? override.wire : wire;
	const applied =
		stale || !entry
			? { value: base, dropped: [] }
			: applyOverlayToValue(base, baseWire, entry.patches, serializer.tryDeserialize);

	// ---- registration and reporting happen after the render, never during ----
	const pending = React.useRef({ slot, name, revision, wire, optionsWire, applied });
	pending.current = { slot, name, revision, wire, optionsWire, applied };

	const overview = runtime.overview === true;

	React.useEffect(() => {
		if (overview) return;
		const current = pending.current;
		store.commitRegistration({
			slot: current.slot,
			name: current.name,
			revision: current.revision,
			wire: current.wire,
			options: current.optionsWire,
		});
		if (current.applied.dropped.length > 0) {
			store.reportDropped(current.name, current.revision, current.applied.dropped);
		}
	});

	React.useEffect(() => {
		if (overview) return;
		return () => store.releaseSlot(slot, name);
	}, [store, slot, name, overview]);

	const set = React.useCallback(
		(value: T) => {
			if (overview) return;
			store.setFromRenderer(name, value);
		},
		[store, name, overview],
	);

	// In overview mode nothing registered, so there is no overlay to apply and
	// the module's own default is the honest value to show.
	return [overview ? initial : (applied.value as T), set];
}

/* ------------------------------------------------------------------ *
 * The rest of §19.2
 * ------------------------------------------------------------------ */

export function useFixtureSelect<T extends string>(
	name: string,
	options: { options: readonly T[]; initial?: T },
): [T, (value: T) => void] {
	const fallback = options.initial ?? options.options[0] ?? ("" as T);
	const [value, set] = useFixtureInput<T>(name, fallback, {
		control: "select",
		options: options.options,
	});
	// A value the host produced that is no longer one of the options would leave
	// the fixture rendering something the panel cannot show. Fall back instead.
	const safe = options.options.includes(value) ? value : fallback;
	return [safe, set];
}

export function useFixtureViewport(): Viewport {
	const runtime = useFixtureRuntime("useFixtureViewport");
	return React.useSyncExternalStore(
		runtime.viewport.subscribe,
		runtime.viewport.getSnapshot,
		runtime.viewport.getSnapshot,
	);
}

export function useFixtureId(): FixtureId {
	return useFixtureRuntime("useFixtureId").fixtureId;
}

export function useSelectFixture(): (id: FixtureId | string) => void {
	const runtime = useFixtureRuntime("useSelectFixture");
	return React.useCallback(
		(id: FixtureId | string) => {
			const parsed = parseFixtureId(id);
			if (!parsed) {
				// eslint-disable-next-line no-console
				console.error(`[uaight] useSelectFixture(): not a fixture id: ${String(id)}`);
				return;
			}
			runtime.send({ type: "NAVIGATE", fixture: parsed });
		},
		[runtime],
	);
}

export function useFixtureIsolation(): "frame" | "inline" {
	return useFixtureRuntime("useFixtureIsolation").isolation;
}

/** Internal: the renderer's own access to the runtime it published. */
export function useRendererRuntime(): FixtureRuntime | null {
	return React.useContext(FixtureRuntimeContext);
}
