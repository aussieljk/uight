/**
 * The index scan. SPEC.md §4.4, §3.4, §12.
 *
 * D3: **Vite owns loading, watching and HMR; we own one lightweight index
 * scan.** One tinyglobby pass at init produces the fixture list with names
 * (§3.4), the decorator list, collision detection, `hasFixtures` for
 * `production: 'error'`, and manifest counts. None of that is derivable from a
 * lazy glob expression, because the glob is transformed later and overlapping
 * patterns are deduplicated before the runtime sees them.
 *
 * The scan mirrors Vite's own `import.meta.glob` crawl exactly — `dot: false`,
 * `expandDirectories: false`, `extglob: false`, `ignore: ["**\/node_modules/**"]`,
 * `caseSensitiveMatch` from the `caseSensitive` option — so that the index and
 * the emitted glob keys cannot disagree about which files exist.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { glob } from "tinyglobby";
import { globToRegExp } from "../shared/filter.ts";
import type {
	CallSite,
	DecoratorFileIndex,
	FixtureFileIndex,
	FixtureIndex,
	IndexProblem,
	InventoryItem,
} from "../shared/types.ts";
import { groupCallSites, parseCallSites } from "./callsites.ts";
import type { ResolvedUaightConfig } from "./config.ts";
import { CODE_EXTENSIONS, FIXTURE_EXTENSIONS, escapesRoot, joinGlob, toGlobPath } from "./config.ts";
import { parseInventoryFile, toInventoryItems } from "./inventory.ts";
import { parseFixtureFile } from "./parse.ts";
import type { ParsedFixtureFile } from "./parse.ts";

/** Vite's own default. Kept in lockstep so the two crawls agree. */
const ALWAYS_IGNORE = ["**/node_modules/**"];

/* ------------------------------------------------------------------ *
 * Patterns — §4.4
 * ------------------------------------------------------------------ */

const exts = (list: readonly string[]): string => `{${list.join(",")}}`;

/** `**\/*.fixture.{js,jsx,ts,tsx,mdx}`, relative to the fixtures dir. */
export function fixturePatterns(cfg: ResolvedUaightConfig): string[] {
	return [`**/*.${cfg.fixtureFileSuffix}.${exts(FIXTURE_EXTENSIONS)}`];
}

/** `**\/{cosmos,uaight}.decorator.{js,jsx,ts,tsx}`. */
export function decoratorPatterns(cfg: ResolvedUaightConfig): string[] {
	return cfg.decoratorFileSuffixes.map(
		(suffix) => `**/${suffix}.${exts(CODE_EXTENSIONS)}`,
	);
}

/** `**\/*.stories.{js,jsx,ts,tsx}` — only when Storybook support is on (§13). */
export function storybookPatterns(cfg: ResolvedUaightConfig): string[] {
	if (!cfg.storybook) return [];
	return [`**/*.${cfg.storybook.fileSuffix}.${exts(CODE_EXTENSIONS)}`];
}

export function inventoryPatterns(cfg: ResolvedUaightConfig): string[] {
	return cfg.inventory ? [...cfg.inventory.include] : [];
}

/**
 * Files the inventory must never offer: fixtures, decorators and CSF modules
 * are already in the tree, so listing them again as "detected components"
 * would double every entry (§12 step 3 — the two shapes merge naturally). The
 * preview entry and the codec module are ours too — `Preview` is a provider
 * wrapper, not a component anybody wants to render in isolation.
 */
export function inventoryIgnore(cfg: ResolvedUaightConfig): string[] {
	const ignore = cfg.inventory ? [...cfg.inventory.exclude] : [];
	const ours = [cfg.previewEntry, cfg.codecs]
		.map((globPath) => (globPath ? insideFixturesDir(globPath, cfg) : null))
		.filter((p): p is string => p !== null);
	return [
		...ignore,
		...ours,
		...fixturePatterns(cfg),
		...decoratorPatterns(cfg),
		...storybookPatterns(cfg),
	];
}

/** A root-relative glob path re-expressed relative to the fixtures dir. */
function insideFixturesDir(
	globPath: string,
	cfg: ResolvedUaightConfig,
): string | null {
	const prefix = cfg.fixturesDirGlobPath === "/" ? "" : cfg.fixturesDirGlobPath;
	if (!globPath.startsWith(`${prefix}/`)) return null;
	return globPath.slice(prefix.length + 1);
}

