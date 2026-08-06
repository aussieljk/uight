# uight — Technical Specification

**Status:** Draft v1.0 — pre-implementation
**Lineage:** Independent implementation. Fixture-format compatible with react-cosmos 7.x, plus extensions (§3, §18)
**Toolchain verified:** 31 July 2026 (§0)
**Public API:** §19

---

## 0. Toolchain

Two lists, because they have different audiences and different rules. Consumer requirements are ranges we support; repository requirements are exact versions we build with.

### 0.1 Consumer requirements

| Requirement    | Range          | Note                                                              |
| -------------- | -------------- | ----------------------------------------------------------------- |
| Vite           | `^8.1`         | Not `^8.0` — `caseSensitive` for `import.meta.glob` landed in 8.1 |
| React          | `^18 \|\| ^19` | Peer of the runtime, not the plugin                               |
| Node           | `>=20.19`      | Vite 8's floor                                                    |
| Tailwind       | none           | Not required. Only needed to _eject_ chrome (§10.3)               |
| TypeScript     | none           | Not required to consume                                           |
| Browser target | Baseline 2024  | `@property`, `:has`, container queries, `adoptedStyleSheets`      |

### 0.2 Repository requirements — pinned exactly

| Tool              | Version  | Why pinned                                                                             |
| ----------------- | -------- | -------------------------------------------------------------------------------------- |
| `typescript`      | `7.0.2`  | tsgolint compatibility is tied to a TypeScript release (§17.1)                         |
| `oxlint`          | `1.76.0` |                                                                                        |
| `oxlint-tsgolint` | `7.0.0`  | Tracks TS 7.0.2. Upgrade in lockstep with `typescript`                                 |
| `oxfmt`           | `0.61.0` | Beta. A formatter that shifts on a patch bump produces enormous meaningless diffs      |
| `oxc-parser`      | pinned   | **A direct dependency.** AST interpretation drives §3.4; "current" is not reproducible |
| `shadcn` CLI      | pinned   | Generates published registry output (§11.2)                                            |
| Vite              | `8.1.5`  | Dev and test                                                                           |
| Playwright        | pinned   | §20.2                                                                                  |

**On TypeScript 7.1.** It is available under `typescript@next`, which changes §15's plan: the docgen question moves from "wait and see" to a spike we can run now. It does not change the repository pin. tsgolint v7 is built against TypeScript 7.0.2 and its versioning exists to express that coupling, so moving the repo to 7.1 before tsgolint follows would trade a working type-aware linter for an unproven docgen path. The spike runs 7.1 in isolation (§15.2); the repo moves when tsgolint does.

---

## 1. Overview

### 1.1 What uight is

A component explorer that runs inside your application's own Vite dev server and needs no configuration to be useful.

**Two steps:**

```bash
npm i -D @aussieljk/uight
```

```ts
// vite.config.ts
import { uight } from "@aussieljk/uight/vite";
export default defineConfig({ plugins: [react(), uight()] });
```

Then open `/uight` alongside your app. With no config file and no fixtures, it finds your components and lists them. Write fixtures when you want states and controls; you never have to.

That is the whole onboarding. No second process, no second port, no `uight.config.json`, no HTML file in your repository, and no third step.

### 1.2 The two entry paths

| Path          | How                                                | For                                               |
| ------------- | -------------------------------------------------- | ------------------------------------------------- |
| **Dev route** | Plugin serves `/uight` from memory in `serve` mode | Zero-config exploration and daily development     |
| **Embedded**  | `<Uight />` mounted anywhere in your app           | Docs pages, an auth-gated internal route, a panel |

Same explorer, same code. The dev route is the embedded component mounted into a document the plugin generates and never writes to disk (§6.1).

### 1.3 Jobs to be done

1. **See what exists.** Point it at a codebase with no fixtures and get an inventory that is immediately useful (§12).
2. **Development and debugging.** Isolate a component, edit its props, check it at 320px.
3. **Living design-system documentation.** Prose and fixtures on one page, at an auth-gated URL.
4. **QA and design review.** A shared link to a specific fixture. (Not "in a state" — control values stay out of URLs in v1, §5.4.)

Job 1 is new in v1.0 and is what the zero-config requirement buys. It also inverts a default: component auto-detection is **on** unless disabled.

### 1.4 Non-goals for v1

- Bundlers other than Vite 8.1+.
- SSR of the explorer chrome.
- React Server Components.
- Visual regression testing, screenshots.
- Storybook `play`, loaders, interactions (§13).
- Remote renderers, React Native.
- Becoming an MDX documentation framework (§14).
- A plugin/slot system. Replacement is covered by `components` and ejection (§11).
- **Writing files.** The fixture-scaffolding endpoint proposed in earlier drafts is cut from v1 entirely (§21.2). It carried disproportionate security and maintenance liability for something peripheral to the thesis.

---

## 2. Decision log

| #       | Decision                                                                             | Consequence                                                                  |
| ------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| D1      | Vite 8.1+ only                                                                       | `import.meta.glob` plus one index scan                                       |
| D2      | Independent implementation, format-compatible                                        | §18                                                                          |
| D3      | Vite owns loading, watching and HMR; the plugin owns one index scan                  | §4.4                                                                         |
| D4      | **Zero-config by default; `uight.config.json` optional**                             | Every option has a working default. Component inventory is on                |
| D5      | **One published package with subpath exports**                                       | Fixes the package-graph inconsistency and enables the two-step install (§16) |
| D6      | No plugin/slot system in v1                                                          |                                                                              |
| D7      | Production inclusion opt-in, default excluded                                        | Gated at compile time (§9.2)                                                 |
| D8      | Isolation configurable per mount                                                     | §5.2                                                                         |
| D9      | Tailwind v4 internally; compiled scoped CSS when packaged, host-native when ejected  | §10.3                                                                        |
| D10     | **Router integration is explicit, not automatic**                                    | "Router-agnostic" was too strong (§5.4)                                      |
| D11     | A versioned CSF subset                                                               | §13                                                                          |
| D12     | Fixture format compatible with cosmos 7.x plus documented extensions                 | §3                                                                           |
| D13     | Names indexed statically at build time, warm pass by default                         | §3.4–3.5                                                                     |
| D14     | Ejection via a shadcn-compatible registry; the **hook facade** is the frozen surface | §11                                                                          |
| D15     | Consumer preview entry supplies fixture CSS and providers                            | §6.4                                                                         |
| D16     | **No HTML file is required.** Custom preview documents are a supported opt-in        | §6.1                                                                         |
| **D17** | **Control state is an editable overlay of patches, not a canonical value**           | The v0.6 model could not survive HMR (§7)                                    |
| **D18** | **Control metadata is declared at the call site, not inferred from docgen**          | There is no reliable mapping from an input name to a component prop (§7.6)   |
| **D19** | **Renderer and runtime virtual modules are separate**                                | Removes a self-referential module graph (§4.3)                               |
| **D20** | **Bootstrap messages are not enveloped; mounted messages are**                       | The child cannot carry a `mountId` it has not been given (§8.2)              |

---

## 3. The fixture model

### 3.1 Compatible, plus extensions

```tsx
// Node fixture — the module is one fixture
export default <Button disabled>Click me</Button>;

// Component fixture — enables hooks
export default () => {
	const [n, setN] = useState(0);
	return <Counter count={n} onIncrement={() => setN(n + 1)} />;
};

// Multi-fixture — the default export is an OBJECT.
// Property names are fixture names and may contain spaces.
export default {
	Primary: <PrimaryButton>Click me</PrimaryButton>,
	"Primary Disabled": <PrimaryButton disabled>Click me</PrimaryButton>,
};
```

Named exports are never fixtures, which is what leaves room for extensions:

```tsx
// File-level metadata
export const fileMeta: FixtureFileMeta = {
	group: "Forms",
	tags: ["stable"],
	viewport: { width: 1024, height: 768 }, // default for every fixture here
};

// Per-fixture metadata, keyed by fixture name.
// For a single-fixture file, use the DEFAULT_FIXTURE key.
export const fixtureMeta: Record<string, FixtureMeta> = {
	Primary: { title: "Primary button", description: "One per view." },
	"Primary Disabled": { viewport: { width: 375, height: 667 } },
};

// Static name declaration for dynamically built fixtures (§3.4)
export const fixtureNames = ["red", "green", "blue"];
```

v0.6 called a single flat `meta` object "per-fixture metadata" while giving it no fixture keys, and keyed `viewports` by name without saying what a single-fixture file does. Both are now explicit: **`fileMeta` is file-level; `fixtureMeta` is keyed by fixture name; viewport lives inside either.** A single fixture is keyed by the exported constant:

```ts
export const DEFAULT_FIXTURE = "\0default"; // never collides with a real name
```

