/**
 * One command from a react-cosmos repository to a working `/uight`.
 *
 * The fixture *format* already moves for free — that is D12, and it is why this
 * file is short. What does not move for free is everything around the fixtures:
 * the config file has different keys, the hooks are imported from a package
 * that will no longer be installed, and cosmos's second fixture convention —
 * any file inside a `__fixtures__/` directory, regardless of its name — is not
 * one uight recognizes.
 *
 * Each of those is mechanical, so each is done here rather than left in a
 * migration guide. Syntax only, like every other pass we run: the config is
 * JSON, the imports are rewritten from the parse, and nothing is executed.
 *
 * What this deliberately does not do is translate cosmos's renderer plugins or
 * its fixture-state API. Those are not import renames; a rewrite that appeared
 * to move them would move a program that no longer means what it said.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { glob } from "tinyglobby";
import type { UightPluginOptions } from "../shared/types.ts";

/** Where a cosmos config lives, in the order cosmos itself looks. */
const COSMOS_CONFIG_FILES = ["cosmos.config.json"];

/** Modules whose imports move to `uight`. */
const COSMOS_CLIENT_MODULES = new Set([
	"react-cosmos/client",
	"react-cosmos/fixture",
	"react-cosmos-fixture",
]);

/**
 * Cosmos hook → uight hook. The right-hand side is exported from `uight`
 * with the same signature; the pairs that differ only in name are cosmos's own
 * older spelling, kept working here because corpora contain both.
 */
const HOOK_RENAMES: Record<string, string> = {
	useValue: "useFixtureInput",
	useSelect: "useFixtureSelect",
	useFixtureInput: "useFixtureInput",
	useFixtureSelect: "useFixtureSelect",
	useFixtureViewport: "useFixtureViewport",
	useSelectFixture: "useSelectFixture",
	useFixtureId: "useFixtureId",
};

/**
 * Named imports uight has no equivalent for. They are left in place, not
 * rewritten to something that would compile and mean something else.
 */
const DECLINED_IMPORTS: Record<string, string> = {
	useFixtureState: "no equivalent — uight has no fixture-state protocol",
	setFixtureState: "no equivalent — uight has no fixture-state protocol",
	useCosmosConfig: "no equivalent — read `uight.config.json` yourself",
	RendererProvider: "use the preview entry (§6.4) instead",
	FixtureLoader: "internal to cosmos — uight loads fixtures itself",
};

/* ------------------------------------------------------------------ *
 * Detection
 * ------------------------------------------------------------------ */

interface PackageJson {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	[key: string]: unknown;
}

/**
 * Why this looks like a react-cosmos project.
 *
 * A list rather than a boolean for the same reason the Storybook side returns
 * one: it is printed, and "no cosmos found" is a worse message than showing
 * what was looked for.
 */
export function detectCosmos(root: string, pkg: PackageJson | null): string[] {
	const evidence: string[] = [];
	for (const name of COSMOS_CONFIG_FILES) {
		if (fs.existsSync(path.join(root, name))) evidence.push(name);
	}
	const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
	const cosmosDeps = Object.keys(deps)
		.filter((name) => name === "react-cosmos" || name.startsWith("react-cosmos-"))
		.sort();
	if (cosmosDeps.length) evidence.push(`${cosmosDeps.join(", ")} in package.json`);
	return evidence;
}

/* ------------------------------------------------------------------ *
 * The config translation
 * ------------------------------------------------------------------ */

export interface CosmosTranslation {
	/** The `uight.config.json` body, empty when every default already fits. */
	options: UightPluginOptions;
	/** One line per translated key, for the transcript. */
	translated: string[];
	/** Cosmos keys with no equivalent: `key` → why it was dropped. */
	dropped: Record<string, string>;
}

/**
 * Cosmos keys that describe its own dev server rather than the corpus. Vite
 * owns all of these once uight is a plugin, so dropping them is the answer,
 * not a limitation — but they are still named, because a silently ignored
 * config key is how a migration loses someone's `staticPath`.
 */
const SERVER_KEYS: Record<string, string> = {
	port: "Vite owns the dev server — set `server.port` in vite.config",
	hostname: "Vite owns the dev server — set `server.host` in vite.config",
	host: "Vite owns the dev server — set `server.host` in vite.config",
	https: "Vite owns the dev server — set `server.https` in vite.config",
	staticPath: "Vite serves `public/` — move these files there",
	publicUrl: "Vite owns this — set `base` in vite.config",
	exportPath: "use `uight build --out <dir>`",
	watchDirs: "Vite watches the project already",
	webpack: "uight is a Vite plugin",
	vite: "uight is a Vite plugin — this config is your vite.config now",
	plugins:
		"cosmos renderer plugins have no equivalent — replaceable chrome (§17) is the closest thing",
	ui: "no equivalent — the explorer's own layout is not configurable this way",
	dom: "no equivalent",
	globalImports: "use `previewEntry` for app-wide providers (§6.4)",
	experimentalRendererUrl: "no equivalent",
};

