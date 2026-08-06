/**
 * Ejection registry. SPEC.md §11.
 *
 *   bun run scripts/build-registry.ts [--skip-missing] [--source-dir <dir>] [--out-dir <dir>]
 *
 * Emits shadcn-compatible registry items into `registry/`: one JSON per
 * ejectable item (§11.3), plus the index and a versioned copy (§11.1).
 *
 * Three things here are load-bearing and easy to get wrong:
 *
 *   - `registryDependencies` must be namespaced. A bare `"tree-item"` resolves
 *     against shadcn's own registry and installs somebody else's component.
 *     The versioned copies use a per-minor namespace rather than a namespace
 *     alone, because §11.1 says items may only be combined within one minor —
 *     and rather than an absolute URL, because an absolute URL cannot be
 *     pointed at a mirror and makes the pinned items untestable until
 *     `uight.dev` is deployed.
 *   - Every emitted file carries a header naming the project, version and
 *     licence (§11.4). Repository-level licensing does not travel into another
 *     repository; the file has to say so itself.
 *   - **Import specifiers are rewritten at emit time.** The sources are written
 *     for this repository and say `../../shared/types.ts` and `../cx.ts`; those
 *     paths do not exist in a consumer's project, so an installed file that
 *     kept them would resolve, install, and then fail to compile. See
 *     `PUBLISHED_ENTRY` and `COMPANION_FILE` below. An unmapped relative specifier fails the build:
 *     silent passthrough is exactly how that defect survived a real
 *     `shadcn add` (ROADMAP Q8).
 *
 * Sources are read at run time from `src/ui/chrome/`, which the UI owns. A
 * missing file is a hard failure naming every one that is missing, because a
 * registry that silently ships eight of nine items is worse than one that
 * refuses to build.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { UIGHT_VERSION } from "../src/shared/version.ts";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PROJECT = "uight";
const LICENCE = "MIT";
const HOMEPAGE = "https://uight.dev";
const NAMESPACE = "@uight";

/**
 * shadcn publishes two schemas: `registry.json` describes the index, and
 * `registry-item.json` describes a single item. §11.2's example names the
 * former on an item, which does not validate — see NOTES.md.
 */
const SCHEMA_REGISTRY = "https://ui.shadcn.com/schema/registry.json";
const SCHEMA_ITEM = "https://ui.shadcn.com/schema/registry-item.json";

/** Where the shared token stylesheet lands in the consumer's project. §10.3 */
const TOKENS_TARGET = "~/styles/uight-chrome.css";
const TOKENS_PATH = "styles/uight-chrome.css";

/**
 * Every emitted source file — components and their companions alike — is
 * published under one flat directory.
 *
 * This is not cosmetic. shadcn v4 does not promise to preserve the directory
 * part of an item's `path`: observed behaviour is that a `registry:component`
 * lands in the `components` alias under its BASE NAME, so `ui/a/X.tsx` and
 * `ui/b/Y.tsx` both end up in `components/`. A layout that only works if the
 * directories survive would break sibling imports (`control-panel` importing
 * `control-panel-inputs`) on exactly that behaviour. Emitting one flat
 * directory makes both readings agree: whether shadcn keeps `uight/` or
 * flattens to the base name, every file lands in the SAME directory as every
 * other, so a `./sibling.ts` specifier resolves either way.
 */
const EMIT_DIR = "uight";

/* ------------------------------------------------------------------ *
 * §11.3 — what is ejectable
 *
 * "Anything that renders chrome is ejectable; anything that defines fixture
 * semantics or owns the realm is not." FrameHost, RendererBootstrap,
 * FrameTransport, the overlay store and the serializer are deliberately absent.
 * ------------------------------------------------------------------ */

export interface Ejectable {
	/** Registry item name. */
	name: string;
	/** Component and source file base name, under the chrome source directory. */
	component: string;
	title: string;
	description: string;
	/** Bare names; namespaced, or pinned to a minor namespace, at emit time. */
	registryDependencies: string[];
}

