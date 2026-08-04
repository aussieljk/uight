/**
 * Transport and handshake — SPEC.md §8.
 *
 * D20: bootstrap messages are **not** enveloped, mounted messages are. The
 * child cannot carry a `mountId` it has not been given, so `READY` never could
 * have satisfied an envelope contract.
 *
 *   READY (child, targetOrigin '*')
 *     → INIT (parent, exact targetOrigin, after verifying event.source)
 *       → INIT_ACK (child, exact targetOrigin)
 *         → parent flushes its queue
 *
 * Sequence numbers are **per direction**. Every inbound message is validated at
 * runtime with `shared/protocol.ts`'s validators; nothing is trusted by type
 * assertion.
 */

import type {
	BootstrapMessage,
	InitMessage,
	MountedEnvelope,
	MountedMessage,
	Outbound,
	Scheduler,
} from "../shared/protocol.ts";
import {
	CHANNEL,
	PROTOCOL_VERSION,
	SUPPORTED_PROTOCOL_VERSIONS,
	microtaskScheduler,
	validateBootstrap,
	validateEnvelope,
} from "../shared/protocol.ts";
import type { FixtureId, InputOverlay, RendererError } from "../shared/types.ts";
import { UAIGHT_VERSION } from "../shared/version.ts";

/* ------------------------------------------------------------------ *
 * Public transport shapes — ARCHITECTURE §2
 * ------------------------------------------------------------------ */

export interface RendererTransport {
	send(message: MountedMessage): void;
	subscribe(callback: (message: MountedMessage) => void): () => void;
	dispose(): void;
}

export interface HostTransport extends RendererTransport {
	readonly status: "connecting" | "ready" | "error";
	onStatusChange(callback: () => void): () => void;
	error: RendererError | null;
}

/** Extra surface the host chrome needs; not part of the frozen facade. */
export interface FrameHostTransport extends HostTransport {
	/** Kept for replay after a frame reload (§8.2, duplicate READY). */
	setOverlays(overlays: InputOverlay[]): void;
	setInitialFixture(fixture: FixtureId | null): void;
	readonly mountId: string;
	readonly protocolVersion: number | null;
	readonly droppedMessages: number;
}

const BOOTSTRAP_TIMEOUT_MS = 5000;
const MOUNT_MISMATCH_LIMIT = 5;

function channel<T extends object>(message: T): T & { __uaight: typeof CHANNEL } {
	return { __uaight: CHANNEL, ...message };
}

function envelopeOf(
	protocolVersion: number,
	mountId: string,
	sequence: number,
	message: MountedMessage,
): Outbound {
	return channel({
		type: "ENVELOPE" as const,
		envelope: { protocolVersion, mountId, sequence, message },
	});
}

/**
 * §8.2 step 2: an **exact** targetOrigin. An opaque origin (`file://`,
 * a sandboxed document) serializes as "null", which postMessage rejects as a
 * target; there the only options are `'*'` or no message at all, and a frame we
 * created in our own realm is not a trust boundary anyway (§5.2).
 */
function exactTargetOrigin(win: Window): string {
	const origin = win.location?.origin;
	if (!origin || origin === "null") return "*";
	return origin;
}

function bestVersion(offered: readonly number[]): number | null {
	const shared = offered.filter((version) => SUPPORTED_PROTOCOL_VERSIONS.includes(version));
	return shared.length ? Math.max(...shared) : null;
}

/* ------------------------------------------------------------------ *
 * Child side — the renderer realm
 * ------------------------------------------------------------------ */

export interface ChildTransportOptions {
	scheduler?: Scheduler;
	win?: Window;
	onMismatch?: (error: RendererError) => void;
}

export interface ChildTransport {
	transport: RendererTransport;
	/** Resolves on the INIT that the child accepted. */
	ready: Promise<InitMessage>;
	/** A later INIT after a fresh READY — the parent treating us as reloaded. */
	onReinit(callback: (init: InitMessage) => void): () => void;
}