### 3.2 Fixture identity

```ts
interface FixtureId {
	path: string; // display path: dir, suffix, extension stripped
	name: string | null; // key in the default-exported object
}
```

- `name: null` means **the module's default export is the fixture** — a single-fixture file.
- `name: ''` means **a multi-fixture whose key is the empty string**. Legal JavaScript, so it must round-trip.
- These are different states and the serialization distinguishes them.

**Canonical encoding**, not address-bar readability:

```
single    → uight:1|<encodedPath>
named     → uight:1|<encodedPath>|<encodedName>
```

Both segments are `encodeURIComponent`-encoded, so `''` encodes to an empty third segment and `null` produces no third segment at all. The `uight:1|` prefix versions the format, so a v2 encoding can be introduced without ambiguity. `parseFixtureId` is total and returns `null` on anything malformed, including a missing or unknown version prefix.

The convenience form `path:name` remains accepted **on input only** — in the `fixture` prop and hand-written links — and is normalized to canonical form immediately. It rejects `:` in the path segment. Never emitted.

### 3.3 Decorators

A decorator file default-exports a component receiving `children`:

```tsx
// src/cosmos.decorator.tsx  (or uight.decorator.tsx — both recognized)
export default function Decorator({ children }: { children: React.ReactNode }) {
	return <ThemeProvider>{children}</ThemeProvider>;
}
```

Contract, previously undefined:

- **Props:** `{ children }` only. No fixture metadata is passed; a decorator needing it calls `useFixtureId()`.
- **Scope:** applies to every fixture at or below its directory.
- **Composition:** outermost-first by directory depth; a root decorator wraps a nested one.
- **Errors:** a throwing decorator is caught by the fixture error boundary and reported as a decorator error naming the file, not as a fixture error.
- **Versus `CosmosPreview`** (§6.4): the preview entry runs **once per frame realm** and supplies app-wide providers; decorators run **per fixture render** and are part of the fixture tree. Providers that must not remount between fixtures belong in the preview entry.
- **Versus Storybook decorators:** adapted CSF decorators (§13) are applied inside file decorators, innermost relative to them.
- Decorators are not fixtures and are excluded from the tree.

### 3.4 The static name index

Names live inside a module's default export. Loading every module to enumerate them defeats lazy loading. So parse instead: names are data, modules are code, and a build step can read one without executing the other.

`oxc-parser` walks only the default export:

| Default export                                         | Result                               |
| ------------------------------------------------------ | ------------------------------------ |
| Not an object literal                                  | `names: [null]` — single fixture     |
| Object literal, all keys static                        | `names: [...]`                       |
| Object literal with spread, computed keys, or getters  | `names: null`                        |
| Identifier bound to a module-scope `const` initializer | apply this table to that initializer |
| Identifier assigned elsewhere                          | `names: null`                        |
| `export const fixtureNames` present                    | **Wins outright**                    |

The identifier rows are ordered. `const fixtures = {…}; export default fixtures` resolves, because the initializer is written down in the same module — but only when the binding is a module-scope `const`, has an initializer, and is the only module-scope declaration of that name. `let`, `var`, an import, a destructuring pattern and a redeclaration all stay undecidable: in each of those the initializer is not the final value, and establishing what is would need the scope analysis this pass exists to avoid. Chains resolve (`const a = {…}; const b = a; export default b`), with a cycle guard. Once resolved, the rest of the table applies unchanged — a resolved object with a spread is still `null`.

```ts
interface FixtureFileIndex {
	path: string;
	names: string[] | null; // null = undecidable
	hash: string;
}
```

**Reconciliation.** After a module loads, compare real keys against the index; on mismatch, warn in development naming the file and both lists.

### 3.5 The warm pass

| `index`                | Behaviour                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `'static'`             | Build-time parse only                                                                                                     |
| **`'warm'` (default)** | Static, plus a development-only background pass that loads undecidable modules after first paint and caches names by hash |
| `'lazy'`               | No index; every file reveals on open                                                                                      |

The warm pass makes parser coverage a performance characteristic rather than a correctness one. It executes module-scope code, which is why it is development-only and deferred until after first paint (Q4).

**Progressive disclosure**, previously unspecified. When `names: null`, the tree shows one node per file. Selecting it:

1. Loads the module and expands to show real names.
2. **Does not auto-select a child.** The file node remains selected and renders the first fixture, with a note naming what it is. Auto-selecting would rewrite the user's URL to something they did not choose.
3. A deep link to `path|name` where the file is undecidable loads the module first, then validates the name. Unknown after load → empty state, parameter preserved (§5.4).

### 3.6 Filtering

`filter` was undefined in prior drafts. Three forms, disambiguated by shape:

| Form                        | Meaning                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `string` without `*`        | **Path prefix on segment boundaries.** `'components/forms'` matches `components/forms/Input` but not `components/formsy/X` |
| `string` containing `*`     | Glob against the display path, via the same matcher as discovery                                                           |
| `string[]`                  | Any match wins; entries prefixed `!` exclude                                                                               |
| `(path: string) => boolean` | Predicate. Called per file, not per fixture                                                                                |

Filtering scopes the **tree**. It never prevents a `fixture` prop from rendering (§5.3).

---

## 4. Discovery and the plugin

### 4.1 Configuration

Everything has a default. `uight.config.json` is optional and most projects never create one.

```ts
export interface UightPluginOptions {
	/** Dev route. Default '/uight'. Set false to disable the route entirely. */
	route?: string | false;

	configPath?: string | false;
	fixturesDir?: string; // default 'src'
	fixtureFileSuffix?: string; // default 'fixture'
	decoratorFileSuffix?: string; // default 'cosmos.decorator|uight.decorator'
	include?: string[];
	exclude?: string[];
	caseSensitive?: boolean; // default true

	/** Component inventory. Default true — this is the zero-config experience. */
	inventory?: boolean | { include?: string[]; exclude?: string[] };

	previewEntry?: string; // §6.4
	previewHtmlPath?: string; // §6.6 — a build-time HTML input
	codecs?: string; // §7.7

	index?: "static" | "warm" | "lazy"; // default 'warm'
	production?: "exclude" | "include" | "error"; // default 'exclude'

	storybook?: boolean | StorybookSupport;
	docgen?: boolean; // default false in v1 (§15)
}
```

Options resolve in `config()`, not `configResolved()` — see §4.5.

**Structural options require a server restart:** `route`, `fixturesDir`, `include`, `exclude`, `previewEntry`, `previewHtmlPath`, `codecs`, `inventory`. They determine middleware and watcher wiring that cannot be safely rebuilt in place. Changing one in `uight.config.json` prints a message telling the user to restart, rather than half-applying. Non-structural options (`index`, `production`, `storybook`) reload live.

### 4.2 Two path representations

A glob beginning with `/` resolves against the **Vite project root**, not the filesystem.

```ts
interface ResolvedConfig {
	fixturesDirFsPath: string; // /Users/…/project/src   — for the scan
	fixturesDirGlobPath: string; // /src                    — for emitted globs
}
```

Never interchange them. Consequently, **fixtures outside the Vite root cannot be reached by a root-absolute glob naming their filesystem path.** They need a `resolve.alias`, a different root, or generated imports. Document that; do not imply `server.fs.allow` is sufficient.

### 4.3 Virtual modules

v0.6 had `virtual:uight/fixtures` export the renderer's own URL while the renderer imported that same module — a self-referential graph, with needless circular-chunk risk. Split:

| Id                            | Imported by     | Contents                                                   |
| ----------------------------- | --------------- | ---------------------------------------------------------- |
| `virtual:uight/runtime`       | **Both realms** | Fixture index, globs, resolved runtime config              |
| `virtual:uight/renderer-url`  | Host only       | The emitted renderer chunk URL                             |
| `virtual:uight/renderer`      | (entry)         | Frame realm entry. Imports `runtime`, never `renderer-url` |
| `virtual:uight/preview-entry` | Renderer        | Consumer preview entry or a pass-through                   |
| `virtual:uight/codecs`        | Both realms     | Consumer codecs (§7.7)                                     |
| `virtual:uight/inventory`     | Host            | Component auto-detection glob (§12)                        |

The renderer imports only `runtime`; the host imports `runtime` and `renderer-url`. No cycle.

Declarations ship as `uight/client`.

### 4.4 The index scan

One tinyglobby pass at init, producing the fixture list with names (§3.4), the decorator list, collision detection (two files normalizing to one display path is a build error naming both, including via symlink), `hasFixtures` for `production: 'error'`, and manifest counts.

None of that is derivable from a lazy glob expression, since the glob is transformed later and overlapping patterns are deduplicated before runtime sees them. The honest rule is D3: **Vite owns loading, watching and HMR; we own one lightweight index scan.**