export const EJECTABLE: readonly Ejectable[] = [
	{
		name: "preview-shell",
		component: "PreviewShell",
		title: "Preview Shell",
		description:
			"The frame around a fixture: borders, background, toolbar slot and loading presentation. Reads useUightChrome().status for loading and error, and .viewport for the current preset.",
		registryDependencies: [],
	},
	{
		name: "fixture-tree",
		component: "FixtureTree",
		title: "Fixture Tree",
		description:
			"Hierarchical navigation for fixtures. Reads useUightChrome().fixtureTree and reports selection through onSelect.",
		registryDependencies: [],
	},
	{
		name: "control-panel",
		component: "ControlPanel",
		title: "Control Panel",
		description:
			"Groups the inputs a fixture registered, with their overlay values. Reads useUightChrome().inputs and reports edits through onSet and onReset, including how many patches no longer apply.",
		registryDependencies: ["control-panel-inputs"],
	},
	{
		name: "control-panel-inputs",
		component: "ControlPanelInputs",
		title: "Control Panel Inputs",
		description:
			"Type-appropriate editors for one registered input: text, number with step, checkbox, date, select, and a collapsible tree for arrays and objects. Keyboard-navigable throughout (§7.5).",
		registryDependencies: [],
	},
	{
		name: "viewport-toolbar",
		component: "ViewportToolbar",
		title: "Viewport Toolbar",
		description:
			"Viewport preset switcher. Reads useUightChrome().viewport and renders disabled under inline isolation, where the width is a CSS box and the fixture's media queries still see the page (§6.5).",
		registryDependencies: [],
	},
	{
		name: "toolbar",
		component: "Toolbar",
		title: "Toolbar",
		description:
			"The chrome's top bar: a layout container for the viewport controls, the theme control and anything you add.",
		registryDependencies: [],
	},
	{
		name: "empty-state",
		component: "EmptyState",
		title: "Empty State",
		description:
			"Shown when nothing is selected, when a filter matches nothing, or when a well-formed fixture id is not known — which §5.4 preserves rather than discards, because it may become valid after HMR.",
		registryDependencies: [],
	},
	{
		name: "error-state",
		component: "ErrorState",
		title: "Error State",
		description:
			"Renders a RendererError — fixture, decorator, bootstrap, module or protocol — with an optional retry. Reads useUightChrome().status.error.",
		registryDependencies: [],
	},
	{
		name: "inventory-list",
		component: "InventoryList",
		title: "Inventory List",
		description:
			"Components detected without fixtures (§12). Selecting one renders its real code in frame isolation; the first-run safety notice is part of this component and its wording is specified.",
		registryDependencies: [],
	},
	{
		name: "prop-table",
		component: "PropTable",
		title: "Prop Table",
		description:
			"The documented props of the selected component: name, type, default, required and description, with react-docgen's limitations named rather than hidden (§13).",
		registryDependencies: [],
	},
	{
		name: "command-palette",
		component: "CommandPalette",
		title: "Command Palette",
		description:
			"⌘K over every fixture, detected component and harvested call site. Receives a list that is already filtered and ranked, so a replacement never has to reimplement the matcher.",
		registryDependencies: [],
	},
];

/* ------------------------------------------------------------------ *
 * Specifier rewriting — the difference between "installs" and "compiles"
 *
 * A source under `src/ui/chrome/` imports three kinds of thing:
 *
 *   1. External packages (`react`). Left alone — the consumer already has them.
 *   2. Symbols that uight publishes. Rewritten to the published entry point.
 *      `uight/chrome` is the one used throughout: §11.4 makes it the frozen
 *      surface, so an ejected component that reaches for nothing else is an
 *      ejected component that cannot be broken by a minor. Where a symbol was
 *      not yet exported from there it was ADDED to `src/chrome/index.ts` — a
 *      published-surface addition, which is the honest fix, rather than
 *      reaching into `uight/runtime` for something the renderer does not own.
 *   3. Repository-internal helpers with no published home (`cx.ts`, the
 *      `wire-view` formatters, …). These are emitted as COMPANION FILES in the
 *      same item, so the relative import still resolves after install. They are
 *      yours-now code too, which is the point of ejection.
 *
 * Keys are the specifier NORMALISED against the chrome source directory, so
 * one table covers both a component's `../cx.ts` and a companion's own
 * `../shared/types.ts` (both of which resolve to the same file).
 * ------------------------------------------------------------------ */

