/**
 * Transport protocol. SPEC.md §8.
 *
 * D20: bootstrap messages are NOT enveloped; mounted messages are. The child
 * cannot carry a `mountId` it has not been given, so `READY` could never have
 * satisfied an envelope contract.
 */

import type {
	FixtureId,
	InputOptionsWire,
	InputOverlay,
	Patch,
	RendererError,
	Wire,
} from "./types.ts";

export const PROTOCOL_VERSION = 1;
export const SUPPORTED_PROTOCOL_VERSIONS = [1];

/* ---------------- Bootstrap — not enveloped (D20) ---------------- */

export interface ReadyMessage {
	type: "READY";
	protocolVersions: number[];
	rendererVersion: string;
}
export interface InitMessage {
	type: "INIT";
	mountId: string;
	protocolVersion: number;
	parentOrigin: string;
	initialFixture: FixtureId | null;
	overlays: InputOverlay[];
}
export interface InitAckMessage {
	type: "INIT_ACK";
	mountId: string;
	protocolVersion: number;
}

export type BootstrapMessage = ReadyMessage | InitMessage | InitAckMessage;

/* ---------------- Mounted — enveloped ---------------- */

export interface SelectFixture {
	type: "SELECT_FIXTURE";
	fixture: FixtureId | null;
	/** Render a detected component instead of a fixture. §12 */
	component?: { globPath: string; exportName: string } | null;
	/**
	 * Props for a harvested call site, and its text children.
	 *
	 * JSON by construction: the harvester only records values it could read
	 * statically, so nothing here can carry a function, an element or a
	 * reference into the host realm. An added optional field rather than a new
	 * message, because the renderer's reaction is the same one it already has —
	 * render this component — with arguments.
	 */
	props?: Record<string, unknown> | null;
	children?: string | null;
	/** Where those props were written, for the toolbar and the error panel. */
	origin?: string | null;
}
export interface InputRegistered {
	type: "INPUT_REGISTERED";
	name: string;
	revision: number;
	wire: Wire;
	options?: InputOptionsWire;
}
export interface InputsSettled {
	type: "INPUTS_SETTLED";
	/** Names registered during the latest render, in registration order. */
	names: string[];
}
export interface OverlayMessage {
	type: "OVERLAY";
	name: string;
	revision: number;
	patches: Patch[];
	/** Set when the renderer's own setter produced the patch (§7.3). */
	fromRenderer?: boolean;
}
export interface ResyncMessage {
	type: "RESYNC";
	name: string;
	revision: number;
	wire: Wire;
	/** Patches the renderer could not apply against the current shape. */
	dropped: number;
}
export interface ResizeMessage {
	type: "RESIZE";
	width: number;
	height: number;
}
export interface RendererErrorMessage {
	type: "RENDERER_ERROR";
	error: RendererError | null;
}
export interface DisposeMessage {
	type: "DISPOSE";
}
export interface NavigateMessage {
	type: "NAVIGATE";
	fixture: FixtureId;
}
export interface SetOverlaysMessage {
	type: "SET_OVERLAYS";
	overlays: InputOverlay[];
}

export type MountedMessage =
	| SelectFixture
	| InputRegistered
	| InputsSettled
	| OverlayMessage
	| ResyncMessage
	| ResizeMessage
	| RendererErrorMessage
	| DisposeMessage
	| NavigateMessage
	| SetOverlaysMessage;

export interface MountedEnvelope<T = MountedMessage> {
	protocolVersion: number;
	mountId: string;
	/** Per direction. A shared counter made each side see phantom gaps. §8.2 */
	sequence: number;
	message: T;
}

/** Marker so a foreign postMessage on the same window is never mistaken for ours. */
export const CHANNEL = "uaight";

export interface Channelled {
	__uaight: typeof CHANNEL;
}

export type Outbound =
	| (Channelled & BootstrapMessage)
	| (Channelled & { type: "ENVELOPE"; envelope: MountedEnvelope });

export function isChannelled(data: unknown): data is Outbound {
	return (
		typeof data === "object" &&
		data !== null &&
		(data as { __uaight?: unknown }).__uaight === CHANNEL
	);
}

/**
 * Runtime validation. Every inbound message is validated; nothing is trusted
 * by type assertion (§8.2).
 */
export function validateBootstrap(m: unknown): BootstrapMessage | null {
	if (!isChannelled(m)) return null;
	const v = m as unknown as Record<string, unknown>;
	switch (v.type) {
		case "READY":
			return Array.isArray(v.protocolVersions) &&
				v.protocolVersions.every((n) => typeof n === "number") &&
				typeof v.rendererVersion === "string"
				? ({
						type: "READY",
						protocolVersions: v.protocolVersions as number[],
						rendererVersion: v.rendererVersion,
					} satisfies ReadyMessage)
				: null;
		case "INIT":
			return typeof v.mountId === "string" &&
				typeof v.protocolVersion === "number" &&
				typeof v.parentOrigin === "string" &&
				Array.isArray(v.overlays)
				? ({
						type: "INIT",
						mountId: v.mountId,
						protocolVersion: v.protocolVersion,
						parentOrigin: v.parentOrigin,
						initialFixture: (v.initialFixture ?? null) as FixtureId | null,
						overlays: v.overlays as InputOverlay[],
					} satisfies InitMessage)
				: null;
		case "INIT_ACK":
			return typeof v.mountId === "string" && typeof v.protocolVersion === "number"
				? ({
						type: "INIT_ACK",
						mountId: v.mountId,
						protocolVersion: v.protocolVersion,
					} satisfies InitAckMessage)
				: null;
		default:
			return null;
	}
}

export function validateEnvelope(m: unknown): MountedEnvelope | null {
	if (!isChannelled(m)) return null;
	const v = m as unknown as Record<string, unknown>;
	if (v.type !== "ENVELOPE") return null;
	const e = v.envelope as Record<string, unknown> | undefined;
	if (
		!e ||
		typeof e.protocolVersion !== "number" ||
		typeof e.mountId !== "string" ||
		typeof e.sequence !== "number" ||
		typeof e.message !== "object" ||
		e.message === null ||
		typeof (e.message as { type?: unknown }).type !== "string"
	) {
		return null;
	}
	return e as unknown as MountedEnvelope;
}

/** A scheduler, injectable so M0 can settle Q3 without touching call sites. */
export type Scheduler = (fn: () => void) => void;

export const microtaskScheduler: Scheduler = (fn) => queueMicrotask(fn);

export const taskScheduler: Scheduler = (() => {
	if (typeof MessageChannel === "undefined") return (fn: () => void) => setTimeout(fn, 0);
	let queue: Array<() => void> = [];
	let channel: MessageChannel | undefined;
	return (fn: () => void) => {
		queue.push(fn);
		if (!channel) {
			channel = new MessageChannel();
			channel.port1.onmessage = () => {
				const batch = queue;
				queue = [];
				for (const f of batch) f();
			};
		}
		channel.port2.postMessage(null);
	};
})();
