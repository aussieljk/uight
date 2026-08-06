/**
 * Plugin configuration resolution. SPEC.md §4.1, §4.2, §4.5.
 *
 * Everything has a default (D4). `uight.config.json` is optional and most
 * projects never create one.
 *
 * Two rules this module exists to enforce:
 *
 *   1. Options resolve in the `config()` hook, never by mutating
 *      `ResolvedConfig` (§4.5). Nothing here touches Vite state.
 *   2. §4.2's two path representations are separate fields and are never
 *      interchanged: `fixturesDirFsPath` is for the filesystem scan,
 *      `fixturesDirGlobPath` is for emitted `import.meta.glob` patterns.
 */

import fs from "node:fs";
import path from "node:path";
import type { StorybookSupport, UightPluginOptions } from "../shared/types.ts";

/* ------------------------------------------------------------------ *
 * Defaults — §4.1
 * ------------------------------------------------------------------ */

export const DEFAULT_ROUTE = "/uight";
export const DEFAULT_FIXTURES_DIR = "src";
export const DEFAULT_FIXTURE_FILE_SUFFIX = "fixture";
export const DEFAULT_DECORATOR_FILE_SUFFIX = "cosmos.decorator|uight.decorator";
export const DEFAULT_STORYBOOK_FILE_SUFFIX = "stories";
export const DEFAULT_DOCS_FILE_SUFFIX = "docs";
export const DEFAULT_CONFIG_FILE = "uight.config.json";

/** Module extensions a fixture file may use. §4.4 */
export const FIXTURE_EXTENSIONS = ["js", "jsx", "ts", "tsx", "mdx"] as const;
/** Decorators and CSF modules are code, never MDX. */
export const CODE_EXTENSIONS = ["js", "jsx", "ts", "tsx"] as const;

const DEFAULT_EXCLUDE = ["**/node_modules/**"];

/** Sites kept per component after ranking. Enough to show variety, few enough to scan. */
export const DEFAULT_CALL_SITE_MAX = 8;

/**
 * Set by `buildStatic()` for the duration of a static explorer build, and the
 * one thing that can override `production` from outside the config.
 *
 * A static build exists to ship the explorer, so `production: 'exclude'` — the
 * right default for an application bundle — would produce an empty page. An
 * inline plugin cannot reach into another plugin's options, and a second
 * `uight()` would mean two plugins claiming the same virtual modules, so the
 * signal travels through the environment where both can see it.
 */
export const STATIC_ENV = "UIGHT_STATIC";

/** Where a Storybook config lives, in the order Storybook itself looks. */
const STORYBOOK_DIRS = [".storybook", "storybook"];

const DEFAULT_INVENTORY_INCLUDE = ["**/*.{jsx,tsx}"];
const DEFAULT_INVENTORY_EXCLUDE = [
	"**/node_modules/**",
	"**/*.d.ts",
	"**/*.test.*",
	"**/*.spec.*",
	"**/*.bench.*",
	"**/__tests__/**",
	"**/__mocks__/**",
];

/** The declared CSF subset. §13 */
const STORYBOOK_SUPPORT_DEFAULTS: Required<NonNullable<StorybookSupport["support"]>> = {
	metaArgs: true,
	storyArgs: true,
	argTypes: true,
	render: true,
	metaDecorators: true,
	storyDecorators: true,
	globalDecorators: false,
	parameters: "viewport-only",
	globals: false,
	loaders: false,
	play: false,
};

/* ------------------------------------------------------------------ *
 * The resolved shape
 * ------------------------------------------------------------------ */

export interface ResolvedUightConfig {
	root: string;
	command: "serve" | "build";
	route: string | false;

	/** Absolute filesystem path — for the scan. §4.2 */
	fixturesDirFsPath: string;
	/** Vite-root-relative, leading slash — for emitted globs. §4.2 */
	fixturesDirGlobPath: string;

	fixtureFileSuffix: string;
	decoratorFileSuffixes: string[];

	/** Globs relative to the fixtures dir. Empty `include` means "everything". */
	include: string[];
	exclude: string[];
	caseSensitive: boolean;

	inventory: false | { include: string[]; exclude: string[] };

