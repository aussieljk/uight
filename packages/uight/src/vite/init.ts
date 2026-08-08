/**
 * One command from a Storybook or react-cosmos repository to a working
 * `/uight`.
 *
 * The cosmos half lives in `cosmos.ts`; this file owns the part both sources
 * share — the dependency, the Vite config, the transcript — and calls into it.
 *
 * §13 already made the corpus readable — CSF is a declared subset and
 * `.storybook/preview` is loaded — but the last mile was still four manual
 * steps: add the dependency, find the Vite config, remember the option name,
 * then discover for yourself which stories will not survive. Every one of them
 * is mechanical, so none of them should be a reason not to try it.
 *
 * The edit is made against the parsed config rather than by regex: an import is
 * inserted after the last existing one, and the plugin is prepended to the
 * `plugins` array the parser found. When the parser cannot find that array the
 * command says so and prints the line to paste, because a config it half
 * understands is worse than a config it declines to touch.
 *
 * Nothing here installs anything or runs a package manager. It writes files and
 * prints the one command left to run, which keeps `--dry-run` honest: the
 * difference between a dry run and a real one is exactly the writes it lists.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { resolveUightConfig } from "./config.ts";
import type { CosmosReport, FixtureRename } from "./cosmos.ts";
import {
	cosmosFixturesDirName,
	cosmosReport,
	detectCosmos,
	planFixtureRenames,
	readCosmosConfig,
	rewriteCosmosImports,
	translateCosmosConfig,
} from "./cosmos.ts";
import type { StorybookReport } from "./storybook-report.ts";
import { storybookReport } from "./storybook-report.ts";

/** Vite config filenames, in the order Vite itself resolves them. */
const CONFIG_FILES = [
	"vite.config.ts",
	"vite.config.mts",
	"vite.config.js",
	"vite.config.mjs",
	"vite.config.cts",
	"vite.config.cjs",
];

const STORYBOOK_DIRS = [".storybook", "storybook"];

/** What the command did, or would do, to one file. */
export interface MigrationChange {
	/** Root-relative. */
	path: string;
	action: "create" | "edit" | "skip" | "rename";
	/** One line describing the change, or why there was none. */
	detail: string;
	/** The full file after the change. Absent for `skip` and bare renames. */
	contents?: string;
	/** Root-relative source path. Set only for `rename`. */
	renameFrom?: string;
}

export interface MigrationResult {
	root: string;
	/** What made this look like a Storybook project, empty when nothing did. */
	evidence: string[];
	/** What made this look like a react-cosmos project, empty when nothing did. */
	cosmosEvidence: string[];
	changes: MigrationChange[];
	/** Null when there was no CSF to scan. */
	report: StorybookReport | null;
	/** Null when this was not a cosmos project. */
	cosmos: CosmosReport | null;
	/** Commands and edits the user still has to do, in order. */
	nextSteps: string[];
	/** True when `--dry-run` meant nothing was written. */
	dryRun: boolean;
}

export interface MigrateOptions {
	root: string;
	/** Compute every change and write none. */
	dryRun?: boolean;
	/** Version range written into `devDependencies`. Default `latest`. */
	version?: string;
	/**
	 * Rename cosmos's `__fixtures__/Button.tsx` to `Button.fixture.tsx`, which
	 * is what makes those fixtures discoverable at all. Default true — off is
	 * for someone who would rather do the renames in their own commit.
	 */
	renameFixtures?: boolean;
}

/* ------------------------------------------------------------------ *
 * Detection
 * ------------------------------------------------------------------ */

interface PackageJson {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	[key: string]: unknown;
}

function readPackageJson(
	root: string,
): { file: string; json: PackageJson; source: string } | null {
	const file = path.join(root, "package.json");
	let source: string;
	try {
		source = fs.readFileSync(file, "utf8");
	} catch {
		return null;
	}
	try {
		return { file, json: JSON.parse(source) as PackageJson, source };
	} catch {
		return null;
	}
}

/**
 * Why this looks like a Storybook project.
 *
 * Returned as a list rather than a boolean because it is printed: "no Storybook
 * found" is a much worse message than showing what was looked for and missed.
 */
