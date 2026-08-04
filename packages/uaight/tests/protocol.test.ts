/**
 * Transport protocol validation. SPEC.md §8.1, §8.2, §20.1.
 *
 * §8.2's rule is that every inbound message is validated at runtime and never
 * trusted by type assertion — the frame is same-origin and anything on the page
 * can `postMessage` at us. D20's split matters too: bootstrap messages are not
 * enveloped, because the child cannot carry a `mountId` it has not been given.
 */

import { describe, expect, it, vi } from "vitest";

import {
	CHANNEL,
	PROTOCOL_VERSION,
	SUPPORTED_PROTOCOL_VERSIONS,
	isChannelled,
	microtaskScheduler,
	taskScheduler,
	validateBootstrap,
	validateEnvelope,
} from "../src/shared/protocol.ts";
import type { ResyncMessage } from "../src/shared/protocol.ts";

const channelled = <T extends object>(m: T): T & { __uaight: typeof CHANNEL } => ({
	__uaight: CHANNEL,
	...m,
});

describe("isChannelled", () => {
	it("rejects anything without our marker, so a foreign postMessage is never ours", () => {
		expect(isChannelled({ type: "READY" })).toBe(false);
		expect(isChannelled(null)).toBe(false);
		expect(isChannelled("READY")).toBe(false);
		expect(isChannelled({ __uaight: "something-else" })).toBe(false);
		expect(isChannelled(channelled({ type: "READY" }))).toBe(true);
	});
});

describe("validateBootstrap", () => {
	it("accepts a well-formed READY", () => {
		expect(
			validateBootstrap(
				channelled({
					type: "READY",
					protocolVersions: [1],
					rendererVersion: "1.0.0",
				}),
			),
		).toEqual({ type: "READY", protocolVersions: [1], rendererVersion: "1.0.0" });
	});

	it("accepts INIT and defaults a missing initialFixture to null", () => {
		const init = validateBootstrap(
			channelled({
				type: "INIT",
				mountId: "m1",
				protocolVersion: PROTOCOL_VERSION,
				parentOrigin: "https://example.test",
				overlays: [],
			}),
		);
		expect(init).toEqual({
			type: "INIT",
			mountId: "m1",
			protocolVersion: PROTOCOL_VERSION,
			parentOrigin: "https://example.test",
			initialFixture: null,
			overlays: [],
		});
	});

	it("accepts INIT_ACK", () => {
		expect(
			validateBootstrap(
				channelled({ type: "INIT_ACK", mountId: "m1", protocolVersion: 1 }),
			),
		).toEqual({ type: "INIT_ACK", mountId: "m1", protocolVersion: 1 });
	});

	it("rejects an unchannelled message", () => {
		expect(
			validateBootstrap({ type: "READY", protocolVersions: [1], rendererVersion: "1" }),
		).toBeNull();
	});

	it("rejects an unknown type", () => {
		expect(validateBootstrap(channelled({ type: "HELLO" }))).toBeNull();
		expect(validateBootstrap(channelled({}))).toBeNull();
	});

	it("rejects fields of the wrong type rather than coercing them", () => {
		expect(
			validateBootstrap(
				channelled({ type: "READY", protocolVersions: ["1"], rendererVersion: "1.0.0" }),
			),
		).toBeNull();
		expect(
			validateBootstrap(
				channelled({ type: "READY", protocolVersions: [1], rendererVersion: 1 }),
			),
		).toBeNull();
		expect(
			validateBootstrap(
				channelled({
					type: "INIT",
					mountId: 1,
					protocolVersion: 1,
					parentOrigin: "o",
					overlays: [],
				}),
			),
		).toBeNull();
		expect(
			validateBootstrap(
				channelled({
					type: "INIT",
					mountId: "m",
					protocolVersion: 1,
					parentOrigin: "o",
					overlays: "not an array",
				}),
			),
		).toBeNull();
		expect(
			validateBootstrap(channelled({ type: "INIT_ACK", mountId: "m" })),
		).toBeNull();
	});

	it("does not accept an envelope", () => {
		expect(
			validateBootstrap(channelled({ type: "ENVELOPE", envelope: {} })),
		).toBeNull();
	});
});

describe("validateEnvelope", () => {
	const envelope = {
		protocolVersion: PROTOCOL_VERSION,
		mountId: "m1",
		sequence: 3,
		message: { type: "RESIZE", width: 100, height: 200 },
	};

	it("accepts a well-formed envelope", () => {
		expect(validateEnvelope(channelled({ type: "ENVELOPE", envelope }))).toEqual(envelope);
	});

	it("rejects an unchannelled or misshapen envelope", () => {
		expect(validateEnvelope({ type: "ENVELOPE", envelope })).toBeNull();
		expect(validateEnvelope(channelled({ type: "READY" }))).toBeNull();
		expect(validateEnvelope(channelled({ type: "ENVELOPE" }))).toBeNull();
	});

	it("rejects a missing or malformed sequence, mountId or message", () => {
		for (const bad of [
			{ ...envelope, sequence: "3" },
			{ ...envelope, mountId: 1 },
			{ ...envelope, protocolVersion: "1" },
			{ ...envelope, message: null },
			{ ...envelope, message: { noType: true } },
		]) {
			expect(validateEnvelope(channelled({ type: "ENVELOPE", envelope: bad }))).toBeNull();
		}
	});
});

describe("version constants", () => {
	it("advertises the negotiable set, which includes the current version", () => {
		expect(SUPPORTED_PROTOCOL_VERSIONS).toContain(PROTOCOL_VERSION);
	});

	it("does not advertise 1, whose RESYNC carried a count where 2 carries paths", () => {
		expect(PROTOCOL_VERSION).toBeGreaterThanOrEqual(2);
		expect(SUPPORTED_PROTOCOL_VERSIONS).not.toContain(1);
	});
});

describe("RESYNC", () => {
	it("names what was lost: the paths are the payload, the count is derived", () => {
		const message: ResyncMessage = {
			type: "RESYNC",
			name: "props",
			revision: 3,
			wire: { t: "object", v: [] },
			dropped: [["variant"], ["items", 2, "size"]],
		};
		expect(message.dropped).toHaveLength(2);
		expect(message.dropped[0]).toEqual(["variant"]);
	});
});

describe("schedulers", () => {
	it("microtaskScheduler defers, satisfying non-reentrancy (§8.2)", async () => {
		const order: string[] = [];
		microtaskScheduler(() => order.push("scheduled"));
		order.push("sync");
		await Promise.resolve();
		expect(order).toEqual(["sync", "scheduled"]);
	});

	it("taskScheduler defers and preserves order", async () => {
		const run = vi.fn();
		taskScheduler(() => run("a"));
		taskScheduler(() => run("b"));
		expect(run).not.toHaveBeenCalled();
		await new Promise((resolve) => setTimeout(resolve, 5));
		expect(run.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
	});
});