### 4.5 Plugin implementation

Three v0.6 defects are fixed here: the production flag was computed by mutating `ResolvedConfig`; fixture add/delete invalidated the module graph without telling the browser; and the watcher read files directly, which races editor saves.

```ts
import type { Plugin, ViteDevServer } from "vite";
import path from "node:path";

const V = {
	runtime: "virtual:uight/runtime",
	rendererUrl: "virtual:uight/renderer-url",
	renderer: "virtual:uight/renderer",
	preview: "virtual:uight/preview-entry",
	codecs: "virtual:uight/codecs",
	inventory: "virtual:uight/inventory",
} as const;
const R = (id: string) => "\0" + id;
const DEV_RENDERER_URL = "/@uight/renderer";

export function uight(options: UightPluginOptions = {}): Plugin {
	let cfg: ResolvedConfig;
	let index: FixtureIndex;
	let rendererRef: string | undefined;
	let server: ViteDevServer | undefined;
	const disposers: Array<() => void> = [];

	return {
		name: "uight",

		// Config is resolved HERE, where Vite documents configuration changes.
		// `env.command` is already available, so nothing needs configResolved,
		// and ResolvedConfig is never mutated.
		config(userConfig, env) {
			cfg = resolveConfig({
				root: userConfig.root ?? process.cwd(),
				options,
				command: env.command,
			});
			index = scanFixtures(cfg);

			if (env.command === "build" && cfg.production === "error" && index.files.length) {
				throw new Error(
					`[uight] production: "error" — ${index.files.length} fixture files present`,
				);
			}

			const enabled = env.command === "serve" || cfg.production === "include";
			return {
				define: { __UIGHT_ENABLED__: JSON.stringify(enabled) },
				...(cfg.previewHtmlPath && env.command === "build"
					? {
							build: {
								rollupOptions: {
									input: { uightPreview: cfg.previewHtmlPath },
								},
							},
						}
					: {}),
			};
		},

		buildStart() {
			if (cfg.command === "build" && cfg.production === "include") {
				rendererRef = this.emitFile({
					type: "chunk",
					id: V.renderer,
					name: "uight-renderer",
				});
			}
		},

		configureServer(s) {
			server = s;
			if (cfg.route) s.middlewares.use(cfg.route, devRouteHandler(s, cfg)); // §6.1
			s.middlewares.use(DEV_RENDERER_URL, rendererHandler(s));
			s.middlewares.use(
				"/@uight",
				readOnlyApi(s, cfg, () => index),
			); // §19.6

			// Raw watcher events are used ONLY for topology: add and unlink.
			// Content changes go through handleHotUpdate, which provides ctx.read()
			// and avoids the empty-file race during editor saves.
			const onTopology = debounce(
				serialize(async (file: string) => {
					if (!isFixtureFile(file, cfg)) return;
					index = await rescanIncremental(index, file, cfg);
					invalidate(s, [V.runtime, V.inventory]);
					s.hot.send({
						type: "custom",
						event: "uight:index",
						data: index.serialize(),
					});
				}),
				40,
			);

			for (const ev of ["add", "unlink"] as const) {
				s.watcher.on(ev, onTopology);
				disposers.push(() => s.watcher.off(ev, onTopology));
			}
			if (cfg.configFile) s.watcher.add(cfg.configFile);
		},

		async handleHotUpdate(ctx) {
			if (ctx.file === cfg.configFile) {
				const next = await safeReloadConfig(cfg, await ctx.read());
				if (isStructural(cfg, next)) {
					ctx.server.config.logger.warn(
						"[uight] structural config change — restart the dev server to apply",
					);
					return [];
				}
				cfg = next;
				invalidate(ctx.server, Object.values(V));
				ctx.server.hot.send({ type: "full-reload" });
				return [];
			}

			if (isFixtureFile(ctx.file, cfg)) {
				// ctx.read() is the safe read; the raw file may be momentarily empty.
				const parsed = parseFixtureFile(await ctx.read());
				if (namesChanged(index, ctx.file, parsed)) {
					index = applyParse(index, ctx.file, parsed);
					invalidate(ctx.server, [V.runtime]);
					ctx.server.hot.send({
						type: "custom",
						event: "uight:index",
						data: index.serialize(),
					});
				}
				return ctx.modules; // ordinary Fast Refresh for the fixture itself
			}
		},

		buildEnd() {
			disposers.splice(0).forEach((d) => d());
		},

		resolveId(id) {
			if ((Object.values(V) as string[]).includes(id)) return R(id);
		},

		load(id) {
			if (id === R(V.runtime)) return generateRuntime(cfg, index);
			if (id === R(V.rendererUrl)) {
				return rendererRef
					? `export const rendererEntryUrl = import.meta.ROLLDOWN_FILE_URL_${rendererRef};`
					: `export const rendererEntryUrl = ${JSON.stringify(DEV_RENDERER_URL)};`;
			}
			if (id === R(V.renderer)) return generateRendererEntry(cfg);
			if (id === R(V.preview)) return generatePreviewEntry(cfg);
			if (id === R(V.codecs)) return generateCodecs(cfg);
			if (id === R(V.inventory)) return generateInventory(cfg);
		},

		generateBundle(_, bundle) {
			emitManifest(bundle, index, cfg);
		},
	};
}
```

The browser learns about topology changes through a namespaced `uight:index` custom event, which the explorer subscribes to. Invalidating a virtual module in the server graph does not by itself cause the browser to re-import it — v0.6 assumed it did.

Rescans are debounced and serialized, and a content change reparses **one file** rather than the corpus.

`import.meta.ROLLDOWN_FILE_URL_<ref>` resolves to the final hashed name at render time. For deployments with an unusual base or non-ESM output, Rolldown's `resolveFileUrl` is the escape hatch (Q7).

---

## 5. The `<Uight />` component

### 5.1 Props

```ts
export interface UightProps {
	filter?: string | string[] | ((path: string) => boolean); // §3.6
	fixture?: FixtureId | string;
	isolation?: "frame" | "inline";
	chrome?: boolean | ChromeOptions;

	selected?: FixtureId | null;
	onSelect?: (id: FixtureId | null) => void;

	router?: RouterAdapter | "history" | "hash" | "none"; // §5.4
	urlParam?: string; // default 'fixture'
	routerId?: string;

	enabled?: boolean;
	fallback?: React.ReactNode;
	loading?: React.ReactNode;

	components?: Partial<UightComponents>;
	theme?: "light" | "dark" | "system";
	height?: number | string | "auto";
	previewDocumentUrl?: string;

	className?: string;
	style?: React.CSSProperties;
}
```

### 5.2 Isolation is an execution model

|                        | `frame`                                            | `inline`                                                     |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| JS realm               | Separate: own `window`, `document`                 | Shared with the host                                         |
| CSS media queries      | Frame viewport                                     | **Page** viewport                                            |
| `matchMedia`, `resize` | Frame                                              | **Parent** — JS-driven responsiveness reports the wrong size |
| Host CSS reach         | None                                               | Full                                                         |
| Host React context     | Unreachable; providers come from the preview entry | Available                                                    |
| Cost                   | A realm, a handshake, a paint                      | Nearly free                                                  |

**Frame mode is not a sandbox.** Same-origin: fixture code can still make authenticated requests, read and write cookies and storage, reach `window.parent`, and trigger server-side mutations. It contains DOM, CSS and ordinary global listeners. Nothing more.

### 5.3 Selection precedence

| Priority | Condition                | Behaviour                          |
| -------- | ------------------------ | ---------------------------------- |
| 1        | `selected !== undefined` | Fully controlled; `router` ignored |
| 2        | `fixture` set            | Pinned; tree hidden                |
| 3        | `router` not `'none'`    | URL-owned                          |
| 4        | otherwise                | Local state                        |

Development errors: `selected` with `fixture`; `selected` with an explicit non-`none` router. Legal: `onSelect` without `selected`. A `fixture` outside `filter` renders anyway, with a warning.

### 5.4 Routing — explicit, not automatic

v0.6 claimed router-agnosticism while calling `history.pushState` directly. Since `pushState` does not emit `popstate`, a host router never learns about the navigation, and hash mode conflicts outright with an app already using a hash router. The claim was too strong.

| `router`                             | Behaviour                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `'none'` (**default when embedded**) | Local state                                                                                                                                            |
| `'history'`                          | We call `pushState` and listen for `popstate`. **Only safe when no host router owns the URL**                                                          |
| `'hash'`                             | Hash parameter. **Incompatible with an existing hash router** — dev error if one is detected via `location.hash` already carrying a route-shaped value |
| `RouterAdapter`                      | You own it                                                                                                                                             |

