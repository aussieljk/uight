/**
 * `uaight doctor` — the answer to "why is my component missing".
 *
 * §19.6 already answers that question, on `/@uaight/config.json`, to a client
 * that can reach a running dev server. That is the wrong shape for the moment
 * the question is actually asked: the tree is empty, so the user has no reason
 * to trust the explorer, and telling them to open the explorer to find out why
 * the explorer is empty is a loop.
 *
 * This runs the same scan the plugin runs, from a shell, against a project that
 * does not have to be serving. It prints what was resolved, what was found and
 * what went wrong — and nothing else. It writes no files, starts no server and
 * changes no state, so it is safe to run at any time.
 */

import type { FixtureIndex, IndexProblem } from "../shared/types.ts";
import type { ResolvedUaightConfig } from "./config.ts";
import { resolveUaightConfig } from "./config.ts";
import { loadViteUaightOptions } from "./load-config.ts";
import { scanFixtures } from "./scan.ts";
import { fixtureGlobPatterns, indexStats, inventoryGlobPatterns } from "./scan.ts";

export interface DoctorReport {
	root: string;
	command: "serve" | "build";
	route: string | false;
	configFile: string | null;
	/** The Vite config the inline options came from, when one was loaded. */
	viteConfigFile: string | null;
	/** Why the Vite config yielded no options, when it did not. */
	viteConfigProblem: string | null;

	/** Both of §4.2's representations, because confusing them is the bug. */
	fixturesDirFsPath: string;
	fixturesDirGlobPath: string;
	fixtureFileSuffix: string;
	/** The patterns actually emitted, not the options that produced them. */
	fixturePatterns: string[];
	inventoryPatterns: string[];
	include: string[];
	exclude: string[];

	files: number;
	fixtures: number;
	undecidable: number;
	decorators: number;
	components: number;
	/** Ranked groups, and the total number of usages behind them. */
	callSiteGroups: number;
	callSites: number;

	problems: IndexProblem[];
	/** Problem counts by kind, in descending order. */
	problemsByKind: Array<[IndexProblem["kind"], number]>;

	docgen: boolean;
	inventory: boolean;
	callSitesEnabled: boolean;
	storybook: boolean;
	index: "static" | "warm" | "lazy";
	aliases: number;
}

/**
 * Run the scan and describe it. Never throws for a project-level problem.
 *
 * Unless the caller passes an already-scanned index — which is how a running
 * plugin calls this — the project's Vite config is loaded first and the
 * options passed inline to `uaight()` are folded into `cfg` before scanning.
 * Without that step this reports the defaults for every project that
 * configures the plugin the documented way; see `load-config.ts`.
 */
export async function doctorReport(
	cfg: ResolvedUaightConfig,
	scanned?: FixtureIndex,
): Promise<DoctorReport> {
	let vite = { viteConfigFile: null as string | null, problem: null as string | null };

	if (!scanned) {
		const loaded = await loadViteUaightOptions(cfg.root, cfg.command);
		vite = { viteConfigFile: loaded.viteConfigFile, problem: loaded.problem };
		if (loaded.options) {
			// Re-resolve rather than patch: inline options win over
			// `uaight.config.json` (§4.1), and only `resolveUaightConfig` knows
			// the precedence, the two path representations and the CSF defaults.
			cfg = resolveUaightConfig({
				root: cfg.root,
				options: loaded.options,
				command: cfg.command,
				alias: loaded.alias,
			});
		}
	}

	const index = scanned ?? (await scanFixtures(cfg));
	const stats = indexStats(index);

	const counts = new Map<IndexProblem["kind"], number>();
	for (const problem of index.problems) {
		counts.set(problem.kind, (counts.get(problem.kind) ?? 0) + 1);
	}

	return {
		root: cfg.root,
		command: cfg.command,
		route: cfg.route,
		configFile: cfg.configFile ?? null,
		viteConfigFile: vite.viteConfigFile,
		viteConfigProblem: vite.problem,

		fixturesDirFsPath: cfg.fixturesDirFsPath,
		fixturesDirGlobPath: cfg.fixturesDirGlobPath,
		fixtureFileSuffix: cfg.fixtureFileSuffix,
		fixturePatterns: fixtureGlobPatterns(cfg),
		inventoryPatterns: inventoryGlobPatterns(cfg),
		include: cfg.include,
		exclude: cfg.exclude,

		files: stats.files,
		fixtures: stats.fixtures,
		undecidable: stats.undecidable,
		decorators: stats.decorators,
		components: stats.components,
		callSiteGroups: index.callSites.length,
		callSites: index.callSites.reduce((sum, group) => sum + group.total, 0),

		problems: index.problems,
		problemsByKind: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),

		docgen: cfg.docgen,
		inventory: cfg.inventory !== false,
		callSitesEnabled: cfg.callSites !== false,
		storybook: cfg.storybook !== false,
		index: cfg.index,
		aliases: cfg.aliases.length,
	};
}

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