	/** Call-site harvesting, and how many sites to keep per component. */
	callSites: false | { max: number };

	/**
	 * Vite's string aliases, normalized, longest-first-agnostic. Internal: it is
	 * read by exactly one thing, the call-site pass, so that `@/components/Button`
	 * names the same component as `../components/Button`.
	 *
	 * It is not a `UightPluginOptions` field. The plugin fills it from
	 * `userConfig.resolve.alias` in `config()` — where the initial scan runs —
	 * and reconciles it against `configResolved`'s table afterwards, because
	 * another plugin may have added entries in between.
	 */
	aliases: ResolvedAlias[];

	/** Root-relative import specifier (`/src/uight.preview.tsx`). §4.2 */
	previewEntry?: string;
	/** Absolute filesystem path — it becomes a Rollup HTML input. §6.6 */
	previewHtmlPath?: string;
	/** Root-relative import specifier. §7.7 */
	codecs?: string;

	index: "static" | "warm" | "lazy";
	production: "exclude" | "include" | "error";

	storybook:
		| false
		| (Required<NonNullable<StorybookSupport["support"]>> & {
				fileSuffix: string;
		  });

	/**
	 * Root-relative import specifier for a Storybook `preview` module (§4.2), or
	 * undefined when there is none to load.
	 */
	storybookPreview?: string;

	docgen: boolean;

	/**
	 * MDX documentation pages (§14) — `**\/*.docs.mdx` by default.
	 *
	 * `false` turns them off entirely, which is what a project that writes its
	 * docs somewhere else wants: the pattern is one more glob on every scan.
	 */
	docs: false | { fileSuffix: string };

	/** Absolute path to `uight.config.json`, when one is in play. */
	configFile?: string;
}

/* ------------------------------------------------------------------ *
 * `defineUightConfig` — §19.4
 * ------------------------------------------------------------------ */

/**
 * Identity helper that types a `uight.config.ts`:
 *
 * ```ts
 * import { defineUightConfig } from "@aussieljk/uight/vite";
 * export default defineUightConfig({ fixturesDir: "app" });
 * ```
 *
 * A `.ts` config cannot be read synchronously by the plugin, so import it into
 * your Vite config and pass it to `uight()`. The file the plugin discovers on
 * its own is `uight.config.json` (§4.1).
 */
export function defineUightConfig(config: UightPluginOptions): UightPluginOptions {
	return config;
}

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Aliases — the call-site pass's half of Vite's resolver
 * ------------------------------------------------------------------ */

export interface ResolvedAlias {
	find: string;
	replacement: string;
}

/**
 * Vite's `resolve.alias` in either of the two shapes it accepts — a record or
 * an array of entries — reduced to the string ones.
 *
 * RegExp finds are dropped rather than approximated. A regex alias can rewrite
 * any part of a specifier, and half-implementing that produces a *wrong* module
 * path rather than no answer; Vite's own internal aliases are all RegExp, so
 * dropping them also keeps the table to what the user wrote.
 */
export function normalizeAliases(alias: unknown): ResolvedAlias[] {
	const out: ResolvedAlias[] = [];
	const push = (find: unknown, replacement: unknown): void => {
		if (typeof find !== "string" || typeof replacement !== "string") return;
		if (find === "") return;
		out.push({ find, replacement });
	};

	if (Array.isArray(alias)) {
		for (const entry of alias as Array<Record<string, unknown>>) {
			if (entry && typeof entry === "object") push(entry.find, entry.replacement);
		}
	} else if (alias && typeof alias === "object") {
		for (const [find, replacement] of Object.entries(alias)) push(find, replacement);
	}

	return out.sort((a, b) => a.find.localeCompare(b.find));
}

/** True when two alias tables would resolve every specifier identically. */
export function sameAliases(a: ResolvedAlias[], b: ResolvedAlias[]): boolean {
	return (
		a.length === b.length &&
		a.every(
			(entry, i) => entry.find === b[i]?.find && entry.replacement === b[i]?.replacement,
		)
	);
}