/**
 * Translate a parsed `cosmos.config.json` into uight plugin options.
 *
 * The one translation worth explaining is `fixturesDir`. Cosmos means "a
 * directory *name* that marks fixtures anywhere in the tree"; uight's
 * `fixturesDir` means "the single directory the scan starts at". They are not
 * the same key, so cosmos's is not copied into it — it drives the rename pass
 * below instead, and `rootDir` is what becomes `fixturesDir`.
 */
export function translateCosmosConfig(json: Record<string, unknown>): CosmosTranslation {
	const options: UightPluginOptions = {};
	const translated: string[] = [];
	const dropped: Record<string, string> = {};

	for (const [key, value] of Object.entries(json)) {
		switch (key) {
			case "rootDir": {
				if (typeof value !== "string" || value === "." || value === "./") break;
				options.fixturesDir = value.replace(/^\.\//, "");
				translated.push(`rootDir → fixturesDir: ${options.fixturesDir}`);
				break;
			}
			case "fixtureFileSuffix": {
				if (typeof value !== "string" || value === "fixture") break;
				options.fixtureFileSuffix = value;
				translated.push(`fixtureFileSuffix → fixtureFileSuffix: ${value}`);
				break;
			}
			case "ignore": {
				const list = Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
				if (!list.length) break;
				options.exclude = list as string[];
				translated.push(`ignore → exclude: ${list.length} pattern(s)`);
				break;
			}
			case "lazy": {
				if (value !== true) break;
				options.index = "lazy";
				translated.push("lazy → index: lazy");
				break;
			}
			case "fixturesDir": {
				// Deliberately not copied — see the doc comment. The rename pass
				// is what honours it, and it is named there rather than here.
				break;
			}
			default: {
				const reason = SERVER_KEYS[key];
				if (reason) dropped[key] = reason;
				break;
			}
		}
	}

	return { options, translated, dropped };
}

/** The cosmos config at `root`, or null when there is none. */
export function readCosmosConfig(
	root: string,
): { file: string; json: Record<string, unknown> } | null {
	for (const name of COSMOS_CONFIG_FILES) {
		const file = path.join(root, name);
		let source: string;
		try {
			source = fs.readFileSync(file, "utf8");
		} catch {
			continue;
		}
		try {
			const parsed: unknown = JSON.parse(source);
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				return { file, json: parsed as Record<string, unknown> };
			}
		} catch {
			/* An unparseable config is reported by the caller as "not found". */
		}
	}
	return null;
}

/**
 * The `fixturesDir` name cosmos would treat as a fixture directory, honouring
 * an override and falling back to cosmos's own default.
 */
export function cosmosFixturesDirName(json: Record<string, unknown> | null): string {
	const value = json?.fixturesDir;
	return typeof value === "string" && value.trim() !== "" ? value : "__fixtures__";
}

/* ------------------------------------------------------------------ *
 * The import rewrite
 * ------------------------------------------------------------------ */

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
	return (
		typeof value === "object" && value !== null && typeof (value as Node).type === "string"
	);
}

export interface ImportRewrite {
	source: string;
	changed: boolean;
	/** `cosmosName → uightName`, for the transcript. */
	renamed: Record<string, string>;
	/** `name → why`, for imports left exactly as they were. */
	declined: Record<string, string>;
	/** Set when the file could not be parsed; nothing was rewritten. */
	problem?: string;
}

/**
 * Point a fixture's cosmos imports at `uight`.
 *
 * Edits are collected as offset splices and applied back-to-front, so an
 * earlier one is still valid after a later one has moved. A specifier that
 * uight declines keeps its original module: the file then imports from both
 * packages, which is exactly the state it is in — half moved, and visibly so.
 */
