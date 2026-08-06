/**
 * `uight/mcp` — the explorer, addressable by a coding agent.
 *
 * A component explorer is a perception tool: it answers *what components exist*,
 * *what states do they have*, and *what does this one look like with these
 * props*. Those are exactly the questions an agent editing a component cannot
 * answer from source alone — and uight already answers all three over HTTP
 * (§19.6), because the read-only endpoints were built for "tools that cannot
 * import the package".
 *
 * This is that surface spoken as MCP. It is a **client of a running dev
 * server**, not a second index: nothing here parses, scans or executes project
 * code, so it cannot disagree with what the explorer shows, and it inherits
 * §19.6's read-only guarantee wholesale — there is no tool here that writes.
 *
 *   uight-mcp                  # discovers the dev server
 *   uight-mcp --url http://localhost:5174
 *
 * Speaks JSON-RPC 2.0 over stdio, newline-delimited, with no SDK dependency:
 * the package ships two runtime dependencies and this is not worth a third.
 */

/* ------------------------------------------------------------------ *
 * JSON-RPC
 * ------------------------------------------------------------------ */

import { DEFAULT_VIEWPORT, renderFixture, SCREENSHOT_VIEWPORTS } from "./screenshot.ts";

interface RpcRequest {
	jsonrpc: "2.0";
	id?: string | number | null;
	method: string;
	params?: Record<string, unknown>;
}

interface RpcError {
	code: number;
	message: string;
}

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

/** The MCP revision this server implements. */
export const MCP_PROTOCOL_VERSION = "2024-11-05";

/* ------------------------------------------------------------------ *
 * The dev-server client
 * ------------------------------------------------------------------ */

export interface UightClientOptions {
	/** Base URL of the running Vite dev server. */
	url: string;
	/** Request timeout in milliseconds. */
	timeout?: number;
}

/* ------------------------------------------------------------------ *
 * Discovery — finding the dev server without being told a port
 * ------------------------------------------------------------------ */

/**
 * Ports probed when no `--url` is given, in the order a running server is most
 * likely to be on.
 *
 * Vite takes 5173 and counts up when it is busy, which is what actually happens
 * to anyone running two projects — and it is exactly that person for whom a
 * hard-coded 5173 fails with a connection error naming a port they never used.
 * 4173 is `vite preview`, and 3000/8080 are the two ports a host is most likely
 * to have pinned in their own config.
 *
 * Vite writes no discoverable state naming its port: there is no lock file, no
 * `.vite/port`, and the dev server's address lives only in the process that
 * owns it. A sweep is therefore the whole of what is possible from a separate
 * process, and it is cheap — the probes run concurrently and a closed port
 * refuses immediately.
 */
export const DISCOVERY_PORTS: readonly number[] = [
	5173, 5174, 5175, 5176, 5177, 5178, 4173, 4174, 3000, 8080,
];

export const DISCOVERY_HOST = "http://localhost";

/** Env var an agent config can set to skip discovery entirely. */
export const URL_ENV = "UIGHT_URL";

export interface DiscoverOptions {
	ports?: readonly number[];
	host?: string;
	/**
	 * Per-probe timeout. Generous rather than tight: a live local server answers
	 * in single-digit milliseconds, but a dev server that is mid-dependency-scan
	 * can hold its event loop for far longer than that, and a probe that times
	 * out on a busy server reports "not found" for a server that is right there.
	 * The probes run concurrently, so the worst case — nothing running at all —
	 * costs one of these, once.
	 */
	timeout?: number;
	/** Injected in tests. Defaults to global `fetch`. */
	fetchImpl?: typeof fetch;
}

/**
 * Find a dev server that is actually running uight.
 *
 * The probe is `/@uight/health`, not a bare `GET /`: a port answering HTTP is
 * not evidence of anything, and connecting to the wrong project's dev server
 * and reporting its fixtures is worse than finding nothing. The response must
 * parse as JSON and carry a `protocolVersion`, which no other server on a
 * developer's machine will.
 *
 * Every candidate is probed concurrently and the **lowest port that answers**
 * wins, so the result does not depend on which probe returned first.
 */