/** Internal file → the published entry point that re-exports its symbols. */
const PUBLISHED_ENTRY: Readonly<Record<string, string>> = {
	// Every prop and wire type a chrome component names is re-exported from the
	// frozen surface. See `src/chrome/index.ts`.
	"../../shared/types.ts": "@aussieljk/uight/chrome",
	// `applyPatches` / `pathKey` — overlay arithmetic the control panel does in
	// the UI realm. Added to `uight/chrome` for this.
	"../../shared/wire.ts": "@aussieljk/uight/chrome",
	// `fixtureIdsEqual` / `serializeFixtureId` — the tree compares ids. `uight`
	// exports the serializer but not the comparison; both added to the frozen
	// surface so an ejected tree needs exactly one import source.
	"../../shared/fixture-id.ts": "@aussieljk/uight/chrome",
	// `builtinCodecEditors`. Deliberately NOT on `uight/runtime` (Q6: editors
	// render in the UI realm, §7.7, and re-exporting them there would pull every
	// editor into the renderer chunk). `uight/chrome` IS the UI realm, so that
	// is where it belongs.
	"../../runtime/codec-editors.tsx": "@aussieljk/uight/chrome",
	// The facade itself. §11.4.
	"../chrome-context.ts": "@aussieljk/uight/chrome",
};

/**
 * Internal file → the base name it is published under, beside the component.
 *
 * Base names must be unique across the whole set, since everything lands in one
 * directory (`EMIT_DIR`). Asserted below rather than trusted.
 */
const COMPANION_FILE: Readonly<Record<string, string>> = {
	"../cx.ts": "cx.ts",
	"../dropped.ts": "dropped.ts",
	"../docs.ts": "docs.ts",
	"../constants.ts": "constants.ts",
	"../wire-view.ts": "wire-view.ts",
	"../Overlay.tsx": "Overlay.tsx",
};

{
	const seen = new Set<string>();
	for (const base of Object.values(COMPANION_FILE)) {
		if (seen.has(base)) {
			throw new Error(`[uight] companion base name collides in one directory: ${base}`);
		}
		seen.add(base);
	}
}

/**
 * Find the specifier of every static/dynamic import and re-export.
 *
 * Deliberately not a parser: the decision is made by `SPECIFIER_MAP`, and this
 * only has to locate the strings. A specifier this misses is caught by the
 * guard below, which rejects any relative specifier left in the output — so the
 * failure mode is a loud build, not a broken install.
 */
