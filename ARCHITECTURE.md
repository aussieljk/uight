# uight — integration contract

This file is the **binding interface** between the parts of the package. SPEC.md is the
requirements document; this file says exactly which module owns which symbol, so that
independently written parts link together. If SPEC.md and this file disagree on a
signature, this file wins for the signature and SPEC.md wins for the behaviour.

Package root: `packages/uight`. Monorepo uses **bun** workspaces.
`examples/frosted-ui/node_modules/uight` symlinks to `packages/uight`.

## Already written — DO NOT EDIT

| File                       | Exports                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/shared/types.ts`      | every public type (`FixtureId`, `RuntimeConfig`, `Wire`, `UightProps`, `UightPluginOptions`, …)                   |
| `src/shared/fixture-id.ts` | `serializeFixtureId`, `parseFixtureId`, `fixtureIdsEqual`, `fixtureLabel`                                         |
| `src/shared/filter.ts`     | `matchesFilter`, `globToRegExp`                                                                                   |
| `src/shared/protocol.ts`   | `PROTOCOL_VERSION`, message types, `validateBootstrap`, `validateEnvelope`, `isChannelled`, `CHANNEL`, schedulers |
| `src/shared/wire.ts`       | `applyPatches`, `wireSet`, `wireAt`, `mergePatch`, `wireEqual`, `isSafePath`, `pathKey`, `isEditableWire`         |
| `src/shared/tree.ts`       | `buildTree`, `flattenSelectable`, `searchTree`                                                                    |
| `src/shared/version.ts`    | `UIGHT_VERSION`                                                                                                   |
| `src/client.d.ts`          | virtual module declarations + `__UIGHT_ENABLED__`                                                                 |

Read them before writing anything. Import with **explicit `.ts` extensions**
(`import { x } from "../shared/types.ts"`) — the repo uses
`allowImportingTsExtensions` + `verbatimModuleSyntax`, and tsdown rewrites them on build.
Use `import type` for type-only imports.

## Ownership map — each agent writes ONLY its own files

| Area         | Directory                                    |
| ------------ | -------------------------------------------- |
| Plugin       | `src/vite/**`                                |
| Runtime      | `src/runtime/**`                             |
| UI chrome    | `src/ui/**`, `src/chrome/**`, `src/index.ts` |
| Styles/build | `src/styles/**`, `scripts/**`, `tests/**`    |
| Demo         | `examples/frosted-ui/**`                     |

Never edit a file outside your area. If you need something from another area, code
against the signature below and assume it exists.

---

## 1. `src/vite/index.ts` — the plugin (`@aussieljk/uight/vite`)

```ts
export function uight(options?: UightPluginOptions): Plugin;
export function defineUightConfig(config: UightPluginOptions): UightPluginOptions;
export function buildFixtureIndex(config: ResolvedUightConfig): Promise<FixtureIndex>;
export function validateFixtures(config: ResolvedUightConfig): Promise<IndexProblem[]>;
export function parseFixtureFile(source: string, filename: string): ParsedFixtureFile;
export function resolveUightConfig(opts: {
	root: string;
	options: UightPluginOptions;
	command: "serve" | "build";
}): ResolvedUightConfig;
```

### Virtual modules it must emit (§4.3)

| Id                            | Must export                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `virtual:uight/runtime`       | `config: RuntimeConfig`, `fixtureModules`, `decoratorModules`, `inventoryModules`   |
| `virtual:uight/renderer-url`  | `rendererEntryUrl: string`                                                          |
| `virtual:uight/renderer`      | side-effecting frame entry (calls `mountRenderer`)                                  |
| `virtual:uight/preview-entry` | `Preview: React.ComponentType<{children}> \| undefined`                             |
| `virtual:uight/codecs`        | `codecs: FixtureCodec[]`                                                            |
| `virtual:uight/inventory`     | `inventoryItems: InventoryItem[]`                                                   |
| `virtual:uight/dev-entry`     | side-effecting: mounts `<Uight router="history" height="100%" />` into `#uight-app` |

`fixtureModules` / `decoratorModules` / `inventoryModules` are
`import.meta.glob(..., { eager: false })` maps **keyed by the glob path**
(root-relative, leading slash — e.g. `/src/components/Button.fixture.tsx`). This key is
`FixtureFileIndex.globPath`, so the runtime can go index → module without guessing.

The renderer entry (`virtual:uight/renderer`) must be exactly:

```js
import "@vitejs/plugin-react/refresh-runtime-preamble"; // dev only; see §6.3 note below
import { mountRenderer } from "@aussieljk/uight/runtime";
import {
	config,
	fixtureModules,
	decoratorModules,
	inventoryModules,
} from "virtual:uight/runtime";
import * as preview from "virtual:uight/preview-entry";
import { codecs } from "virtual:uight/codecs";

mountRenderer({
	root: document.getElementById("uight-root"),
	fixtureModules,
	decoratorModules,
	inventoryModules,
	config,
	codecs,
	Providers: preview.Preview,
});
```

**Q2 (preamble specifier) is open.** `@vitejs/plugin-react` v6 does not publish a
preamble module. Resolve it by having the plugin inline the preamble source that
`plugin-react` exposes via its `preambleCode` export, or by inlining the standard
`/@react-refresh` bootstrap:

```js
import RefreshRuntime from "/@react-refresh";
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;
```

Emit that verbatim at the top of the dev renderer entry (dev only). Record the answer
to Q2 in `NOTES.md`.

### Dev endpoints (§19.6, serve mode only)

- `GET <route>` (default `/uight`) — HTML through `server.transformIndexHtml`, containing
  `<div id="uight-app">` and `<script type="module" src="/@uight/dev-entry">`.
- `GET /@uight/renderer` — `server.transformRequest("virtual:uight/renderer")`, served as
  `application/javascript`. Public, stable URL.
- `GET /@uight/dev-entry` — same treatment for `virtual:uight/dev-entry`.
- `GET /@uight/index.json`, `/inventory.json`, `/config.json`, `/health` — read-only JSON.

`DEV_RENDERER_URL = "/@uight/renderer"`.

### Scan (§4.4, §3.4)

One `tinyglobby` pass at init. Fixture files: `**/*.{fixtureFileSuffix}.{js,jsx,ts,tsx,mdx}`
under `fixturesDir`. Decorators: `**/{cosmos,uight}.decorator.{js,jsx,ts,tsx}`. When
`storybook` is enabled, also `**/*.stories.{js,jsx,ts,tsx}` — those get `csf: true` and
`names: null` unless the CSF named exports are statically parseable (they usually are:
take every exported const that is not `default`/`__namedExportsOrder`, and honour a
`name:` property when it is a static string literal).

`parseFixtureFile` uses `oxc-parser` and walks only the default export, per §3.4's table.
`export const fixtureNames` wins outright.

Display path = globPath minus the fixtures dir prefix, minus `.{suffix}`, minus extension.
Collisions are a build error naming both files.

### Config

`resolveUightConfig` returns:

```ts
export interface ResolvedUightConfig {
	root: string;
	command: "serve" | "build";
	route: string | false;
	fixturesDirFsPath: string; // /Users/…/project/src
	fixturesDirGlobPath: string; // /src          (§4.2 — never interchange)
	fixtureFileSuffix: string;
	decoratorFileSuffixes: string[];
	include: string[];
	exclude: string[];
	caseSensitive: boolean;
	inventory: false | { include: string[]; exclude: string[] };
	previewEntry?: string;
	previewHtmlPath?: string;
	codecs?: string;
	index: "static" | "warm" | "lazy";
	production: "exclude" | "include" | "error";
	storybook:
		false | (Required<NonNullable<StorybookSupport["support"]>> & { fileSuffix: string });
	docgen: boolean;
	configFile?: string;
}
```

Resolve in `config()`, never mutate `ResolvedConfig` (§4.5). `define: { __UIGHT_ENABLED__ }`.

---

## 2. `src/runtime/index.ts` — the renderer (`@aussieljk/uight/runtime`)

```ts
export interface MountRendererOptions {
	root: HTMLElement;
	config: RuntimeConfig;
	fixtureModules: ModuleMap;
	decoratorModules: ModuleMap;
	inventoryModules: ModuleMap;
	codecs?: FixtureCodec[];
	Providers?: React.ComponentType<{ children: React.ReactNode }> | undefined;
}
export type ModuleMap = Record<string, () => Promise<unknown>>;

/** Frame realm entry: performs the child handshake, then renders. */
export function mountRenderer(o: MountRendererOptions): () => void;