export async function discoverDevServer(
	options: DiscoverOptions = {},
): Promise<string | null> {
	const host = options.host ?? DISCOVERY_HOST;
	const ports = options.ports ?? DISCOVERY_PORTS;
	const timeout = options.timeout ?? 1500;
	const doFetch = options.fetchImpl ?? fetch;

	const results = await Promise.all(
		ports.map(async (port) => {
			const base = `${host}:${port}`;
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeout);
			try {
				const response = await doFetch(`${base}/@uight/health`, {
					signal: controller.signal,
				});
				if (!response.ok) return null;
				const body = (await response.json()) as { protocolVersion?: unknown };
				return typeof body.protocolVersion === "number" ? base : null;
			} catch {
				return null;
			} finally {
				clearTimeout(timer);
			}
		}),
	);

	return results.find((base) => base !== null) ?? null;
}

/** Every place a URL can come from, most explicit first. */
export async function resolveDevServerUrl(
	explicit: string | undefined,
	options: DiscoverOptions = {},
): Promise<string> {
	if (explicit) return explicit;

	const fromEnv = process.env[URL_ENV];
	if (fromEnv) return fromEnv;

	const found = await discoverDevServer(options);
	if (found) return found;

	// Not a connection error. A connection error names one port and implies the
	// port was the right one; this names every port that was tried and what was
	// asked of each, which is the difference between "it is broken" and "start
	// the dev server, or pass --url".
	const ports = (options.ports ?? DISCOVERY_PORTS).join(", ");
	throw new Error(
		`no uight dev server found. Probed ${options.host ?? DISCOVERY_HOST} on ports ` +
			`${ports} for /@uight/health and none answered with a uight response.\n` +
			`Start your dev server with uight() in the Vite config, or pass ` +
			`--url http://localhost:<port>, or set ${URL_ENV}.`,
	);
}

/**
 * The dev-server client.
 *
 * Its base URL may be a function, and discovery is what that exists for: an
 * agent starts its MCP servers before the human starts a dev server, so
 * resolving the URL eagerly at construction would fail every session that did
 * not happen in the lucky order. The lookup runs on first use and its *result*
 * is remembered, not its failure — so the next tool call after the dev server
 * comes up succeeds without restarting the MCP server.
 */
export class UightClient {
	private readonly source: string | (() => Promise<string>);
	private readonly timeout: number;
	private resolved: string | undefined;

	constructor(
		options: Omit<UightClientOptions, "url"> & {
			url: string | (() => Promise<string>);
		},
	) {
		this.source =
			typeof options.url === "string" ? options.url.replace(/\/+$/, "") : options.url;
		this.timeout = options.timeout ?? 5000;
	}

	/** The base URL, discovering one if that is what was configured. */
	async base(): Promise<string> {
		if (this.resolved !== undefined) return this.resolved;
		const value =
			typeof this.source === "string"
				? this.source
				: (await this.source()).replace(/\/+$/, "");
		this.resolved = value;
		return value;
	}

	async get<T>(path: string): Promise<T> {
		const base = await this.base();
		const url = `${base}/@uight${path}`;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeout);
		try {
			const response = await fetch(url, { signal: controller.signal });
			if (!response.ok) {
				throw new Error(`${url} responded ${response.status} ${response.statusText}`);
			}
			return (await response.json()) as T;
		} catch (error) {
			// The overwhelmingly likely cause is "no dev server", and saying so is
			// more useful to an agent than relaying a connection error verbatim.
			const reason = error instanceof Error ? error.message : String(error);
			// A discovered base that has since gone away must not stay cached, or
			// every later call reports the dead port instead of looking again.
			this.resolved = undefined;
			throw new Error(
				`could not reach uight at ${base} (${reason}). Is the dev server ` +
					`running, and is uight() in the Vite config?`,
			);
		} finally {
			clearTimeout(timer);
		}
	}

	/** A deep link that opens one fixture in the explorer (§3.2's encoding). */
	async fixtureUrl(route: string, path: string, name?: string | null): Promise<string> {
		const id =
			name === undefined || name === null
				? `uight:1|${encodeURIComponent(path)}`
				: `uight:1|${encodeURIComponent(path)}|${encodeURIComponent(name)}`;
		return `${await this.base()}${route}?fixture=${encodeURIComponent(id)}`;
	}
}

