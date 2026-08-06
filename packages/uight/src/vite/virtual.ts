/**
 * Virtual module generators. SPEC.md §4.3, §6.3, §7.7, §12.
 *
 * D19 split the renderer's own URL out of the module the renderer imports, so
 * the graph has no cycle: the renderer imports `runtime`; the host imports
 * `runtime` and `renderer-url`.
 *
 * Every emitted `import.meta.glob` is keyed by the **glob path** — root
 * relative with a leading slash, exactly `FixtureFileIndex.globPath` — so the
 * runtime maps index → module without guessing. Vite refuses a relative glob
 * inside a virtual module outright ("In virtual modules, all globs must start
 * with '/'"), which is §4.2 enforced by the bundler.
 */

import { HOT_REGISTRY_KEY } from "../runtime/hot.ts";
import { PROTOCOL_VERSION } from "../shared/protocol.ts";
import type { FixtureIndex, RuntimeConfig } from "../shared/types.ts";
import { UIGHT_VERSION } from "../shared/version.ts";
import type { ResolvedUightConfig } from "./config.ts";
import {
	decoratorGlobPatterns,
	fixtureGlobPatterns,
	inventoryGlobPatterns,
} from "./scan.ts";

export const VIRTUAL_IDS = {
	runtime: "virtual:uight/runtime",
	rendererUrl: "virtual:uight/renderer-url",
	renderer: "virtual:uight/renderer",
	preview: "virtual:uight/preview-entry",
	storybookPreview: "virtual:uight/storybook-preview",
	codecs: "virtual:uight/codecs",
	inventory: "virtual:uight/inventory",
	devEntry: "virtual:uight/dev-entry",
} as const;

/** Resolved ids carry the `\0` prefix so no other plugin claims them. */
export const resolvedId = (id: string): string => `\0${id}`;

/**
 * The placeholder `virtual:uight/renderer-url` carries in a production build.
 * `import.meta.ROLLDOWN_FILE_URL_<ref>` does not exist in this toolchain
 * (Q7), so `generateBundle` rewrites this token with `this.getFileName(ref)`.
 */
export const RENDERER_URL_PLACEHOLDER = "__UIGHT_RENDERER_URL__";

/**
 * The same trick for the renderer's stylesheets, and for the same reason.
 *
 * In development the preview entry's CSS reaches the frame through Vite's own
 * injection: the module is served as JavaScript that appends a `<style>` to the
 * document it runs in, and it runs in the frame realm. A build extracts that
 * CSS into a file instead, and the link normally goes into the HTML document
 * that loads the chunk — but the renderer is injected into the frame as a
 * script element at runtime (§6.3), so there is no such document and nothing
 * links it. The result was a deployed explorer whose fixtures rendered with
 * none of the host's global CSS, which is the one thing `previewEntry` exists
 * to deliver.
 */
export const RENDERER_CSS_PLACEHOLDER = "__UIGHT_RENDERER_CSS__";

/** The public, stable dev URL. Vite's `/@id/__x00__…` encoding is private. */
export const DEV_RENDERER_URL = "/@uight/renderer";
export const DEV_ENTRY_URL = "/@uight/dev-entry";

/**
 * The frame's document in `serve` mode (§6.6).
 *
 * The frame used to be `about:blank` written into from the host. That document
 * has no creation URL, and a surprising amount of the platform refuses to work
 * in one: `navigator.serviceWorker.getRegistrations()` throws `InvalidStateError`
 * outright, which takes MSW — and therefore every fixture that mocks its
 * network — down with it, with the only evidence a console line. Cookies,
 * storage partitioning and `location` are all likewise not what the fixture
 * would see in the app.
 *
 * Serving the same document from a real URL costs one request and fixes all of
 * it. Nothing is written to the repository: this is generated in memory by the
 * dev middleware exactly like the explorer document above it (§6.1), and it
 * goes through `transformIndexHtml`, so the React plugin's Fast Refresh
 * preamble reaches the frame realm — which the written document could never
 * arrange for itself.
 */
export const DEV_PREVIEW_URL = "/@uight/preview";