**For any app with a router, controlled selection is the recommended integration**, and the docs lead with it:

```tsx
const [params, setParams] = useSearchParams();
<Uight
	selected={parseFixtureId(params.get("fixture"))}
	onSelect={(id) => setParams({ fixture: id ? serializeFixtureId(id) : "" })}
/>;
```

The adapter is the middle ground:

```ts
interface RouterAdapter {
	read(): string | null;
	write(value: string | null, opts: { replace: boolean }): void;
	subscribe(cb: () => void): () => void;
}
```

Other rules:

- We update **only our query parameter**. The pathname is never touched, so `BASE_URL` is irrelevant — v0.6 mentioned it in error.
- User selection writes with push; corrections write with replace.
- **Invalid ids by kind:** malformed → removed with replace; well-formed but unknown → **parameter preserved**, empty state shown, because it may become valid after HMR or a deploy; deleted during HMR → preserved until the user selects something else.
- **One owner per resolved key** (`routerId ? `${urlParam}.${routerId}` : urlParam`). A second claimant falls back to local state **identically in development and production**, with a development error added. Environment-dependent routing is worse than either outcome.
- **Ownership is released on unmount and re-acquired on remount**, including across HMR. A StrictMode double-mount must not leave the key permanently claimed — ownership is refcounted, not a boolean.

---

## 6. Rendering

### 6.1 No _required_ HTML file

Nothing is written to your repository. The dev route's document is generated in memory by the middleware; the frame's document is constructed at runtime. A custom preview document (§6.6) is a supported opt-in that does introduce a file — which is why this section is no longer titled "No HTML file."

The dev route handler returns a minimal document that mounts `<Uight />`, passed through `transformIndexHtml` so `@vitejs/plugin-react` injects its Fast Refresh preamble and any nonce handling applies.

### 6.2 Frame bootstrap

The frame's document is served from a **real URL**, not written into `about:blank`.

A document with no creation URL is not merely unusual, it is second-class:
`navigator.serviceWorker.getRegistrations()` throws `InvalidStateError` in one
outright, which takes MSW — and with it every fixture that mocks its network —
down with it, leaving a blank frame whose only evidence is a console line.
Cookies, storage partitioning and `location` are all likewise not what the
fixture would see in the app. The written document also can never pass through
`transformIndexHtml`, which is why §6.3 has to import the React preamble by hand.

Both the dev server and `uight build` therefore emit a preview document of their
own — in memory at `/@uight/preview` in `serve`, and as `preview.html` beside
`index.html` in the static build. Neither writes to your repository (§6.1); the
static build's scaffold lives under `node_modules/.uight/` like the explorer's.

1. Point the iframe's `src` at the preview document's URL.
2. On load, adopt it: it already contains `<div id="uight-root">`.
3. Stamp the theme, and inject our scoped stylesheet (§10.3).
4. Inject `<script type="module" src={rendererEntryUrl}>`.
5. Handshake (§8.2), then render.

`previewDocumentUrl` (§6.6) overrides which URL that is. Writing into
`about:blank` remains the fallback for a mount that has no URL to offer — an
embedded `<Uight />` in an app that ships no preview document — and carries the
initial-load race (Q1) that a served document does not have: create with no
`src`, wait for `contentDocument`, write, and keep a `load` listener for the
about:blank load already in flight.

### 6.3 The renderer entry

The frame document never passes through `transformIndexHtml`, so the React plugin cannot inject its Fast Refresh preamble and transformed modules fail with a "can't detect preamble" error. The generated entry imports it first:

```ts
import "@vitejs/plugin-react/preamble"; // dev only; verify specifier (Q2)
import { mountRenderer } from "@aussieljk/uight/runtime";
import { fixtureModules, decoratorModules, config } from "virtual:uight/runtime";
import * as preview from "virtual:uight/preview-entry";
import * as codecs from "virtual:uight/codecs";

mountRenderer({
	root: document.getElementById("uight-root")!,
	fixtureModules,
	decoratorModules,
	config,
	codecs,
	Providers: preview.Preview,
});
```

The dev URL is public and stable at `/@uight/renderer`. Vite's `/@id/__x00__…` encoding is private and must not be relied on.

### 6.4 The preview entry

Reconstructing the host's global CSS is guesswork, and worse under CSS code splitting where each async chunk gets its own file. The consumer declares what fixtures need, in a module that runs **inside the frame realm**:

```tsx
// src/uight.preview.tsx
import "./styles/global.css";

// Module scope. Constructing this inside the component would hand every
// render a new client and reset fixture state.
const queryClient = new QueryClient();

export function Preview({ children }: { children: React.ReactNode }) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

Because the module executes in the frame realm, Vite's CSS handling targets the frame's document. It is also the only way to supply providers, since React context cannot cross a realm boundary as an element.

Optional. Omitting it yields an unstyled frame and a one-time warning.

### 6.5 Height and viewport

`ResizeObserver` on the frame's `documentElement` when `height="auto"`. Viewport controls are frame-only; inline they render disabled with a tooltip, because inline width is a CSS box and the fixture's media queries still see the page.

### 6.6 Custom preview document — decided

v0.6 offered two options and deferred the choice. **Decision: a Vite HTML input.**

```ts
uight({ previewHtmlPath: "uight/preview.html" });
```

The plugin adds it to `build.rollupOptions.input` (§4.5) and it is served through the dev server's HTML pipeline. `public/` was the alternative and is rejected: files there are copied verbatim, bypassing HTML transformation, which means no preamble injection, no nonce handling, no asset rewriting — precisely the capabilities someone reaches for a custom document to get.

Contract: contains `id="uight-root"`; does not boot the renderer itself; same-origin, so not a security boundary.

- **`previewHtmlPath`** (plugin option) — a build-time file path.
- **`previewDocumentUrl`** (component prop) — a runtime URL.

Neither is required to get a _served_ document: the dev route and the static
build each supply one by default (§6.2). These name a document of **your own**,
for when the default's two divs and a reset are not enough — a `<meta>` the
fixtures read, a font link, a CSP nonce of your issuing.

### 6.7 CSP

1. Read the nonce from the frame document's `csp-nonce` meta if present.
2. For a runtime-constructed document, read the parent's.
3. Apply it to every injected script, style and link.
4. For a custom document, prefer its own.
5. If scripts are blocked, fail with a message naming the missing directive rather than rendering an empty frame.

---

## 7. Control state

The section v0.6 got wrong, and the most important one to get right before M1.

### 7.1 Why the previous model could not work

v0.6 said the UI owned the value of record, opaque values were renderer-local ids, the renderer patched leaves of the original object, and state survived HMR. Those cannot all hold. After HMR the new module produces new functions, elements and defaults; restoring opaque ids from the previous module would inject stale references into a fresh fixture. "Walking the original and setting a leaf" also implies mutation, which may not trigger a render and may target a frozen element or a consumer-owned object.

### 7.2 The overlay model (D17)

**The UI owns an editable overlay. The renderer owns the value.**

```ts
interface InputOverlay {
	input: string;
	revision: number; // the registration this was computed against
	patches: Array<{ path: PathSegment[]; value: EditableWire }>;
}
type PathSegment = string | number;
```

Per render:

1. The renderer calls `useFixtureInput(name, default)`, producing a **fresh** default.
2. It serializes that default to `Wire` and sends `INPUT_REGISTERED { name, revision, wire }`. Opaque leaves get fresh ids valid only for this revision.
3. The UI holds patches for `name` and returns `OVERLAY { name, revision, patches }`.
4. The renderer applies patches **immutably** to the fresh default — structural sharing, new objects along the changed path only.
5. The result is what the hook returns.

Opaque values never travel in a patch. `EditableWire` excludes them by type. So functions, elements and class instances always come from the current module, and HMR is correct by construction rather than by cleanup.

### 7.3 Rules

| Situation                                         | Behaviour                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Duplicate input name in one fixture               | Development error naming the fixture; last registration wins                                                                               |
| Input name changes between renders                | The old overlay is retained for the session keyed by name and reapplied if the name returns. Dropped on fixture change                     |
| Conditional registration                          | An unregistered input's overlay is preserved; the panel shows it greyed and inactive                                                       |
| Fixture calls the setter itself                   | Becomes a root-path patch, so it persists like a panel edit and survives re-render                                                         |
| Stale revision                                    | The renderer rejects patches whose revision predates the current registration and replies `RESYNC`; the UI recomputes against the new wire |
| Patch path not present in the new shape           | Dropped, reported once per input per revision, surfaced in the panel as "N settings no longer apply"                                       |
| Array length shrinks                              | Out-of-range index patches dropped by the same rule                                                                                        |
| Cyclic data                                       | The serializer tracks seen objects and emits `opaque` with label `[Circular]`                                                              |
| Depth beyond 8, or payload beyond 256 KB          | Truncated to `opaque` with a label; a development warning names the input                                                                  |
| Getters, proxies, non-plain objects               | `opaque` unless a codec matches (§7.7). Getters are never invoked during serialization                                                     |
| `__proto__`, `constructor`, `prototype` in a path | **Rejected outright** at the transport boundary, before application                                                                        |
| `Date`                                            | Serialized as an ISO instant in UTC. The editor shows local time with a UTC toggle. Documented plainly: we store instants, not wall times  |
| Reset                                             | Means **the current module's default** — clearing the overlay. "The first-ever default" is not recoverable after HMR and is not offered    |

### 7.4 Wire format

```ts
type Wire =
	| { t: "prim"; v: string | number | boolean | null }
	| { t: "undef" }
	| { t: "bigint"; v: string }
	| { t: "array"; v: Wire[] }
	| { t: "object"; v: Array<[string, Wire]> } // array preserves key order
	| { t: "codec"; codec: string; v: unknown } // §7.7
	| { t: "opaque"; id: number; label: string }; // never in a patch