/* ------------------------------------------------------------------ *
 * Payload shapes we read back
 * ------------------------------------------------------------------ */

interface IndexPayload {
	version: string;
	files: Array<{
		path: string;
		globPath: string;
		names: Array<string | null> | null;
		csf?: boolean;
	}>;
	problems: Array<{ kind: string; message: string }>;
	stats: Record<string, number>;
}

interface InventoryPayload {
	components: Array<{ path: string; name: string; exportName: string; kind: string }>;
}

interface CallSitesPayload {
	components: number;
	sites: number;
	groups: Array<{
		component: string;
		total: number;
		sites: Array<{
			props: Record<string, unknown>;
			children?: string;
			path: string;
			line: number;
			dynamic: string[];
		}>;
	}>;
}

interface ConfigPayload {
	route: string | false;
	[key: string]: unknown;
}

/* ------------------------------------------------------------------ *
 * Tools
 * ------------------------------------------------------------------ */

interface Tool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	run(args: Record<string, unknown>, client: UightClient): Promise<unknown>;
}

const stringArg = (args: Record<string, unknown>, key: string): string | undefined =>
	typeof args[key] === "string" ? (args[key] as string) : undefined;

const numberArg = (args: Record<string, unknown>, key: string): number | undefined =>
	typeof args[key] === "number" ? (args[key] as number) : undefined;

function matches(haystack: string, needle: string | undefined): boolean {
	return !needle || haystack.toLowerCase().includes(needle.toLowerCase());
}

async function routeOf(client: UightClient): Promise<string> {
	const config = await client.get<ConfigPayload>("/config.json");
	return typeof config.route === "string" ? config.route : "/uight";
}

