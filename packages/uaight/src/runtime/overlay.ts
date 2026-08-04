/**
 * Renderer-side overlay store — SPEC.md §7.2, §7.3.
 *
 * D17: the UI owns an editable overlay of patches; the renderer owns the value.
 * This module holds the renderer's half — patches keyed by input name, the
 * per-input revision, stale-revision rejection with `RESYNC`, and the dropped
 * patches the panel surfaces by name — "`variant` no longer applies".
 *
 * Nothing here mutates a value the consumer owns. Patches are applied to the
 * fresh default immutably, with structural sharing: new objects along the
 * changed path only, everything else by identity.
 */

import type { MountedMessage, OverlayMessage } from "../shared/protocol.ts";
import type {
	InputOptionsWire,
	InputOverlay,
	Patch,
	PathSegment,
	Wire,
} from "../shared/types.ts";
import { isSafePath, mergePatch, wireAt, wireEqual } from "../shared/wire.ts";
import type { DeserializeResult, Serializer } from "./serialize.ts";
import { isFullyEditable } from "./serialize.ts";

/* ------------------------------------------------------------------ *
 * Immutable application over the JS value — §7.2 step 4
 * ------------------------------------------------------------------ */

const MISSING = Symbol("uaight.missing");

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null) return false;
	const proto = Object.getPrototypeOf(value) as object | null;
	return proto === Object.prototype || proto === null;
}

/**
 * Structural sharing: only the containers along `path` are rebuilt. Returns
 * MISSING when the path is not present in the current shape, so the caller can
 * drop and count the patch (§7.3).
 */
function immutableSet(
	target: unknown,
	path: readonly PathSegment[],
	value: unknown,
): unknown | typeof MISSING {
	if (path.length === 0) return value;
	const [head, ...rest] = path as [PathSegment, ...PathSegment[]];

	if (typeof head === "number") {
		if (!Array.isArray(target)) return MISSING;
		if (!Number.isInteger(head) || head < 0 || head >= target.length) return MISSING;
		const next = immutableSet(target[head], rest, value);
		if (next === MISSING) return MISSING;
		const copy = (target as unknown[]).slice();
		copy[head] = next;
		return copy;
	}

	if (!isPlainObject(target)) return MISSING;
	if (!Object.prototype.hasOwnProperty.call(target, head)) return MISSING;
	const next = immutableSet(target[head], rest, value);
	if (next === MISSING) return MISSING;
	const copy: Record<string, unknown> = { ...target };
	Object.defineProperty(copy, head, {
		value: next,
		enumerable: true,
		writable: true,
		configurable: true,
	});
	return copy;
}

export interface ApplyOverlayResult {
	value: unknown;
	/** One entry per patch that did not apply, at the path it pointed to (§7.3). */
	dropped: PathSegment[][];
}

/**
 * Apply an overlay's patches to the fresh default.
 *
 * Presence is decided against the *wire* — that is what the UI edited, and it
 * is the only view that knows an `opaque` leaf has no interior. Application
 * happens against the JS value, so identity is preserved everywhere the patch
 * did not reach and opaque leaves keep coming from the current module.
 */
export function applyOverlayToValue(
	base: unknown,
	baseWire: Wire,
	patches: readonly Patch[],
	deserialize: (wire: Wire) => DeserializeResult,
): ApplyOverlayResult {
	let value = base;
	const dropped: PathSegment[][] = [];

	for (const patch of patches) {
		// `__proto__`, `constructor`, `prototype` are rejected outright (§7.3).
		if (!isSafePath(patch.path)) {
			dropped.push(patch.path);
			continue;
		}
		// Opaque values never travel in a patch (§7.2).
		if (!patch.value || !isFullyEditable(patch.value)) {
			dropped.push(patch.path);
			continue;
		}
		if (patch.path.length > 0 && wireAt(baseWire, patch.path) === undefined) {
			dropped.push(patch.path);
			continue;
		}
		const decoded = deserialize(patch.value);
		if (!decoded.ok) {
			dropped.push(patch.path);
			continue;
		}
		const next = immutableSet(value, patch.path, decoded.value);
		if (next === MISSING) {
			dropped.push(patch.path);
			continue;
		}
		value = next;
	}

	return { value, dropped };
}