export function createRendererChildTransport(
	options: ChildTransportOptions = {},
): ChildTransport {
	const win = options.win ?? window;
	const schedule = options.scheduler ?? microtaskScheduler;
	const parent = win.parent;

	const subscribers = new Set<(message: MountedMessage) => void>();
	const reinitListeners = new Set<(init: InitMessage) => void>();
	const queued: MountedMessage[] = [];

	let mountId: string | null = null;
	let parentOrigin = "*";
	let protocolVersion = PROTOCOL_VERSION;
	let acked = false;
	let readySentAt = 0;
	let outboundSequence = 0;
	let inboundSequence = -1;
	let mismatches = 0;
	let disposed = false;

	let resolveReady: (init: InitMessage) => void = () => {};
	const ready = new Promise<InitMessage>((resolve) => {
		resolveReady = resolve;
	});

	function post(message: Outbound, targetOrigin: string): void {
		if (!parent || parent === win) return;
		parent.postMessage(message, targetOrigin);
	}

	function sendReady(): void {
		readySentAt = Date.now();
		acked = false;
		// targetOrigin '*': the child does not yet know the parent's origin, and
		// the message carries no secrets. The parent's protection is verifying
		// event.source against its own frame's contentWindow (§8.2).
		post(
			channel({
				type: "READY" as const,
				protocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
				rendererVersion: UAIGHT_VERSION,
			}),
			"*",
		);
	}

	function handleInit(init: InitMessage): void {
		if (acked && init.mountId === mountId) return; // duplicate INIT (§8.2)

		if (!SUPPORTED_PROTOCOL_VERSIONS.includes(init.protocolVersion)) {
			// Never silently degrade: both sides render a mismatch panel.
			options.onMismatch?.({
				kind: "protocol",
				message:
					`no mutually supported protocol version: the host selected ${init.protocolVersion}, ` +
					`this renderer (uaight ${UAIGHT_VERSION}) supports ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")}`,
			});
			return;
		}

		const reinit = acked || mountId !== null;
		mountId = init.mountId;
		protocolVersion = init.protocolVersion;
		parentOrigin = init.parentOrigin || "*";
		acked = true;
		inboundSequence = -1;
		outboundSequence = 0;

		post(
			channel({
				type: "INIT_ACK" as const,
				mountId: init.mountId,
				protocolVersion: init.protocolVersion,
			}),
			parentOrigin,
		);

		resolveReady(init);
		if (reinit) for (const listener of [...reinitListeners]) listener(init);

		const pending = queued.splice(0);
		for (const message of pending) transport.send(message);
	}

	function onMessage(event: MessageEvent): void {
		if (disposed) return;
		if (parent && event.source !== parent) return;

		const bootstrap: BootstrapMessage | null = validateBootstrap(event.data);
		if (bootstrap) {
			if (bootstrap.type === "INIT") handleInit(bootstrap);
			return;
		}

		const envelope: MountedEnvelope | null = validateEnvelope(event.data);
		if (!envelope) return;
		if (!mountId || envelope.mountId !== mountId) {
			mismatches++;
			if (mismatches === MOUNT_MISMATCH_LIMIT) {
				// eslint-disable-next-line no-console
				console.error(
					`[uaight] ${mismatches} messages dropped for a mismatched mountId — two mounts sharing a frame?`,
				);
			}
			return;
		}
		if (envelope.protocolVersion !== protocolVersion) return;
		if (inboundSequence >= 0 && envelope.sequence !== inboundSequence + 1) {
			// eslint-disable-next-line no-console
			console.warn(
				`[uaight] host message sequence gap: expected ${inboundSequence + 1}, saw ${envelope.sequence}`,
			);
		}
		inboundSequence = envelope.sequence;

		const message = envelope.message;
		schedule(() => {
			for (const subscriber of [...subscribers]) subscriber(message);
		});
	}

	const transport: RendererTransport = {
		send(message) {
			if (disposed) return;
			if (!acked || !mountId) {
				queued.push(message);
				return;
			}
			post(envelopeOf(protocolVersion, mountId, outboundSequence++, message), parentOrigin);
		},
		subscribe(callback) {
			subscribers.add(callback);
			return () => {
				subscribers.delete(callback);
			};
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			win.removeEventListener("message", onMessage);
			subscribers.clear();
		},
	};

	win.addEventListener("message", onMessage);
	if (!parent || parent === win) {
		options.onMismatch?.({
			kind: "bootstrap",
			message: "the uaight renderer was loaded outside a frame; there is no host to talk to",
		});
	} else {
		sendReady();
		void readySentAt;
	}

	return {
		transport,
		ready,
		onReinit(callback) {
			reinitListeners.add(callback);
			return () => {
				reinitListeners.delete(callback);
			};
		},
	};
}