function detectStorybook(root: string, pkg: PackageJson | null): string[] {
	const evidence: string[] = [];
	for (const dir of STORYBOOK_DIRS) {
		if (fs.existsSync(path.join(root, dir))) evidence.push(`${dir}/`);
	}
	const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
	const storybookDeps = Object.keys(deps)
		.filter((name) => name === "storybook" || name.startsWith("@storybook/"))
		.sort();
	if (storybookDeps.length) {
		evidence.push(
			storybookDeps.length > 3
				? `${storybookDeps.slice(0, 3).join(", ")} and ${storybookDeps.length - 3} more in package.json`
				: `${storybookDeps.join(", ")} in package.json`,
		);
	}
	return evidence;
}

/* ------------------------------------------------------------------ *
 * The Vite config edit
 * ------------------------------------------------------------------ */

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
	return (
		typeof value === "object" && value !== null && typeof (value as Node).type === "string"
	);
}

function walk(node: unknown, visit: (n: Node) => void): void {
	if (Array.isArray(node)) {
		for (const child of node) walk(child, visit);
		return;
	}
	if (!isNode(node)) return;
	visit(node);
	for (const [key, value] of Object.entries(node)) {
		if (key === "type" || key === "start" || key === "end") continue;
		walk(value, visit);
	}
}

function staticKey(key: unknown): string | null {
	if (!isNode(key)) return null;
	if (key.type === "Identifier" && typeof key.name === "string") return key.name;
	if (key.type === "Literal" && typeof key.value === "string") return key.value;
	return null;
}

interface ConfigEdit {
	source: string;
	/** Null when the config was already wired up. */
	changed: boolean;
	/** Set when the plugins array could not be found. */
	problem?: string;
}

/** The plugin call this command writes, and the report expects to find. */
const PLUGIN_CALL = "uight({ storybook: true })";
const PLUGIN_IMPORT = 'import { uight } from "@aussieljk/uight/vite";';

/**
 * Insert the import and the plugin call into an existing Vite config.
 *
 * Offsets are collected from the parse and applied back-to-front, so the
 * earlier insertion point is still valid when the later one has moved.
 */