/* ------------------------------------------------------------------ *
 * The store
 * ------------------------------------------------------------------ */

export interface InputRegistration {
	/** Stable per hook call site, so two inputs sharing a name are detectable. */
	slot: string;
	name: string;
	revision: number;
	wire: Wire;
	options?: InputOptionsWire;
	/** False when the input was not registered during the latest render (§7.3). */
	active: boolean;
	/** Registration order, for INPUTS_SETTLED. */
	order: number;
}

export interface OverlayEntry {
	name: string;
	/** The registration these patches were computed against. */
	revision: number;
	patches: Patch[];
	/**
	 * A root value the fixture set on itself that the wire cannot carry
	 * (§7.3, "fixture calls the setter itself"). Dropped when the revision
	 * moves, which is what keeps it from surviving HMR as a stale reference.
	 */
	override?: { value: unknown; wire: Wire; revision: number };
}

export type Send = (message: MountedMessage) => void;

/**
 * Compared with `wireEqual`, which ignores opaque ids — those are minted fresh
 * on every serialization, so a structural comparison is the only one that does
 * not report a change on every render.
 */
function optionsEqual(a?: InputOptionsWire, b?: InputOptionsWire): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	if (a.label !== b.label || a.description !== b.description) return false;
	if (a.control !== b.control) return false;
	if (a.min !== b.min || a.max !== b.max || a.step !== b.step) return false;
	if (!a.options || !b.options) return a.options === b.options;
	return (
		a.options.length === b.options.length &&
		a.options.every((wire, index) => wireEqual(wire, b.options![index]!))
	);
}

export class OverlayStore {
	/** Named in the duplicate-input development error (§7.3). */
	fixtureLabel = "";

	private readonly entries = new Map<string, OverlayEntry>();
	private readonly registrations = new Map<string, InputRegistration>();
	private readonly listeners = new Set<() => void>();
	private readonly reportedDrops = new Map<string, number>();
	private order = 0;
	private settleQueued = false;
	private lastSettled: string | null = null;
	private readonly bumps = new Map<string, number>();

	droppedTotal = 0;

	constructor(
		private readonly serializer: Serializer,
		private send: Send,
		private readonly dev = true,
	) {}