/** `<` is escaped so a generated module can also be inlined into HTML. */
function json(value: unknown): string {
	return JSON.stringify(value ?? null)
		.replace(/</g, "\\u003c")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
}

/* ------------------------------------------------------------------ *
 * `virtual:uight/runtime` — imported by both realms (§4.3)
 * ------------------------------------------------------------------ */

export function buildRuntimeConfig(
	cfg: ResolvedUightConfig,
	index: FixtureIndex,
): RuntimeConfig {
	// Inventory is development-only and is excluded from production builds
	// regardless of `production` mode (§12, last line).
	const inventoryEnabled = cfg.inventory !== false && cfg.command === "serve";

	const { fileSuffix, ...storybookSupport } = cfg.storybook || {
		fileSuffix: "stories",
	};

	return {
		version: UIGHT_VERSION,
		protocolVersion: PROTOCOL_VERSION,
		index: cfg.index,
		command: cfg.command,
		// The glob-path form (§4.2): the runtime uses it to turn a glob key back
		// into a display path, so it must be the representation the keys use.
		fixturesDir: cfg.fixturesDirGlobPath,
		fixtureFileSuffix: cfg.fixtureFileSuffix,
		inventoryEnabled,
		storybook: cfg.storybook ? (storybookSupport as RuntimeConfig["storybook"]) : null,
		storybookFileSuffix: fileSuffix,
		hasStorybookPreview: Boolean(cfg.storybookPreview),
		hasPreviewEntry: Boolean(cfg.previewEntry),
		hasCodecs: Boolean(cfg.codecs),
		route: cfg.route,
		files: index.files,
		decorators: index.decorators,
		inventory: inventoryEnabled ? index.inventory : [],
		// Call sites ride with the inventory: both are development-only, and a
		// production build has no detected components to attach them to.
		callSites: inventoryEnabled && cfg.callSites ? index.callSites : [],
		problems: index.problems,
		// §15: absent unless `docgen` is on, so a consumer must treat "no docs"
		// as the normal case rather than as a failure to produce them.
		...(index.docs ? { docs: index.docs } : {}),
	};
}

export function generateRuntime(cfg: ResolvedUightConfig, index: FixtureIndex): string {
	const globOptions = `{ eager: false, caseSensitive: ${cfg.caseSensitive} }`;
	const inventoryPatterns = cfg.command === "serve" ? inventoryGlobPatterns(cfg) : [];

	// Only the fixtures. Decorators are loaded with whatever fixture needs them
	// and the inventory is development-only, so neither is on the path `eager`
	// exists to shorten — and both would be pure weight in the entry chunk.
	const fixtureOptions = cfg.eager
		? `{ eager: true, caseSensitive: ${cfg.caseSensitive} }`
		: globOptions;
	const fixtures = globCall(fixtureGlobPatterns(cfg), fixtureOptions);

	return `// Generated by uight. SPEC.md §4.3.
export const config = ${json(buildRuntimeConfig(cfg, index))};
${cfg.eager ? EAGER_HELPER : ""}
// Keys are FixtureFileIndex.globPath — root-relative with a leading slash.
export const fixtureModules = ${cfg.eager ? `loaders(${fixtures})` : fixtures};
export const decoratorModules = ${globCall(decoratorGlobPatterns(cfg), globOptions)};
export const inventoryModules = ${globCall(inventoryPatterns, globOptions)};
${cfg.command === "serve" ? selfAccept() : ""}`;
}

/**
 * An eager glob's values are module namespaces; a lazy one's are loaders.
 *
 * Normalizing here rather than at the reader keeps `ModuleMap` one shape, so
 * `loadFixtureModule`, the hot registry and every caller stay unaware that the
 * option exists. The promise is already resolved, so an eager selection costs a
 * microtask rather than a request.
 */
const EAGER_HELPER = `
const loaders = (modules) => {
	const out = {};
	for (const key in modules) {
		const value = modules[key];
		out[key] = typeof value === "function" ? value : () => Promise.resolve(value);
	}
	return out;
};
`;