export function rewriteCosmosImports(source: string, filename: string): ImportRewrite {
	const renamed: Record<string, string> = {};
	const declined: Record<string, string> = {};

	let program: Node;
	try {
		const result = parseSync(filename, source, { showSemanticErrors: false });
		if (result.errors.some((e) => e.severity === "Error")) {
			return { source, changed: false, renamed, declined, problem: "does not parse" };
		}
		program = result.program as unknown as Node;
	} catch {
		return { source, changed: false, renamed, declined, problem: "does not parse" };
	}

	const edits: { start: number; end: number; text: string }[] = [];

	for (const statement of (program.body ?? []) as unknown[]) {
		if (!isNode(statement) || statement.type !== "ImportDeclaration") continue;
		const from = statement.source;
		if (!isNode(from) || typeof from.value !== "string") continue;
		if (!COSMOS_CLIENT_MODULES.has(from.value)) continue;

		const specifiers = ((statement.specifiers ?? []) as unknown[]).filter(isNode);
		const moving: Node[] = [];
		const staying: Node[] = [];
		for (const specifier of specifiers) {
			const imported = specifier.imported;
			const name =
				specifier.type === "ImportSpecifier" && isNode(imported)
					? typeof imported.name === "string"
						? imported.name
						: null
					: null;
			if (name !== null && HOOK_RENAMES[name]) {
				moving.push(specifier);
				continue;
			}
			staying.push(specifier);
			if (name !== null) {
				declined[name] = DECLINED_IMPORTS[name] ?? "no equivalent in uight";
			} else {
				declined[specifier.type === "ImportDefaultSpecifier" ? "default" : "namespace"] =
					"uight has no default or namespace export to move this to";
			}
		}

		if (!moving.length) continue;

		const clause = moving
			.map((specifier) => {
				const imported = specifier.imported as Node;
				const from = String(imported.name);
				const to = HOOK_RENAMES[from] as string;
				if (from !== to) renamed[from] = to;
				const local = specifier.local;
				const alias = isNode(local) && typeof local.name === "string" ? local.name : to;
				return alias === to ? to : `${to} as ${alias}`;
			})
			.join(", ");
		const moved = `import { ${clause} } from "@aussieljk/uight";`;

		if (!staying.length) {
			edits.push({
				start: Number(statement.start),
				end: Number(statement.end),
				text: moved,
			});
			continue;
		}
		// Some specifiers stay behind, so the original declaration is rewritten to
		// carry only those and the moved ones become a second import beside it.
		const kept = staying
			.map((specifier) => source.slice(Number(specifier.start), Number(specifier.end)))
			.join(", ");
		edits.push({
			start: Number(statement.start),
			end: Number(statement.end),
			text: `import { ${kept} } from "${from.value}";\n${moved}`,
		});
	}

	if (!edits.length) return { source, changed: false, renamed, declined };

	let out = source;
	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
	}
	return { source: out, changed: true, renamed, declined };
}

/* ------------------------------------------------------------------ *
 * The `__fixtures__/` rename
 * ------------------------------------------------------------------ */

export interface FixtureRename {
	/** Root-relative. */
	from: string;
	to: string;
}

/**
 * Cosmos's directory convention, expressed as uight's suffix convention.
 *
 * `__fixtures__/Button.tsx` becomes `__fixtures__/Button.fixture.tsx` — the
 * file does not move, it is only named so the scan can see it. A file that
 * already carries the suffix is left alone, which is what makes running the
 * migration twice a no-op.
 */
export async function planFixtureRenames(options: {
	root: string;
	dirName: string;
	suffix: string;
	exclude?: string[];
}): Promise<FixtureRename[]> {
	const { root, dirName, suffix } = options;
	const matched = await glob([`**/${dirName}/**/*.{js,jsx,ts,tsx,mdx}`], {
		cwd: root,
		absolute: true,
		dot: false,
		expandDirectories: false,
		ignore: ["**/node_modules/**", ...(options.exclude ?? [])],
	});

	const renames: FixtureRename[] = [];
	for (const file of matched.sort()) {
		const base = path.basename(file);
		const ext = path.extname(base);
		const stem = base.slice(0, -ext.length);
		if (stem.endsWith(`.${suffix}`)) continue;
		// A `__fixtures__/index.ts` is cosmos's barrel, not a fixture.
		if (stem === "index") continue;
		const to = path.join(path.dirname(file), `${stem}.${suffix}${ext}`);
		if (fs.existsSync(to)) continue;
		renames.push({ from: path.relative(root, file), to: path.relative(root, to) });
	}
	return renames;
}

/* ------------------------------------------------------------------ *
 * The report
 * ------------------------------------------------------------------ */

export interface CosmosFileReport {
	path: string;
	/** `cosmosName → uightName`. */
	renamed: Record<string, string>;
	/** `name → why`. */
	declined: Record<string, string>;
}

