/**
 * Portless MCP. The dev server is found, not assumed.
 *
 * `--url http://localhost:5173` was a default that is wrong for everyone
 * running two projects — Vite takes 5174 for the second, and the failure an
 * agent then reports is a connection error naming a port the human never used.
 *
 * Two properties are worth testing and neither is "it finds the server": that
 * the probe is **specific** (a port answering HTTP is not evidence of uaight),
 * and that the failure **names what it tried**.
 */

import { describe, expect, it, vi } from "vitest";

import {
	DISCOVERY_PORTS,
	URL_ENV,
	UaightClient,
	discoverDevServer,
	resolveDevServerUrl,
} from "../src/mcp/index.ts";

/** A fetch that answers only on the named ports, with the given body. */
function fakeFetch(
	answers: Record<number, unknown>,
	options: { status?: number } = {},
): typeof fetch {
	return ((url: string) => {
		const port = Number(new URL(url).port);
		if (!(port in answers)) return Promise.reject(new Error("ECONNREFUSED"));
		return Promise.resolve({
			ok: options.status === undefined || options.status < 400,
			status: options.status ?? 200,
			statusText: "OK",
			json: () => Promise.resolve(answers[port]),
		} as Response);
	}) as unknown as typeof fetch;
}

describe("discoverDevServer", () => {
	it("probes /@uaight/health, not the site root", async () => {
		const seen: string[] = [];
		const fetchImpl = ((url: string) => {
			seen.push(url);
			return Promise.reject(new Error("ECONNREFUSED"));
		}) as unknown as typeof fetch;

		await discoverDevServer({ ports: [5173], fetchImpl, timeout: 50 });
		expect(seen).toEqual(["http://localhost:5173/@uaight/health"]);
	});

	it("finds a server on a port that is not 5173", async () => {
		const found = await discoverDevServer({
			fetchImpl: fakeFetch({ 5176: { protocolVersion: 1, ok: true } }),
			timeout: 50,
		});
		expect(found).toBe("http://localhost:5176");
	});

	it("ignores a server that answers but is not uaight", async () => {
		// Some other dev server on 5173 is the common case for anyone running a
		// second project. Reporting its fixtures would be worse than finding none.
		const found = await discoverDevServer({
			fetchImpl: fakeFetch({ 5173: { hello: "some other tool" } }),
			timeout: 50,
		});
		expect(found).toBeNull();
	});

	it("ignores a non-2xx answer", async () => {
		const found = await discoverDevServer({
			fetchImpl: fakeFetch({ 5173: { protocolVersion: 1 } }, { status: 404 }),
			timeout: 50,
		});
		expect(found).toBeNull();
	});

	it("prefers the lowest answering port, so the result is not a race", async () => {
		const found = await discoverDevServer({
			fetchImpl: fakeFetch({
				5175: { protocolVersion: 1 },
				5173: { protocolVersion: 1 },
			}),
			timeout: 50,
		});
		expect(found).toBe("http://localhost:5173");
	});

	it("sweeps the ports Vite actually takes when 5173 is busy", () => {
		expect(DISCOVERY_PORTS.slice(0, 3)).toEqual([5173, 5174, 5175]);
		expect(DISCOVERY_PORTS).toContain(4173);
	});
});

describe("resolveDevServerUrl", () => {
	it("an explicit --url wins over everything", async () => {
		await expect(
			resolveDevServerUrl("http://localhost:9999", { fetchImpl: fakeFetch({}) }),
		).resolves.toBe("http://localhost:9999");
	});

	it("falls back to the environment before probing", async () => {
		vi.stubEnv(URL_ENV, "http://localhost:4321");
		try {
			await expect(
				resolveDevServerUrl(undefined, { ports: [], fetchImpl: fakeFetch({}) }),
			).resolves.toBe("http://localhost:4321");
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("fails by naming what it probed, not with a connection error", async () => {
		const error = (await resolveDevServerUrl(undefined, {
			ports: [5173, 5174],
			fetchImpl: fakeFetch({}),
			timeout: 20,
		}).then(
			() => null,
			(err: unknown) => err as Error,
		)) as Error;

		expect(error.message).toContain("no uaight dev server found");
		expect(error.message).toContain("5173, 5174");
		expect(error.message).toContain("/@uaight/health");
		expect(error.message).toContain("--url");
		expect(error.message).toContain(URL_ENV);
		// A raw connection error would be the failure this replaces.
		expect(error.message).not.toContain("ECONNREFUSED");
	});
});

describe("UaightClient with a discovered base", () => {
	it("does not resolve the URL until a tool actually asks for something", async () => {
		let calls = 0;
		const client = new UaightClient({
			url: () => {
				calls++;
				return Promise.resolve("http://localhost:5199");
			},
		});

		// Constructing an MCP server must not require a running dev server: an
		// agent starts its servers before the human starts theirs.
		expect(calls).toBe(0);
		expect(await client.base()).toBe("http://localhost:5199");
		expect(await client.base()).toBe("http://localhost:5199");
		expect(calls).toBe(1);
	});

	it("looks again after a failure, so a dev server that comes up later is found", async () => {
		let attempt = 0;
		const client = new UaightClient({
			url: () => Promise.resolve(`http://localhost:520${attempt++}`),
			timeout: 20,
		});
		const original = globalThis.fetch;
		globalThis.fetch = (() => Promise.reject(new Error("ECONNREFUSED"))) as typeof fetch;

		try {
			await expect(client.get("/health")).rejects.toThrow("could not reach uaight");
			await expect(client.get("/health")).rejects.toThrow("http://localhost:5201");
		} finally {
			globalThis.fetch = original;
		}
	});
});