const SPECIFIER_RE = /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)(["'])([^"']+)\2/g;

/**
 * Drop the extension from an emitted specifier.
 *
 * This repository writes `./cx.ts`, which needs `allowImportingTsExtensions`.
 * A consumer's tsconfig is not ours to choose — Next.js's default does not set
 * it — and every shadcn item in the ecosystem is extensionless, so an ejected
 * file is written the way the project it lands in already writes imports.
 */
function bare(base: string): string {
	return base.replace(/\.tsx?$/, "");
}

/** Normalise a specifier to a key in the tables above: relative to `sourceDir`. */
function specifierKey(sourceDir: string, importer: string, spec: string): string {
	const abs = path.resolve(path.dirname(importer), spec);
	return path.relative(sourceDir, abs).split(path.sep).join("/");
}

interface Rewritten {
	content: string;
	/** Keys of internal files that must be emitted alongside this one. */
	companions: string[];
}

/**
 * Rewrite one file's relative specifiers, and report the companions it needs.
 *
 * `siblings` maps a normalised key of another EJECTABLE's source to the base
 * name it is published under. Those are pulled in by `registryDependencies`,
 * not copied, so they are rewritten but not collected.
 */
export function rewriteSpecifiers(opts: {
	sourceDir: string;
	/** Absolute path of the file being rewritten. */
	importer: string;
	content: string;
	siblings: ReadonlyMap<string, string>;
}): Rewritten {
	const { sourceDir, importer, content, siblings } = opts;
	const companions: string[] = [];
	const unmapped: string[] = [];

	const out = content.replace(
		SPECIFIER_RE,
		(match, lead: string, quote: string, spec: string) => {
			if (!spec.startsWith(".")) return match;
			const key = specifierKey(sourceDir, importer, spec);

			const entry = PUBLISHED_ENTRY[key];
			if (entry !== undefined) return `${lead}${quote}${entry}${quote}`;

			const sibling = siblings.get(key);
			if (sibling !== undefined) return `${lead}${quote}./${bare(sibling)}${quote}`;

			const companion = COMPANION_FILE[key];
			if (companion !== undefined) {
				companions.push(key);
				return `${lead}${quote}./${bare(companion)}${quote}`;
			}

			unmapped.push(spec);
			return match;
		},
	);

	if (unmapped.length > 0) {
		throw new Error(
			`[uight] cannot build the ejection registry: unmapped relative import(s) in ` +
				`${path.relative(PKG_ROOT, importer)}:\n` +
				unmapped
					.map((s) => `  ${s}  (key: ${specifierKey(sourceDir, importer, s)})`)
					.join("\n") +
				"\n\nAn ejected file may only import external packages, a published uight entry\n" +
				"point, or a companion file shipped in the same item. Add the specifier to\n" +
				"PUBLISHED_ENTRY or COMPANION_FILE in scripts/build-registry.ts — a passthrough\n" +
				"installs cleanly and then fails to compile in the consumer's project (§11.1).",
		);
	}

	return { content: out, companions };
}

/**
 * The guard §11.1 actually asks for: nothing in a shipped file may point
 * outside the directory it is installed into.
 */
export function assertNoEscapingSpecifier(file: string, content: string): void {
	for (const [, , , spec] of content.matchAll(SPECIFIER_RE)) {
		if (spec === undefined || !spec.startsWith(".")) continue;
		if (spec.startsWith("./") && !spec.slice(2).includes("/")) continue;

		throw new Error(
			`[uight] emitted file ${file} keeps a relative import that escapes its ` +
				`install directory: ${spec}`,
		);
	}
}

/* ------------------------------------------------------------------ *
 * §11.2 — registry item shape
 * ------------------------------------------------------------------ */

export interface RegistryFile {
	path: string;
	type: "registry:component" | "registry:file";
	/** Required for `registry:file`; shadcn has nowhere else to put it. §11.2 */
	target?: string;
	content?: string;
}

export interface RegistryItem {
	$schema?: string;
	name: string;
	type: "registry:component";
	title: string;
	description: string;
	author?: string;
	dependencies: string[];
	registryDependencies: string[];
	files: RegistryFile[];
}

export interface RegistryIndex {
	$schema: string;
	name: string;
	homepage: string;
	items: RegistryItem[];
}

/** `1.0.0` → `v1.0`. Registry output is published per minor (§11.1). */
export function minorTag(version: string): string {
	const [major = "0", minor = "0"] = version.split(".");
	return `v${major}.${minor}`;
}

/**
 * §11.4 — ejected files carry a header naming the project, version and licence,
 * since repository-level licensing does not travel into another repository.
 */
export function fileHeader(opts: {
	title: string;
	name: string;
	version: string;
	css?: boolean;
}): string {
	const tag = minorTag(opts.version);
	const body = [
		`${opts.title} — ejected from ${PROJECT} v${opts.version}.`,
		"",
		`${PROJECT} · ${LICENCE} licence · ${HOMEPAGE}`,
		`Registry: ${NAMESPACE}/${opts.name} (${tag})`,
		"",
		"This file is yours now. It is plain Tailwind v4 compiled by your build and",
		"inherits your theme (§10.3); the tokens it names come from",
		`${TOKENS_PATH}, installed beside it.`,
		"",
		"The only uight surface it depends on is `uight/chrome`, which is the",
		"frozen one (§11.4) — the facade hook, the prop and wire types, and the few",
		"pure helpers it names. Anything it needed that has no published home was",
		"installed beside it as a plain file. Component props are not frozen and",
		"may change in a minor.",
	];
	return `/**\n${body.map((l) => (l ? ` * ${l}` : " *")).join("\n")}\n */\n\n`;
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

export interface BuildRegistryOptions {
	/** Directory holding `<Component>.tsx`. The UI owns it. */
	sourceDir: string;
	/** The shared token stylesheet (src/styles/chrome-tokens.css). */
	tokensFile: string;
	outDir: string;
	version: string;
	/** Emit whatever exists instead of failing. For partial trees only. */
	skipMissing?: boolean;
	items?: readonly Ejectable[];
}

export interface BuildRegistryResult {
	items: RegistryItem[];
	missing: string[];
	written: string[];
}

function namespaced(name: string): string {
	return `${NAMESPACE}/${name}`;
}

/**
 * The namespace a consumer defines for one published minor. §11.1
 *
 * This used to be an absolute `https://uight.dev/r/v0.0/…` URL. An absolute
 * URL says *where*, and a pinned item only needs to say *which minor* — the
 * cost of conflating the two was that the pinned items could not be resolved
 * against a mirror or a local server, which made them untestable until the
 * domain was deployed. A namespace expresses the pin and leaves the host to
 * `components.json`, where it belongs. Dots are not used: shadcn registry
 * names are identifier-ish, so `v0.0` is spelled `v0-0`.
 */
function pinnedNamespace(version: string): string {
	return `${NAMESPACE}-${minorTag(version).replace(".", "-")}`;
}

function pinned(name: string, version: string): string {
	return `${pinnedNamespace(version)}/${name}`;
}

/** Strip `content` for the index, which records paths rather than sources. */
function withoutContent(item: RegistryItem): RegistryItem {
	return {
		...item,
		$schema: undefined,
		files: item.files.map(({ content: _content, ...rest }) => rest),
	};
}

/** Re-point an item's registry dependencies at one published minor. §11.1 */
function versioned(item: RegistryItem, version: string): RegistryItem {
	return {
		...item,
		registryDependencies: item.registryDependencies.map((dep) =>
			dep.startsWith(`${NAMESPACE}/`)
				? pinned(dep.slice(NAMESPACE.length + 1), version)
				: dep,
		),
	};
}

function writeJson(file: string, value: unknown, written: string[]): void {
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify(value, null, "\t")}\n`);
	written.push(file);
}

export function buildRegistry(options: BuildRegistryOptions): BuildRegistryResult {
	const { sourceDir, tokensFile, outDir, version } = options;
	const table = options.items ?? EJECTABLE;
	const missing: string[] = [];
	const items: RegistryItem[] = [];

	if (!existsSync(tokensFile)) missing.push(tokensFile);
	const tokensSource = existsSync(tokensFile) ? readFileSync(tokensFile, "utf8") : "";
	const tokensContent =
		fileHeader({ title: "Chrome tokens", name: "chrome-tokens", version }) + tokensSource;

	// Another ejectable's source is pulled in by `registryDependencies`, never
	// copied — but its specifier still has to name where it lands (§11.3).
	const siblings = new Map<string, string>(
		table.map((e) => [`${e.component}.tsx`, `${e.component}.tsx`]),
	);

	for (const entry of table) {
		const source = path.join(sourceDir, `${entry.component}.tsx`);
		if (!existsSync(source)) {
			missing.push(source);
			continue;
		}

		/*
		 * Walk the component and everything it drags in. A companion may import
		 * another companion, so this is a queue rather than one pass — and each
		 * file is rewritten with the same table, so `../shared/types.ts` seen from
		 * `src/ui/cx.ts` and `../../shared/types.ts` seen from a component both
		 * normalise to the same key.
		 */
		const emitted = new Map<string, string>(); // base name → rewritten content
		const queue: { file: string; base: string; title: string }[] = [
			{ file: source, base: `${entry.component}.tsx`, title: entry.component },
		];
		const seen = new Set<string>();
		let missingCompanion = false;

		while (queue.length > 0) {
			const next = queue.shift()!;
			if (seen.has(next.base)) continue;
			seen.add(next.base);
			if (!existsSync(next.file)) {
				missing.push(next.file);
				missingCompanion = true;
				continue;
			}
			const rewritten = rewriteSpecifiers({
				sourceDir,
				importer: next.file,
				content: readFileSync(next.file, "utf8"),
				siblings,
			});
			const body =
				fileHeader({ title: next.title, name: entry.name, version }) + rewritten.content;
			assertNoEscapingSpecifier(`${entry.name}/${next.base}`, body);
			emitted.set(next.base, body);
			for (const key of rewritten.companions) {
				const base = COMPANION_FILE[key]!;
				queue.push({
					file: path.resolve(sourceDir, key),
					base,
					title: base.replace(/\.tsx?$/, ""),
				});
			}
		}

		if (missingCompanion) continue;
		const content = emitted.get(`${entry.component}.tsx`)!;
		// The component first, then its companions in a stable order.
		const companionFiles: RegistryFile[] = [...emitted.entries()]
			.filter(([base]) => base !== `${entry.component}.tsx`)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([base, body]) => ({
				path: `${EMIT_DIR}/${base}`,
				type: "registry:component" as const,
				content: body,
			}));

		items.push({
			$schema: SCHEMA_ITEM,
			name: entry.name,
			type: "registry:component",
			title: entry.title,
			description: entry.description,
			author: `${PROJECT} (${HOMEPAGE})`,
			// One published package with subpath exports (§16.1), so this is the
			// only npm dependency an ejected component can need.
			dependencies: [PROJECT],
			registryDependencies: entry.registryDependencies.map(namespaced),
			files: [
				{
					path: `${EMIT_DIR}/${entry.component}.tsx`,
					type: "registry:component",
					content,
				},
				...companionFiles,
				{
					path: TOKENS_PATH,
					type: "registry:file",
					target: TOKENS_TARGET,
					content: tokensContent,
				},
			],
		});
	}

	if (missing.length > 0 && !options.skipMissing) {
		throw new Error(
			`[uight] cannot build the ejection registry: ${String(missing.length)} source file(s) missing.\n` +
				missing.map((f) => `  ${path.relative(PKG_ROOT, f)}`).join("\n") +
				"\n\nEvery item in SPEC §11.3 must exist before the registry is published.\n" +
				"Pass --skip-missing to emit only what is present (development only).",
		);
	}

	const written: string[] = [];
	rmSync(outDir, { recursive: true, force: true });

	const tag = minorTag(version);
	for (const item of items) {
		writeJson(path.join(outDir, `${item.name}.json`), item, written);
		writeJson(
			path.join(outDir, tag, `${item.name}.json`),
			versioned(item, version),
			written,
		);
	}

	const index: RegistryIndex = {
		$schema: SCHEMA_REGISTRY,
		name: PROJECT,
		homepage: HOMEPAGE,
		items: items.map(withoutContent),
	};
	writeJson(path.join(outDir, "registry.json"), index, written);
	writeJson(
		path.join(outDir, tag, "registry.json"),
		{ ...index, items: items.map((i) => withoutContent(versioned(i, version))) },
		written,
	);

	return { items, missing, written };
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

function flag(argv: string[], name: string): string | undefined {
	const i = argv.indexOf(name);
	return i === -1 ? undefined : argv[i + 1];
}

function main(): void {
	const argv = process.argv.slice(2);
	const sourceDir = path.resolve(
		PKG_ROOT,
		flag(argv, "--source-dir") ?? path.join("src", "ui", "chrome"),
	);
	const outDir = path.resolve(PKG_ROOT, flag(argv, "--out-dir") ?? "registry");
	const tokensFile = path.join(PKG_ROOT, "src", "styles", "chrome-tokens.css");

	const result = buildRegistry({
		sourceDir,
		tokensFile,
		outDir,
		version: UIGHT_VERSION,
		skipMissing: argv.includes("--skip-missing"),
	});

	process.stdout.write(
		`[uight] registry: ${String(result.items.length)}/${String(EJECTABLE.length)} items, ` +
			`${String(result.written.length)} files → ${path.relative(PKG_ROOT, outDir)}/\n`,
	);
	for (const item of result.items) {
		process.stdout.write(`  ${NAMESPACE}/${item.name}\n`);
	}
	if (result.missing.length > 0) {
		process.stdout.write(
			`[uight] warning: skipped ${String(result.missing.length)} missing source file(s)\n`,
		);
	}
}

const entry = process.argv[1];
if (entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url)) {
	main();
}