/**
 * §4.5, Q9 — this module is where adding a file used to reload the page.
 *
 * `import.meta.glob` matched a set of paths when this module was transformed,
 * so a new fixture file makes it stale; Vite invalidates it, nobody along the
 * chain to the host entry accepts anything, and the only move left is a full
 * reload. Accepting here stops the propagation at the module that actually
 * changed, and hands the fresh loaders to `runtime/hot.ts` — the index itself
 * still arrives over the `uight:index` event, which an accept callback cannot
 * replace because the host needs it whether or not this module moved.
 */
function selfAccept(): string {
	return `
if (import.meta.hot) {
	import.meta.hot.accept((mod) => {
		if (mod) globalThis[${json(HOT_REGISTRY_KEY)}]?.updateMaps(mod);
	});
}
`;
}

function globCall(patterns: string[], options: string): string {
	if (patterns.length === 0) return "{}";
	return `import.meta.glob(${json(patterns)}, ${options})`;
}

/* ------------------------------------------------------------------ *
 * `virtual:uight/renderer-url` — host only (§4.3)
 * ------------------------------------------------------------------ */

export function generateRendererUrl(emitted: boolean): string {
	const value = emitted ? RENDERER_URL_PLACEHOLDER : DEV_RENDERER_URL;
	// A `|`-separated string rather than an array literal, because the
	// substitution happens on generated code after it has been parsed: a token
	// inside a string is inert, and a bare identifier standing in for an array
	// is a free variable the bundler is entitled to have opinions about. No URL
	// contains `|`. A dev server extracts no CSS, so this is empty there and the
	// frame keeps getting its styles the way it always has.
	const styles = emitted ? json(RENDERER_CSS_PLACEHOLDER) : json("");
	return (
		`export const rendererEntryUrl = ${json(value)};\n` +
		`export const rendererStyleUrls = ${styles}.split("|").filter(Boolean);\n`
	);
}

/* ------------------------------------------------------------------ *
 * `virtual:uight/renderer` — the frame realm entry (§6.3)
 * ------------------------------------------------------------------ */

/**
 * How the React Refresh preamble reaches the frame. The frame document never
 * passes through `transformIndexHtml`, so `@vitejs/plugin-react` cannot inject
 * it and every transformed module throws "can't detect preamble".
 *
 * - `module` — `@vitejs/plugin-react/preamble` resolved. Preferred: it is a
 *   real module, so it evaluates before the imports that need it, and the
 *   plugin makes it a no-op when Fast Refresh is off or Bundled Dev Mode is on.
 * - `inline` — some other React plugin serves `/@react-refresh`. Fall back to
 *   the standard bootstrap.
 * - `none` — no React plugin, or a production build.
 */
export type PreambleMode = "module" | "inline" | "none";

export const PREAMBLE_MODULE_ID = "@vitejs/plugin-react/preamble";
export const REACT_REFRESH_RUNTIME_ID = "/@react-refresh";

function preambleSource(mode: PreambleMode): string {
	if (mode === "module") return `import ${json(PREAMBLE_MODULE_ID)}; // dev only — §6.3\n`;
	if (mode === "inline") {
		return `// dev only — §6.3. Inlined React Refresh bootstrap (Q2 fallback).
import RefreshRuntime from ${json(REACT_REFRESH_RUNTIME_ID)};
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;
`;
	}
	return "";
}

export function generateRendererEntry(mode: PreambleMode): string {
	return `${preambleSource(mode)}import { mountRenderer } from "@aussieljk/uight/runtime";
import { config, fixtureModules, decoratorModules, inventoryModules } from "virtual:uight/runtime";
import * as preview from "virtual:uight/preview-entry";
import { storybookPreview } from "virtual:uight/storybook-preview";
import { codecs } from "virtual:uight/codecs";

mountRenderer({
	root: document.getElementById("uight-root"),
	fixtureModules, decoratorModules, inventoryModules, config, codecs,
	Providers: preview.Preview,
	storybookPreview,
});
`;
}

/* ------------------------------------------------------------------ *
 * `virtual:uight/storybook-preview` — §13, the drop-in path
 * ------------------------------------------------------------------ */