export interface ResolveUightConfigOptions {
	root: string;
	options: UightPluginOptions;
	command: "serve" | "build";
	/** Vite's `resolve.alias`, in whichever shape the config carries it. */
	alias?: unknown;
	/**
	 * Internal. Pre-read `uight.config.json` source, used by the watcher path
	 * so a reload never re-reads a file mid-save (§4.5).
	 */
	configSource?: string;
	/** Internal. Reports a bad config file without throwing. */
	onProblem?: (message: string) => void;
}

export function resolveUightConfig(opts: ResolveUightConfigOptions): ResolvedUightConfig {
	const root = path.resolve(opts.root);
	const configFile = findConfigFile(root, opts.options.configPath);

	const fileOptions = readConfigFile(configFile, opts.configSource, (msg) => {
		opts.onProblem?.(msg);
	});

	// Inline plugin options win over the config file: what is written in
	// `vite.config.ts` is the more specific statement of intent.
	const o: UightPluginOptions = { ...fileOptions, ...opts.options };

	const fixturesDir = o.fixturesDir ?? DEFAULT_FIXTURES_DIR;
	const fixturesDirFsPath = path.resolve(root, fixturesDir);

	// Discovery runs before support resolution: finding a preview module is what
	// makes global decorators supportable, so it has to be known first.
	const storybookPreview = resolveStorybookPreview(root, o.storybook);

	return {
		root,
		command: opts.command,
		route: normalizeRoute(o.route),

		fixturesDirFsPath,
		fixturesDirGlobPath: toGlobPath(root, fixturesDirFsPath),

		fixtureFileSuffix: (o.fixtureFileSuffix ?? DEFAULT_FIXTURE_FILE_SUFFIX)
			.replace(/^\.+/, "")
			.trim(),
		decoratorFileSuffixes: (o.decoratorFileSuffix ?? DEFAULT_DECORATOR_FILE_SUFFIX)
			.split("|")
			.map((s) => s.replace(/^\.+/, "").trim())
			.filter(Boolean),

		include: [...(o.include ?? [])],
		exclude: [...(o.exclude ?? DEFAULT_EXCLUDE)],
		caseSensitive: o.caseSensitive ?? true,

		inventory: resolveInventory(o.inventory),
		callSites: resolveCallSites(o.callSites),
		aliases: normalizeAliases(opts.alias),

		previewEntry: o.previewEntry
			? toGlobPath(root, path.resolve(root, o.previewEntry))
			: undefined,
		previewHtmlPath: o.previewHtmlPath ? path.resolve(root, o.previewHtmlPath) : undefined,
		codecs: o.codecs ? toGlobPath(root, path.resolve(root, o.codecs)) : undefined,

		index: o.index ?? "warm",
		production: process.env[STATIC_ENV] === "1" ? "include" : (o.production ?? "exclude"),

		storybook: resolveStorybook(o.storybook, Boolean(storybookPreview)),
		storybookPreview,

		docgen: o.docgen ?? false,
		docs: resolveDocs(o.docs),

		configFile,
	};
}

function resolveCallSites(
	value: UightPluginOptions["callSites"],
): false | { max: number } {
	if (value === false) return false;
	if (value === true || value === undefined) return { max: DEFAULT_CALL_SITE_MAX };
	return { max: Math.max(1, value.max ?? DEFAULT_CALL_SITE_MAX) };
}

/**
 * Find the Storybook preview module. `.storybook/preview.{ts,tsx,js,jsx}` is
 * the convention every Storybook install follows, so discovery needs no
 * configuration in the common case — which is the point: the drop-in story is
 * "point uight at the repo you have".
 *
 * Returns a root-relative specifier (§4.2's glob-path form) so the virtual
 * module can import it, or undefined when there is nothing to load.
 */
function resolveStorybookPreview(
	root: string,
	value: UightPluginOptions["storybook"],
): string | undefined {
	if (!value) return undefined;
	const declared = value === true ? undefined : value.preview;
	if (declared === false) return undefined;

	if (typeof declared === "string") {
		const file = path.resolve(root, declared);
		return fs.existsSync(file) ? toGlobPath(root, file) : undefined;
	}

	for (const dir of STORYBOOK_DIRS) {
		for (const ext of CODE_EXTENSIONS) {
			const candidate = path.join(root, dir, `preview.${ext}`);
			if (fs.existsSync(candidate)) return toGlobPath(root, candidate);
		}
	}
	return undefined;
}