	setSend(send: Send): void {
		this.send = send;
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	private notify(): void {
		for (const listener of [...this.listeners]) listener();
	}

	/* -------------------- reads, safe during render -------------------- */

	getEntry = (name: string): OverlayEntry | undefined => this.entries.get(name);

	getRegistration = (name: string): InputRegistration | undefined =>
		this.registrations.get(name);

	/** Registered inputs in registration order, for INPUTS_SETTLED and the panel. */
	list(): InputRegistration[] {
		return [...this.registrations.values()].sort((a, b) => a.order - b.order);
	}

	/**
	 * The overlay the host should hold, for replay after a frame reload.
	 * Overrides are renderer-local by construction and are not included.
	 */
	toOverlays(): InputOverlay[] {
		return [...this.entries.values()]
			.filter((entry) => entry.patches.length > 0)
			.map((entry) => ({
				input: entry.name,
				revision: entry.revision,
				patches: entry.patches,
			}));
	}

	/* -------------------- registration -------------------- */

	/**
	 * Called from an effect, never during render (§7.2 is a data-flow contract,
	 * not a side effect).
	 */
	commitRegistration(input: {
		slot: string;
		name: string;
		revision: number;
		wire: Wire;
		options?: InputOptionsWire;
	}): void {
		const previous = this.registrations.get(input.name);

		if (this.dev && previous && previous.slot !== input.slot && previous.active) {
			// eslint-disable-next-line no-console
			console.error(
				`[uaight] duplicate fixture input "${input.name}"${
					this.fixtureLabel ? ` in ${this.fixtureLabel}` : ""
				} — last registration wins`,
			);
		}

		const revisionChanged = !previous || previous.revision !== input.revision;
		const changed = revisionChanged || !optionsEqual(previous.options, input.options);

		if (revisionChanged && previous) {
			// A new revision invalidates a renderer-side override: the module's
			// default moved, so the value the fixture pinned is stale (§7.1).
			const entry = this.entries.get(input.name);
			if (entry?.override) {
				this.entries.set(input.name, {
					name: entry.name,
					revision: entry.revision,
					patches: entry.patches,
				});
			}
			this.reportedDrops.delete(input.name);

			// §7.2 serializes a *fresh* default every render, so a default that is
			// genuinely new each time (`new Date()`, an inline `() => {}` under a
			// changing name) bumps the revision forever and the host resyncs
			// forever. That is inherent to the model; say so once instead of
			// letting it look like a protocol fault.
			const bumps = (this.bumps.get(input.name) ?? 0) + 1;
			this.bumps.set(input.name, bumps);
			if (this.dev && bumps === 25) {
				// eslint-disable-next-line no-console
				console.warn(
					`[uaight] input "${input.name}" has produced a different default on ${bumps} consecutive renders. ` +
						`Its default is being rebuilt each render, so the control panel can never settle — hoist it or memoize it.`,
				);
			}
		} else if (!revisionChanged) {
			this.bumps.set(input.name, 0);
		}

		this.registrations.set(input.name, {
			slot: input.slot,
			name: input.name,
			revision: input.revision,
			wire: input.wire,
			options: input.options,
			active: true,
			order: previous?.order ?? this.order++,
		});

		if (changed) {
			this.send({
				type: "INPUT_REGISTERED",
				name: input.name,
				revision: input.revision,
				wire: input.wire,
				options: input.options,
			});
		}
		this.scheduleSettle();
	}

	/**
	 * The hook unmounted. The registration record is kept — §7.3 wants the
	 * overlay preserved and the panel showing it greyed and inactive — but the
	 * input no longer counts as registered.
	 */
	releaseSlot(slot: string, name: string): void {
		const record = this.registrations.get(name);
		if (record && record.slot === slot) {
			this.registrations.set(name, { ...record, active: false });
			this.scheduleSettle();
		}
	}

	/**
	 * Batched to a microtask rather than driven from an effect: a child that
	 * re-renders alone can change what is registered without its parent
	 * re-rendering, and the panel must not be told a stale list.
	 */
	private scheduleSettle(): void {
		if (this.settleQueued) return;
		this.settleQueued = true;
		queueMicrotask(() => {
			this.settleQueued = false;
			this.settle();
		});
	}

	/** The names registered during the latest render, in registration order. */
	settle(): void {
		const names = this.list()
			.filter((record) => record.active)
			.map((record) => record.name);
		const key = JSON.stringify(names);
		if (key === this.lastSettled) return;
		this.lastSettled = key;
		this.send({ type: "INPUTS_SETTLED", names });
	}

	/* -------------------- patches from the host -------------------- */

	receiveOverlay(message: OverlayMessage): "applied" | "stale" | "invalid" {
		if (typeof message.name !== "string" || !Array.isArray(message.patches)) {
			return "invalid";
		}

		const patches: Patch[] = [];
		for (const patch of message.patches) {
			if (!patch || !Array.isArray(patch.path) || !isSafePath(patch.path)) return "invalid";
			if (!patch.value || typeof patch.value.t !== "string") return "invalid";
			// `EditableWire` excludes opaque by type; enforce it at the boundary.
			if (!isFullyEditable(patch.value)) return "invalid";
			patches.push({ path: patch.path, value: patch.value });
		}

		const record = this.registrations.get(message.name);
		if (record && message.revision < record.revision) {
			// §7.3: reject patches predating the current registration and reply
			// RESYNC so the UI recomputes against the new wire.
			this.send({
				type: "RESYNC",
				name: message.name,
				revision: record.revision,
				wire: record.wire,
				dropped: [],
			});
			return "stale";
		}

		const revision = record ? record.revision : message.revision;
		this.entries.set(message.name, { name: message.name, revision, patches });
		this.notify();
		return "applied";
	}

	/** INIT and SET_OVERLAYS both land here. */
	setOverlays(overlays: readonly InputOverlay[]): void {
		this.entries.clear();
		for (const overlay of overlays) {
			if (!overlay || typeof overlay.input !== "string") continue;
			const patches = (overlay.patches ?? []).filter(
				(patch) =>
					patch &&
					Array.isArray(patch.path) &&
					isSafePath(patch.path) &&
					patch.value &&
					isFullyEditable(patch.value),
			);
			this.entries.set(overlay.input, {
				name: overlay.input,
				revision: overlay.revision ?? 0,
				patches,
			});
		}
		this.notify();
	}

	/** Reset means the current module's default — clearing the overlay (§7.3). */
	reset(name?: string): void {
		if (name === undefined) this.entries.clear();
		else this.entries.delete(name);
		this.reportedDrops.clear();
		this.notify();
	}

	/** Fixture change drops every overlay (§7.3, "dropped on fixture change"). */
	clearForFixture(): void {
		this.entries.clear();
		this.registrations.clear();
		this.reportedDrops.clear();
		this.bumps.clear();
		this.order = 0;
		this.droppedTotal = 0;
		this.lastSettled = null;
		this.notify();
	}

	/* -------------------- the fixture's own setter -------------------- */

	/**
	 * §7.3: "Fixture calls the setter itself → becomes a root-path patch, so it
	 * persists like a panel edit and survives re-render."
	 *
	 * When the new value serializes without an opaque leaf, that is exactly what
	 * happens and the patch is mirrored to the UI. When it does not — the value
	 * holds a function, an element or a class instance — a patch cannot carry it
	 * (`EditableWire` excludes opaque), so the value is held renderer-side as a
	 * root override and the UI is told the new shape with RESYNC. Either way the
	 * value survives re-render and neither way does an opaque leaf reach the wire.
	 */
	setFromRenderer(name: string, value: unknown): void {
		const record = this.registrations.get(name);
		const revision = record?.revision ?? 0;
		const wire = this.serializer.serialize(value, revision, { name });

		if (isFullyEditable(wire)) {
			const previous = this.entries.get(name);
			const patch: Patch = { path: [], value: wire };
			const patches = mergePatch(previous?.patches ?? [], patch);
			this.entries.set(name, { name, revision, patches });
			this.notify();
			this.send({ type: "OVERLAY", name, revision, patches, fromRenderer: true });
			return;
		}

		this.entries.set(name, {
			name,
			revision,
			patches: [],
			override: { value, wire, revision },
		});
		this.notify();
		this.send({ type: "RESYNC", name, revision, wire, dropped: [] });
	}

	/* -------------------- dropped patches -------------------- */

	/**
	 * Reported once per input per revision (§7.3), carrying the paths so the
	 * panel can name what was lost rather than tally it.
	 */
	reportDropped(name: string, revision: number, paths: readonly PathSegment[][]): void {
		if (paths.length === 0) return;
		if (this.reportedDrops.get(name) === revision) return;
		this.reportedDrops.set(name, revision);
		this.droppedTotal += paths.length;

		const record = this.registrations.get(name);
		this.send({
			type: "RESYNC",
			name,
			revision,
			wire: record?.wire ?? { t: "undef" },
			dropped: paths.map((path) => [...path]),
		});

		if (this.dev) {
			const count = paths.length;
			// eslint-disable-next-line no-console
			console.warn(
				`[uaight] ${count} overlay patch${count === 1 ? "" : "es"} for input "${name}" no longer apply to the current shape: ` +
					paths.map((path) => (path.length ? path.join(".") : "(root)")).join(", "),
			);
		}
	}
}