export const TOOLS: Tool[] = [
	{
		name: "list_fixtures",
		description:
			"List every fixture in the project, with its display path and fixture names. " +
			"Use this first to find out what exists before asking about a specific component.",
		inputSchema: {
			type: "object",
			properties: {
				filter: { type: "string", description: "Case-insensitive substring of the path" },
				limit: { type: "number", description: "Maximum files to return (default 200)" },
			},
		},
		async run(args, client) {
			const index = await client.get<IndexPayload>("/index.json");
			const filter = stringArg(args, "filter");
			const limit = numberArg(args, "limit") ?? 200;
			const files = index.files
				.filter((file) => matches(file.path, filter))
				.slice(0, limit)
				.map((file) => ({
					path: file.path,
					fixtures: file.names === null ? "undecidable until loaded" : file.names,
					storybook: file.csf === true,
				}));
			return { version: index.version, stats: index.stats, problems: index.problems, files };
		},
	},
	{
		name: "list_components",
		description:
			"List components detected in the source that have no fixtures yet (uight's " +
			"zero-config inventory). Useful for finding what is undocumented.",
		inputSchema: {
			type: "object",
			properties: {
				filter: { type: "string", description: "Case-insensitive substring of name or path" },
			},
		},
		async run(args, client) {
			const inventory = await client.get<InventoryPayload>("/inventory.json");
			const filter = stringArg(args, "filter");
			return {
				components: inventory.components.filter(
					(item) => matches(item.name, filter) || matches(item.path, filter),
				),
			};
		},
	},
	{
		name: "list_call_sites",
		description:
			"Real usages of a component found in the project's own source, with the props " +
			"written at each one. This is how to learn how a component is actually used — " +
			"the values are quoted from code, never inferred.",
		inputSchema: {
			type: "object",
			properties: {
				component: { type: "string", description: "Component name, e.g. Button" },
				limit: { type: "number", description: "Maximum groups to return (default 25)" },
			},
		},
		async run(args, client) {
			const payload = await client.get<CallSitesPayload>("/callsites.json");
			const component = stringArg(args, "component");
			const limit = numberArg(args, "limit") ?? 25;
			const groups = payload.groups
				.filter((group) => matches(group.component, component))
				.slice(0, limit);
			return { components: payload.components, sites: payload.sites, groups };
		},
	},
	{
		name: "fixture_url",
		description:
			"Build a URL that opens one fixture in the explorer, for a browser tool or to " +
			"hand to a human. Pass the display path from list_fixtures.",
		inputSchema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Fixture display path" },
				name: { type: "string", description: "Fixture name; omit for a single-fixture file" },
			},
			required: ["path"],
		},
		async run(args, client) {
			const path = stringArg(args, "path");
			if (!path) throw new Error("path is required");
			const route = await routeOf(client);
			return { url: await client.fixtureUrl(route, path, stringArg(args, "name") ?? null) };
		},
	},
	{
		name: "render_fixture",
		description:
			"Screenshot one fixture as it actually renders and return the IMAGE. This is the " +
			"only tool that answers 'what does it look like' — the others return text. Needs " +
			"the optional playwright package; without it the error says so and fixture_url " +
			"remains the fallback.",
		inputSchema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Fixture display path from list_fixtures" },
				name: { type: "string", description: "Fixture name; omit for a single-fixture file" },
				viewport: {
					type: "string",
					description:
						`Viewport preset: ${Object.keys(SCREENSHOT_VIEWPORTS).join(", ")} ` +
						`(default ${DEFAULT_VIEWPORT})`,
				},
				width: { type: "number", description: "Explicit viewport width; overrides viewport" },
				height: { type: "number", description: "Explicit viewport height; used with width" },
				theme: { type: "string", enum: ["light", "dark"], description: "Resolved theme" },
				fullPage: {
					type: "boolean",
					description: "Capture the whole explorer chrome instead of just the fixture frame",
				},
			},
			required: ["path"],
		},
		async run(args, client) {
			const path = stringArg(args, "path");
			if (!path) throw new Error("path is required");
			const width = numberArg(args, "width");
			const height = numberArg(args, "height");
			if ((width === undefined) !== (height === undefined)) {
				throw new Error("width and height must be given together");
			}
			const theme = stringArg(args, "theme");
			const result = await renderFixture({
				base: await client.base(),
				route: await routeOf(client),
				path,
				name: stringArg(args, "name") ?? null,
				...(width !== undefined && height !== undefined
					? { viewport: { width, height } }
					: stringArg(args, "viewport")
						? { viewport: stringArg(args, "viewport") as string }
						: {}),
				...(theme ? { theme: theme as "light" | "dark" } : {}),
				fullPage: args.fullPage === true,
			});
			// An image block, not JSON: the point of this tool is that the agent
			// sees the render. The URL rides along as text so the answer stays
			// checkable by a human.
			return {
				content: [
					{ type: "image", data: result.base64, mimeType: "image/png" },
					{
						type: "text",
						text: JSON.stringify(
							{
								url: result.url,
								viewport: result.viewport,
								theme: result.theme,
								fullPage: result.fullPage,
							},
							null,
							2,
						),
					},
				],
			};
		},
	},
	{
		name: "get_config",
		description:
			"The resolved uight configuration, including both path representations and the " +
			"patterns actually in use. This answers 'why is my fixture not found'.",
		inputSchema: { type: "object", properties: {} },
		async run(_args, client) {
			return client.get("/config.json");
		},
	},
	{
		name: "health",
		description:
			"Versions, fixture count and index problems. Use it to check the dev server is " +
			"up and the index is clean before trusting anything else.",
		inputSchema: { type: "object", properties: {} },
		async run(_args, client) {
			return client.get("/health");
		},
	},
];

/* ------------------------------------------------------------------ *
 * The server
 * ------------------------------------------------------------------ */

export interface McpServerOptions extends Omit<UightClientOptions, "url"> {
	/**
	 * Dev server URL. Omit it and the server discovers one — `--url` is an
	 * override, not a requirement, because an agent has no way to know which
	 * port the human's dev server took.
	 */
	url?: string;
	/** Package version, reported in `serverInfo`. */
	version?: string;
	stdin?: NodeJS.ReadableStream;
	stdout?: NodeJS.WritableStream;
	/** Injected in tests. Passed through to discovery. */
	discovery?: DiscoverOptions;
}

/**
 * Handle one decoded request and return a result, or throw to produce an error
 * response. Exported so the dispatch table can be tested without a stream.
 */