/**
 * The consumer's `.storybook/preview` module, loaded in the frame realm.
 *
 * §13 originally declined global decorators "by construction: `.storybook/preview`
 * is never loaded". That reading is what stands between a declared subset and a
 * drop-in replacement — nearly every real Storybook install puts its providers,
 * theme and global styles in that file, so declining it renders a repo's whole
 * corpus stripped of context and reads as uight being broken.
 *
 * Both spellings are accepted, because Storybook accepts both: named exports
 * (`export const decorators = […]`) and the CSF-style default export
 * (`export default { decorators: […] } satisfies Preview`). A named export wins,
 * matching Storybook's own precedence.
 */
export function generateStorybookPreview(cfg: ResolvedUightConfig): string {
	if (!cfg.storybookPreview) return `export const storybookPreview = null;\n`;
	return `import * as mod from ${json(cfg.storybookPreview)};
const preview = mod.default ?? {};
export const storybookPreview = {
	decorators: mod.decorators ?? preview.decorators ?? [],
	parameters: mod.parameters ?? preview.parameters ?? {},
	globalTypes: mod.globalTypes ?? preview.globalTypes ?? {},
	initialGlobals: mod.initialGlobals ?? preview.initialGlobals ?? mod.globals ?? preview.globals ?? {},
	args: mod.args ?? preview.args ?? {},
	argTypes: mod.argTypes ?? preview.argTypes ?? {},
};
`;
}

/* ------------------------------------------------------------------ *
 * `virtual:uight/preview-entry` — §6.4
 * ------------------------------------------------------------------ */

/**
 * The consumer module runs **inside the frame realm**, which is the only way
 * to give fixtures their CSS and their providers: Vite's CSS handling then
 * targets the frame's document, and React context cannot cross a realm
 * boundary as an element. Omitting it yields an unstyled frame (§6.4).
 */
export function generatePreviewEntry(cfg: ResolvedUightConfig): string {
	if (!cfg.previewEntry) {
		return `export const Preview = undefined;\n`;
	}
	return `import * as mod from ${json(cfg.previewEntry)};
// Accept either \`export function Preview\` or a default export.
export const Preview = mod.Preview ?? mod.default;
`;
}

/* ------------------------------------------------------------------ *
 * `virtual:uight/codecs` — §7.7
 * ------------------------------------------------------------------ */

/**
 * One module both realms import, because a single registry object cannot cross
 * realms. Consumer codecs are tested before the built-ins, which the runtime
 * arranges by concatenating in that order.
 */
export function generateCodecs(cfg: ResolvedUightConfig): string {
	if (!cfg.codecs) return `export const codecs = [];\n`;
	return `import * as mod from ${json(cfg.codecs)};
const declared = mod.codecs ?? mod.default ?? [];
export const codecs = Array.isArray(declared) ? declared : [];
`;
}

/* ------------------------------------------------------------------ *
 * `virtual:uight/inventory` — §12
 * ------------------------------------------------------------------ */

/** Empty in a production build, regardless of `production` mode (§12). */
export function generateInventory(cfg: ResolvedUightConfig, index: FixtureIndex): string {
	const items = cfg.command === "serve" && cfg.inventory !== false ? index.inventory : [];
	return `export const inventoryItems = ${json(items)};\n`;
}

/* ------------------------------------------------------------------ *
 * `virtual:uight/dev-entry` — the dev route's host realm (§6.1)
 * ------------------------------------------------------------------ */

/**
 * `createElement` rather than JSX: this module is generated, and a generated
 * virtual module is not guaranteed to pass through the React plugin's JSX
 * transform. The host document is produced by `transformIndexHtml`, so the
 * Fast Refresh preamble is already installed here — unlike the frame (§6.3).
 */
export function generateDevEntry(): string {
	// `previewDocumentUrl` is what keeps the frame off `about:blank` — see the
	// constant's own note for what that document cannot do.
	return `import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { Uight } from "@aussieljk/uight";

const container = document.getElementById("uight-app");
if (!container) {
	throw new Error('[uight] the dev document is missing <div id="uight-app">');
}

createRoot(container).render(
	createElement(Uight, {
		router: "history",
		height: "100%",
		previewDocumentUrl: ${json(DEV_PREVIEW_URL)},
	}),
);
`;
}