/** Same renderer, driven by a transport the caller owns. Used by inline mode. */
export const RendererApp: React.ComponentType<
	MountRendererOptions & { transport: RendererTransport }
>;

export interface RendererTransport {
	send(m: MountedMessage): void;
	subscribe(cb: (m: MountedMessage) => void): () => void;
	dispose(): void;
}

export interface HostTransport extends RendererTransport {
	readonly status: "connecting" | "ready" | "error";
	onStatusChange(cb: () => void): () => void;
	error: RendererError | null;
}

/** Inline isolation: one realm, two ends, no postMessage. */
export function createDirectTransportPair(scheduler?: Scheduler): {
	host: HostTransport;
	renderer: RendererTransport;
};

/** Parent side of the frame handshake (§8.2). Used by ui/FrameHost. */
export function createFrameHostTransport(opts: {
	frame: HTMLIFrameElement;
	mountId: string;
	initialFixture: FixtureId | null;
	overlays: InputOverlay[];
	scheduler?: Scheduler;
}): HostTransport;

/** Serializer + codec registry, exported for tests and the inline path. */
export function createSerializer(codecs: FixtureCodec[]): {
	serialize(value: unknown, revision: number): Wire;
	deserialize(wire: Wire): unknown;
	resolveOpaque(id: number): unknown;
};
export const builtinCodecs: FixtureCodec[];
export function defineCodec<T, S>(c: FixtureCodec<T, S>): FixtureCodec<T, S>;