/* ------------------------------------------------------------------ *
 * Parent side — §8.2
 * ------------------------------------------------------------------ */

export interface FrameHostTransportOptions {
	frame: HTMLIFrameElement;
	mountId: string;
	initialFixture: FixtureId | null;
	overlays: InputOverlay[];
	scheduler?: Scheduler;
	/** Named in the bootstrap-timeout error (§8.2). */
	rendererUrl?: string;
	timeoutMs?: number;
	/** The plugin's version, for the §16.2 mismatch message. */
	pluginVersion?: string;
}

export function createFrameHostTransport(
	options: FrameHostTransportOptions,
): FrameHostTransport {
	const { frame, mountId } = options;
	const schedule = options.scheduler ?? microtaskScheduler;
	const timeoutMs = options.timeoutMs ?? BOOTSTRAP_TIMEOUT_MS;
	const hostWindow = frame.ownerDocument.defaultView ?? window;

	const subscribers = new Set<(message: MountedMessage) => void>();
	const statusListeners = new Set<() => void>();
	const queued: MountedMessage[] = [];

	let status: "connecting" | "ready" | "error" = "connecting";
	let error: RendererError | null = null;
	let protocolVersion: number | null = null;
	let overlays = options.overlays;
	let initialFixture = options.initialFixture;
	let sawReady = false;
	let probed = false;
	let outboundSequence = 0;
	let inboundSequence = -1;
	let dropped = 0;
	let disposed = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function setStatus(next: typeof status, nextError: RendererError | null = null): void {
		if (status === next && error === nextError) return;
		status = next;
		error = nextError;
		transport.error = nextError;
		for (const listener of [...statusListeners]) listener();
	}

	function target(): Window | null {
		return frame.contentWindow;
	}

	function post(message: Outbound): void {
		const win = target();
		if (!win) return;
		win.postMessage(message, exactTargetOrigin(hostWindow));
	}

	function sendInit(version: number): void {
		protocolVersion = version;
		post(
			channel({
				type: "INIT" as const,
				mountId,
				protocolVersion: version,
				parentOrigin: exactTargetOrigin(hostWindow),
				initialFixture,
				overlays,
			}),
		);
	}

	function armTimeout(): void {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			if (disposed || sawReady) return;
			if (!probed) {
				// §8.2: retry the INIT probe once. A child that sent READY before
				// we were listening is alive and will simply ACK.
				probed = true;
				sendInit(PROTOCOL_VERSION);
				armTimeout();
				return;
			}
			setStatus("error", {
				kind: "bootstrap",
				message:
					`the fixture frame did not report READY within ${Math.round((timeoutMs * 2) / 1000)}s. ` +
					`Check that ${options.rendererUrl ?? "the renderer entry"} loaded and that no CSP directive blocked it.`,
				file: options.rendererUrl,
			});
		}, timeoutMs);
	}

	function handleReady(versions: readonly number[], rendererVersion: string): void {
		const reload = sawReady;
		sawReady = true;
		if (timer) clearTimeout(timer);

		const version = bestVersion(versions);
		if (version === null) {
			// Send INIT anyway so the child can raise its own panel — the one
			// thing §8.2 forbids is silent degradation.
			sendInit(PROTOCOL_VERSION);
			setStatus("error", {
				kind: "protocol",
				message:
					`no mutually supported protocol version. Host (uaight ${options.pluginVersion ?? UAIGHT_VERSION}) ` +
					`supports ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")}; renderer (uaight ${rendererVersion}) offers ${versions.join(", ")}.`,
			});
			return;
		}

		if (reload) {
			// Duplicate READY is a frame reload: discard mount state, re-INIT
			// with the same mountId, replay the current overlays.
			outboundSequence = 0;
			inboundSequence = -1;
			setStatus("connecting");
		}
		sendInit(version);
	}

	function onMessage(event: MessageEvent): void {
		if (disposed) return;
		// The parent's protection: verify event.source against its own frame.
		if (event.source !== target()) return;

		const bootstrap = validateBootstrap(event.data);
		if (bootstrap) {
			if (bootstrap.type === "READY") {
				handleReady(bootstrap.protocolVersions, bootstrap.rendererVersion);
			} else if (bootstrap.type === "INIT_ACK") {
				if (bootstrap.mountId !== mountId) {
					dropped++;
					return;
				}
				// A version mismatch is terminal: an ACK that arrives afterwards
				// must not quietly promote the transport back to ready (§8.2).
				if (status === "error" && error?.kind === "protocol") return;
				setStatus("ready");
				const pending = queued.splice(0);
				for (const message of pending) transport.send(message);
			}
			return;
		}

		const envelope = validateEnvelope(event.data);
		if (!envelope) return;
		if (envelope.mountId !== mountId) {
			dropped++;
			if (dropped === MOUNT_MISMATCH_LIMIT) {
				// eslint-disable-next-line no-console
				console.error(
					`[uaight] ${dropped} frame messages dropped for a mismatched mountId (${envelope.mountId} ≠ ${mountId})`,
				);
			}
			return;
		}
		if (protocolVersion !== null && envelope.protocolVersion !== protocolVersion) return;
		if (inboundSequence >= 0 && envelope.sequence !== inboundSequence + 1) {
			// eslint-disable-next-line no-console
			console.warn(
				`[uaight] renderer message sequence gap: expected ${inboundSequence + 1}, saw ${envelope.sequence}`,
			);
		}
		inboundSequence = envelope.sequence;

		const message = envelope.message;
		schedule(() => {
			for (const subscriber of [...subscribers]) subscriber(message);
		});
	}

	const transport: FrameHostTransport = {
		error: null,
		get status() {
			return status;
		},
		get mountId() {
			return mountId;
		},
		get protocolVersion() {
			return protocolVersion;
		},
		get droppedMessages() {
			return dropped;
		},
		send(message) {
			if (disposed) return;
			if (message.type === "SET_OVERLAYS") overlays = message.overlays;
			if (message.type === "SELECT_FIXTURE") initialFixture = message.fixture;
			if (status !== "ready" || protocolVersion === null) {
				queued.push(message);
				return;
			}
			post(envelopeOf(protocolVersion, mountId, outboundSequence++, message));
		},
		subscribe(callback) {
			subscribers.add(callback);
			return () => {
				subscribers.delete(callback);
			};
		},
		onStatusChange(callback) {
			statusListeners.add(callback);
			return () => {
				statusListeners.delete(callback);
			};
		},
		setOverlays(next) {
			overlays = next;
		},
		setInitialFixture(next) {
			initialFixture = next;
		},
		dispose() {
			if (disposed) return;
			if (status === "ready") transport.send({ type: "DISPOSE" });
			disposed = true;
			if (timer) clearTimeout(timer);
			hostWindow.removeEventListener("message", onMessage);
			subscribers.clear();
			statusListeners.clear();
		},
	};

	hostWindow.addEventListener("message", onMessage);
	armTimeout();

	return transport;
}

