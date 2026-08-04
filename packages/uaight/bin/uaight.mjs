#!/usr/bin/env node
/**
 * The uaight CLI.
 *
 *   uaight build [--out dist-uaight] [--base /] [--root .]
 *   uaight doctor [--root .] [--json]
 *   uaight init [--root .] [--dry-run] [--no-rename]
 *   uaight storybook [--root .]
 *   uaight cosmos [--root .]
 *   uaight mcp [--url <url>]
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

  uaight init                 Wire uaight into this project — one command from
                              Storybook or react-cosmos
    --root <dir>              Project root (default: cwd)
    --dry-run                 Print every change and write nothing
    --no-rename               Leave cosmos __fixtures__/ filenames alone
    --version-range <range>   Version written to devDependencies (default: latest)

  uaight doctor               Why is my component missing: config, index, problems
    --root <dir>              Project root (default: cwd)
    --json                    Print the full report as JSON

  uaight storybook            Report which CSF features would not survive
    --root <dir>              Project root (default: cwd)
    --json                    Print the full report as JSON

  uaight cosmos               Report what a react-cosmos move would rename and decline
    --root <dir>              Project root (default: cwd)
    --json                    Print the full report as JSON

  uaight mcp                  Run the MCP server over stdio
    --url <url>               Dev server URL (default: discovered)
                              render_fixture returns a screenshot and needs the
                              optional "playwright" package; the rest do not.

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
		console.log(
			`\nuaight → ${path.relative(process.cwd(), result.outDir)} (${result.files} files)`,
		);
		// Never drop a plugin in silence: the explorer being built without a
		// framework's transforms is the kind of thing that only shows up as a
		// fixture rendering differently here than in `bun dev`.
		if (result.excluded?.length) {
			// Grouped by the part before the first colon. A framework contributes
			// two dozen plugins and naming each one is a wall of text nobody
			// reads, which is the same as not reporting it.
			const groups = new Map();
			for (const name of result.excluded) {
				const key = name.split(":")[0];
				groups.set(key, (groups.get(key) ?? 0) + 1);
			}
			const summary = [...groups]
				.map(([key, n]) => (n > 1 ? `${key} (${n})` : key))
				.join(", ");
			console.log(`  without ${result.excluded.length} framework plugin(s): ${summary}`);
		}
		return;
	}

	if (command === "init" || command === "migrate") {
		const { migrateProject, formatMigration } = await import("../dist/vite.js");
		const range = flag("version-range", undefined);
		const result = await migrateProject({
			root: path.resolve(String(flag("root", process.cwd()))),
			dryRun: flag("dry-run", false) === true,
			renameFixtures: flag("no-rename", false) !== true,
			...(typeof range === "string" ? { version: range } : {}),
		});
		console.log(formatMigration(result));
		return;
	}

	if (command === "doctor") {
		const { resolveUaightConfig, doctorReport, formatDoctorReport } =
			await import("../dist/vite.js");
		const root = path.resolve(String(flag("root", process.cwd())));
		// `serve` because that is the mode the question is asked in: the inventory
		// and call-site passes are development-only, and a doctor that reported
		// zero components for a healthy project would be its own bug report.
		const config = resolveUaightConfig({ root, options: {}, command: "serve" });
		const report = await doctorReport(config);
		if (flag("json", false) === true) {
			console.log(JSON.stringify(report, null, 2));
		} else {
			console.log(formatDoctorReport(report));
		}
		// A collision makes fixture ids ambiguous, so it is the one problem kind
		// that should fail a CI step that runs this.
		if (report.problems.some((p) => p.kind === "collision")) process.exitCode = 1;
		return;
	}

	if (command === "storybook") {
		const { resolveUaightConfig, storybookReport, formatStorybookReport } =
			await import("../dist/vite.js");
		const root = path.resolve(String(flag("root", process.cwd())));
		const config = resolveUaightConfig({
			root,
			options: { storybook: true },
			command: "build",
		});
		const report = await storybookReport(config);
		if (flag("json", false) === true) {
			console.log(JSON.stringify(report, null, 2));
			return;
		}
		console.log(formatStorybookReport(report));
		return;
	}

	if (command === "cosmos") {
		const { cosmosReport, formatCosmosReport } = await import("../dist/vite.js");
		const report = await cosmosReport({
			root: path.resolve(String(flag("root", process.cwd()))),
		});
		if (flag("json", false) === true) {
			console.log(JSON.stringify(report, null, 2));
			return;
		}
		console.log(formatCosmosReport(report));
		return;
	}

	if (command === "mcp") {
		const { runMcpServer } = await import("../dist/mcp.js");
		const url = flag("url", undefined);
		await runMcpServer({
			// Omitted entirely when there is no `--url`, which is what turns
			// discovery on: nobody should have to know which port Vite took.
			...(typeof url === "string" ? { url } : {}),
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