/** Fixture-side hooks implementation. Re-exported from `uight`. */
export function useFixtureInput<T>(
	name: string,
	initial: T,
	opts?: InputOptions<T>,
): [T, (v: T) => void];
export function useFixtureSelect<T extends string>(
	name: string,
	o: { options: readonly T[]; initial?: T },
): [T, (v: T) => void];
export function useFixtureViewport(): { width: number; height: number };
export function useFixtureId(): FixtureId;
export function useSelectFixture(): (id: FixtureId | string) => void;
export function useFixtureIsolation(): "frame" | "inline";
```

Behaviour that matters: §7.2 overlay model (fresh default → serialize → register →
apply host patches immutably → return), §7.3 rules table, §7.4 wire format, §7.7 codecs,
§3.3 decorator composition (outermost-first by directory depth), §13 CSF adaptation
(Storybook applies decorators innermost-first from the array; we nest outermost-first —
reverse when adapting).

Fixture module normalization (`src/runtime/normalize.ts`):

```ts
export interface NormalizedFixture {
	name: string | null;
	render: React.ComponentType | (() => React.ReactNode) | React.ReactElement;
	meta?: FixtureMeta;
	unsupported?: string[]; // CSF features we declined to run (§13) — badge these
}
export function normalizeModule(
	mod: unknown,
	file: FixtureFileIndex,
	cfg: RuntimeConfig,
): {
	fixtures: NormalizedFixture[];
	fileMeta?: FixtureFileMeta;
};
```

An element default export, a component default export, and an object of either are all
fixtures (§3.1). Named exports are never fixtures except in a CSF module.

---

## 3. `src/ui/**`, `src/chrome/**`, `src/index.ts` — the explorer

`src/index.ts` (the `uight` entry) exports:

```ts
export { Uight, UightProvider, Fixture, UightErrorBoundary } from "./ui/entry.tsx";
export {
	useFixtureInput,
	useFixtureSelect,
	useFixtureViewport,
	useFixtureId,
	useSelectFixture,
	useFixtureIsolation,
	defineCodec,
} from "../runtime/index.ts"; // re-export
export { parseFixtureId, serializeFixtureId } from "./shared/fixture-id.ts";
export { matchesFilter } from "./shared/filter.ts";
export type {} from /* every type in shared/types.ts */ "./shared/types.ts";
```

`Uight` is the compile-time gate (§9.2). Write it so Rollup can drop the chunk:

```tsx
const UightUI = __UIGHT_ENABLED__ ? React.lazy(() => import("./UightUI.tsx")) : null;
```

`src/chrome/index.ts` exports `useUightChrome(): UightChromeApiV1` exactly as §19.3
defines it. The facade reads a React context published by `UightUI`; calling it outside
throws a clear error. This is the surface that freezes at v1.2 (§11.4) — nothing else is
frozen, so keep implementation detail out of it.

`UightUI` owns: selection precedence (§5.3), routing + ownership refcounting (§5.4),
the overlay store, host transport, frame/inline hosting, and the chrome layout.
Ejectable components (§11.3) live one per file in `src/ui/chrome/` and are all
replaceable through `props.components`.

Styles: `import { UIGHT_CSS } from "../styles/generated.ts"` — a string. Inject it once
per document (host document, and again into the frame document) via a `<style>` element
carrying any CSP nonce (§6.7). Every element you render lives under a `.uight-root`
ancestor; the compiled CSS only matches inside it.

---

## 4. `src/styles/**`, `scripts/**`, `tests/**`

- `src/styles/uight.css` — Tailwind v4 source. **Never `@import "tailwindcss"` whole**;
  import `theme.css` + `utilities.css` only, so preflight never ships (§10.2).
- `scripts/build-css.ts` — compile with `@tailwindcss/cli`, then rewrite every selector to
  require a `.uight-root` ancestor (§10.3), and write both `dist/styles.css` and
  `src/styles/generated.ts` (`export const UIGHT_CSS = "…"`). Commit a placeholder
  `generated.ts` so the type-check passes before the first build.
- `scripts/build-registry.ts` — emit shadcn registry items (§11.2) into `registry/`.
- `tests/**` — vitest for §20.1's list.

---

## 5. Demo — `examples/frosted-ui/**`

Consumes the built package through the workspace symlink, exactly as a real user would:
`import { uight } from "@aussieljk/uight/vite"`. Renders **frosted-ui's own Storybook stories** as
fixtures through the §13 CSF subset.