export interface CosmosReport {
	/** Why this looked like a cosmos project. */
	evidence: string[];
	/** Root-relative, or null when there is none. */
	configFile: string | null;
	translation: CosmosTranslation | null;
	/** Fixture files found, by either convention. */
	files: number;
	/** Files needing a rename to be discoverable. */
	renames: FixtureRename[];
	/** Totals across the corpus, most common first. */
	declined: Record<string, number>;
	details: CosmosFileReport[];
}

export interface CosmosReportOptions {
	root: string;
	/** Defaults to the cosmos config's suffix, then `fixture`. */
	suffix?: string;
	exclude?: string[];
}

/**
 * Read every fixture the project has under either convention and report what
 * the move would rename and what it would decline — before anyone commits to
 * it. Exported from `uight/vite` so it can run in CI.
 */
export async function cosmosReport(options: CosmosReportOptions): Promise<CosmosReport> {
	const root = path.resolve(options.root);
	const config = readCosmosConfig(root);
	let pkg: PackageJson | null = null;
	try {
		pkg = JSON.parse(
			fs.readFileSync(path.join(root, "package.json"), "utf8"),
		) as PackageJson;
	} catch {
		pkg = null;
	}

	const suffix =
		options.suffix ??
		(typeof config?.json.fixtureFileSuffix === "string"
			? config.json.fixtureFileSuffix
			: "fixture");
	const dirName = cosmosFixturesDirName(config?.json ?? null);

	const renames = await planFixtureRenames({
		root,
		dirName,
		suffix,
		...(options.exclude ? { exclude: options.exclude } : {}),
	});

	const matched = await glob(
		[`**/*.${suffix}.{js,jsx,ts,tsx,mdx}`, `**/${dirName}/**/*.{js,jsx,ts,tsx,mdx}`],
		{
			cwd: root,
			absolute: true,
			dot: false,
			expandDirectories: false,
			ignore: ["**/node_modules/**", ...(options.exclude ?? [])],
		},
	);

	const details: CosmosFileReport[] = [];
	const totals: Record<string, number> = {};
	for (const file of [...new Set(matched)].sort()) {
		let source: string;
		try {
			source = await fsp.readFile(file, "utf8");
		} catch {
			continue;
		}
		if (!source.includes("react-cosmos")) continue;
		const rewrite = rewriteCosmosImports(source, file);
		if (!rewrite.changed && !Object.keys(rewrite.declined).length) continue;
		for (const name of Object.keys(rewrite.declined)) {
			totals[name] = (totals[name] ?? 0) + 1;
		}
		details.push({
			path: path.relative(root, file),
			renamed: rewrite.renamed,
			declined: rewrite.declined,
		});
	}

	const declined: Record<string, number> = {};
	for (const [name, count] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
		declined[name] = count;
	}

	return {
		evidence: detectCosmos(root, pkg),
		configFile: config ? path.relative(root, config.file) : null,
		translation: config ? translateCosmosConfig(config.json) : null,
		files: matched.length,
		renames,
		declined,
		details,
	};
}

/** A short human-readable summary, used by the CLI. */
export function formatCosmosReport(report: CosmosReport): string {
	const lines: string[] = [];
	lines.push(
		report.evidence.length
			? `react-cosmos found: ${report.evidence.join("; ")}`
			: "No react-cosmos found here — looked for cosmos.config.json and react-cosmos in package.json.",
	);
	lines.push(`${report.files} fixture file(s) found`);
	if (report.renames.length) {
		lines.push(
			`${report.renames.length} need renaming to carry the suffix — ` +
				"uight finds fixtures by name, not by directory",
		);
	}

	if (report.translation) {
		const { translated, dropped } = report.translation;
		lines.push("");
		lines.push(`${report.configFile}:`);
		for (const line of translated) lines.push(`  ✓ ${line}`);
		for (const [key, reason] of Object.entries(dropped))
			lines.push(`  · ${key} — ${reason}`);
		if (!translated.length && !Object.keys(dropped).length) {
			lines.push("  · every key is already a uight default");
		}
	}

	const entries = Object.entries(report.declined);
	if (entries.length) {
		lines.push("");
		lines.push("declined imports, by frequency (left in place, never rewritten):");
		const width = Math.max(...entries.map(([key]) => key.length));
		for (const [key, count] of entries) lines.push(`  ${key.padEnd(width)}  ${count}`);
	} else {
		lines.push("no unsupported cosmos imports found");
	}
	return lines.join("\n");
}