/**
 * Docs pages are on by default and cost nothing when a project has none: the
 * glob simply matches no files. Off is for a project that keeps `.docs.mdx`
 * files it does not want the explorer listing.
 */
function resolveDocs(value: UightPluginOptions["docs"]): ResolvedUightConfig["docs"] {
	if (value === false) return false;
	const suffix = value === true || value === undefined ? undefined : value.fileSuffix;
	return { fileSuffix: (suffix ?? DEFAULT_DOCS_FILE_SUFFIX).replace(/^\.+/, "").trim() };
}

function resolveInventory(
	value: UightPluginOptions["inventory"],
): false | { include: string[]; exclude: string[] } {
	// Default true — this is the zero-config experience (D4, §12).
	if (value === false) return false;
	if (value === true || value === undefined) {
		return {
			include: [...DEFAULT_INVENTORY_INCLUDE],
			exclude: [...DEFAULT_INVENTORY_EXCLUDE],
		};
	}
	return {
		include: [...(value.include ?? DEFAULT_INVENTORY_INCLUDE)],
		exclude: [...(value.exclude ?? DEFAULT_INVENTORY_EXCLUDE)],
	};
}

/**
 * `hasPreview` flips `globalDecorators` on by default.
 *
 * §13 declined them "by construction: `.storybook/preview` is never loaded".
 * Once it *is* loaded the construction no longer holds, and continuing to
 * decline them would badge every story in a repository for a feature that now
 * works. An explicit `support.globalDecorators` still wins in both directions.
 */
function resolveStorybook(
	value: UightPluginOptions["storybook"],
	hasPreview: boolean,
): ResolvedUightConfig["storybook"] {
	if (!value) return false;
	if (value === true) {
		return {
			...STORYBOOK_SUPPORT_DEFAULTS,
			globalDecorators: hasPreview,
			fileSuffix: DEFAULT_STORYBOOK_FILE_SUFFIX,
		};
	}
	return {
		...STORYBOOK_SUPPORT_DEFAULTS,
		globalDecorators: hasPreview,
		...value.support,
		fileSuffix: (value.fileSuffix ?? DEFAULT_STORYBOOK_FILE_SUFFIX)
			.replace(/^\.+/, "")
			.trim(),
	};
}

function normalizeRoute(route: UightPluginOptions["route"]): string | false {
	if (route === false) return false;
	const value = route ?? DEFAULT_ROUTE;
	const withSlash = value.startsWith("/") ? value : `/${value}`;
	const trimmed = withSlash.replace(/\/+$/, "");
	return trimmed === "" ? "/" : trimmed;
}

/* ------------------------------------------------------------------ *
 * §4.2 — the two path representations
 * ------------------------------------------------------------------ */

/**
 * Filesystem path → Vite-root-relative glob path with a leading slash.
 *
 * A glob beginning with `/` resolves against the **Vite project root**, not the
 * filesystem. Consequently a directory outside the root cannot be reached by a
 * root-absolute glob naming its filesystem path; the caller detects that by
 * checking for a `..` segment and reports it rather than emitting a glob that
 * silently matches nothing (§4.2).
 */
export function toGlobPath(root: string, fsPath: string): string {
	const rel = path.relative(root, fsPath).split(path.sep).join("/");
	if (rel === "" || rel === ".") return "/";
	return `/${rel}`;
}

/** True when the path escapes the Vite root and cannot be globbed. §4.2 */
export function escapesRoot(globPath: string): boolean {
	return globPath === "/.." || globPath.startsWith("/../");
}

/** Join a root-relative glob dir with a pattern relative to it. */
export function joinGlob(dirGlobPath: string, pattern: string): string {
	if (pattern.startsWith("/")) return pattern;
	const base = dirGlobPath === "/" ? "" : dirGlobPath;
	return `${base}/${pattern}`;
}

/* ------------------------------------------------------------------ *
 * Config file — discovery, reading, safe reload (§4.5)
 * ------------------------------------------------------------------ */

