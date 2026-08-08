/**
 * Routing. SPEC.md §5.4.
 *
 * Explicit, not automatic (D10). Three rules govern everything here:
 *
 *   1. We touch ONLY our query parameter. The pathname is never written, which
 *      is why `BASE_URL` is irrelevant.
 *   2. User selection pushes; corrections replace.
 *   3. One owner per resolved key, REFCOUNTED — a StrictMode double-mount
 *      (effect, cleanup, effect) must not leave the key permanently claimed.
 *      A second claimant falls back to local state identically in development
 *      and production, plus a development error. Environment-dependent routing
 *      is worse than either outcome.
 */

import {
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type { RouterAdapter } from "../shared/types.ts";

export type RouterSpec = RouterAdapter | "history" | "hash" | "none";

const isDev = process.env.NODE_ENV !== "production";

/* ------------------------------------------------------------------ *
 * Ownership — one owner per key, arbitrated by arrival order
 * ------------------------------------------------------------------ */

const claims = new Map<string, Set<Claimant>>();

/**
 * A hook instance that wants a key. `seq` is assigned once, when the component
 * first renders, and never moves.
 *
 * That is the whole fix for §5.4 under StrictMode. Ownership used to be a
 * refcount, and a count cannot say WHO: StrictMode remounts effects one fiber
 * at a time, so with two mounts the real order is
 *
 *     A.setup(1, owner) B.setup(2, denied)
 *     A.cleanup(1) A.setup(2, DENIED) B.cleanup(1) B.setup(2, DENIED)
 *
 * — the count never returns to 0 while A re-claims, so A was denied its own
 * key and nobody owned the parameter. Both mounts then ignored the deep link
 * in the URL and rendered the empty state, in the configuration React makes the
 * default. Ordering by a per-instance sequence is stable across that churn: A's
 * `seq` is lower than B's however many times either re-claims.
 */
interface Claimant {
	seq: number;
	/** Recompute this claimant's ownership. Set only while it is claiming. */
	notify: () => void;
	/** §5.4's development error is stated once per denied mount, not per claim. */
	warned: boolean;
}

let nextSeq = 0;

function resolveRouterKey(urlParam: string, routerId?: string | undefined): string {
	return routerId ? `${urlParam}.${routerId}` : urlParam;
}

/** The live claimant that arrived first, which is the one that owns the key. */
function ownerOf(key: string): Claimant | null {
	let best: Claimant | null = null;
	for (const claimant of claims.get(key) ?? []) {
		if (!best || claimant.seq < best.seq) best = claimant;
	}
	return best;
}

function announce(key: string): void {
	for (const claimant of [...(claims.get(key) ?? [])]) claimant.notify();
}

function claim(key: string, claimant: Claimant): void {
	const set = claims.get(key) ?? new Set<Claimant>();
	set.add(claimant);
	claims.set(key, set);
	announce(key);
}

function release(key: string, claimant: Claimant): void {
	const set = claims.get(key);
	if (!set) return;
	set.delete(claimant);
	if (set.size === 0) claims.delete(key);
	// Whoever is left may now own it — the second mount takes over when the
	// first unmounts, rather than the key staying orphaned.
	announce(key);
}

type Ownership = "pending" | "owner" | "denied";

/**
 * Claiming happens in a layout effect, so it runs before paint and nothing is
 * ever shown with a value the mount does not own.
 */
function useRouterOwnership(key: string, active: boolean): Ownership {
	const [state, setState] = useState<Ownership>("pending");
	// Lazily, so the sequence is this component's and follows tree order. The
	// initializer may run twice under StrictMode; only the number it kept is
	// ever used, and both are below whatever the next component allocates.
	const [claimant] = useState<Claimant>(() => ({
		seq: nextSeq++,
		notify: () => {},
		warned: false,
	}));

	useLayoutEffect(() => {
		if (!active) {
			setState("pending");
			return;
		}
		claimant.notify = () => {
			const owner = ownerOf(key) === claimant;
			setState(owner ? "owner" : "denied");
			if (!owner && !claimant.warned && isDev) {
				claimant.warned = true;
				console.error(
					`[uight] two mounts asked to own the URL parameter "${key}". The second ` +
						`falls back to local selection state. Give one of them a distinct ` +
						`routerId (or urlParam), or drive selection with the \`selected\`/` +
						`\`onSelect\` props.`,
				);
			}
		};
		claim(key, claimant);
		return () => {
			claimant.notify = () => {};
			release(key, claimant);
			setState("pending");
		};
	}, [key, active, claimant]);

	return active ? state : "pending";
}

/* ------------------------------------------------------------------ *
 * Built-in drivers. Both satisfy `RouterAdapter`, so `RouterAdapter` is
 * not a special case anywhere below.
 * ------------------------------------------------------------------ */

type Listener = () => void;

function makeEmitter() {
	const listeners = new Set<Listener>();
	return {
		emit: () => {
			for (const l of [...listeners]) l();
		},
		add: (l: Listener) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
	};
}

function writeSearch(search: string, param: string, value: string | null): string {
	const params = new URLSearchParams(search);
	if (value === null) params.delete(param);
	else params.set(param, value);
	const text = params.toString();
	return text ? `?${text}` : "";
}

/** `pushState` never emits `popstate`, so our own writes notify locally. */
function createHistoryRouter(param: string): RouterAdapter {
	const emitter = makeEmitter();
	return {
		read: () => new URLSearchParams(window.location.search).get(param),
		write(value, opts) {
			const url =
				window.location.pathname +
				writeSearch(window.location.search, param, value) +
				window.location.hash;
			if (opts.replace) window.history.replaceState(window.history.state, "", url);
			else window.history.pushState(window.history.state, "", url);
			emitter.emit();
		},
		subscribe(cb) {
			const off = emitter.add(cb);
			window.addEventListener("popstate", cb);
			return () => {
				off();
				window.removeEventListener("popstate", cb);
			};
		},
	};
}

/** Splits `#/route?a=b` into its route part and its query part. */
function splitHash(hash: string): { head: string; query: string } {
	const raw = hash.startsWith("#") ? hash.slice(1) : hash;
	const q = raw.indexOf("?");
	if (q === -1) {
		// A bare `#a=b` is a query; a bare `#/route` is a route.
		return raw.includes("=") ? { head: "", query: raw } : { head: raw, query: "" };
	}
	return { head: raw.slice(0, q), query: raw.slice(q + 1) };
}

function createHashRouter(param: string): RouterAdapter {
	const emitter = makeEmitter();
	return {
		read: () => new URLSearchParams(splitHash(window.location.hash).query).get(param),
		write(value, opts) {
			const { head, query } = splitHash(window.location.hash);
			const search = writeSearch(query, param, value);
			const hash = head || search ? `#${head}${search}` : "";
			const url = window.location.pathname + window.location.search + hash;
			if (opts.replace) window.history.replaceState(window.history.state, "", url);
			else window.history.pushState(window.history.state, "", url);
			emitter.emit();
		},
		subscribe(cb) {
			const off = emitter.add(cb);
			window.addEventListener("hashchange", cb);
			return () => {
				off();
				window.removeEventListener("hashchange", cb);
			};
		},
	};
}

/** §5.4 — hash mode is incompatible with a host hash router. */
function warnOnHashRouterConflict(): void {
	if (!isDev || typeof window === "undefined") return;
	const { head } = splitHash(window.location.hash);
	if (head.startsWith("/")) {
		console.error(
			`[uight] router="hash" but location.hash already carries a route ` +
				`("#${head}"). A hash router and uight cannot both own the hash. Use ` +
				`router="history", a RouterAdapter, or controlled selection.`,
		);
	}
}

/* ------------------------------------------------------------------ *
 * The hook
 * ------------------------------------------------------------------ */

export interface RouterBinding {
	/** The raw parameter value, or `null` when absent or not owned. */
	value: string | null;
	/** True once this mount has been arbitrated as the key's owner. */
	owned: boolean;
	/** True until arbitration has run; render nothing selection-shaped yet. */
	pending: boolean;
	/** User selection pushes; corrections replace. */
	write(value: string | null, opts: { replace: boolean }): void;
}

export function useRouterBinding(opts: {
	router: RouterSpec;
	urlParam: string;
	routerId?: string | undefined;
	/** False when a higher precedence rule (§5.3) already owns selection. */
	active: boolean;
}): RouterBinding {
	const { router, urlParam, routerId, active } = opts;
	const key = resolveRouterKey(urlParam, routerId);
	const enabled = active && router !== "none";
	const ownership = useRouterOwnership(key, enabled);
	const owned = ownership === "owner";

	const adapter = useMemo<RouterAdapter | null>(() => {
		if (!enabled || typeof window === "undefined") return null;
		if (router === "history") return createHistoryRouter(urlParam);
		if (router === "hash") {
			warnOnHashRouterConflict();
			return createHashRouter(urlParam);
		}
		return router;
	}, [enabled, router, urlParam]);

	const live = owned && adapter !== null;

	const subscribe = useCallback(
		(cb: () => void) => (live && adapter ? adapter.subscribe(cb) : () => {}),
		[live, adapter],
	);
	const snapshot = useCallback(
		() => (live && adapter ? adapter.read() : null),
		[live, adapter],
	);

	const value = useSyncExternalStore(subscribe, snapshot, () => null);

	const adapterRef = useRef(adapter);
	adapterRef.current = adapter;
	const liveRef = useRef(live);
	liveRef.current = live;

	const write = useCallback((next: string | null, o: { replace: boolean }) => {
		if (!liveRef.current) return;
		adapterRef.current?.write(next, o);
	}, []);

	return { value, owned: live, pending: enabled && ownership === "pending", write };
}
