/**
 * The overlay store. SPEC.md §7.2, §7.3.
 *
 * D17: the UI owns an editable overlay of patches; the renderer owns the
 * value. Nothing here ever holds a fixture value — only `Wire` snapshots the
 * renderer sent and the patches the user made against them. That is what makes
 * HMR correct by construction rather than by cleanup.
 *
 * Exposed through `useSyncExternalStore`, so an edit is one synchronous state
 * transition and the panel can never tear against the transport.
 */

import { useSyncExternalStore } from "react";
import { isSafePath, mergePatch, wireAt } from "../shared/wire.ts";
import type {
	DroppedPatchReport,
	EditableWire,
	InputOverlay,
	InputOptionsWire,
	PathSegment,
	Patch,
	RegisteredInput,
	Wire,
} from "../shared/types.ts";

export interface OverlayState {
	/** Registration order, which is call order inside the fixture. */
	registered: RegisteredInput[];
	overlays: InputOverlay[];
	/** §7.3 — the running total. Counted once per input per revision. */
	dropped: number;
	/**
	 * The same loss, per input and with the paths, so the panel can say
	 * "`variant`, `size` and 2 more no longer apply" instead of an aggregate.
	 * Newest first, one entry per input; `dropped` is the sum of their lengths.
	 */
	droppedInputs: DroppedPatchReport[];
}

const EMPTY: OverlayState = {
	registered: [],
	overlays: [],
	dropped: 0,
	droppedInputs: [],
};

export interface OverlayStore {
	subscribe(cb: () => void): () => void;
	getState(): OverlayState;
	/** §7.2 step 2. Returns the overlay to echo back, if any. */
	register(msg: {
		name: string;
		revision: number;
		wire: Wire;
		options?: InputOptionsWire | undefined;
	}): InputOverlay | null;
	/** §7.3 — inputs not named by the latest render are greyed, not forgotten. */
	settle(names: string[]): void;
	/** §7.3 — the renderer rejected a stale revision; recompute against the new wire. */
	resync(msg: {
		name: string;
		revision: number;
		wire: Wire;
		dropped: PathSegment[][];
	}): InputOverlay | null;
	/** A patch the renderer produced itself, by the fixture calling its setter. */
	adopt(msg: { name: string; revision: number; patches: Patch[] }): void;
	/**
	 * Patches from a shared link, held until the inputs they name register.
	 *
	 * A link carries no revision — a revision numbers *this* renderer's
	 * registration and means nothing in another tab — so seeded patches adopt
	 * whatever revision their input registers with and are pruned against its
	 * wire by the same rule as any other patch (§7.3). A patch naming a shape
	 * that no longer exists is dropped, not applied blindly.
	 */
	seed(overlays: readonly InputOverlay[]): void;
	set(name: string, path: PathSegment[], value: EditableWire): InputOverlay | null;
	reset(name?: string | undefined): InputOverlay[];
	/**
	 * Put back what `reset` took — the undo behind the reset toast.
	 *
	 * `r` wipes every tuned control and there was no way back; the values are not
	 * persisted (Q14) and the panel holds no history, so a mis-keyed `r` was
	 * final. This is deliberately NOT a general undo stack: it re-applies one
	 * snapshot the caller kept, against the CURRENT registration, and prunes it
	 * by exactly the same §7.3 rule as any other patch. A snapshot taken before
	 * an HMR reshaped the input comes back partially or not at all, which is the
	 * honest answer — the alternative is re-applying patches to a shape that no
	 * longer has them.
	 */
	restore(overlays: readonly InputOverlay[]): InputOverlay[];
	/** Overlays are dropped on fixture change (§7.3). */
	clear(): void;
}

/**
 * Patches whose path is no longer present in the shape are dropped (§7.3).
 * A root patch has an empty path and always survives, which is what keeps a
 * fixture-driven setter working across re-registration.
 */
function prune(
	wire: Wire,
	patches: readonly Patch[],
): { kept: Patch[]; dropped: PathSegment[][] } {
	const kept: Patch[] = [];
	const dropped: PathSegment[][] = [];
	for (const patch of patches) {
		if (isSafePath(patch.path) && wireAt(wire, patch.path) !== undefined) kept.push(patch);
		else dropped.push(patch.path);
	}
	return { kept, dropped };
}