/* ------------------------------------------------------------------ *
 * Inline isolation — one realm, two ends, no postMessage (§5.2)
 * ------------------------------------------------------------------ */

export function createDirectTransportPair(scheduler: Scheduler = microtaskScheduler): {
	host: HostTransport;
	renderer: RendererTransport;
} {
	const hostSubscribers = new Set<(message: MountedMessage) => void>();
	const rendererSubscribers = new Set<(message: MountedMessage) => void>();
	const statusListeners = new Set<() => void>();
	let disposed = false;

	/**
	 * Messages sent to an end that has not subscribed yet — §8.2's queue, which
	 * the frame path gets for free from the handshake and this one has to keep
	 * itself.
	 *
	 * The two ends of a direct pair do not come up together. The host end is
	 * live from the layout effect that publishes the transport, and sends
	 * `SELECT_FIXTURE` immediately; the renderer end does not exist until
	 * `InlineHost` has measured its root element and — when the project has one —
	 * dynamically imported the preview entry, which is at best a microtask and in
	 * practice a network round trip later. Delivering into an empty subscriber
	 * set dropped that selection on the floor, and nothing replayed it: a direct
	 * pair reports `status: "ready"` from its first read, so the host's
	 * "re-send on ready" path never fires. Inline isolation therefore showed
	 * "No fixture selected." for every selection.
	 *
	 * Buffering is per direction and only while that direction has no
	 * subscriber, so a live pair never queues, ordering is preserved, and a
	 * StrictMode unsubscribe/resubscribe cannot lose what arrives in between.
	 */
	const queues = new Map<Set<(message: MountedMessage) => void>, MountedMessage[]>([
		[hostSubscribers, []],
		[rendererSubscribers, []],
	]);

	function deliver(
		subscribers: Set<(message: MountedMessage) => void>,
		message: MountedMessage,
	): void {
		if (disposed) return;
		if (subscribers.size === 0) {
			queues.get(subscribers)?.push(message);
			return;
		}
		// Scheduled, so a send can never re-enter the sender's own render.
		scheduler(() => {
			for (const subscriber of [...subscribers]) subscriber(message);
		});
	}

	/** Called on the first subscribe of an end, on the scheduler like any delivery. */
	function flush(subscribers: Set<(message: MountedMessage) => void>): void {
		const queued = queues.get(subscribers);
		if (!queued || queued.length === 0) return;
		const batch = queued.splice(0, queued.length);
		scheduler(() => {
			if (disposed) return;
			for (const message of batch) {
				for (const subscriber of [...subscribers]) subscriber(message);
			}
		});
	}

	const host: HostTransport = {
		error: null,
		get status() {
			return disposed ? "error" : "ready";
		},
		send: (message) => deliver(rendererSubscribers, message),
		subscribe(callback) {
			hostSubscribers.add(callback);
			flush(hostSubscribers);
			return () => {
				hostSubscribers.delete(callback);
			};
		},
		onStatusChange(callback) {
			statusListeners.add(callback);
			return () => {
				statusListeners.delete(callback);
			};
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			hostSubscribers.clear();
			rendererSubscribers.clear();
			for (const listener of [...statusListeners]) listener();
			statusListeners.clear();
		},
	};

	const renderer: RendererTransport = {
		send: (message) => deliver(hostSubscribers, message),
		subscribe(callback) {
			rendererSubscribers.add(callback);
			flush(rendererSubscribers);
			return () => {
				rendererSubscribers.delete(callback);
			};
		},
		dispose() {
			rendererSubscribers.clear();
			queues.get(rendererSubscribers)?.splice(0);
		},
	};

	return { host, renderer };
}
