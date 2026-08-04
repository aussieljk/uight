/**
 * Ejection registry. SPEC.md §11.
 *
 *   bun run scripts/build-registry.ts [--skip-missing] [--source-dir <dir>] [--out-dir <dir>]
 *
 * Emits shadcn-compatible registry items into `registry/`: one JSON per
 * ejectable item (§11.3), plus the index and a versioned copy (§11.1).
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 *   - `registryDependencies` must be namespaced. A bare `"tree-item"` resolves
 *     against shadcn's own registry and installs somebody else's component.
 *     The versioned copies go further and use absolute URLs, because §11.1 says
 *     items may only be combined within one minor and a namespace alone cannot
 *     express that.
 *   - Every emitted file carries a header naming the project, version and
 *     licence (§11.4). Repository-level licensing does not travel into another
 *     repository; the file has to say so itself.
 *
 * Sources are read at run time from `src/ui/chrome/`, which the UI owns. A
 * missing file is a hard failure naming every one that is missing, because a
 * registry that silently ships eight of nine items is worse than one that
 * refuses to build.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { UAIGHT_VERSION } from "../src/shared/version.ts";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PROJECT = "uaight";
const LICENCE = "MIT";
const HOMEPAGE = "https://uaight.dev";
const REGISTRY_BASE = "https://uaight.dev/r";
const NAMESPACE = "@uaight";

/**
 * shadcn publishes two schemas: `registry.json` describes the index, and
 * `registry-item.json` describes a single item. §11.2's example names the
 * former on an item, which does not validate — see NOTES.md.
 */
const SCHEMA_REGISTRY = "https://ui.shadcn.com/schema/registry.json";
const SCHEMA_ITEM = "https://ui.shadcn.com/schema/registry-item.json";

/** Where the shared token stylesheet lands in the consumer's project. §10.3 */
const TOKENS_TARGET = "~/styles/uaight-chrome.css";
const TOKENS_PATH = "styles/uaight-chrome.css";

/* ------------------------------------------------------------------ *
 * §11.3 — what is ejectable
 *
 * "Anything that renders chrome is ejectable; anything that defines fixture
 * semantics or owns the realm is not." FrameHost, RendererBootstrap,
 * FrameTransport, the overlay store and the serializer are deliberately absent.
 * ------------------------------------------------------------------ */

export interface Ejectable {
	/** Registry item name; also the directory the file is published under. */
	name: string;
	/** Component and source file base name, under the chrome source directory. */
	component: string;
	title: string;
	description: string;
	/** Bare names; namespaced or URL-pinned at emit time. */
	registryDependencies: string[];
}

export const EJECTABLE: readonly Ejectable[] = [
	{
		name: "preview-shell",
		component: "PreviewShell",
		title: "Preview Shell",
		description:
			"The frame around a fixture: borders, background, toolbar slot and loading presentation. Reads useUaightChrome().status for loading and error, and .viewport for the current preset.",
		registryDependencies: [],
	},
	{
		name: "fixture-tree",
		component: "FixtureTree",
		title: "Fixture Tree",
		description:
			"Hierarchical navigation for fixtures. Reads useUaightChrome().fixtureTree and reports selection through onSelect.",
		registryDependencies: [],
	},
	{
		name: "control-panel",
		component: "ControlPanel",
		title: "Control Panel",
		description:
			"Groups the inputs a fixture registered, with their overlay values. Reads useUaightChrome().inputs and reports edits through onSet and onReset, including how many patches no longer apply.",
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
			"Viewport preset switcher. Reads useUaightChrome().viewport and renders disabled under inline isolation, where the width is a CSS box and the fixture's media queries still see the page (§6.5).",
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
			"Renders a RendererError — fixture, decorator, bootstrap, module or protocol — with an optional retry. Reads useUaightChrome().status.error.",
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
		name: "command-palette",
		component: "CommandPalette",
		title: "Command Palette",
		description:
			"⌘K over every fixture, detected component and harvested call site. Receives a list that is already filtered and ranked, so a replacement never has to reimplement the matcher.",
		registryDependencies: [],
	},
];

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
		"The only uaight surface it depends on is `useUaightChrome()` from",
		"`uaight/chrome`, which is the frozen one (§11.4). Component props are not",
		"frozen and may change in a minor.",
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

function pinned(name: string, version: string): string {
	return `${REGISTRY_BASE}/${minorTag(version)}/${name}.json`;
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

	for (const entry of table) {
		const source = path.join(sourceDir, `${entry.component}.tsx`);
		if (!existsSync(source)) {
			missing.push(source);
			continue;
		}
		const content =
			fileHeader({ title: entry.component, name: entry.name, version }) +
			readFileSync(source, "utf8");

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
					path: `ui/${entry.name}/${entry.component}.tsx`,
					type: "registry:component",
					content,
				},
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
			`[uaight] cannot build the ejection registry: ${String(missing.length)} source file(s) missing.\n` +
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
		version: UAIGHT_VERSION,
		skipMissing: argv.includes("--skip-missing"),
	});

	process.stdout.write(
		`[uaight] registry: ${String(result.items.length)}/${String(EJECTABLE.length)} items, ` +
			`${String(result.written.length)} files → ${path.relative(PKG_ROOT, outDir)}/\n`,
	);
	for (const item of result.items) {
		process.stdout.write(`  ${NAMESPACE}/${item.name}\n`);
	}
	if (result.missing.length > 0) {
		process.stdout.write(
			`[uaight] warning: skipped ${String(result.missing.length)} missing source file(s)\n`,
		);
	}
}

const entry = process.argv[1];
if (entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url)) {
	main();
}