export async function handleRequest(
	request: RpcRequest,
	client: UightClient,
	version: string,
): Promise<unknown> {
	switch (request.method) {
		case "initialize":
			return {
				protocolVersion: MCP_PROTOCOL_VERSION,
				capabilities: { tools: { listChanged: false } },
				serverInfo: { name: "uight", version },
			};
		case "ping":
			return {};
		case "tools/list":
			return {
				tools: TOOLS.map((tool) => ({
					name: tool.name,
					description: tool.description,
					inputSchema: tool.inputSchema,
				})),
			};
		case "tools/call": {
			const name = request.params?.name;
			const tool = TOOLS.find((candidate) => candidate.name === name);
			if (!tool) throw new Error(`no such tool: ${String(name)}`);
			const args = (request.params?.arguments ?? {}) as Record<string, unknown>;
			try {
				const result = await tool.run(args, client);
				// Most tools return plain data and get serialized as one text block.
				// A tool that already speaks in MCP content blocks — render_fixture,
				// which must return an image — says so by returning `{ content }`,
				// and that is passed through untouched.
				if (
					result !== null &&
					typeof result === "object" &&
					Array.isArray((result as { content?: unknown }).content)
				) {
					return result;
				}
				return {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				};
			} catch (error) {
				// A tool failure is a result with isError, not a protocol error: the
				// agent should see the message and be able to act on it.
				return {
					content: [
						{ type: "text", text: error instanceof Error ? error.message : String(error) },
					],
					isError: true,
				};
			}
		}
		default:
			throw Object.assign(new Error(`unknown method: ${request.method}`), {
				code: METHOD_NOT_FOUND,
			});
	}
}

/** Run the stdio server. Resolves when stdin closes. */
export function runMcpServer(options: McpServerOptions): Promise<void> {
	const client = new UightClient({
		...options,
		// A string when `--url` was given, a lookup otherwise. Either way the
		// server starts immediately: an agent must not have to sequence its MCP
		// servers behind the human starting a dev server.
		url: options.url ?? (() => resolveDevServerUrl(undefined, options.discovery)),
	});
	const version = options.version ?? "0.0.0";
	// Annotated rather than inferred: `process.stdin` is a `ReadStream`, and the
	// union of it with `ReadableStream` has no callable `on` overload in common.
	const stdin: NodeJS.ReadableStream = options.stdin ?? process.stdin;
	const stdout: NodeJS.WritableStream = options.stdout ?? process.stdout;

	const write = (message: unknown): void => {
		stdout.write(`${JSON.stringify(message)}\n`);
	};

	const fail = (id: RpcRequest["id"], error: RpcError): void => {
		if (id === undefined || id === null) return; // a notification gets no reply
		write({ jsonrpc: "2.0", id, error });
	};

	return new Promise((resolve) => {
		let buffer = "";

		stdin.setEncoding?.("utf8");
		stdin.on("data", (chunk: string) => {
			buffer += chunk;

			let newline = buffer.indexOf("\n");
			while (newline !== -1) {
				const line = buffer.slice(0, newline).trim();
				buffer = buffer.slice(newline + 1);
				newline = buffer.indexOf("\n");
				if (line === "") continue;

				let request: RpcRequest;
				try {
					request = JSON.parse(line) as RpcRequest;
				} catch {
					fail(null, { code: PARSE_ERROR, message: "invalid JSON" });
					continue;
				}
				if (typeof request.method !== "string") {
					fail(request.id ?? null, { code: INVALID_REQUEST, message: "missing method" });
					continue;
				}

				// Notifications carry no id and must not be answered at all.
				const id = request.id;
				void handleRequest(request, client, version)
					.then((result) => {
						if (id === undefined || id === null) return;
						write({ jsonrpc: "2.0", id, result });
					})
					.catch((error: unknown) => {
						const code =
							typeof (error as { code?: unknown })?.code === "number"
								? (error as { code: number }).code
								: INTERNAL_ERROR;
						fail(id ?? null, {
							code,
							message: error instanceof Error ? error.message : String(error),
						});
					});
			}
		});

		stdin.on("end", () => resolve());
		stdin.on("close", () => resolve());
	});
}