type EditableWire = Exclude<Wire, { t: "opaque" }>;
```

### 7.5 Registration and the panel

Grouped by input, with type-appropriate editors: text, number with step, checkbox, date, select, and a collapsible tree for arrays and objects. Keyboard-navigable throughout; a control panel needing a mouse fails job 2.

### 7.6 Control metadata is declared, not inferred (D18)

v0.6 expected docgen to supply enum options and descriptions to `useFixtureInput(name, default)`. There is no reliable mapping from an input named `variant` to a particular component prop: a fixture may compose several components, transform values, or expose a control matching no prop at all.

```ts
const [variant, setVariant] = useFixtureInput("variant", "primary", {
	label: "Variant",
	description: "Visual treatment",
	control: "select",
	options: ["primary", "secondary"] as const,
});
```

```ts
interface InputOptions<T> {
	label?: string;
	description?: string;
	control?:
		| "auto"
		| "text"
		| "textarea"
		| "number"
		| "range"
		| "checkbox"
		| "select"
		| "radio"
		| "date"
		| "color"
		| "json";
	options?: readonly T[];
	min?: number;
	max?: number;
	step?: number;
	/** Opt in to docgen metadata for a named prop of a named component. */
	from?: { component: string; prop: string };
}
```

Docgen (§15) contributes only through `from`, an explicit reference. It never guesses.

### 7.7 Value codecs

Without them every domain type — `Money`, a decimal, a branded id — is an uneditable chip, and "editable control panel" quietly means "editable unless the value is interesting."

```ts
export interface FixtureCodec<T = unknown, S = unknown> {
	name: string; // appears on the wire
	test(value: unknown): value is T; // tested before built-ins
	serialize(value: T): S; // S must be structured-cloneable
	deserialize(data: S): T;
	editor?: React.ComponentType<CodecEditorProps<S>>; // omit for display-only
	label?(value: T): string;
}
```

`serialize`/`deserialize`/`test` run in the renderer realm; `editor` renders in the UI realm. A single registry object cannot cross realms, so codecs live in one module both realms import via `virtual:uight/codecs`:

```ts
uight({ codecs: "src/uight.codecs.tsx" });
```

Rules: consumer codecs are tested before built-ins, so `Date` can be overridden; no match falls through to `opaque`; `serialize` output is validated as structured-cloneable in development and fails loudly with the codec name; codecs must be pure, since §7.2's structural sharing assumes the renderer's value is untouched; an unknown codec name on the wire degrades to `opaque` with a warning.

Built-ins for `Date`, `bigint`, `RegExp`, `URL`, `Map`, `Set` and `File` are implemented against this same public interface — the only honest test of whether it is sufficient.

Editors must not land in the renderer chunk. If tree-shaking cannot guarantee that, the module splits into `codecs` and `codecs/editors` (Q6).

---

## 8. Transport and protocol

### 8.1 Two message shapes (D20)

v0.6 typed every message as an envelope carrying `mountId` — but the child must send `READY` before `INIT` gives it a `mountId`. `READY` could not satisfy the contract it was required to satisfy.

```ts
// Before the handshake completes. Not enveloped.
type BootstrapMessage =
	| { type: "READY"; protocolVersions: number[]; rendererVersion: string }
	| {
			type: "INIT";
			mountId: string;
			protocolVersion: number;
			parentOrigin: string;
			initialFixture: FixtureId | null;
			overlays: InputOverlay[];
	  }
	| { type: "INIT_ACK"; mountId: string; protocolVersion: number };

// After. Enveloped.
interface MountedEnvelope<T = MountedMessage> {
	protocolVersion: number;
	mountId: string;
	sequence: number; // per direction
	message: T;
}

type MountedMessage =
	SelectFixture | InputRegistered | Overlay | Resync | Resize | RendererError | Dispose;
```

### 8.2 Handshake

1. Child sends `READY` to `window.parent` with `targetOrigin: '*'` — it does not yet know the parent's origin, and the message carries no secrets. The parent's protection is verifying `event.source` against its own frame's `contentWindow`.
2. Parent verifies `event.source`, selects the highest mutually supported `protocolVersion`, and replies `INIT` with an **exact** `targetOrigin` (its own).
3. Child records `mountId` and `parentOrigin`, replies `INIT_ACK`, and from then on sends only to that exact origin.
4. Parent flushes queued messages.

| Case                          | Behaviour                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| No `READY` within 5s          | Retry `INIT` probe once, then surface a frame-bootstrap error with the renderer URL                                 |
| Duplicate `READY`             | Treated as a frame reload: discard mount state, re-`INIT` with the same `mountId`, replay current overlays          |
| Duplicate `INIT`              | Child ignores after `INIT_ACK` unless preceded by a fresh `READY`                                                   |
| No mutually supported version | Both sides render an explicit version-mismatch panel naming plugin and runtime versions. **Never** silently degrade |
| `mountId` mismatch            | Dropped and counted; a persistent mismatch is a development error                                                   |
| Payload fails validation      | Dropped, reported once per type; every inbound message is validated at runtime, never trusted by type assertion     |

Sequence numbers are **per direction** — one shared counter made each side see phantom gaps whenever the other sent.

Scheduling is injectable (`queueMicrotask` or a `MessageChannel` task); both satisfy the non-reentrancy requirement and M0 settles which (Q3).

---

## 9. Production

### 9.1 Lazy boundaries

**Each fixture _module_ is a lazy dynamic-import boundary. Final chunk structure is bundler-controlled and must be inspected.** Several fixtures share a module (§3.1), shared dependencies hoist, and a module can emit accompanying CSS and asset chunks. "One chunk per fixture" is wrong.

### 9.2 The gate is a compile-time constant

```tsx
declare const __UIGHT_ENABLED__: boolean;
const UightUI = React.lazy(() => import("./ui/UightUI"));

export function Uight(props: UightProps) {
	if (!__UIGHT_ENABLED__ || props.enabled === false) return <>{props.fallback ?? null}</>;
	return (
		<React.Suspense fallback={props.loading ?? null}>
			<UightUI {...props} />
		</React.Suspense>
	);
}
```

`__UIGHT_ENABLED__` is injected via `define` from the `config` hook (§4.5), so `production: 'exclude'` genuinely removes the UI chunk rather than loading it and declining to render. Ship a declaration for non-Vite type-checking, and prove removal with a bundle test (Q5).

### 9.3 Modes and manifest

`'exclude'` (default) · `'include'` · `'error'`.

```
[uight] production build with fixtures INCLUDED
  96 fixture modules → 148 fixtures    entry chunks   3.1 MB
  19 decorators                        shared chunks  0.9 MB
                                       CSS + assets   0.4 MB
                                       unique total   4.4 MB
  source maps: enabled