function row(label: string, value: unknown): string {
	return `  ${label.padEnd(22)}${String(value)}`;
}

function list(label: string, values: string[]): string {
	if (values.length === 0) return row(label, "—");
	return values.map((value, i) => row(i === 0 ? label : "", value)).join("\n");
}

/**
 * Problems come last and in full. Everything above them is context for reading
 * them, and a report that buried the failures under the configuration that
 * caused them would be answering a different question.
 */
export function formatDoctorReport(report: DoctorReport): string {
	const lines: string[] = [];

	lines.push("uaight doctor", "");
	lines.push("Configuration");
	lines.push(row("root", report.root));
	lines.push(row("command", report.command));
	lines.push(row("route", report.route === false ? "disabled" : report.route));
	lines.push(row("config file", report.configFile ?? "none (defaults)"));
	// The Vite config is loaded and its inline `uaight()` options are folded in
	// before the scan, so the numbers below are the dev server's numbers. This
	// row says which file they came from — and, when they came from nowhere,
	// why, because "no vite config found" is itself an answer.
	lines.push(row("vite config", report.viteConfigFile ?? "none"));
	if (report.viteConfigProblem) {
		lines.push(row("", report.viteConfigProblem));
		lines.push(row("", "Options below are defaults plus uaight.config.json only."));
	}
	lines.push("");

	lines.push("Fixtures directory (§4.2 — two representations, never interchanged)");
	lines.push(row("filesystem path", report.fixturesDirFsPath));
	lines.push(row("glob path", report.fixturesDirGlobPath));
	lines.push(row("file suffix", `.${report.fixtureFileSuffix}.*`));
	lines.push(list("fixture patterns", report.fixturePatterns));
	lines.push(list("inventory patterns", report.inventoryPatterns));
	lines.push(list("include", report.include));
	lines.push(list("exclude", report.exclude));
	lines.push("");

	lines.push("Index");
	lines.push(row("files indexed", report.files));
	lines.push(row("fixtures found", report.fixtures));
	lines.push(
		row(
			"undecidable files",
			report.undecidable === 0
				? "0"
				: `${report.undecidable} (names resolve when the module loads — §3.5)`,
		),
	);
	lines.push(row("decorators", report.decorators));
	lines.push(row("components", report.components));
	lines.push(
		row("call sites", `${report.callSites} across ${report.callSiteGroups} components`),
	);
	lines.push("");

	lines.push("Features");
	lines.push(row("index mode", report.index));
	lines.push(row("inventory", report.inventory ? "on" : "off"));
	lines.push(row("call sites", report.callSitesEnabled ? "on" : "off"));
	lines.push(row("storybook", report.storybook ? "on" : "off"));
	lines.push(row("docgen", report.docgen ? "on (babel resolver)" : "off"));
	lines.push(row("aliases resolved", report.aliases));
	lines.push("");

	if (report.problems.length === 0) {
		lines.push("Problems", row("", "none"));
	} else {
		const breakdown = report.problemsByKind
			.map(([kind, count]) => `${count} ${kind}`)
			.join(", ");
		lines.push(`Problems (${report.problems.length}: ${breakdown})`);
		for (const problem of report.problems) {
			lines.push(`  ${problem.kind}: ${problem.message.replace(/^\[uaight\] /, "")}`);
			for (const file of problem.files) lines.push(`    ${file}`);
		}
	}

	// The one thing a report of "0 files" should say out loud, because the
	// cause is almost always a `fixturesDir` that is not where the user thinks.
	if (report.files === 0 && report.components === 0) {
		lines.push(
			"",
			`Nothing was indexed. Check that ${report.fixturesDirFsPath} exists and holds`,
			`components or *.${report.fixtureFileSuffix}.* files, and that "exclude" does not cover them.`,
		);
	}

	return `${lines.join("\n")}\n`;
}
