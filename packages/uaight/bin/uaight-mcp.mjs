#!/usr/bin/env node
/**
 * The MCP server, as its own binary so an MCP client config can name it
 * directly:
 *
 *   { "command": "npx", "args": ["-y", "uaight-mcp", "--url", "http://localhost:5173"] }
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

  --url <url>   uaight dev server to read (default: http://localhost:5173)

Speaks MCP over stdio. The dev server must be running.
`);
	process.exit(0);
}

runMcpServer({
	url: flag("url", "http://localhost:5173"),
	version,
}).catch((error) => {
	console.error(`uaight-mcp: ${error?.message ?? error}`);
	process.exit(1);
});
