#!/usr/bin/env node
/**
 * The uaight CLI.
 *
 *   uaight build [--out dist-uaight] [--base /] [--root .]
 *   uaight storybook [--root .]
 *   uaight mcp [--url http://localhost:5173]
 *
 * A thin argument parser over the Node API in `uaight/vite` and `uaight/mcp`.
 * Everything it can do is also callable from a script, which is the supported
 * path for CI — this exists so trying it costs one command.
 */

import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const argv = process.argv.slice(2);
const command = argv[0];

function flag(name, fallback) {
	const index = argv.indexOf(`--${name}`);
	if (index === -1) return fallback;
	const value = argv[index + 1];
	return value === undefined || value.startsWith("--") ? true : value;
}

function usage() {
	console.log(`uaight ${version}

  uaight build                Build a deployable static explorer
    --out <dir>               Output directory (default: dist-uaight)
    --base <path>             Public base path (default: /)
    --root <dir>              Project root (default: cwd)
    --config <file>           Vite config file

  uaight storybook            Report which CSF features would not survive
    --root <dir>              Project root (default: cwd)
    --json                    Print the full report as JSON

  uaight mcp                  Run the MCP server over stdio
    --url <url>               Dev server URL (default: http://localhost:5173)

  uaight --version
`);
}

async function main() {
	if (!command || command === "--help" || command === "-h" || command === "help") {
		usage();
		return;
	}
	if (command === "--version" || command === "-v" || command === "version") {
		console.log(version);
		return;
	}

	if (command === "build") {
		const { buildStatic } = await import("../dist/vite.js");
		const result = await buildStatic({
			root: path.resolve(String(flag("root", process.cwd()))),
			outDir: String(flag("out", "dist-uaight")),
			base: String(flag("base", "/")),
			...(typeof flag("config", undefined) === "string"
				? { configFile: String(flag("config")) }
				: {}),
		});
		console.log(`\nuaight → ${path.relative(process.cwd(), result.outDir)} (${result.files} files)`);
		return;
	}

	if (command === "storybook") {
		const { resolveUaightConfig, storybookReport, formatStorybookReport } = await import(
			"../dist/vite.js"
		);
		const root = path.resolve(String(flag("root", process.cwd())));
		const config = resolveUaightConfig({ root, options: { storybook: true }, command: "build" });
		const report = await storybookReport(config);
		if (flag("json", false) === true) {
			console.log(JSON.stringify(report, null, 2));
			return;
		}
		console.log(formatStorybookReport(report));
		return;
	}

	if (command === "mcp") {
		const { runMcpServer } = await import("../dist/mcp.js");
		await runMcpServer({
			url: String(flag("url", "http://localhost:5173")),
			version,
		});
		return;
	}

	console.error(`uaight: unknown command "${command}"\n`);
	usage();
	process.exitCode = 1;
}

main().catch((error) => {
	console.error(`uaight: ${error?.message ?? error}`);
	process.exitCode = 1;
});
