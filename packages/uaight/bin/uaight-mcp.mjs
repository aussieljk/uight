#!/usr/bin/env node
/**
 * The MCP server, as its own binary so an MCP client config can name it
 * directly:
 *
 *   { "command": "npx", "args": ["-y", "uaight-mcp"] }
 *
 * No port: the dev server is discovered on first use, because an agent config is
 * written once and the port Vite takes changes with whatever else is running.
 *
 * Identical to `uaight mcp`.
 */

import { createRequire } from "node:module";
import { runMcpServer } from "../dist/mcp.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const argv = process.argv.slice(2);

function flag(name, fallback) {
	const index = argv.indexOf(`--${name}`);
	if (index === -1) return fallback;
	const value = argv[index + 1];
	return value === undefined || value.startsWith("--") ? fallback : value;
}

if (argv.includes("--help") || argv.includes("-h")) {
	console.log(`uaight-mcp ${version}

  --url <url>   uaight dev server to read. Omit it and one is discovered by
                probing common Vite ports for /@uaight/health.

Speaks MCP over stdio. The dev server must be running by the time a tool is
called; it does not have to be running when this starts.
`);
	process.exit(0);
}

const url = flag("url", undefined);

runMcpServer({
	...(typeof url === "string" ? { url } : {}),
	version,
}).catch((error) => {
	console.error(`uaight-mcp: ${error?.message ?? error}`);
	process.exit(1);
});