function findConfigFile(
	root: string,
	configPath: UightPluginOptions["configPath"],
): string | undefined {
	if (configPath === false) return undefined;
	if (typeof configPath === "string") return path.resolve(root, configPath);
	const candidate = path.join(root, DEFAULT_CONFIG_FILE);
	return fs.existsSync(candidate) ? candidate : undefined;
}

function readConfigFile(
	file: string | undefined,
	preRead: string | undefined,
	onProblem: (message: string) => void,
): UightPluginOptions {
	// A pre-read source is authoritative: the watcher already has the bytes,
	// and re-reading the file would race the editor save (§4.5).
	if (preRead !== undefined) {
		return parseConfigSource(preRead, file ?? DEFAULT_CONFIG_FILE, onProblem);
	}
	if (!file) return {};
	let source: string;
	try {
		source = fs.readFileSync(file, "utf8");
	} catch {
		// A declared-but-missing config file is worth saying out loud; a
		// discovered one cannot be missing, because discovery stat'd it.
		onProblem(`[uight] could not read ${file}`);
		return {};
	}
	return parseConfigSource(source, file, onProblem);
}

function parseConfigSource(
	source: string,
	file: string,
	onProblem: (message: string) => void,
): UightPluginOptions {
	if (source.trim() === "") return {};
	try {
		const parsed: unknown = JSON.parse(source);
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
			onProblem(`[uight] ${file} must contain a JSON object`);
			return {};
		}
		return parsed as UightPluginOptions;
	} catch (err) {
		onProblem(`[uight] ${file} is not valid JSON: ${(err as Error).message}`);
		return {};
	}
}

/**
 * Reload after a `uight.config.json` edit, using the content the watcher
 * handed us rather than re-reading the file (§4.5 — a raw read races an
 * editor save). A config that fails to parse leaves the previous one in
 * force; a half-applied config is worse than a stale one.
 */
export function safeReloadConfig(
	prev: ResolvedUightConfig,
	source: string,
	options: UightPluginOptions,
	onProblem?: (message: string) => void,
): ResolvedUightConfig {
	let failed = false;
	const next = resolveUightConfig({
		root: prev.root,
		options,
		command: prev.command,
		// Aliases come from the Vite config, not from ours, so a `uight.config.json`
		// reload must carry the table it already has rather than lose it.
		alias: prev.aliases,
		configSource: source,
		onProblem: (message) => {
			failed = true;
			onProblem?.(message);
		},
	});
	return failed ? prev : next;
}

/* ------------------------------------------------------------------ *
 * Structural comparison — §4.1
 * ------------------------------------------------------------------ */

/**
 * Structural options determine middleware and watcher wiring, which cannot be
 * safely rebuilt in place. §4.1 names `route`, `fixturesDir`, `include`,
 * `exclude`, `previewEntry`, `previewHtmlPath`, `codecs` and `inventory`; the
 * file-suffix and case-sensitivity options are added here for the same reason
 * — they decide which paths the watcher and the emitted globs cover.
 */
const STRUCTURAL_FIELDS = [
	"route",
	"fixturesDirFsPath",
	"fixturesDirGlobPath",
	"fixtureFileSuffix",
	"decoratorFileSuffixes",
	"include",
	"exclude",
	"caseSensitive",
	"inventory",
	"callSites",
	"previewEntry",
	"previewHtmlPath",
	"storybookPreview",
	"codecs",
	"configFile",
] as const satisfies ReadonlyArray<keyof ResolvedUightConfig>;

/** True when moving from `a` to `b` requires a dev-server restart. §4.1 */
export function isStructural(a: ResolvedUightConfig, b: ResolvedUightConfig): boolean {
	return STRUCTURAL_FIELDS.some((key) => !deepEqual(a[key], b[key]));
}

/** The structural fields that actually differ. Used to word the warning. */
export function structuralDiff(a: ResolvedUightConfig, b: ResolvedUightConfig): string[] {
	return STRUCTURAL_FIELDS.filter((key) => !deepEqual(a[key], b[key]));
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
		return false;
	}
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
	}
	const ak = Object.keys(a as Record<string, unknown>);
	const bk = Object.keys(b as Record<string, unknown>);
	if (ak.length !== bk.length) return false;
	return ak.every((k) =>
		deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
	);
}