/* ------------------------------------------------------------------ *
 * Root-relative patterns for emitted `import.meta.glob` calls — §4.2
 * ------------------------------------------------------------------ */

/**
 * §4.2: a glob beginning with `/` resolves against the Vite project root, and
 * Vite refuses a relative glob inside a virtual module outright. Every emitted
 * pattern therefore goes through `joinGlob(fixturesDirGlobPath, …)`.
 * Exclusions ride along as `!`-prefixed entries, which is how
 * `import.meta.glob` spells negation.
 */
export function fixtureGlobPatterns(cfg: ResolvedUaightConfig): string[] {
	return toRootRelative(
		cfg,
		[...fixturePatterns(cfg), ...storybookPatterns(cfg)],
		cfg.exclude,
	);
}

export function decoratorGlobPatterns(cfg: ResolvedUaightConfig): string[] {
	return toRootRelative(cfg, decoratorPatterns(cfg), cfg.exclude);
}

export function inventoryGlobPatterns(cfg: ResolvedUaightConfig): string[] {
	if (!cfg.inventory) return [];
	return toRootRelative(cfg, inventoryPatterns(cfg), [
		...cfg.exclude,
		...inventoryIgnore(cfg),
	]);
}

function toRootRelative(
	cfg: ResolvedUaightConfig,
	include: string[],
	exclude: string[],
): string[] {
	const dir = cfg.fixturesDirGlobPath;
	return [
		...include.map((p) => joinGlob(dir, p)),
		...exclude.map((p) => `!${joinGlob(dir, p)}`),
	];
}

/* ------------------------------------------------------------------ *
 * File classification — used by the watcher (§4.5)
 * ------------------------------------------------------------------ */

/** True for a fixture module or, when enabled, a CSF module. */
export function isFixtureFile(file: string, cfg: ResolvedUaightConfig): boolean {
	const rel = relativeToFixturesDir(file, cfg);
	if (rel === null) return false;
	if (!matchesAny(rel, [...fixturePatterns(cfg), ...storybookPatterns(cfg)], cfg)) {
		return false;
	}
	return passesFilters(rel, cfg);
}

export function isDecoratorFile(file: string, cfg: ResolvedUaightConfig): boolean {
	const rel = relativeToFixturesDir(file, cfg);
	if (rel === null) return false;
	return matchesAny(rel, decoratorPatterns(cfg), cfg) && passesFilters(rel, cfg);
}

export function isInventoryFile(file: string, cfg: ResolvedUaightConfig): boolean {
	if (!cfg.inventory) return false;
	const rel = relativeToFixturesDir(file, cfg);
	if (rel === null) return false;
	if (!matchesAny(rel, inventoryPatterns(cfg), cfg)) return false;
	if (matchesAny(rel, inventoryIgnore(cfg), cfg)) return false;
	return passesFilters(rel, cfg);
}

/** True when the file is a CSF module rather than a fixture module. §13 */
export function isCsfFile(file: string, cfg: ResolvedUaightConfig): boolean {
	const rel = relativeToFixturesDir(file, cfg);
	if (rel === null) return false;
	return matchesAny(rel, storybookPatterns(cfg), cfg);
}

function relativeToFixturesDir(
	file: string,
	cfg: ResolvedUaightConfig,
): string | null {
	const rel = path.relative(cfg.fixturesDirFsPath, path.resolve(file));
	if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return null;
	return rel.split(path.sep).join("/");
}

function matchesAny(
	rel: string,
	patterns: string[],
	cfg: ResolvedUaightConfig,
): boolean {
	return patterns.some((p) =>
		expandBraces(p).some((one) => globToRegExp(one, cfg.caseSensitive).test(rel)),
	);
}

/** `include` narrows; `exclude` and the always-ignore list remove. */
function passesFilters(rel: string, cfg: ResolvedUaightConfig): boolean {
	if (matchesAny(rel, [...ALWAYS_IGNORE, ...cfg.exclude], cfg)) return false;
	if (cfg.include.length === 0) return true;
	return matchesAny(rel, cfg.include, cfg);
}