export function createOverlayStore(): OverlayStore {
	let state: OverlayState = EMPTY;
	const listeners = new Set<() => void>();

	/** Overlays live in a Map keyed by name so a name that returns finds its patches. */
	const overlays = new Map<string, InputOverlay>();
	const registered = new Map<string, RegisteredInput>();
	/** Patches from a shared link, waiting for their input to register. */
	const seeded = new Map<string, Patch[]>();
	const order: string[] = [];
	/** Dropped patches are reported once per input per revision. */
	const reported = new Map<string, number>();
	/** Newest first, at most one entry per input. */
	let droppedInputs: DroppedPatchReport[] = [];

	const commit = () => {
		state = {
			registered: order
				.map((n) => registered.get(n))
				.filter((r): r is RegisteredInput => r !== undefined),
			overlays: order
				.map((n) => overlays.get(n))
				.filter((o): o is InputOverlay => o !== undefined),
			dropped: droppedInputs.reduce((total, report) => total + report.paths.length, 0),
			droppedInputs,
		};
		for (const l of [...listeners]) l();
	};

	/** §7.3 — once per input per revision, wherever the loss was noticed. */
	const report = (
		name: string,
		revision: number,
		paths: readonly PathSegment[][],
	): void => {
		if (paths.length === 0) return;
		if (reported.get(name) === revision) return;
		reported.set(name, revision);
		droppedInputs = [
			{ input: name, revision, paths: paths.map((path) => [...path]) },
			...droppedInputs.filter((entry) => entry.input !== name),
		];
	};

	const rebase = (name: string, revision: number, wire: Wire): InputOverlay | null => {
		const existing = overlays.get(name);
		if (!existing) return null;
		const { kept, dropped: lost } = prune(wire, existing.patches);
		if (lost.length > 0) report(name, revision, lost);
		if (kept.length === 0) {
			overlays.delete(name);
			return null;
		}
		const next: InputOverlay = { input: name, revision, patches: kept };
		overlays.set(name, next);
		return next;
	};

	return {
		subscribe(cb) {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},
		getState: () => state,

		register(msg) {
			// §7.3 — a duplicate name inside one fixture is the renderer's error to
			// report; here, last registration simply wins.
			if (!order.includes(msg.name)) order.push(msg.name);
			registered.set(msg.name, {
				name: msg.name,
				revision: msg.revision,
				wire: msg.wire,
				options: msg.options,
				active: true,
			});

			// A shared link's patches wait here until the input they name shows up.
			// An edit made before that point is the user's, and wins.
			const pending = seeded.get(msg.name);
			if (pending && !overlays.has(msg.name)) {
				overlays.set(msg.name, {
					input: msg.name,
					revision: msg.revision,
					patches: pending,
				});
			}
			seeded.delete(msg.name);

			const overlay = rebase(msg.name, msg.revision, msg.wire);
			commit();
			return overlay;
		},

		seed(next) {
			seeded.clear();
			for (const overlay of next) {
				if (overlay.patches.length) seeded.set(overlay.input, [...overlay.patches]);
			}
		},

		settle(names) {
			const live = new Set(names);
			for (const [name, reg] of registered) {
				const active = live.has(name);
				if (reg.active !== active) registered.set(name, { ...reg, active });
			}
			// Registration order follows the latest render, then anything retained.
			const retained = order.filter((n) => !live.has(n));
			order.splice(0, order.length, ...names.filter((n) => registered.has(n)), ...retained);
			commit();
		},

		resync(msg) {
			const reg = registered.get(msg.name);
			registered.set(msg.name, {
				name: msg.name,
				revision: msg.revision,
				wire: msg.wire,
				options: reg?.options,
				active: reg?.active ?? true,
			});
			report(msg.name, msg.revision, msg.dropped);
			const overlay = rebase(msg.name, msg.revision, msg.wire);
			commit();
			return overlay;
		},

		adopt(msg) {
			// §7.3 — the fixture called its own setter. That becomes a root-path
			// patch so it persists exactly like a panel edit.
			const existing = overlays.get(msg.name);
			let patches = existing?.patches ?? [];
			for (const patch of msg.patches) patches = mergePatch(patches, patch);
			overlays.set(msg.name, { input: msg.name, revision: msg.revision, patches });
			commit();
		},

		set(name, path, value) {
			const reg = registered.get(name);
			if (!reg) return null;
			if (!isSafePath(path)) {
				console.error(`[uaight] refused an unsafe control path on "${name}".`);
				return null;
			}
			const existing = overlays.get(name);
			const patches = mergePatch(existing?.patches ?? [], { path: [...path], value });
			const next: InputOverlay = { input: name, revision: reg.revision, patches };
			overlays.set(name, next);
			commit();
			return next;
		},

		reset(name) {
			// §7.3 — reset means the CURRENT module's default: clear the overlay.
			// "The first-ever default" is not recoverable after HMR and is not offered.
			const targets = name === undefined ? [...overlays.keys()] : [name];
			const cleared: InputOverlay[] = [];
			for (const target of targets) {
				const reg = registered.get(target);
				overlays.delete(target);
				reported.delete(target);
				if (reg) cleared.push({ input: target, revision: reg.revision, patches: [] });
			}
			// A wholly dropped overlay is no longer in `overlays`, so "reset all"
			// clears every report rather than only the targets it just cleared.
			const gone = new Set(targets);
			droppedInputs =
				name === undefined ? [] : droppedInputs.filter((entry) => !gone.has(entry.input));
			commit();
			return cleared;
		},

		restore(snapshot) {
			const applied: InputOverlay[] = [];
			for (const overlay of snapshot) {
				const reg = registered.get(overlay.input);
				if (!reg) continue;
				const { kept } = prune(reg.wire, overlay.patches);
				// A patch whose path no longer exists is not reported again here: it
				// was already accounted for when the shape changed, and an undo is not
				// a new loss.
				if (kept.length === 0) continue;
				const next: InputOverlay = {
					input: overlay.input,
					revision: reg.revision,
					patches: kept,
				};
				overlays.set(overlay.input, next);
				applied.push(next);
			}
			commit();
			return applied;
		},

		clear() {
			overlays.clear();
			registered.clear();
			reported.clear();
			seeded.clear();
			order.length = 0;
			droppedInputs = [];
			commit();
		},
	};
}

export function useOverlayState(store: OverlayStore): OverlayState {
	return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