```

Entry chunks, shared chunks and assets reported separately, plus total _unique_ emitted bytes. No per-fixture size attribution — with shared chunks the number would be fiction.

> Fixtures and their imports are part of your production bundle. Authentication controls who sees the explorer UI; it does not control who can read the JavaScript.

---

## 10. Design and styling

### 10.1 Direction

Recessive: the chrome should disappear next to the fixture. Monochrome plus one accent used only for selection and focus. System UI font stack, one family, three sizes, two weights. No shadows; borders only where whitespace cannot do the job. 4px grid. Light and dark via CSS variables. Keyboard-first, visible focus rings, no hover-only affordances. Motion under 150ms, honouring `prefers-reduced-motion`.

### 10.2 Tailwind v4 internally

CSS-first configuration; tokens in `@theme`. **Never ship preflight** — a published library that resets the host's elements is hostile. Our reset applies only within `.uight-root`.

### 10.3 Dual-mode styling

Consumers usually have Tailwind, but not always, so neither assumption is safe.

**Packaged: compiled, scoped CSS.** Our build compiles our classes and rewrites every rule to require a `.uight-root` ancestor. Works with no host Tailwind, is immune to the host's `@theme`, and cannot leak outward. Preferable to Tailwind's `prefix()`, which requires prefixed class names in _source_ and would break ejected components in any host without the same prefix.

**Ejected: host-native.** Ejected sources are plain Tailwind compiled by the host, inheriting their theme. Use the package and it looks like ours; eject it and it looks like yours. Documented cost: **ejection requires Tailwind v4.**

In frame mode our scoped stylesheet is injected into the frame; the fixture's own CSS arrives via the preview entry. Two compiled stylesheets coexist because ours is scoped.

---

## 11. Ejectable chrome

### 11.1 Installation story

Namespaced registry dependencies only resolve once the namespace is configured. Ship both paths:

```json
// components.json
{ "registries": { "@uight": "https://uight.dev/r/{name}.json" } }
```

```bash
npx shadcn add @uight/fixture-tree
# or, without configuring a namespace:
npx shadcn add https://uight.dev/r/fixture-tree.json
```

- **Versioning:** registry output is published per minor at `/r/v{major}.{minor}/{name}.json`, with `/r/{name}.json` tracking latest. Ejected items record the version they came from in their file header.
- **Mixed versions:** items from different versions may be combined only within one minor. The CLI output states the version installed; `registryDependencies` pin to the same minor.
- **Proof, not plausibility:** an integration test performs a real `shadcn add` into a scratch project and type-checks the result (Q8). The registry example is not considered correct until that passes.

### 11.2 Registry item

```json
{
	"$schema": "https://ui.shadcn.com/schema/registry-item.json",
	"name": "fixture-tree",
	"type": "registry:component",
	"title": "Fixture Tree",
	"description": "Hierarchical navigation for fixtures. Reads useUightChrome().fixtureTree and reports selection through onSelect.",
	"dependencies": ["uight"],
	"registryDependencies": ["@uight/control-panel-inputs"],
	"files": [{ "path": "ui/fixture-tree/FixtureTree.tsx", "type": "registry:component" }]
}
```

**Two schemas, not one.** shadcn publishes `registry.json` for the _index_ and `registry-item.json` for a _single item_; an item carrying the index schema does not validate. Earlier drafts of this section named `registry.json` here, which was wrong — the emitted items use `registry-item.json` and only `registry/registry.json` uses `registry.json`.

`registryDependencies` must be namespaced — a bare `"tree-item"` resolves against shadcn's own registry, and must also name an item this registry actually publishes: `@uight/tree-item` appeared in an earlier draft and is not in §11.3's table. Any `registry:file` entry requires an explicit `target`.

### 11.3 What is ejectable

| Item                                                                                                                           | Ejectable |
| ------------------------------------------------------------------------------------------------------------------------------ | --------- |
| `PreviewShell` — borders, background, toolbar, loading presentation                                                            | **Yes**   |
| `FixtureTree`, `ControlPanel`, `ControlPanelInputs`, `ViewportToolbar`, `Toolbar`, `EmptyState`, `ErrorState`, `InventoryList` | **Yes**   |
| `FrameHost` — document construction, initial-load race                                                                         | No        |
| `RendererBootstrap`, `FrameTransport`                                                                                          | No        |
| Overlay store and serializer                                                                                                   | No        |

**Anything that renders chrome is ejectable; anything that defines fixture semantics or owns the realm is not.**

### 11.4 The frozen surface is the hook facade

```ts
export function useUightChrome(): UightChromeApiV1;
```

Component props stay free to change; the facade is the commitment. Designed in v1, frozen at v1.2 (§21).

Ejected files carry a header naming the project, version and licence, since repository-level licensing does not travel into another repo.

---

## 12. Component inventory

The zero-config experience, and now a v1 feature rather than an afterthought.

With no fixtures present, `/uight` lists what it found:

1. Glob candidate files (`virtual:uight/inventory`).
2. Filter with `oxc-parser`: exported names, PascalCase, function or `memo`/`forwardRef` shape. **No docgen in v1** (§15) — this pass is syntax only, which keeps it fast and dependency-light.
3. Group by directory, matching the fixture tree's shape so the two merge naturally when fixtures appear.
4. **Selecting a component renders it** in frame isolation, behind an error boundary, with required-prop names shown when it fails.

**The limitation is real and belongs in the docs rather than in a banner:** rendering runs your component's real code. Frame isolation contains DOM, CSS and global listeners. It does not contain network requests, storage, cookies or backend effects. The in-app first-run notice was removed — it interrupted every session to say something the docs say once, permanently.

Rendering happens **on explicit selection only** — never on tree expansion, never in bulk, never on hover. An error boundary catches render errors; it does not stop a `fetch`.

Inventory is development-only and is excluded from production builds regardless of `production` mode.

---

## 13. Storybook: a declared subset

```ts
storybook: {
  csfVersion: 3,
  support: {
    metaArgs: true, storyArgs: true, argTypes: true, render: true,
    metaDecorators: true, storyDecorators: true,
    globalDecorators: false, parameters: 'viewport-only',
    globals: false, loaders: false, play: false,
  },
}
```

CSF has decorators at global, component and story level with defined inheritance; `args` and `argTypes` at two levels; `parameters` at three; `includeStories`/`excludeStories`; tags; story context. We support a subset, **declare** it, and badge anything unsupported during normalization. A story that appears to work while silently skipping its interaction logic is worse than one that says it cannot run here.

Storybook applies decorators innermost-first from the array; we nest outermost-first. Reverse when adapting, and test global/component/story precedence together.

---

## 14. MDX

**MDX fixtures.** An `.mdx` file normalizes into a fixture. Upstream implements this purely as bundler configuration — `@mdx-js/rollup` plus the extension — so it is a glob pattern and a transform, not a server feature.

**Documentation pages.** `**/*.docs.mdx` under the fixtures directory is a documentation page: prose that lives beside the components it is about. Mechanically it is a fixture — the same glob map, the same index entry, the same selection and the same frame realm, and one page per module by the rule above — and it carries `docsPage: true` so the tree can say which it is. `docs: false` turns the pattern off, `docs: { fileSuffix }` renames it.

Compiling MDX is still entirely the host's job, and this does not change that: uight exports a component, a host MDX setup puts it in scope, and we do not try to detect whether the host already has an MDX plugin — plugin ordering is configuration, not something to infer. Startup naming a _missing_ plugin is not inference; it reads the resolved list and reports it.

**This is not a documentation framework** (§1.4). No router, no authored navigation, no page hierarchy separate from the fixture tree.

---

## 15. Prop metadata

### 15.1 Not in v1

`docgen` defaults to `false` and prop tables ship in v1.3 (§21). Inventory uses `oxc-parser` alone; control metadata is declared at the call site (§7.6). This removes a dependency, a cache, and a build-time cost from the first release without weakening it.

### 15.2 The TypeScript 7.1 spike

`react-docgen-typescript` resolves types across files and is the better tool for a TypeScript design system, but it drives the compiler API, which TypeScript 7.0 did not ship. **7.1 is now available under `typescript@next`**, so this becomes a spike we can run rather than a wait.

The spike answers three questions, and all three must pass before the TypeScript resolver is adopted:

1. Is the 7.1 API **sufficient** for `react-docgen-typescript`'s needs, not merely present?
2. Does the integration actually work against a real corpus — cross-file interface inheritance, generics, unions?
3. Has `oxlint-tsgolint` shipped a build tracking 7.1, so the repository can move without losing type-aware linting?

Until all three hold, v1.3 ships the Babel resolver behind the same interface, with the documented limitation that props inherited from another file will not appear.

---

## 16. Packaging

### 16.1 One package (D5)

v0.6 referenced five package names and defined three, using an undefined one as an ejected component's dependency. Worse, a multi-package install cannot be two steps. **One published package, `uight`, with subpath exports:**

| Entry           | Contents                                            | Environment |
| --------------- | --------------------------------------------------- | ----------- |
| `uight`         | `<Uight />`, fixture hooks, `defineCodec`, types    | Browser     |
| `uight/vite`    | The plugin, config resolution, index builder        | Node        |
| `uight/runtime` | Renderer mount, protocol, serializer, overlay store | Browser     |
| `uight/chrome`  | `useUightChrome`, chrome component types            | Browser     |
| `uight/client`  | Virtual module declarations                         | Types only  |

`useFixtureInput` is exported from `uight`; the runtime implementation lives in `uight/runtime` and is not imported directly by consumers.

```json
{
	"name": "uight",
	"type": "module",
	"exports": {
		".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
		"./vite": { "types": "./dist/vite.d.ts", "import": "./dist/vite.js" },
		"./runtime": {
			"types": "./dist/runtime.d.ts",
			"import": "./dist/runtime.js"
		},
		"./chrome": { "types": "./dist/chrome.d.ts", "import": "./dist/chrome.js" },
		"./client": { "types": "./dist/client.d.ts" },
		"./styles.css": "./dist/styles.css"
	},
	"sideEffects": ["*.css"],
	"peerDependencies": {
		"react": "^18 || ^19",
		"react-dom": "^18 || ^19",
		"vite": "^8.1"
	},
	"peerDependenciesMeta": {
		"vite": { "optional": true }
	},
	"engines": { "node": ">=20.19.0" }
}
```

- **ESM only.** A project that exists because of `import.meta.glob`, targeting an ESM-only Vite, has no reason to ship CJS.
- **React is external**, never bundled — two React copies would break hooks in inline mode.
- **Vite is an optional peer** so that a consumer who only embeds `<Uight />` in an app built elsewhere is not warned about a dependency they do not use.
- **`sideEffects: ["*.css"]`.** JavaScript entries are side-effect-free; stylesheet imports are side effects.
- **Browser target: Baseline 2024.**

### 16.2 Plugin and runtime version compatibility

Both ship in one package, so they cannot skew by installation — but they can by stale build artefacts or a cached virtual module. The runtime carries the package version; the plugin embeds its own into `virtual:uight/runtime`. On mismatch, the explorer renders an explicit version-mismatch panel (§8.2) naming both, rather than failing in a way that looks like a protocol bug.

Protocol version is negotiated separately (§8.2) so a future split into multiple packages remains possible.

---

## 17. Repository toolchain

### 17.1 Lint and format

`oxlint` with `react`, `react-perf`, `typescript`, `jsx-a11y` and `import` plugins; `correctness` as error. Type-aware linting via `oxlint --type-aware`, backed by `oxlint-tsgolint`, **pinned in lockstep with `typescript`** — tsgolint v7 is built against TypeScript 7.0.2 and its versioning exists to express that coupling.

`tsgo --noEmit` stays a **separate step**. Oxlint's `--type-check` is still experimental; collapsing them is premature.

`oxfmt` with `sortImports: true` — import sorting ships but is off by default. Pinned exactly.

### 17.2 Tools

| Concern         | Tool                              |
| --------------- | --------------------------------- |
| Lint / format   | oxlint, oxfmt                     |
| Bundle          | Rolldown via Vite 8.1             |
| Parse           | `oxc-parser`, a direct dependency |
| Type-check      | tsgo, separate                    |
| Unit test       | Vitest                            |
| Browser test    | **Playwright** (§20.2)            |
| Package manager | pnpm                              |

---

## 18. Independent implementation and compatibility policy

Renamed from "clean-room," which was both a legal conclusion we are not qualified to draw and, given that earlier drafts of this project were designed as a fork, potentially inaccurate as a description of process. Stated factually instead:

1. **No upstream code, tests, or documentation prose is copied into this repository.**
2. **Behavioural compatibility is established from public documentation and separately authored black-box tests**, not by reading implementation source.
3. **Contributors declare prior exposure.** Anyone who has read upstream implementation source — including during this project's earlier fork-shaped drafts — records that in the PR, and does not author the value serializer or the fixture-state machinery.
4. **Naming and branding avoid implying affiliation.** The README states: compatible with react-cosmos fixture files, independently implemented, not affiliated with or endorsed by that project.
5. **Legal characterisation is out of scope for this document.** Whether file formats attract protection, and what obligations follow, requires separate review before any public release. This policy is engineering hygiene, not a legal opinion.

Where a behaviour is genuinely undocumented upstream, specify our own and document the divergence rather than reading source to match it.

---

## 19. Public API surface

Tiers: **Stable** (semver-protected) · **Experimental** (may change in a minor) · **Internal** (not exported).

### 19.1 Components — `uight`

| Export                                                   | Tier         |
| -------------------------------------------------------- | ------------ |
| `<Uight>`                                                | Stable       |
| `<UightProvider>` — shared `components`, `theme`, codecs | Stable       |
| `<Fixture>` — render one fixture, no chrome              | Stable       |
| `<UightErrorBoundary>`                                   | Experimental |

### 19.2 Fixture hooks — `uight`

| Hook                  | Tier         | Signature                                                                |
| --------------------- | ------------ | ------------------------------------------------------------------------ |
| `useFixtureInput`     | Stable       | `<T>(name, initial: T, opts?: InputOptions<T>) => [T, (v: T) => void]`   |
| `useFixtureSelect`    | Stable       | `<T extends string>(name, { options, initial? }) => [T, (v: T) => void]` |
| `useFixtureViewport`  | Stable       | `() => { width: number; height: number }`                                |
| `useFixtureId`        | Stable       | `() => FixtureId`                                                        |
| `useSelectFixture`    | Stable       | `() => (id: FixtureId \| string) => void`                                |
| `useFixtureIsolation` | Experimental | `() => 'frame' \| 'inline'`                                              |

### 19.3 Chrome facade — `uight/chrome`

```ts
export function useUightChrome(): UightChromeApiV1;

export interface UightChromeApiV1 {
	fixtureTree: {
		nodes: TreeNode[];
		expanded: ReadonlySet<string>;
		toggle(path: string): void;
		search(q: string): TreeNode[];
	};
	inventory: { components: InventoryItem[]; enabled: boolean };
	selection: {
		current: FixtureId | null;
		select(id: FixtureId | null): void;
		next(): void;
		previous(): void;
	};
	inputs: {
		registered: RegisteredInput[];
		overlay: InputOverlay[];
		set(name: string, path: PathSegment[], value: EditableWire): void;
		reset(name?: string): void;
	};
	viewport: {
		current: ViewportPreset | null;
		presets: ViewportPreset[];
		set(p: ViewportPreset | null): void;
		supported: boolean;
	};
	status: {
		loading: boolean;
		error: RendererError | null;
		isolation: "frame" | "inline";
		droppedPatches: number;
	};
}
```

### 19.4 Build API — `uight/vite`

| Export                      | Tier         | Purpose                                            |
| --------------------------- | ------------ | -------------------------------------------------- |
| `uight(options)`            | Stable       | The plugin                                         |
| `defineUightConfig(config)` | Stable       | Typed `uight.config.ts`                            |
| `buildFixtureIndex(config)` | Stable       | Standalone scan. Measures parse coverage (§3.5)    |
| `validateFixtures(config)`  | Stable       | Collisions, confinement, unparseable files. For CI |
| `parseFixtureFile(source)`  | Experimental | The single-file classifier                         |
| `resolveUightConfig(opts)`  | Experimental | Config resolution alone                            |

### 19.5 Shared — `uight`

`parseFixtureId`, `serializeFixtureId`, `matchesFilter`, `defineCodec`, and the types `FixtureId`, `FixtureIndex`, `FixtureFileIndex`, `FixtureFileMeta`, `FixtureMeta`, `TreeNode`, `InventoryItem`, `Wire`, `EditableWire`, `InputOverlay`, `InputOptions`, `FixtureCodec`, `CodecEditorProps`, `UightProps`, `ChromeOptions`, `UightComponents`, `UightChromeApiV1`, `RouterAdapter`, `ViewportPreset`, `RendererError`, `UightPluginOptions` — all Stable. `UightTransport`, `MountedEnvelope`, `Scheduler` — Experimental.

### 19.6 HTTP endpoints

**Development only.** Registered solely in `serve` mode, loopback-bound by default, absent in production builds. All read-only — v1 writes no files (§1.4), which removes CSRF and path-confinement risk entirely rather than mitigating it.

| Method | Path                     | Tier     | Returns                                                                  |
| ------ | ------------------------ | -------- | ------------------------------------------------------------------------ |
| `GET`  | `/uight`                 | Stable   | The explorer document (§6.1). Configurable via `route`                   |
| `GET`  | `/@uight/renderer`       | Internal | Transformed renderer entry. Stable URL, opaque body                      |
| `GET`  | `/@uight/index.json`     | Stable   | Fixture index: paths, names, `null` markers, hashes                      |
| `GET`  | `/@uight/inventory.json` | Stable   | Detected components                                                      |
| `GET`  | `/@uight/config.json`    | Stable   | Resolved config echo. Answers "why is my fixture not found"              |
| `GET`  | `/@uight/health`         | Stable   | `{ version, viteVersion, protocolVersion, fixtureCount, indexMode, ok }` |

Prefer the Node API for CI; the HTTP surface exists for tools that cannot import the package — editor extensions, dashboards, scripts.

### 19.7 Deliberately not public

The overlay store implementation; the renderer mount function and handshake; `FrameHost`, `RendererBootstrap`, `FrameTransport`; virtual module contents; the wire format beyond the exported types, where `codec` is the extension point rather than the union; internal tree construction, where `TreeNode` is stable but its production is not.

---

## 20. Testing

### 20.1 Vitest

Parsing and classification, fixture-id round-tripping, serialization and codecs, overlay application and patch dropping, path rejection (`__proto__` and friends), filter semantics, config resolution, index scanning, collision detection, routing utilities, decorator composition order.

### 20.2 Playwright — required, not optional

The M0 questions are browser questions: iframe realm behaviour, Fast Refresh inside a frame, CSP, history, `matchMedia`, focus, and the bootstrap race. Vitest cannot answer any of them.

**Matrix:** Chromium, Firefox, WebKit × React 18 and 19 × dev server and production preview × default base, non-root base, relative base.

**Scenarios:** frame bootstrap and handshake; HMR of a fixture; add, delete and rename; `matchMedia` inside the frame; portals and modals; keyboard-only tree and panel; screen-reader labels; focus restoration after fixture change; CSP with nonces; two mounts on one page; production gate removes the chunk; ejected component under host Tailwind.

### 20.3 Budgets

Measured in CI, failing on regression beyond a threshold:

| Metric                                         | Budget          |
| ---------------------------------------------- | --------------- |
| Plugin startup, 100 fixture modules            | < 300 ms        |
| Plugin startup, 500 fixture modules            | < 1.2 s         |
| Incremental index on one file change           | < 30 ms         |
| Fixture selection to first paint (frame, warm) | < 250 ms        |
| Frame handshake                                | < 100 ms        |
| Chrome bundle, gzipped                         | < 90 KB         |
| Memory after 100 mount/unmount cycles          | no upward trend |
| HMR latency, fixture edit to render            | < 150 ms        |

Budgets are set at M0 from measurements, not guessed; the numbers above are the targets to validate.

---

## 21. Release plan

Earlier drafts put fixture compatibility, static indexing, inline and frame rendering, full controls with custom serialization, routing, production modes, ejection, CSF, MDX, docgen, inventory and a file-writing endpoint into one release. That is several products.

### 21.1 M0 — spikes

Throwaway code, answering what could invalidate the design.

1. Frame realm bootstrap, dev and production (Q1)
2. React Refresh preamble in-frame; public dev renderer URL (Q2)
3. Production renderer emission via `emitFile` and the Rolldown file-URL token (Q7)
4. Glob HMR and the custom-event path; add, delete, rename; Bundled Dev Mode on and off (Q9)
5. Static name indexing coverage against a real corpus
6. Transport scheduling under React 18/19, StrictMode, `startTransition` (Q3)
7. Overlay application across HMR with opaque siblings (Q10)
8. Preview entry: frame-realm CSS and providers
9. Scoped Tailwind against a hostile host stylesheet
10. Production gate removes the chunk (Q5)
11. A real `shadcn add` into a scratch project (Q8)
12. Handshake, queueing, version mismatch

### 21.2 Releases

| Release     | Contents                                                                                                                                                                                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v1.0**    | Discovery and normalization; static index with warm pass and reconciliation; tree, inventory and selection; inline and frame isolation; preview entry; explicit `useFixtureInput` controls with the overlay model and codecs; routing and production modes; replaceable chrome via `components` |
| **v1.1**    | MDX fixtures; the declared CSF subset                                                                                                                                                                                                                                                           |
| **v1.2**    | Ejection registry; **hook facade freezes**                                                                                                                                                                                                                                                      |
| **v1.3**    | Docgen and prop tables, resolver decided by the §15.2 spike                                                                                                                                                                                                                                     |
| **Post-v1** | Fixture scaffolding and any file-writing endpoint, if it earns its security and maintenance cost — which on current evidence it does not                                                                                                                                                        |

v1.0 is the product thesis: two steps to something useful, fixtures when you want more.

---

## 22. Open questions

| #   | Question                                                                                       | Blocks       |
| --- | ---------------------------------------------------------------------------------------------- | ------------ |
| Q1  | Frame bootstrap race across Chromium, Firefox, WebKit                                          | M0           |
| Q2  | Exact preamble specifier for the installed plugin version                                      | M0           |
| Q3  | Which scheduler; does anything tear?                                                           | M0           |
| Q4  | Is the warm pass acceptable by default? It executes module-scope code in development           | M0           |
| Q5  | Does the production gate remove the chunk?                                                     | M0           |
| Q6  | Does the codec module tree-shake so editors stay out of the renderer chunk?                    | v1.0         |
| Q7  | Rolldown file-URL token, and whether `resolveFileUrl` is needed for unusual bases              | M0           |
| Q8  | Does a real `shadcn add` resolve from our registry?                                            | M0           |
| Q9  | Glob invalidation under Vite 8.1, Rolldown, Bundled Dev Mode                                   | M0           |
| Q10 | Overlay reapplication across HMR — does anything stale survive?                                | M0           |
| Q11 | What goes in `UightChromeApiV1`, given it freezes at v1.2                                      | v1.0 design  |
| Q12 | Is the TypeScript 7.1 API sufficient for `react-docgen-typescript`, and has tsgolint followed? | v1.3         |
| Q13 | Does `uight` clear a trademark and npm availability check?                                     | First commit |
| Q14 | Should overlay state persist across reloads?                                                   | v1.0         |

---

## Appendix A — Two steps, then everything else

**Minimum:**

```bash
npm i -D @aussieljk/uight
```

```ts
import { uight } from "@aussieljk/uight/vite";
export default defineConfig({ plugins: [react(), uight()] });
```

Open `/uight`.

**Add fixtures when you want states:**

```tsx
// src/components/Button.fixture.tsx
export default {
	Primary: <Button variant="primary">Click me</Button>,
	Disabled: <Button disabled>Click me</Button>,
};
```

**Add controls when you want to poke at them:**

```tsx
export default () => {
	const [label, setLabel] = useFixtureInput("label", "Click me");
	const [variant] = useFixtureInput("variant", "primary", {
		control: "select",
		options: ["primary", "secondary"] as const,
	});
	return (
		<Button variant={variant} onClick={() => setLabel("Clicked")}>
			{label}
		</Button>
	);
};
```

**Add providers when fixtures need them:**

```ts
uight({ previewEntry: "src/uight.preview.tsx" });
```

**Embed it anywhere:**

```tsx
<Uight fixture="components/Button:Primary" chrome={false} isolation="inline" />

<Uight enabled={user?.isInternal ?? false} fallback={<NotFound />}
        selected={parseFixtureId(params.get('fixture'))}
        onSelect={(id) => setParams({ fixture: id ? serializeFixtureId(id) : '' })} />
```

---

## Appendix B — Glossary

| Term              | Meaning                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| **Fixture**       | One exported component instance from a `*.fixture.*` file                  |
| **Multi-fixture** | A fixture file whose default export is an object; keys are names           |
| **Fixture id**    | `{ path, name }`; canonically `uight:1\|path\|name` (§3.2)                 |
| **Decorator**     | A wrapper applied to fixtures at or below a directory                      |
| **Chrome**        | Tree, control panel, toolbar, viewport                                     |
| **Realm**         | A JavaScript execution context. Frame mode has its own                     |
| **Preview entry** | Consumer module supplying fixture CSS and providers inside the frame realm |
| **Overlay**       | The UI's patch set over the renderer's fresh default (§7.2)                |
| **Opaque**        | A value that cannot cross the realm boundary; never in a patch             |
| **Codec**         | A consumer-supplied transform making a domain type editable (§7.7)         |
| **Warm pass**     | Dev-only background load of files whose names could not be parsed          |
| **Inventory**     | Components detected without fixtures (§12)                                 |

---

## Appendix C — Sources

- react-cosmos fixture modules — https://reactcosmos.org/docs/fixtures/fixture-modules
- react-cosmos lazy mode — https://reactcosmos.org/docs/configuration/lazy-mode
- Vite features, glob import and CSP — https://vite.dev/guide/features
- Vite plugin API — https://vite.dev/guide/api-plugin
- Vite 8.1 release — https://vite.dev/blog/announcing-vite8-1
- Rolldown plugin reference — https://rolldown.rs/reference/Interface.Plugin
- @vitejs/plugin-react — https://github.com/vitejs/vite-plugin-react
- Tailwind CSS — https://tailwindcss.com
- TypeScript 7.0 — https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- Oxlint type-aware — https://oxc.rs/docs/guide/usage/linter/type-aware.html
- Oxfmt sorting — https://oxc.rs/docs/guide/usage/formatter/sorting
- shadcn registry-item — https://ui.shadcn.com/docs/registry/registry-item-json