/**
 * `{a,b}` expansion, so the shared glob matcher (which deliberately has no
 * brace support) can be reused for classification. One level is enough: every
 * pattern we generate has at most one group.
 */
function expandBraces(pattern: string): string[] {
	const match = /\{([^{}]*)\}/.exec(pattern);
	if (!match) return [pattern];
	const [full, body = ""] = match;
	const head = pattern.slice(0, match.index);
	const tail = pattern.slice(match.index + full.length);
	return body.split(",").flatMap((option) => expandBraces(`${head}${option}${tail}`));
}

/* ------------------------------------------------------------------ *
 * Display paths — §3.2
 * ------------------------------------------------------------------ */

/**
 * Display path = glob path, minus the fixtures dir prefix, minus `.{suffix}`,
 * minus the extension. `/src/components/Button.fixture.tsx` → `components/Button`.
 */
export function displayPathOf(
	globPath: string,
	cfg: ResolvedUaightConfig,
	suffix: string,
): string {
	const prefix = cfg.fixturesDirGlobPath === "/" ? "" : cfg.fixturesDirGlobPath;
	let rel = globPath.startsWith(`${prefix}/`)
		? globPath.slice(prefix.length + 1)
		: globPath.replace(/^\//, "");
	rel = rel.replace(/\.[^./]+$/, "");
	if (suffix && rel.endsWith(`.${suffix}`)) {
		rel = rel.slice(0, -(suffix.length + 1));
	}
	return rel;
}

/* ------------------------------------------------------------------ *
 * The scan
 * ------------------------------------------------------------------ */

export async function scanFixtures(
	cfg: ResolvedUaightConfig,
): Promise<FixtureIndex> {
	const problems: IndexProblem[] = [];

	// §4.2: fixtures outside the Vite root cannot be reached by a root-absolute
	// glob naming their filesystem path. Say so plainly instead of emitting a
	// glob that silently matches nothing. `server.fs.allow` does not help.
	if (escapesRoot(cfg.fixturesDirGlobPath)) {
		problems.push({
			kind: "unreadable",
			message:
				`[uaight] fixturesDir "${cfg.fixturesDirFsPath}" is outside the Vite root ` +
				`"${cfg.root}", so it cannot be reached by a root-relative glob. ` +
				`Use a resolve.alias, a different Vite root, or move the directory.`,
			files: [cfg.fixturesDirFsPath],
		});
		return { files: [], decorators: [], inventory: [], callSites: [], problems };
	}

	if (!fs.existsSync(cfg.fixturesDirFsPath)) {
		return { files: [], decorators: [], inventory: [], callSites: [], problems };
	}

	const [fixturePaths, decoratorPaths, inventoryPaths] = await Promise.all([
		run(cfg, [...fixturePatterns(cfg), ...storybookPatterns(cfg)], cfg.exclude),
		run(cfg, decoratorPatterns(cfg), cfg.exclude),
		cfg.inventory && cfg.command === "serve"
			? run(cfg, inventoryPatterns(cfg), [...cfg.exclude, ...inventoryIgnore(cfg)])
			: Promise.resolve([]),
	]);

	const files: FixtureFileIndex[] = [];
	for (const entry of await Promise.all(
		fixturePaths.map((file) => indexFixtureFile(file, cfg, problems)),
	)) {
		if (entry) files.push(entry);
	}

	const inventory: InventoryItem[] = [];
	const callSiteSources: Record<string, CallSite[]> = {};
	for (const indexed of await Promise.all(
		inventoryPaths.map((file) => indexInventoryFile(file, cfg)),
	)) {
		inventory.push(...indexed.items);
		for (const site of indexed.sites) {
			(callSiteSources[site.globPath] ??= []).push(site);
		}
	}

	const index: FixtureIndex = {
		files: sortByGlobPath(files),
		decorators: sortDecorators(decoratorPaths.map((file) => indexDecorator(file, cfg))),
		inventory,
		callSites: regroup(callSiteSources, cfg),
		callSiteSources,
		problems,
	};
	index.problems = [...problems, ...detectCollisions(index.files)];
	return index;
}

/** Every retained site, re-ranked as one corpus. */
function regroup(
	sources: Record<string, CallSite[]>,
	cfg: ResolvedUaightConfig,
): FixtureIndex["callSites"] {
	if (!cfg.callSites) return [];
	const all: CallSite[] = [];
	for (const sites of Object.values(sources)) all.push(...sites);
	return groupCallSites(all, { max: cfg.callSites.max });
}

/** §19.4 — the standalone scan. Measures parse coverage (§3.5). */
export function buildFixtureIndex(
	config: ResolvedUaightConfig,
): Promise<FixtureIndex> {
	return scanFixtures(config);
}

/** §19.4 — collisions, confinement, unparseable files. For CI. */
export async function validateFixtures(
	config: ResolvedUaightConfig,
): Promise<IndexProblem[]> {
	const index = await scanFixtures(config);
	return index.problems;
}

async function run(
	cfg: ResolvedUaightConfig,
	patterns: string[],
	exclude: string[],
): Promise<string[]> {
	if (patterns.length === 0) return [];
	const matched = await glob(patterns, {
		cwd: cfg.fixturesDirFsPath,
		absolute: true,
		// Mirror Vite's `import.meta.glob` crawl exactly.
		dot: false,
		expandDirectories: false,
		extglob: false,
		caseSensitiveMatch: cfg.caseSensitive,
		ignore: [...ALWAYS_IGNORE, ...exclude],
	});

	// `include` narrows what the patterns found. Applied here rather than as a
	// glob so it uses the same matcher the runtime filter does (§3.6).
	const included =
		cfg.include.length === 0
			? matched
			: matched.filter((file) => {
					const rel = relativeToFixturesDir(file, cfg);
					return rel !== null && matchesAny(rel, cfg.include, cfg);
				});

	return dedupeRealPaths(included).sort();
}

/**
 * The same file reached twice through a symlink is one file, not a collision.
 * A genuine display-path collision — two distinct files — is caught later.
 */
function dedupeRealPaths(files: string[]): string[] {
	const seen = new Map<string, string>();
	for (const file of files) {
		let key = file;
		try {
			key = fs.realpathSync(file);
		} catch {
			/* unreadable: fall back to the literal path */
		}
		if (!seen.has(key)) seen.set(key, file);
	}
	return [...seen.values()];
}

async function indexFixtureFile(
	file: string,
	cfg: ResolvedUaightConfig,
	problems?: IndexProblem[],
): Promise<FixtureFileIndex | null> {
	let source: string;
	try {
		source = await fsp.readFile(file, "utf8");
	} catch (err) {
		problems?.push({
			kind: "unreadable",
			message: `[uaight] could not read ${file}: ${(err as Error).message}`,
			files: [file],
		});
		return null;
	}

	const csf = isCsfFile(file, cfg);
	const suffix =
		csf && cfg.storybook ? cfg.storybook.fileSuffix : cfg.fixtureFileSuffix;
	const globPath = toGlobPath(cfg.root, file);
	const parsed = parseFixtureFile(source, file, { csf });

	if (parsed.errors.length > 0) {
		problems?.push({
			kind: "unparseable",
			message: `[uaight] could not parse ${file}: ${parsed.errors[0]}`,
			files: [file],
		});
	}

	return {
		path: displayPathOf(globPath, cfg, suffix),
		globPath,
		names: parsed.names,
		hash: hashSource(source),
		...(csf ? { csf: true } : {}),
	};
}

interface IndexedInventoryFile {
	items: InventoryItem[];
	sites: CallSite[];
}

const NO_INVENTORY: IndexedInventoryFile = { items: [], sites: [] };

async function indexInventoryFile(
	file: string,
	cfg: ResolvedUaightConfig,
): Promise<IndexedInventoryFile> {
	let source: string;
	try {
		source = await fsp.readFile(file, "utf8");
	} catch {
		return NO_INVENTORY;
	}
	const globPath = toGlobPath(cfg.root, file);
	// The inventory's display path keeps its extension-free form but has no
	// fixture suffix to strip.
	const display = displayPathOf(globPath, cfg, "");

	const items = toInventoryItems(parseInventoryFile(source, file), display, globPath);
	const sites = cfg.callSites
		? parseCallSites(source, file, {
				path: display,
				globPath,
				resolve: (specifier) => resolveSpecifier(specifier, file, cfg),
			})
		: [];

	return { items, sites };
}

/**
 * A relative import specifier → the display path it names, so a `Button` used
 * here can be told from a `Button` of the same name elsewhere.
 *
 * Only relative specifiers are resolved. A bare specifier is a package, and an
 * aliased one (`@/components/Button`) needs Vite's resolver — which would mean
 * running the plugin container during a scan that is meant to be one cheap
 * pass. Both return null, and the caller falls back to matching by name.
 */
function resolveSpecifier(
	specifier: string,
	fromFile: string,
	cfg: ResolvedUaightConfig,
): string | null {
	if (!specifier.startsWith(".")) return null;
	const absolute = path.resolve(path.dirname(fromFile), specifier);
	const globPath = toGlobPath(cfg.root, absolute);
	if (escapesRoot(globPath)) return null;
	return displayPathOf(globPath, cfg, "");
}

function indexDecorator(
	file: string,
	cfg: ResolvedUaightConfig,
): DecoratorFileIndex {
	const globPath = toGlobPath(cfg.root, file);
	const rel = relativeToFixturesDir(file, cfg) ?? "";
	const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
	return { dir, globPath, depth: dir === "" ? 0 : dir.split("/").length };
}

export function hashSource(source: string): string {
	return createHash("sha1").update(source).digest("hex").slice(0, 16);
}

function sortByGlobPath<T extends { globPath: string }>(list: T[]): T[] {
	return [...list].sort((a, b) => (a.globPath < b.globPath ? -1 : a.globPath > b.globPath ? 1 : 0));
}

/** Outermost-first composition needs shallowest-first order. §3.3 */
function sortDecorators(list: DecoratorFileIndex[]): DecoratorFileIndex[] {
	return [...list].sort(
		(a, b) => a.depth - b.depth || (a.globPath < b.globPath ? -1 : 1),
	);
}

/* ------------------------------------------------------------------ *
 * Collisions — §4.4
 * ------------------------------------------------------------------ */

/** Two files normalizing to one display path is an error naming both. §4.4 */
export function detectCollisions(files: FixtureFileIndex[]): IndexProblem[] {
	const byPath = new Map<string, string[]>();
	for (const file of files) {
		const list = byPath.get(file.path);
		if (list) list.push(file.globPath);
		else byPath.set(file.path, [file.globPath]);
	}
	const problems: IndexProblem[] = [];
	for (const [display, globPaths] of byPath) {
		if (globPaths.length < 2) continue;
		problems.push({
			kind: "collision",
			message:
				`[uaight] ${globPaths.length} files normalize to the display path ` +
				`"${display}": ${globPaths.join(", ")}. Fixture ids would be ambiguous.`,
			files: [...globPaths],
		});
	}
	return problems;
}

/* ------------------------------------------------------------------ *
 * Incremental rescan — §4.5
 * ------------------------------------------------------------------ */

/**
 * Topology changed: one file was added or unlinked. Reparse that file only,
 * never the corpus (§4.5). Called debounced and serialized by the plugin.
 */
export async function rescanIncremental(
	index: FixtureIndex,
	file: string,
	cfg: ResolvedUaightConfig,
): Promise<FixtureIndex> {
	const absolute = path.resolve(file);
	const globPath = toGlobPath(cfg.root, absolute);
	const exists = fs.existsSync(absolute);

	let files = index.files;
	let decorators = index.decorators;
	let inventory = index.inventory;
	let callSites = index.callSites;
	let callSiteSources = index.callSiteSources;

	if (isFixtureFile(absolute, cfg)) {
		files = files.filter((f) => f.globPath !== globPath);
		if (exists) {
			const entry = await indexFixtureFile(absolute, cfg);
			if (entry) files = sortByGlobPath([...files, entry]);
		}
	}

	if (isDecoratorFile(absolute, cfg)) {
		decorators = decorators.filter((d) => d.globPath !== globPath);
		if (exists) {
			decorators = sortDecorators([...decorators, indexDecorator(absolute, cfg)]);
		}
	}

	if (cfg.command === "serve" && isInventoryFile(absolute, cfg)) {
		inventory = inventory.filter((i) => i.globPath !== globPath);
		const sources = { ...callSiteSources };
		delete sources[globPath];

		if (exists) {
			const indexed = await indexInventoryFile(absolute, cfg);
			inventory = [...inventory, ...indexed.items];
			if (indexed.sites.length) sources[globPath] = indexed.sites;
		}

		// Re-rank against the whole retained corpus rather than patching one
		// group: a site's rank is relative to its siblings, so a file that just
		// gained the most distinct usage of a component has to be able to
		// displace one that was already there.
		callSiteSources = sources;
		callSites = regroup(sources, cfg);
	}

	const carried = index.problems.filter(
		(p) => p.kind !== "collision" && !p.files.includes(absolute),
	);
	const next: FixtureIndex = {
		files,
		decorators,
		inventory,
		callSites,
		problems: [...carried, ...detectCollisions(files)],
	};
	if (callSiteSources) next.callSiteSources = callSiteSources;
	return next;
}

/* ------------------------------------------------------------------ *
 * Content change — §4.5
 * ------------------------------------------------------------------ */

/**
 * A content edit only matters to the index when the name list moved. Fast
 * Refresh handles everything else, and re-sending the index on every keystroke
 * would make the tree flicker.
 */
export function namesChanged(
	index: FixtureIndex,
	file: string,
	parsed: ParsedFixtureFile,
	cfg: ResolvedUaightConfig,
): boolean {
	const globPath = toGlobPath(cfg.root, path.resolve(file));
	const existing = index.files.find((f) => f.globPath === globPath);
	if (!existing) return true;
	return !sameNames(existing.names, parsed.names);
}

function sameNames(
	a: Array<string | null> | null,
	b: Array<string | null> | null,
): boolean {
	if (a === null || b === null) return a === b;
	return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Write a fresh parse of one file into the index, keeping it sorted. */
export function applyParse(
	index: FixtureIndex,
	file: string,
	parsed: ParsedFixtureFile,
	cfg: ResolvedUaightConfig,
	source: string,
): FixtureIndex {
	const absolute = path.resolve(file);
	const globPath = toGlobPath(cfg.root, absolute);
	const csf = isCsfFile(absolute, cfg);
	const suffix =
		csf && cfg.storybook ? cfg.storybook.fileSuffix : cfg.fixtureFileSuffix;

	const entry: FixtureFileIndex = {
		path: displayPathOf(globPath, cfg, suffix),
		globPath,
		names: parsed.names,
		hash: hashSource(source),
		...(csf ? { csf: true } : {}),
	};

	const files = sortByGlobPath([
		...index.files.filter((f) => f.globPath !== globPath),
		entry,
	]);
	const next: FixtureIndex = {
		files,
		decorators: index.decorators,
		inventory: index.inventory,
		callSites: index.callSites,
		problems: [
			...index.problems.filter((p) => p.kind !== "collision"),
			...detectCollisions(files),
		],
	};
	if (index.callSiteSources) next.callSiteSources = index.callSiteSources;
	return next;
}

/* ------------------------------------------------------------------ *
 * Wire shape for the `uaight:index` custom event — §4.5
 * ------------------------------------------------------------------ */

/**
 * Invalidating a virtual module in the server graph does not by itself cause
 * the browser to re-import it, so topology changes travel as data over a
 * namespaced custom event. This is that payload.
 */
export function serializeIndex(index: FixtureIndex): FixtureIndex {
	// `callSiteSources` is deliberately absent: it is the Node-side working set
	// the ranking is derived from, and sending it would put the whole corpus's
	// raw usages on the wire on every topology change.
	return {
		files: index.files,
		decorators: index.decorators,
		inventory: index.inventory,
		callSites: index.callSites,
		problems: index.problems,
	};
}

/** Parse-coverage statistics. §3.5 makes coverage a performance metric. */
export function indexStats(index: FixtureIndex): {
	files: number;
	fixtures: number;
	undecidable: number;
	decorators: number;
	components: number;
	coverage: number;
} {
	let fixtures = 0;
	let undecidable = 0;
	for (const file of index.files) {
		if (file.names === null) undecidable++;
		else fixtures += Math.max(file.names.length, 1);
	}
	return {
		files: index.files.length,
		fixtures,
		undecidable,
		decorators: index.decorators.length,
		components: index.inventory.length,
		coverage:
			index.files.length === 0
				? 1
				: (index.files.length - undecidable) / index.files.length,
	};
}
