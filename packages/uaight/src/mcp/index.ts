/**
 * `uaight/mcp` — the explorer, addressable by a coding agent.
 *
 * A component explorer is a perception tool: it answers *what components exist*,
 * *what states do they have*, and *what does this one look like with these
 * props*. Those are exactly the questions an agent editing a component cannot
 * answer from source alone — and uaight already answers all three over HTTP
 * (§19.6), because the read-only endpoints were built for "tools that cannot
 * import the package".
 *
 * This is that surface spoken as MCP. It is a **client of a running dev
 * server**, not a second index: nothing here parses, scans or executes project
 * code, so it cannot disagree with what the explorer shows, and it inherits
 * §19.6's read-only guarantee wholesale — there is no tool here that writes.
 *
 *   uaight-mcp --url http://localhost:5173
 *
 * Speaks JSON-RPC 2.0 over stdio, newline-delimited, with no SDK dependency:
 * the package ships two runtime dependencies and this is not worth a third.
 */

/* ------------------------------------------------------------------ *
 * JSON-RPC
 * ------------------------------------------------------------------ */

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

export interface UaightClientOptions {
	/** Base URL of the running Vite dev server. */
	url: string;
	/** Request timeout in milliseconds. */
	timeout?: number;
}

export class UaightClient {
	private readonly base: string;
	private readonly timeout: number;

	constructor(options: UaightClientOptions) {
		this.base = options.url.replace(/\/+$/, "");
		this.timeout = options.timeout ?? 5000;
	}

	async get<T>(path: string): Promise<T> {
		const url = `${this.base}/@uaight${path}`;
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
			throw new Error(
				`could not reach uaight at ${this.base} (${reason}). Is the dev server ` +
					`running, and is uaight() in the Vite config?`,
			);
		} finally {
			clearTimeout(timer);
		}
	}

	/** A deep link that opens one fixture in the explorer (§3.2's encoding). */
	fixtureUrl(route: string, path: string, name?: string | null): string {
		const id =
			name === undefined || name === null
				? `uaight:1|${encodeURIComponent(path)}`
				: `uaight:1|${encodeURIComponent(path)}|${encodeURIComponent(name)}`;
		return `${this.base}${route}?fixture=${encodeURIComponent(id)}`;
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
	run(args: Record<string, unknown>, client: UaightClient): Promise<unknown>;
}

const stringArg = (args: Record<string, unknown>, key: string): string | undefined =>
	typeof args[key] === "string" ? (args[key] as string) : undefined;

const numberArg = (args: Record<string, unknown>, key: string): number | undefined =>
	typeof args[key] === "number" ? (args[key] as number) : undefined;

function matches(haystack: string, needle: string | undefined): boolean {
	return !needle || haystack.toLowerCase().includes(needle.toLowerCase());
}

async function routeOf(client: UaightClient): Promise<string> {
	const config = await client.get<ConfigPayload>("/config.json");
	return typeof config.route === "string" ? config.route : "/uaight";
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
			"List components detected in the source that have no fixtures yet (uaight's " +
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
			return { url: client.fixtureUrl(route, path, stringArg(args, "name") ?? null) };
		},
	},
	{
		name: "get_config",
		description:
			"The resolved uaight configuration, including both path representations and the " +
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

export interface McpServerOptions extends UaightClientOptions {
	/** Package version, reported in `serverInfo`. */
	version?: string;
	stdin?: NodeJS.ReadableStream;
	stdout?: NodeJS.WritableStream;
}

/**
 * Handle one decoded request and return a result, or throw to produce an error
 * response. Exported so the dispatch table can be tested without a stream.
 */
export async function handleRequest(
	request: RpcRequest,
	client: UaightClient,
	version: string,
): Promise<unknown> {
	switch (request.method) {
		case "initialize":
			return {
				protocolVersion: MCP_PROTOCOL_VERSION,
				capabilities: { tools: { listChanged: false } },
				serverInfo: { name: "uaight", version },
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
	const client = new UaightClient(options);
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