export function addUightToViteConfig(source: string, filename: string): ConfigEdit {
	if (/["']uight\/vite["']/.test(source)) {
		return { source, changed: false };
	}

	let program: Node;
	try {
		const result = parseSync(filename, source, { showSemanticErrors: false });
		if (result.errors.some((e) => e.severity === "Error")) {
			return { source, changed: false, problem: "the config does not parse" };
		}
		program = result.program as unknown as Node;
	} catch {
		return { source, changed: false, problem: "the config does not parse" };
	}

	/* Where the import goes: after the last top-level import, or at the top. */
	let importEnd = 0;
	for (const statement of (program.body ?? []) as unknown[]) {
		if (isNode(statement) && statement.type === "ImportDeclaration") {
			importEnd = Number(statement.end);
		}
	}

	/*
	 * Where the plugin goes. The first `plugins: [...]` in the file is the right
	 * one in every config shape we have seen — `defineConfig({...})`, a bare
	 * object, or a function returning one — because a nested `plugins` (a worker
	 * or environment block) always appears after the top-level array it sits in.
	 */
	let pluginsArray: Node | null = null;
	walk(program, (node) => {
		if (pluginsArray) return;
		if (node.type !== "Property" || staticKey(node.key) !== "plugins") return;
		const value = node.value;
		if (isNode(value) && value.type === "ArrayExpression") pluginsArray = value;
	});

	if (!pluginsArray) {
		return { source, changed: false, problem: "no `plugins` array was found" };
	}

	const array = pluginsArray as Node;
	const elements = (array.elements ?? []) as unknown[];
	const first = elements.find(isNode);
	// Prepending rather than appending: uight only contributes virtual modules
	// and a route, so its position does not matter to Vite — but the top of the
	// list is where someone reading the config afterwards will look for it.
	const insertAt = first ? Number(first.start) : Number(array.start) + 1;
	// `plugins: [react()]` stays on one line and `plugins: [\n\treact(),\n]` keeps
	// its own indent — matching what is there beats imposing a house style on a
	// config the user has to read the diff of.
	const indent = detectIndent(source, insertAt);
	const insertion = !first
		? PLUGIN_CALL
		: indent === null
			? `${PLUGIN_CALL}, `
			: `${PLUGIN_CALL},\n${indent}`;

	let out = source.slice(0, insertAt) + insertion + source.slice(insertAt);
	out =
		out.slice(0, importEnd) +
		(importEnd === 0 ? `${PLUGIN_IMPORT}\n` : `\n${PLUGIN_IMPORT}`) +
		out.slice(importEnd);
	return { source: out, changed: true };
}

/**
 * The indent of the line `offset` starts, or null when `offset` is mid-line —
 * which is what tells the caller the array is written on one line.
 */
function detectIndent(source: string, offset: number): string | null {
	const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
	const line = source.slice(lineStart, offset);
	return /^[\t ]*$/.test(line) ? line : null;
}

/** The config written when a Storybook project has no Vite config at all. */
function scaffoldViteConfig(): string {
	return `import react from "@vitejs/plugin-react";
import { uight } from "@aussieljk/uight/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [${PLUGIN_CALL}, react()],
});
`;
}

/* ------------------------------------------------------------------ *
 * package.json
 * ------------------------------------------------------------------ */

/**
 * Add `uight` to `devDependencies`, preserving the file's own formatting.
 *
 * The whole file is re-serialized with the indent it already used, because a
 * config file rewritten with a different indent is a diff nobody asked for.
 */
function addDevDependency(
	source: string,
	json: PackageJson,
	version: string,
): string | null {
	if (json.dependencies?.uight || json.devDependencies?.uight) return null;
	const devDependencies: Record<string, string> = {
		...json.devDependencies,
		uight: version,
	};
	const sorted: Record<string, string> = {};
	for (const key of Object.keys(devDependencies).sort())
		sorted[key] = devDependencies[key] ?? "";
	const next = { ...json, devDependencies: sorted };
	const indent = /\n(\s+)"/.exec(source)?.[1] ?? "\t";
	return `${JSON.stringify(next, null, indent)}\n`;
}

/* ------------------------------------------------------------------ *
 * The command
 * ------------------------------------------------------------------ */

/**
 * Wire uight into the project at `root`, whatever it is coming from.
 *
 * Storybook and react-cosmos are detected independently and both halves run
 * when both are present, because a repository mid-migration between the two is
 * a real repository and picking one for it would leave the other unwired.
 *
 * Exported from `@aussieljk/uight/vite` so a repository can run it from a script — the
 * CLI is one caller, not the only one.
 */
export async function migrateProject(options: MigrateOptions): Promise<MigrationResult> {
	const root = path.resolve(options.root);
	const dryRun = options.dryRun === true;
	const version = options.version ?? "latest";
	const pkg = readPackageJson(root);
	const evidence = detectStorybook(root, pkg?.json ?? null);

	const changes: MigrationChange[] = [];
	const nextSteps: string[] = [];

	/* 1 — the dependency. */
	if (!pkg) {
		changes.push({
			path: "package.json",
			action: "skip",
			detail: "not found or not valid JSON — add `uight` to devDependencies yourself",
		});
	} else {
		const next = addDevDependency(pkg.source, pkg.json, version);
		if (next === null) {
			changes.push({
				path: "package.json",
				action: "skip",
				detail: "uight is already a dependency",
			});
		} else {
			changes.push({
				path: "package.json",
				action: "edit",
				detail: `uight@${version} → devDependencies`,
				contents: next,
			});
			nextSteps.push("bun install");
		}
	}

	/* 2 — the Vite config. */
	const existing = CONFIG_FILES.map((name) => path.join(root, name)).find((file) =>
		fs.existsSync(file),
	);
	if (!existing) {
		changes.push({
			path: "vite.config.ts",
			action: "create",
			detail: "new file — no Vite config existed; uight and @vitejs/plugin-react",
			contents: scaffoldViteConfig(),
		});
		nextSteps.push(
			"Check vite.config.ts: this project was not on Vite, so the rest of its build is not described there.",
		);
	} else {
		const name = path.relative(root, existing);
		const source = await fsp.readFile(existing, "utf8");
		const edit = addUightToViteConfig(source, existing);
		if (edit.problem) {
			changes.push({ path: name, action: "skip", detail: edit.problem });
			nextSteps.push(
				`Add \`${PLUGIN_CALL}\` to the plugins array in ${name}, and \`${PLUGIN_IMPORT}\` above it.`,
			);
		} else if (!edit.changed) {
			changes.push({
				path: name,
				action: "skip",
				detail: "uight is already in this config",
			});
		} else {
			changes.push({
				path: name,
				action: "edit",
				detail: `${PLUGIN_CALL} → the plugins array`,
				contents: edit.source,
			});
		}
	}

	/* 3 — the cosmos-shaped half of the move, when there is one. */
	const cosmosEvidence = detectCosmos(root, pkg?.json ?? null);
	let cosmos: CosmosReport | null = null;
	if (cosmosEvidence.length > 0) {
		cosmos = await migrateCosmos({
			root,
			changes,
			nextSteps,
			renameFixtures: options.renameFixtures !== false,
		});
	}

	/* 4 — what will not survive, before anyone commits to the move. */
	let report: StorybookReport | null = null;
	if (evidence.length > 0 || existing) {
		const config = resolveUightConfig({
			root,
			options: { storybook: true },
			command: "build",
		});
		report = await storybookReport(config);
	}

	/* 5 — write, unless this was a rehearsal. */
	if (!dryRun) {
		for (const change of changes) {
			// A rename moves the file first, so a rewritten fixture is written to
			// the name it is going to have rather than the one it is leaving.
			if (change.action === "rename" && change.renameFrom) {
				await fsp.rename(path.join(root, change.renameFrom), path.join(root, change.path));
			}
			if (change.contents === undefined) continue;
			await fsp.writeFile(path.join(root, change.path), change.contents, "utf8");
		}
	}

	nextSteps.push("Start your dev server and open /uight");

	return { root, evidence, cosmosEvidence, changes, report, cosmos, nextSteps, dryRun };
}

/* ------------------------------------------------------------------ *
 * react-cosmos
 * ------------------------------------------------------------------ */

/**
 * The three things a cosmos repository needs beyond the plugin: its config
 * translated, its `__fixtures__/` files named so the scan can see them, and
 * its hook imports pointed at `uight`.
 *
 * The order matters, and it is the order the writes happen in: a file that is
 * both renamed and rewritten is recorded once, under its new name, so the two
 * halves cannot disagree about where it lives.
 */
async function migrateCosmos(args: {
	root: string;
	changes: MigrationChange[];
	nextSteps: string[];
	renameFixtures: boolean;
}): Promise<CosmosReport> {
	const { root, changes, nextSteps } = args;
	const config = readCosmosConfig(root);
	const suffix =
		typeof config?.json.fixtureFileSuffix === "string"
			? config.json.fixtureFileSuffix
			: "fixture";

	/* a — the config. */
	if (config) {
		const translation = translateCosmosConfig(config.json);
		const target = path.join(root, "uight.config.json");
		const keys = Object.keys(translation.options);
		if (!keys.length) {
			changes.push({
				path: "uight.config.json",
				action: "skip",
				detail: `${path.basename(config.file)} says nothing uight does not already default to`,
			});
		} else if (fs.existsSync(target)) {
			changes.push({
				path: "uight.config.json",
				action: "skip",
				detail: `already exists — ${keys.join(", ")} from ${path.basename(config.file)} were not merged in`,
			});
			nextSteps.push(
				`Merge ${keys.join(", ")} from ${path.basename(config.file)} into uight.config.json.`,
			);
		} else {
			changes.push({
				path: "uight.config.json",
				action: "create",
				detail: translation.translated.join("; "),
				contents: `${JSON.stringify(translation.options, null, "\t")}\n`,
			});
		}
		for (const [key, reason] of Object.entries(translation.dropped)) {
			nextSteps.push(
				`${path.basename(config.file)} \`${key}\` has no equivalent — ${reason}.`,
			);
		}
	}

	/* b — the renames. */
	const dirName = cosmosFixturesDirName(config?.json ?? null);
	const renames: FixtureRename[] = args.renameFixtures
		? await planFixtureRenames({ root, dirName, suffix })
		: [];
	const renamedFrom = new Map(renames.map((r) => [r.from, r.to]));
	for (const rename of renames) {
		changes.push({
			path: rename.to,
			action: "rename",
			detail: `from ${rename.from} — uight finds fixtures by name, not by directory`,
			renameFrom: rename.from,
		});
	}

	/* c — the imports. */
	const report = await cosmosReport({ root, suffix });
	if (!args.renameFixtures && report.renames.length) {
		nextSteps.push(
			`${report.renames.length} file(s) under ${dirName}/ carry no \`.${suffix}\` suffix and will not be found. ` +
				"Re-run without --no-rename, or rename them yourself.",
		);
	}
	for (const detail of report.details) {
		const file = path.join(root, detail.path);
		let source: string;
		try {
			source = await fsp.readFile(file, "utf8");
		} catch {
			continue;
		}
		const rewrite = rewriteCosmosImports(source, file);
		const target = renamedFrom.get(detail.path) ?? detail.path;
		if (rewrite.problem) {
			changes.push({ path: target, action: "skip", detail: rewrite.problem });
			continue;
		}
		const declined = Object.keys(rewrite.declined);
		if (!rewrite.changed) {
			changes.push({
				path: target,
				action: "skip",
				detail: declined.length
					? `nothing to move — ${declined.join(", ")} have no equivalent`
					: "nothing to move",
			});
			continue;
		}
		// A rename already queued this path; folding the contents into that change
		// keeps one entry per file and makes the write order fall out for free.
		const queued = changes.find((c) => c.action === "rename" && c.path === target);
		const names = Object.entries(rewrite.renamed)
			.map(([from, to]) => `${from} → ${to}`)
			.join(", ");
		const detailText =
			`react-cosmos → uight${names ? ` (${names})` : ""}` +
			(declined.length ? `; left behind: ${declined.join(", ")}` : "");
		if (queued) {
			queued.contents = rewrite.source;
			queued.detail = `${queued.detail}; ${detailText}`;
		} else {
			changes.push({
				path: target,
				action: "edit",
				detail: detailText,
				contents: rewrite.source,
			});
		}
	}

	if (report.evidence.some((line) => line.includes("package.json"))) {
		nextSteps.push("Remove react-cosmos from package.json once /uight looks right.");
	}
	return report;
}

/**
 * The name this had when Storybook was the only source, and the one the CLI
 * calls: `uight init` is overwhelmingly reached from a Storybook repository,
 * and the name says so at the call site.
 */
export const migrateFromStorybook = migrateProject;

function plural(n: number, one: string, many = `${one}s`): string {
	return `${n} ${n === 1 ? one : many}`;
}

/** The human-readable transcript the CLI prints. */
export function formatMigration(result: MigrationResult): string {
	const lines: string[] = [];

	if (result.evidence.length) lines.push(`Storybook found: ${result.evidence.join("; ")}`);
	if (result.cosmosEvidence.length)
		lines.push(`react-cosmos found: ${result.cosmosEvidence.join("; ")}`);
	if (!result.evidence.length && !result.cosmosEvidence.length) {
		lines.push(
			"No Storybook or react-cosmos found here — looked for .storybook/, storybook/, " +
				"cosmos.config.json, and @storybook/* or react-cosmos in package.json.",
		);
		lines.push(
			"Wiring uight in anyway: it reads CSF wherever it lives, and fixtures need neither of them.",
		);
	}
	lines.push("");

	for (const change of result.changes) {
		const mark =
			change.action === "skip"
				? "·"
				: change.action === "rename"
					? "↦"
					: result.dryRun
						? "→"
						: "✓";
		lines.push(`  ${mark} ${change.path}  ${change.detail}`);
	}

	if (result.cosmos) {
		const declined = Object.entries(result.cosmos.declined);
		lines.push("");
		lines.push(
			`${plural(result.cosmos.files, "cosmos fixture")} — the format itself moves unchanged`,
		);
		if (declined.length) {
			lines.push("");
			lines.push("left in place, no equivalent in uight:");
			const width = Math.max(...declined.map(([key]) => key.length));
			for (const [key, count] of declined) lines.push(`  ${key.padEnd(width)}  ${count}`);
			lines.push("");
			lines.push("`uight cosmos` prints this per file.");
		}
	}

	// A cosmos-only project scans for CSF too and finds none; saying "0 CSF files"
	// there is noise about a tool it never used.
	if (result.report && (result.report.files > 0 || result.evidence.length > 0)) {
		const { files, stories, clean } = result.report;
		lines.push("");
		lines.push(
			`${plural(files, "CSF file")}, ${plural(stories, "story", "stories")} — ` +
				`${clean} use nothing uight declines`,
		);
		const entries = Object.entries(result.report.unsupported);
		if (entries.length) {
			const width = Math.max(...entries.map(([key]) => key.length));
			lines.push("");
			lines.push(
				"declined, by frequency (each is badged in the UI, never silently skipped):",
			);
			for (const [key, count] of entries) lines.push(`  ${key.padEnd(width)}  ${count}`);
			lines.push("");
			lines.push("`uight storybook` prints this per file.");
		}
	}

	lines.push("");
	lines.push(result.dryRun ? "Nothing was written. Re-run without --dry-run." : "Next:");
	if (!result.dryRun) {
		for (const [i, step] of result.nextSteps.entries()) lines.push(`  ${i + 1}. ${step}`);
	}
	return lines.join("\n");
}
