# NOTES

Findings recorded during implementation. Each entry names the SPEC/ARCHITECTURE
section it relates to and says whether it is an answer, a divergence, or a
caveat.

---

## Integration log

Changes made while wiring the independently-written parts together. Where these
supersede an entry below, the entry is left in place as a record of how the
problem was found, and marked **SUPERSEDED**.

### `FixtureFileIndex.names` — `[null]` is canonical, `[]` is illegal (RESOLVES three entries)

Three parts disagreed about how a single-fixture file is encoded, and the
disagreement was invisible to the type checker. `shared/tree.ts` and
`ui/UaightUI.tsx` read `[null]` (SPEC §3.4's table); `vite/parse.ts` wrote `[]`,
because `names` was typed `string[] | null` and could not hold `[null]`.

The consequence was not cosmetic: `buildTree` read `[]` as a multi-fixture file
with no children, so **every zero-config single-fixture file was invisible in
the tree** — which is precisely the case SPEC §1.3's job 1 exists to serve.

Fix: `names` is now `Array<string | null> | null`. One entry per fixture, an
entry of `null` meaning "the module's default export is the fixture" — mirroring
`FixtureId.name`, so the two agree by construction. `[]` is not a legal value; it
would be indistinguishable from a file contributing no fixtures. The whole field
being `null` still means undecidable, which is what triggers the warm pass.

Regression test: `tests/parse.test.ts` › "a single-fixture file is selectable in
the tree". It was written as `it.fails` by the agent that found the defect, which
is why the fix was verifiable the moment it landed.

Supersedes: "§3.4's `names: [null]` is not representable", "Known cross-module
defect: the single-fixture marker", "single fixtures warn spuriously on
reconciliation". The reconciliation tolerance for `[]` is retained, since an
index serialized by an older plugin build can still carry it.

### `credit-card.css` is vendored, and the verification that missed it

`credit-card.stories.tsx` imports `./credit-card.css`. Those rules exist in
frosted-ui's source tree but **not** in the published package's `styles.css`
(grep: 0 occurrences of `fui-CreditCard`) — frosted-ui's own Storybook builds
from source, so the story imports the file directly. The file is now vendored
beside the story with a header recording its provenance and MIT copyright. It is
the only local import in the corpus; a scan for other relative imports and for
image assets found none.

**The verification that should have caught it, and did not.** The first sweep
read `#uaight-app` in the *host* document. Fixtures render inside an iframe, so
that check was reading a page which structurally could not contain a fixture
error — it would have passed a completely blank explorer. Rebuilding it against
a deliberately broken fixture (a negative control) exposed two further defects in
the checker itself:

1. The failure pattern did not match `Module error` or `Failed to fetch
   dynamically imported module`, which is exactly how an unresolvable import
   surfaces. The real bug sat in the checker's blind spot.
2. The id builder interpolated `name: null` into the literal name `"null"`, so
   every single-fixture file was probed at a nonexistent id that renders a
   harmless empty state — verified by visiting the wrong URL.

The rebuilt probe reads the frame document, the host, and the Vite error overlay,
and it is validated in both directions: it fails on the broken fixture and passes
on known-good ones. 664 pages (581 stories, 77 overview pages, the hand-written
fixtures) then came back clean.

The lesson is the general one: a checker that has never been observed to fail is
not evidence of anything. `scratchpad/sweep2.mjs` keeps the negative control in
its header comment for that reason.

### The tree collapses self-titled files, and a file is selectable as one page

Two changes to `shared/tree.ts`, both from looking at the frosted-ui corpus in the
browser rather than at the spec.

**Self-titled files collapsed.** `components/accordion/accordion.stories.tsx` is
the near-universal convention, and it produced a directory row and a file row one
inside the other, both saying "accordion". Any single child already carrying its
directory's name *is* that directory to a reader, so the two become one row. This
covers both shapes: a file of many stories, and a self-titled file with exactly
one story (which was showing `quote` then `quote / Default` beneath it). A file
that is **not** self-titled keeps its name — `forms/Input` with one fixture is
still `Input / Primary`, because dropping it would lose which file it came from.

**A file is selectable in its own right**, via a new `ALL_FIXTURES` sentinel
(`"\0all"`, same `\0` trick as `DEFAULT_FIXTURE` so it cannot collide with a real
key). Selecting it renders every fixture in the file as one stacked page, each in
its own error boundary so one broken fixture does not take the page with it. The
individual fixtures move out of the sidebar and into a second toolbar row, and
the sidebar shows them again while a search is active so a fixture can still be
found by name. Because the sentinel is an ordinary `FixtureId.name`, it
serializes, round-trips and deep-links through §3.2 with no special case —
`resolve()` in `UaightUI` is the only place that has to admit it before the
membership check.

Two consequences worth noting:

- **Inputs do not register on the overview page** (`FixtureRuntime.overview`). A
  dozen fixtures each declaring `useFixtureInput("size", …)` would otherwise
  collide on one name under §7.3's duplicate rule, and the panel would drive all
  of them at once. Select a single fixture to get its controls.
- **The overview orders fixtures by the static index, not the module.** A module
  namespace object has its keys sorted by the language spec, so anything derived
  from `Object.keys(module)` comes out alphabetical — `Color` before `Default`.
  The index is parsed from source and preserves declaration order, and it is what
  the tree and toolbar already show. Without this the page and the toolbar
  disagreed about the order of the very same list.

### §13 `parameters` gains a `'viewport-and-layout'` support level

`parameters.layout` is set by 71 of frosted-ui's 72 component story files, and
it is a presentation decision its authors made deliberately. At
`'viewport-only'` every one of those stories renders flush to the top-left,
which misrepresents the component. Rather than widen the demo to
`parameters: true` — declaring support for `docs`, `actions` and `controls` that
does not exist, and so making the §13 badge lie — the union gains one member
between the two: `false | 'viewport-only' | 'viewport-and-layout' | true`.

`FixtureMeta.layout` carries it; `RendererApp` applies it; anything outside the
declared level is still badged. Divergence from §13's sample config, which shows
`parameters: 'viewport-only'` — that remains the default.

### `UaightComponents` gains `ControlPanelInputs`

§11.3 lists it as ejectable in its own right, but `UaightComponents` had no
member for it, so it could not be replaced through `props.components` — the one
documented mechanism for replacement (§1.4, D6). Added, with
`ControlPanelInputsProps`.

### Q5 — the production gate: **ANSWERED, affirmative**

Verified against a real production build of the demo, not by inspection. With
`production: 'exclude'` (the default), `vite build` emits a single JS chunk with
no lazy explorer chunk and no fixture or story code (`badgePropDefs`,
`"Semantic color"` — absent). The only surviving occurrences of "uaight" are the
literal string in the landing page's own copy.

This required writing the gate so Rollup can actually drop it:

```tsx
const UaightUI = __UAIGHT_ENABLED__ ? React.lazy(() => import("./UaightUI.tsx")) : null;
```

SPEC §9.2's sample puts the `React.lazy` call at module scope unconditionally,
which keeps the dynamic import in the graph and emits the chunk regardless of
the flag. The gate then loads the UI and declines to render it — the exact
outcome §9.2 says `'exclude'` must avoid.

---

## Plugin (`src/vite/**`)

### Q2 — the React Refresh preamble specifier: **ANSWERED**

**The specifier is `@vitejs/plugin-react/preamble`, and it exists.**

ARCHITECTURE §1 says "`@vitejs/plugin-react` v6 does not publish a preamble
module". That is not correct for the installed version. `@vitejs/plugin-react@6.0.5`
ships `virtualPreamblePlugin({ name: "@vitejs/plugin-react/preamble" })`
(`dist/index.js`), which `resolveId`s the bare specifier with `order: "pre"` and
loads the bootstrap. `package.json` exports `"./preamble"` as a **types-only**
entry (`types/preamble.d.ts`, which is just `export {}`) — the runtime
resolution never touches node resolution, so the missing `import` condition is
by design, not an omission.

Why that is strictly better than inlining the bootstrap:

1. **Evaluation order is correct.** ES module imports are hoisted and evaluated
   before any body statement. Inlining `RefreshRuntime.injectIntoGlobalHook(window)`
   into the renderer entry's body would run it *after* every static import has
   already evaluated — including `virtual:uaight/preview-entry`, which pulls in
   consumer code that plugin-react has transformed. That module would throw
   "can't detect preamble" before our bootstrap line ever ran. A real module
   evaluates first, in import order.
2. **It self-disables.** The plugin's `load` returns `""` when Fast Refresh is
   off or Bundled Dev Mode is on. An inlined `import "/@react-refresh"` would
   404 in Bundled Dev Mode.
3. **It is a version check.** Asking the plugin container to resolve it (via
   `this.resolve()` inside `load`) answers "is the installed plugin one whose
   preamble I should use" without sniffing versions.

Implementation: `detectPreamble()` in `src/vite/index.ts` tries
`this.resolve("@vitejs/plugin-react/preamble")`, then
`this.resolve("/@react-refresh")`, then gives up.

- `module` → `import "@vitejs/plugin-react/preamble";` as line 1 of the dev
  renderer entry. This is ARCHITECTURE §1's template exactly — the placeholder
  first line was always a bare import; Q2 was only ever about its specifier.
- `inline` → ARCHITECTURE's verbatim `/@react-refresh` bootstrap, used when
  some *other* React plugin (swc, or plugin-react v4/v5) serves the refresh
  runtime. Carries the evaluation-order hazard described above; it is a
  fallback, not the path.
- `none` → nothing. Always the case for `command === "build"`.

**Bonus finding — the guard changed.** ARCHITECTURE's snippet sets
`window.__vite_plugin_react_preamble_installed__ = true`. That flag is
vestigial. In Vite 8.1 the Fast Refresh wrapper is a native Rolldown plugin
(`vite/internal` → `rolldown/experimental`), and the string in the binary is:

```js
if (!window.$RefreshReg$) { throw new Error("… can't detect preamble. Something is wrong."); }
```

So `window.$RefreshReg$ = () => {}` is the line that matters. The inline
fallback sets both, since the old flag is harmless.

Verified live: `GET /@uaight/renderer` against a real dev server returns
`import "/@id/__x00__@vitejs/plugin-react/preamble";` as its first line.

### Q7 — `import.meta.ROLLDOWN_FILE_URL_<ref>`: **DOES NOT EXIST** (divergence from SPEC §4.5)

Confirmed independently: `ROLLDOWN_FILE_URL`, `ROLLUP_FILE_URL` and
`resolveFileUrl` are absent from rolldown@1 and vite@8.1.5. `emitFile` and
`getFileName` are present.

SPEC §4.5's `load()` body for `virtual:uaight/renderer-url` therefore cannot
work as written. Implemented instead as:

- `load()` emits `export const rendererEntryUrl = "__UAIGHT_RENDERER_URL__";`
- `generateBundle` calls `this.getFileName(rendererRef)` and string-replaces
  the placeholder across emitted chunks, prefixed with the resolved `base`
  (read in `configResolved`, read-only).
- The dev branch is unchanged: `/@uaight/renderer`.

Verified: a `production: "include"` build resolves the token to
`/assets/uaight-renderer-<hash>.js` and leaves no placeholder behind.

### SPEC §4.5's `build.rollupOptions.input` sample drops the project's entry (divergence)

`previewHtmlPath` handling as written —
`input: { uaightPreview: cfg.previewHtmlPath }` — **silently deletes the
consumer's own build entry.** Vite only falls back to `<root>/index.html` when
`input` is unset, so naming one input removes the default. A build with
`previewHtmlPath` set produced `dist/uaight/preview.html` and the fixture
chunks, but no `index.html` and no app bundle.

`previewHtmlInput()` in `src/vite/index.ts` merges instead: it normalizes any
existing `input` (string / array / record) to a record, adds the project's
`index.html` when nothing was declared and the file exists, then adds
`uaightPreview`.

### §3.4's `names: [null]` is not representable — single fixtures encode as `[]`

> **SUPERSEDED** by the integration log: `names` is now `Array<string | null> | null`
> and `[null]` is canonical. Kept as the record of how the contradiction was found.

`FixtureFileIndex.names` is typed `string[] | null` in `shared/types.ts`
(already written, authoritative), so §3.4's prose value `[null]` does not
typecheck. Encoding used throughout the plugin and expected by the runtime:

| `names`  | Meaning                                                          |
| -------- | ---------------------------------------------------------------- |
| `null`   | Undecidable (§3.4). Triggers the warm pass (§3.5)                |
| `[]`     | One fixture: the module's default export. `FixtureId.name = null` |
| `[…]`    | Keys of the default-exported object, in source order              |

Known ambiguity: `export default {}` (an object literal with zero keys) is
indistinguishable from a single fixture under this encoding. Vanishingly rare
and degrades to one tree node either way.

### Parse coverage (§3.5, M0 item 5)

Corpus: frosted-ui's own Storybook files, 77 `*.stories.tsx`.

```
decided      77  (100.0%)
undecidable  0
parse errors 0
stories      581
time         105ms  (1.36ms/file)
```

Plus 27 synthetic §3.4/§13 decision-table cases, all passing. §12 inventory
detection over 108 candidate component files: 284 components in 50 ms
(0.47 ms/file), plus 15 synthetic cases.

Comfortably inside §20.3's "plugin startup, 100 fixture modules < 300 ms".

### §3.4: an identifier default export stays undecidable, deliberately

```js
const fixtures = { A: <X/>, B: <Y/> };
export default fixtures;
```

The table says `names: null`, and that is what is implemented, even though the
binding is visible in the same module and cheap to resolve. Resolving it is a
straightforward improvement (walk module-scope `const` initializers) but it is
a spec change, not an implementation detail — the warm pass (§3.5) exists to
cover exactly this.

### `caseSensitive` on `import.meta.glob` — confirmed present

`vite/types/importGlob.d.ts:43`, and `chunks/node.js:28983` reads
`caseSensitiveMatch: options.caseSensitive ?? true`. SPEC §0.1's reason for
requiring `^8.1` rather than `^8.0` holds.

### §4.2 is enforced by the bundler, not only by us

Vite's `import.meta.glob` transform throws
`"In virtual modules, all globs must start with '/'"` outright. The scan
mirrors Vite's crawl options exactly (`dot: false`, `expandDirectories: false`,
`extglob: false`, `ignore: ["**/node_modules/**"]`, `caseSensitiveMatch`) so the
index and the emitted glob keys cannot disagree about which files exist.

A `fixturesDir` outside the Vite root is reported as an `IndexProblem` naming
the directory and suggesting `resolve.alias` / a different root — never
`server.fs.allow`, which does not help.

### Caveat: `include` is not applied to the emitted glob

`import.meta.glob` cannot express an AND of two positive pattern sets, so
`include` narrows the **index** (post-filtered with `shared/filter.ts`'s
matcher, per §3.6) but not the emitted glob, which carries only the suffix
patterns and `!`-negated `exclude` entries. The module map may therefore be a
superset of the index. Harmless — the runtime keys off the index — but worth
knowing when reading `/@uaight/config.json`.

### `IndexProblem.kind` has no `confinement` member

`shared/types.ts` fixes the union to `"collision" | "unreadable" | "unparseable"`.
The §4.2 out-of-root case is reported as `"unreadable"`, which is literally
true (the glob cannot read it) but reads oddly. Worth a `"confinement"` member
if the shared type is ever revised.

### Structural options: three added beyond §4.1's list

§4.1 names `route`, `fixturesDir`, `include`, `exclude`, `previewEntry`,
`previewHtmlPath`, `codecs`, `inventory`. `isStructural` also treats
`fixtureFileSuffix`, `decoratorFileSuffix`, `caseSensitive` and `configFile` as
structural, for §4.1's own stated reason: they decide which paths the watcher
and the emitted globs cover, and cannot be rebuilt in place. `index`,
`production`, `storybook` and `docgen` reload live, as specified.

### `uaight.config.json` is JSON; `defineUaightConfig` types a `.ts` file you import yourself

`resolveUaightConfig` is synchronous per ARCHITECTURE §1, so the file it
discovers on its own must be readable synchronously — JSON. §19.4's
`defineUaightConfig` is an identity helper for a `uaight.config.ts` that the
user imports into `vite.config.ts` and passes to `uaight()`. Inline plugin
options take precedence over the config file.

### §4.4's collision rule is enforced as a build error

A display-path collision throws in `config()` when `command === "build"`,
naming every colliding file. In `serve` it is logged as a warning and the dev
server carries on, because the user is usually mid-rename.

### Dev URLs are also resolvable ids

`/@uaight/renderer` and `/@uaight/dev-entry` are registered in `resolveId`
(serve only) in addition to being served by middleware. Without that, Vite's
pre-transform warm-up of the dev document's `<script src="/@uaight/dev-entry">`
logs `Failed to load url … Does the file exist?` on every page load. The
middleware is still what serves the bytes; the resolver only stops the noise.

### §6.7 CSP: the dev document gets nonces for free

The dev route's HTML goes through `server.transformIndexHtml`, so Vite's
`html.cspNonce` handling applies to our `<style>` and `<script>` tags without
the plugin doing anything. The frame document is constructed at runtime and is
the runtime's problem, not the plugin's.

### Not honoured from SPEC

- **§15 docgen** — `docgen` resolves and is echoed, but nothing consumes it.
  Correct for v1: §15.1 says prop tables ship in v1.3.
- **§3.5 warm pass** — the plugin marks files `names: null` and sets
  `config.index`; performing the background load is the runtime's job.
- **§9.3's exact byte layout** — the summary reports the same four figures in
  the same order, but column widths are computed rather than fixed, so it will
  not be character-identical to the sample.

---

## Demo (`examples/frosted-ui/**`)

### Story corpus: 77 files, 581 stories, none dropped

All 77 of frosted-ui's CSF files were copied into `examples/frosted-ui/src/stories/`
and all 77 parse cleanly under `oxc-parser` (the parser the plugin uses) and
type-check cleanly under `tsc --noEmit -p tsconfig.stories.json`. 581 named
story exports, identical to upstream. No file was deleted.

Layout: `packages/frosted-ui/src/components/<x>/<x>.stories.tsx` →
`src/stories/components/<x>/<x>.stories.tsx`, and
`packages/frosted-ui/.storybook/stories/components/<x>.stories.tsx` →
`src/stories/storybook/<x>.stories.tsx`. Display paths therefore begin
`stories/…` because §4.1's `fixturesDir` default is `src`.

### Import rewrite rules applied

Done by a script, then audited with a per-file diff that confirmed only import
lines (plus the three type references listed below) differ from upstream.

| Upstream specifier                                                              | Rewritten to             |
| ------------------------------------------------------------------------------- | ------------------------ |
| `'..'`, `'../..'`, `'../index'`, `'../<sibling>'`, `'./<self>'`                  | `'frosted-ui'`           |
| `'../../../src'`, `'../../../src/components'`, `'../../../src/components/<x>'`   | `'frosted-ui'`           |
| `'../../theme'`, `'../../../src/theme'`                                          | `'frosted-ui'`           |
| `'../../helpers/emoji-colors'`, `'../../../src/helpers/emoji-colors'`            | `'frosted-ui'`           |
| `'../../icons'`                                                                  | `'frosted-ui/icons'`     |
| `'@storybook/react'`                                                             | local shim `csf-types`   |
| `'@storybook/test'`                                                              | local shim `storybook-test` |

Rule in one line: **every relative specifier becomes `'frosted-ui'`**, because
in the published package everything the stories reach for is at the root. All
rewritten imports in a file are merged into a single `import { … } from
'frosted-ui'`, with `import type { X }` folded in as an inline `type X`
specifier.

### Four internals with no root export — fixed, not dropped

`frosted-ui`'s barrel uses `export * as X from './x'` for compound components,
so types inside those modules are reachable only through the namespace:

- `RootProps` from `accordion/accordion` → `Accordion.RootProps`
- `RootProps` from `callout/callout` → `Callout.RootProps`
- `LightboxZoomRef` from `lightbox/lightbox-zoom` → `Lightbox.LightboxZoomRef`
- `import * as Autocomplete from './autocomplete'` and the same for `Combobox`
  → `import { Autocomplete } from 'frosted-ui'`, since the root export is
  already the namespace object

`InfoCircledIcon` is the one case that needed a subpath: it lives in
`frosted-ui`'s internal `icons` module, which the package's `exports` map
publishes as `frosted-ui/icons` via its `"./*"` entry. That is a public
specifier, so the file was kept.

### Two upstream lines changed, both marked in place

- `storybook/theme.stories.tsx` — `<Card variant="classic">` → `"surface"`.
  `classic` exists on frosted-ui's main branch but not in the published
  `0.0.1-canary.154` the demo installs. Genuine API drift between the clone and
  the registry, not a rewrite artifact.
- `components/popover/popover.stories.tsx` — a local helper's prop type was
  `Record<string, unknown>`, which cannot accept `Popover.Content`'s props
  interface (no index signature). Retyped to
  `React.ComponentProps<typeof Popover.Content>`. This is a pre-existing
  upstream type error; Storybook builds with esbuild and never type-checks
  stories, so it never surfaced there.

### Stubs written

- **`src/stories/csf-types.ts`** — `Meta`, `StoryObj`, `StoryFn`, `Decorator`,
  `Preview` plus the aliases Storybook also publishes. Storybook is genuinely
  not a dependency of the demo.

  One finding worth keeping: a fully permissive shim (`args?: any`) is *worse*
  than a faithful one. Twelve of the original type errors were implicit-`any`
  callbacks inside `args` object literals — `label: (value, percent) => …` in
  `stacked-horizontal-bar-chart` and `onChange: (date) => …` in the date
  stories. They only type-check if the shim recovers args from the meta's
  `component` the way Storybook's own types do. `ArgsOf<T>` in the shim does
  that in six lines and fixed all twelve.

- **`src/stories/storybook-test.ts`** — `fn()`, used by `avatar.stories.tsx`
  for a spy in `args`. Records calls, returns nothing. §13 declares
  `play: false` and `loaders: false`, so there is nothing to assert against and
  no reason to install a test runner.

### Dependency pinning that mattered

- `@internationalized/date` and `@react-aria/i18n` must match the versions
  `react-aria`/`react-stately` resolve to (3.12.2 / 3.13.1 here). A duplicate
  copy of `@internationalized/date` in the tree produces ~17 nominal-type
  errors in the calendar and date-picker stories, because `CalendarDate` from
  one copy is not assignable to `DateValue` from the other.
- `@tanstack/react-form` must be `0.43.2`, not `0.43.0`. `0.43.0` depends on
  `@tanstack/form-core@^0.42.1`, and that combination loses generic inference
  in `form.Field` render props under TS 7 (7 implicit-`any` errors). `0.43.2`
  and `0.44.1` both infer correctly.

### `optimizeDeps.include` is not optional for a lazily-globbed corpus

Fixture and story modules are reached through `import.meta.glob` inside a
virtual module, so Vite's dependency scanner never crawls them from the HTML
entry. Without an explicit `optimizeDeps.include`, the first story you open
triggers a mid-session re-optimize and a full frame reload. The demo lists all
eleven transitive story dependencies.

### The preview entry has no way to read uaight's theme

§6.4 hands the preview entry `{ children }` and nothing else, and the frozen
chrome API (§19.3) is a host-realm hook, so a frame-realm module cannot ask the
explorer what `theme` prop it was given. frosted-ui's Storybook drove
`<Theme appearance>` from a toolbar global, so the demo approximates it by
reading the frame's own environment: an explicit `data-theme` /
`data-uaight-theme` / `.dark` on the frame `documentElement` if the host stamps
one, otherwise `prefers-color-scheme`. Both are observed via
`useSyncExternalStore`, so it follows a change without a reload.

If a future version wants preview entries to honour the `theme` prop, the
cleanest contract would be for the frame host to stamp `data-uaight-theme` on
the frame's `documentElement` — the demo already reads it, and it needs no
addition to the frozen surface.

### Bun's transpiler rejects two stories that are valid TypeScript

`circular-progress` and `radio-button-group` use `<X {...args} key={i} />`.
`Bun.Transpiler` treats a `key` after a spread as a hard error; `oxc-parser`
and `tsc` both accept it. Worth knowing if any tooling in this repo ever routes
fixture source through Bun's transpiler for analysis.

### Demo files not yet verifiable end-to-end

`uaight` is not built, so `src/App.tsx`, the fixtures, the codecs module and
`vite.config.ts` cannot resolve `uaight` / `uaight/vite` and `bun run dev`
cannot start. They were type-checked against a scratch `.d.ts` reproducing
ARCHITECTURE §1–§3's signatures exactly, and are clean against it. Once the
package builds, `bun run --cwd examples/frosted-ui typecheck` should be clean
with no changes.

---

## Styles, build scripts, ejection registry and tests

### §10.3 The scoping transform is a structural pass, not a regex

`scripts/scope-css.ts` walks balanced blocks. Regexes over CSS desynchronise on
the two things Tailwind v4 emits constantly: escaped class names
(`.w-\[calc\(100\%\)\]`, where `\(` must not open a group) and `@supports`
preludes containing parentheses. It recurses into `@media` / `@supports` /
`@layer` / `@container`, leaves `@keyframes` and `@property` alone, and keeps a
rule's body verbatim because a nested selector is already relative to a scoped
parent.

Before / after, verbatim from the build:

```css
:root, :host { … }                       →  .uaight-root { … }
.h-6 { … }                               →  :is(.uaight-root, .uaight-root *).h-6 { … }
*, ::before, ::after, ::backdrop { … }   →  :is(.uaight-root, .uaight-root *), :is(…)::before, … { … }
.hover\:bg-\[var\(--u-bg-hover\)\]:hover →  :is(.uaight-root, .uaight-root *).hover\:bg-\[var\(--u-bg-hover\)\]:hover
```

**`:is(.uaight-root, .uaight-root *)` rather than a plain `.uaight-root `
descendant.** ARCHITECTURE §3 promises every chrome element sits *under* the
root, so a descendant combinator would satisfy the letter of §10.3. But the
natural thing to write is `<div className="uaight-root flex flex-col">`, and
under a strict descendant rewrite those utilities silently do nothing. The
`:is()` form matches the root or anything beneath it, costs ~1 KB gzipped across
the whole sheet, and gives every utility the same specificity.
`scopeCss(css, { includeSelf: false })` restores the strict reading and is
covered by tests.

Two selector shapes need special handling and are tested:

- a leading type selector (`html .a`) cannot be concatenated — `:is(…)html` is
  invalid CSS — so it is confined by descent and then matches nothing, which is
  the right outcome for a sheet that must never reach the host's `html`;
- a comment immediately before a rule is not part of the selector, so leading
  comments are split off before scoping.

### §10.2 What is imported, and the feedback loop that is not obvious

`@import "tailwindcss/theme.css" layer(theme)` plus
`@import "tailwindcss/utilities.css" layer(utilities) source(none)`. Preflight
never enters the graph.

`@source "../**/*.{ts,tsx}"` scans our own source for class names — and
`src/styles/generated.ts` *contains the compiled CSS*, whose selectors the
scanner would happily read back as candidates and keep every utility alive
forever. `@source not "../styles/generated.ts"` breaks that loop. Verified in
4.3.3.

### §10.1 The constraints are enforced by the theme, not by discipline

`--text-*: initial`, `--font-weight-*: initial`, `--shadow-*: initial` and
friends clear Tailwind's default scale before ours is declared, so there is no
fourth font size, no third weight, and `shadow-md` produces no output at all
(probe-verified). `--spacing: 4px` is the 4px grid.

**One family, per §10.1 — including no `--font-mono`.** If a chrome component
reaches for `font-mono` it will silently produce nothing. That is the spec's
constraint, not an oversight; raise it if a monospace column turns out to be
non-negotiable.

### Colour tokens are shared with `src/ui/theme.ts` deliberately

The UI resolves the `theme` prop and sets `--u-*` custom properties inline on
the mount. Our Tailwind colour tokens are declared in an `@theme inline` block
as `var(--u-bg, var(--uaight-surface))` and so on, so:

- `bg-surface` expands to the chain itself and resolves per element, which means
  the UI's inline palette wins wherever it is set;
- `.uaight-root` carries our own light/dark defaults (identical values to
  `theme.ts`'s), so the sheet is complete on its own;
- the two palettes cannot drift into disagreeing about what "muted" is.

`inline` is load-bearing here. Without it Tailwind would emit `--color-fg` onto
the scope element and freeze the `var()` chain at that point.

Light and dark: media query first, then `.uaight-root.uaight-theme-light` /
`.uaight-theme-dark .uaight-root`, so an explicit class wins in **both**
directions at equal specificity. A matching `@custom-variant dark` makes `dark:`
follow the same rule rather than reading `prefers-color-scheme` alone.

### `src/styles/generated.ts` is generated, and staleness is silent

`bun run build:css` writes both `dist/styles.css` and `generated.ts`. It is
wired ahead of `tsdown` in `bun run build`, so a package build is always fresh —
but running `tsdown` alone will happily bundle a stale stylesheet. The script
prints a warning when it produces fewer than 40 utility rules, which is the
signature of a tree where the chrome has not been written yet.
`build-css.ts --check` fails when `dist/styles.css` is stale, for CI.

### §11.2 `$schema` — a documented deviation

§11.2's example puts `https://ui.shadcn.com/schema/registry.json` on a registry
*item*. shadcn publishes two schemas: `registry.json` describes the index,
`registry-item.json` describes an item, and an item carrying the index schema
does not validate. The emitted items therefore use `registry-item.json` and the
index uses `registry.json`. §11.1's "proof, not plausibility" test (Q8) would
have caught this on the first `shadcn add`.

### §11.3 registryDependencies, and the tokens file ejection actually needs

§11.2's example names `@uaight/tree-item`, which is not in §11.3's table. Rather
than publish a phantom dependency the registry could not resolve, the only
dependency emitted is the real one: `control-panel → @uaight/control-panel-inputs`.
Every dependency is asserted to be namespaced *and* to name a published item.

The versioned copies under `registry/v1.0/` rewrite dependencies to absolute
URLs (`https://uaight.dev/r/v1.0/control-panel-inputs.json`). §11.1 says items
may only be combined within one minor; a namespace alone cannot express that,
because `@uaight` resolves to whatever the consumer's `components.json` points
at.

**Ejected components need a token file.** §10.3 says ejected sources are plain
Tailwind compiled by the host, inheriting its theme — but they reference
`bg-sunken`, `text-muted`, `border-line`, which no stock host theme defines.
Every item therefore also ships `src/styles/chrome-tokens.css` as a
`registry:file` targeting `~/styles/uaight-chrome.css`. It defines each token as
`var(--color-neutral-200, #e8e8ea)` and so on, so a host that has retuned its
neutrals gets its own greys: the spirit of "eject it and it looks like yours",
made compilable.

### Known cross-module defect: the single-fixture marker

> **SUPERSEDED** — fixed during integration; the `it.fails` guard below is now a
> passing regression test.

`src/shared/tree.ts` (frozen) and `src/ui/UaightUI.tsx` both read `[null]` as
"the default export is the fixture", per §3.4's table.
`src/vite/parse.ts` writes `[]` (`SINGLE_FIXTURE`), because
`FixtureFileIndex.names` is typed `string[] | null` and cannot hold `[null]` —
which is a genuine contradiction inside the spec.

Consequence today: a single-fixture file reaches `buildTree` as
`names: []`, falls through to the multi-fixture branch, and becomes a `file`
node with `children: []` and no `fixture` — **not selectable at all**. Every
zero-config single-fixture file is invisible.

`tests/parse.test.ts` records this with `it.fails("a single-fixture file is
selectable in the tree")`. When the plugin emits `[null]` (cast, as `tree.ts`
and `UaightUI.tsx` already do) that line will report an unexpected pass, which
is the signal to delete it. The fix belongs in `src/vite/parse.ts`, not in
`tree.ts`, which is frozen and already implements the spec.

### Tests

`tests/**` covers §20.1's list. Modules owned by other agents are loaded through
`tests/helpers/optional.ts`, which imports by *variable* specifier — a literal
would fail the type check for everyone the moment a file is missing. Specifiers
resolve relative to that helper, hence the `../../src/…` form. Each such suite
tries the ARCHITECTURE-documented barrel first (`src/vite/index.ts`,
`src/runtime/index.ts`) and falls back to the concrete module, and reports as
*skipped* rather than passed when neither is there.

At the time of writing every module exists, so nothing is skipped: 264 tests
across 12 files, all passing.

### Verified live against the running plugin

Once the package built, the demo was checked against a real dev server. All of
it holds: `/` and `/uaight` both 200; `/@uaight/index.json` reports 82 fixture
files (77 CSF + 5 hand-written) and 589 names — 581 story exports plus 8
fixture names; zero `problems`; the decorator is found at
`/src/fixtures/uaight.decorator.tsx` with `depth: 1`; `fixtures/swatches` is
correctly `names: null` while `fixtures/swatches-declared` is indexed from
`fixtureNames`; and `fixtures/pricing` carries `''` as a real name alongside
`Plans` and `Receipt`. `/@uaight/inventory.json` finds four components and
classifies `UserChip` as `kind: "memo"`, so §12's syntax filter handles
`memo(forwardRef(…))`.

### Caveat: single fixtures warn spuriously on reconciliation

> **SUPERSEDED** — the plugin now emits `[null]`, so the two encodings agree and
> the warning no longer fires. The tolerance for `[]` is retained for old indexes.

Both single-fixture files log on load:

```
[uaight] fixtures/controls: fixture names changed since the index was built.
  indexed: []
  actual:  [null]
```

This is the encoding mismatch already recorded above ("§3.4's `names: [null]`
is not representable — single fixtures encode as `[]`") reaching §3.4's
reconciliation step, which compares the two representations literally. Nothing
is broken — the fixture renders — but every single-fixture file in every
project will print this, which will train users to ignore the warning that
exists to catch real drift. The fix belongs in the reconciliation comparison:
treat an indexed `[]` and an actual `[null]` as equal.

---

## Runtime (`src/runtime/**`)

Files: `index.ts`, `mount.tsx`, `RendererApp.tsx`, `transport.ts`, `overlay.ts`,
`serialize.ts`, `codecs.ts`, `codec-editors.tsx`, `fixture-context.tsx`,
`normalize.ts`, `csf.ts`, `decorators.ts`, `error-boundary.tsx`.

### §7.3 "fixture calls the setter itself" — how a setter reaches the wire

The row says a local `setValue(v)` "becomes a root-path patch, so it persists
like a panel edit and survives re-render". That works only while `v` is
representable: `Patch.value` is `EditableWire`, which **excludes `opaque` by
type**, so `setValue({ onClick: fn })` has no legal wire encoding at all. Both
halves are implemented, chosen per call by `isFullyEditable(wire)`:

| new value                        | renderer state                         | message to the host                          |
| -------------------------------- | -------------------------------------- | -------------------------------------------- |
| serializes with no opaque leaf   | root patch, merged via `mergePatch`     | `OVERLAY { patches, fromRenderer: true }`     |
| contains a function/element/etc. | a **root override** held renderer-side  | `RESYNC { wire }` — `Wire` may carry `opaque` |

The override supersedes the value for that input at that revision, and is
**discarded the moment the registration's revision changes** — which is exactly
when the module's default moved (an edit, HMR). So a setter's value survives
re-render, as specified, without becoming the stale-reference bug §7.1
describes. The override is never included in `toOverlays()`; it is renderer
state, not host state.

`fromRenderer` on `OVERLAY` is the flag that lets the UI store the patch without
echoing it back as a new edit.

### Q10 — overlay reapplication across HMR: **the model holds, with one caveat**

Nothing stale can survive, because nothing opaque ever enters an overlay: the
UI can only ever send `EditableWire`, and the renderer re-derives every opaque
leaf from the current module on every render. Verified with a fixture whose
default holds a function sibling: the patched field changes, the function comes
back by identity from the *new* module, and the untouched subtrees are
identical by reference (structural sharing).

Caveat, and it is inherent to §7.2 rather than to this implementation: a fixture
whose default is genuinely rebuilt every render (`useFixtureInput("t", new
Date())`) bumps its revision on every render, so the host resyncs on every
render and the panel never settles. `OverlayStore` counts consecutive bumps and
warns once at 25, naming the input and saying to hoist or memoize it, so this
reads as what it is rather than as a protocol fault.

### §7.3 rows — all implemented, none stubbed

| Row                                     | Where                                                              |
| --------------------------------------- | ------------------------------------------------------------------ |
| Duplicate input name                    | `OverlayStore.commitRegistration` — dev error naming the fixture, last registration wins (slots are `useId`, so two call sites are distinguishable) |
| Input name changes between renders      | Overlays are keyed by name and outlive the registration; `releaseSlot` marks the record inactive rather than deleting it |
| Conditional registration                | Same; `INPUTS_SETTLED` carries the active names so the panel can grey the rest |
| Fixture calls the setter itself         | `setFromRenderer` — see the table above                            |
| Stale revision                          | `receiveOverlay` rejects `revision < record.revision` and replies `RESYNC` |
| Patch path not in the new shape         | Presence checked with `wireAt` against the registered wire; dropped and counted; `reportDropped` reports once per input per revision |
| Array length shrinks                    | Same rule — `wireAt` bounds-checks the index                       |
| Cyclic data                             | `serialize.ts` tracks the *ancestor path*, so DAG sharing is not misreported as a cycle; emits `opaque` labelled `[Circular]` |
| Depth > 8, payload > 256 KB             | `[depth limit]` / `[size limit]`, plus one dev warning naming the input |
| Getters, proxies, non-plain objects     | `getOwnPropertyDescriptor` only — a getter becomes `opaque` labelled `[getter]` and is **never invoked**. A proxy is indistinguishable from its target and is documented as such, not pretended away |
| `__proto__`, `constructor`, `prototype` | Rejected at the transport boundary in `receiveOverlay` (whole message invalid), again in `applyOverlayToValue`, and skipped on deserialize, which builds with `defineProperty` so the prototype setter is unreachable |
| `Date`                                  | Built-in codec, ISO instant in UTC; the editor shows local time with a UTC toggle |
| Reset                                   | Clears the overlay; the current module's default is what remains   |

### The wire is checked, the JS value is patched

`shared/wire.ts`'s `applyPatches` works on `Wire`; deserializing a whole patched
`Wire` back to JS would rebuild every object and throw away both identity and
the opaque leaves. `applyOverlayToValue` therefore validates each path against
the **wire** (the only view that knows an `opaque` leaf has no interior) and
applies it to the **JS value** with structural sharing. Zero patches returns the
consumer's own object by identity; nothing the consumer owns is ever mutated.

### `serialize(value, revision, { name })` — a third, optional argument

ARCHITECTURE §2 fixes `serialize(value, revision)`. An optional third argument
was added because two requirements need it: "a development warning **names the
input**" (§7.3) and "opaque ids valid only for the current revision" (§7.2),
which is a per-input lifetime — a serializer shared by every input cannot expire
ids correctly from a revision number alone. Callers that omit it get the old
behaviour under the `""` bucket.

### §7.7 built-ins: no `bigint` codec

§7.7 lists `bigint` among the built-ins, but §7.4's wire format carries it
natively as `{ t: "bigint" }` and the `typeof` check precedes all object
handling, so a bigint codec could never be reached. Implemented: `date`,
`regexp`, `url`, `map`, `set`, `file` — all against the public `FixtureCodec`
interface, which turned out to be sufficient without a single private hook.

`Map`/`Set` of non-cloneable values (a `Map<string, () => void>`) fail the
development structured-clone check and fall through to an `opaque` chip with a
warning naming the codec, which is §7.7's stated behaviour. `File` carries
metadata only; a round-trip reconstructs an empty `File` with the same name,
type and `lastModified`, documented in the module rather than hidden.

### Q6 — codec editors are split, and the split is enforced by imports

`codecs.ts` defines no `editor`. The built-in editors live in
`codec-editors.tsx` and are attached by the UI through `withBuiltinEditors()`.
**`runtime/index.ts` deliberately does not re-export `codec-editors.tsx`**, so
the renderer chunk cannot reach an editor component even if tree-shaking fails.
Consumer codecs keep carrying their own `editor` on the codec object, since that
module is imported by both realms by design (§7.7).

### §13 — a CSF story's identity is its export name, not its display name

Storybook shows `startCase(exportName)` ("HighContrast" → "High Contrast"). But
ARCHITECTURE §1 has the plugin's static parse take "every exported const that is
not `default`/`__namedExportsOrder`, and honour a `name:` property when it is a
static string literal" — the raw export name. If the runtime renamed stories the
index and the runtime would disagree and every deep link into a story without an
explicit `name` would break.

So: **`FixtureId.name` is `story.name ?? exportName`, byte-identical to what the
parser can see**, and the prettier `startCase` form goes to `FixtureMeta.title`,
where the UI can show it and no link depends on it.

### §13 — `parameters: 'viewport-only'` is read strictly

Only `parameters.viewport` is honoured (`{ width, height }`, a
`defaultViewport` + `viewports` table with `styles`, or one of Storybook's stock
`mobile1`/`mobile2`/`tablet`). `layout: 'centered'` — which 71 of frosted-ui's
72 files set — is **not** applied, because the declared support level names
viewport and nothing else. Consequence for the demo: stories render top-left
rather than centred. Honouring `layout` would be a one-line change gated on
`support.parameters === true`, but that is a spec decision, not an
implementation one.

### §13 — what gets badged, and what deliberately does not

`unsupported[]` carries features whose absence changes **what the story does**:
`play`, `loaders`, `globals`, meta/story decorators when switched off in config,
and `render`/`args`/`argTypes` when switched off. It does **not** badge every
unhonoured `parameters` key — badging `parameters.layout` on all 556 stories in
the corpus would drown the one badge that matters. `parameters` is badged only
when support is `false` and the module actually sets some.

`globalDecorators` are declined by construction: `.storybook/preview` is never
loaded, so there is nothing to skip. A preview-*shaped* module (one exporting
`decorators` or `globalTypes`) is detected and badged. App-wide providers belong
in the preview entry (§6.4), and that is what the demo does.

### §13 — CSF args are fixture inputs

An `argType` is a call-site declaration of control metadata, which is precisely
what §7.6 asks for, so each arg is registered with `useFixtureInput` and its
`argType` supplies `InputOptions` (`control` mapped to our `ControlKind`,
`options`, `min`/`max`/`step`, `name` → label, `description`). `control: false`,
`table.disable` and action argTypes register no input. The key list is frozen
when the story is prepared, so the hooks-in-a-loop order is stable.

This is the only reading of `argTypes: true` that means anything: without it,
"we support argTypes" would describe metadata nothing consumes.

### §13 — the story body is a component, because Storybook's is

`renderToCanvas` in `@storybook/react` renders the story function *as a
component*, which is why `render: function Render(args) { const [x] =
React.useState() }` works upstream — and 4 of frosted-ui's files rely on it.
`CsfStoryBody` is a stable module-level component that calls `render(args,
context)` in its own render body, so those hooks land on a stable fiber. A
decorator's `Story` argument is a module-level component reading a context, so
it works whether the decorator writes `<Story />` or calls `Story()`; the
provider sits above the decorator body for the second case.

Decorator order: Storybook's array is innermost-first and story decorators nest
inside meta decorators, so the adapted list is
`[...meta].reverse()` then `[...story].reverse()`, which our outermost-first
composition then nests correctly. Verified against precedence in both directions.

### Corpus result — 72 real Storybook files

All 72 of frosted-ui's `*.stories.tsx` were bundled with every frosted-ui import
replaced by a proxy stub and run through `normalizeModule` for real:

```
stories files       72
import failures      1   (form.stories — the zod stub cannot fake z.string().min())
normalize failures   0
stories normalized 556   = 572 `export const` in the corpus − 16 in form.stories
render errors       45   (511/556 rendered; all 45 are stub artefacts —
                          dotted sub-components like Combobox.ChipsInput, and
                          @tanstack/react-table's real API)
```

Every story in every importable file was found, named and rendered. Spot
assertions against the real modules (`badge`, `select`, `toast`, `dialog`)
confirm arg merging, `argTypes` → controls, literal `name` as identity, a dotted
`meta.component`, and render-only stories with no `component`.

### §8.2 — the case table, and two judgement calls

Implemented: exact `targetOrigin` from the parent, `'*'` only for the child's
`READY`; `event.source` verified against `frame.contentWindow`; per-direction
sequence numbers with a gap warning; duplicate `READY` = frame reload
(same `mountId`, sequences reset, current overlays replayed); duplicate `INIT`
ignored after `INIT_ACK`; `mountId` mismatch dropped and counted with an error
at 5; every inbound message through `validateBootstrap`/`validateEnvelope`;
queueing before ready with a flush on `INIT_ACK`; no `READY` in 5s → one `INIT`
probe → a bootstrap error naming the renderer URL.

1. **No mutually supported version.** §8.2 wants *both* sides to render a
   mismatch panel, but the message set has no "mismatch" message. The host
   therefore sends `INIT` carrying its **own** highest version, which the child
   rejects (it is not in `SUPPORTED_PROTOCOL_VERSIONS`), raises its own panel
   for, and does not ACK. Both sides end up explicit; neither degrades. A later
   `INIT_ACK` cannot clear a protocol error — that state is terminal.
2. **Opaque origins.** `exactTargetOrigin()` falls back to `'*'` when
   `location.origin` is `"null"` (a `file://` document, a sandboxed one),
   because `postMessage` rejects `"null"` as a target outright. A frame we
   created in our own realm is not a trust boundary anyway (§5.2).

`INIT` carries the host's *latest* selection and overlays, not the ones the
transport was constructed with, so a reload replays current state.

### §16.2 version skew is checked in the renderer

`RendererApp` compares `config.protocolVersion` with `PROTOCOL_VERSION` and
`config.version` with `UAIGHT_VERSION`, and renders the mismatch panel plus a
`RENDERER_ERROR` instead of the fixture. That catches a stale build artefact or
a cached virtual module, which §16.2 says is the realistic skew.

### Deliberately left to the host realm

- **§3.5 warm pass and progressive disclosure.** No protocol message carries
  fixture *names* (only `INPUTS_SETTLED`, which is inputs), so the renderer
  cannot report discovered names to the chrome. Both realms import
  `virtual:uaight/runtime`, so the host can do this itself: call
  `fixtureModules[globPath]()` and `normalizeModule(...)` — both exported from
  `uaight/runtime` for exactly this — after first paint, in dev only. Doing it
  renderer-side would require a protocol addition.
- **§6.5 `height="auto"`.** The renderer reports `RESIZE` from a
  `ResizeObserver` on its own `documentElement` (frame mode only), which is
  strictly more reliable than the host observing across the boundary. The host
  can still observe the frame directly; the message is there either way.

### Caveats

- **`useFixtureViewport()` inline reports the host element's box**, not a
  viewport, and the fixture's media queries still see the page. That is §5.2's
  documented inline cost, surfaced rather than papered over.
- **HMR of a fixture module relies on React Fast Refresh**, which preserves the
  component tree and re-renders in place. The runtime does not re-import the
  module on `uaight:index`; a *topology* change (add/delete/rename) reaches the
  runtime as a new `SELECT_FIXTURE` from the host, which re-imports.
- **Q3 (scheduler)** is injectable everywhere and defaults to
  `microtaskScheduler`. Delivery is always scheduled, so a `send()` can never
  re-enter the sender's own render — asserted in the inline transport test.
- **Fixture hooks throw outside a fixture**, naming the hook. No silent
  degradation to `useState`, on the same principle as §8.2's version handling.

---

## Explorer UI (`src/ui/**`, `src/chrome/**`, `src/index.ts`)

### Q1 — the frame bootstrap race: **ANSWERED, and it needs all three defences**

An `<iframe>` with no `src` is handed an `about:blank` document as soon as it is
attached, but the browser also runs that document's own load in its own time.
Two failure modes follow, and which one you get depends on the engine:

- **(a)** `contentDocument` is not yet usable when the effect runs.
- **(b)** It *is* usable, we write into it, and the about:blank load that was
  already in flight then replaces the document — blanking our work.

Neither "write immediately" nor "write on load" survives both. `FrameHost`
does all three of the following, which between them cover every ordering:

1. **Write immediately**, and if `contentDocument` is absent, retry on
   animation frames within a 60-frame budget before reporting a bootstrap
   error. Covers (a).
2. **Keep a `load` listener attached for the frame's whole life.** On every
   load, check whether our `#uaight-root` marker survived; if it did not, write
   again. Covers (b) — and also covers a later navigation blanking the frame.
3. **Guard with a written-flag** so a load event that did *not* blank us is a
   no-op rather than a second document and a second renderer.

The recovery path is not a special case: a rewrite re-runs the renderer entry,
which sends a second `READY`, and §8.2 already defines that as a frame reload
(same `mountId`, overlays replayed). `UaightUI` re-sends `SELECT_FIXTURE`
whenever the transport reports `ready`, so a reload lands on the right fixture.

Ordering that matters and is easy to get wrong:

- The transport is created in a **layout** effect that runs *before* the
  document-writing effect. Creating it after would drop the child's `READY`.
- Both `/@vite/client` and the renderer entry must run in order. The Vite
  client is written into the document body; the renderer script is appended
  afterwards with `script.async = false`, because a dynamically inserted script
  otherwise defaults to `async` and can beat the parser-inserted one.

Verified live against the demo at `/uaight`: two `[vite] connected` lines
(host + frame realm), no bootstrap retries, no duplicate renderer.

### §6.7 CSP: `securitypolicyviolation`, not a timeout

Step 5 asks us to "fail with a message naming the missing directive rather than
rendering an empty frame". A handshake timeout can only say "nothing happened".
`FrameHost` instead listens for `securitypolicyviolation` on the *frame's*
document and reports `e.violatedDirective` and `e.blockedURI` directly, so the
message names the directive the way the spec asks. The 5s handshake timeout in
the transport remains the backstop for everything else.

### §12: detected components cannot travel through `onSelect`

`FixtureTreeProps.onSelect` and the frozen `UaightChromeApiV1.selection.select`
are both `(id: FixtureId | null) => void`, and an `InventoryItem` is not a
`FixtureId`. `InventoryListProps.onSelect` is the only typed channel that can
express selecting one.

So the sidebar renders **two sections**: `FixtureTree` over fixtures, and
`InventoryList` over detected components, both grouped by directory so they
read as the same shape (§12.3's "merge naturally"). `fixtureTree.nodes` on the
facade is still the *merged* tree from `buildTree`, for anyone ejecting one
component and wanting the whole thing.

Consequences, all deliberate:

- `FixtureTree` skips `kind: "component"` nodes.
- A component selection is local state. It is not routed and does not appear in
  the URL, because §19.3's `selection.current` is `FixtureId | null`.
- `j`/`k` traverse fixtures only. `InventoryList` has its own arrow-key roving
  focus.
- `InventoryList` shows no selected state — its props cannot express one. The
  preview toolbar names the current target instead.

If a v2 wants shareable component links, the smallest change is a
`component: { current, select }` group on the facade; nothing else moves.

### §7.5: `ControlPanelInputs` is reached through a context, not through props

§11.3 lists `ControlPanelInputs` as ejectable, but `UaightComponents` in
`shared/types.ts` (frozen, not ours) has no member for it, and
`ControlPanelProps` has no slot to pass one down. Widening either type would
change a published surface.

`ControlPanel.tsx` therefore exports `ControlPanelSlots`, a context carrying
`{ codecs, Inputs }`, which `UaightUI` provides and `ControlPanel` consumes.
`props.components.ControlPanelInputs` is honoured at runtime (see
`chrome/defaults.ts`'s `UaightChromeSet`), but a TypeScript consumer passing it
through `components` will see an excess-property error until `UaightComponents`
gains the member. Worth adding when the shared types are next revised.

### §5.4 ownership: refcount, claimed in a layout effect

`claims: Map<string, number>` keyed by `routerId ? \`${urlParam}.${routerId}\` : urlParam`.
`claim()` increments and returns whether it took the key 0 → 1.

Claiming has to happen in an effect, not during render or in a `useState`
initializer — StrictMode double-invokes both, so a render-phase claim would
count twice and a component would deny itself. `useLayoutEffect` runs before
paint, so nothing is ever painted with a value the mount does not own, and
StrictMode's mount → cleanup → mount cycle nets out to a single claim.

Ownership resolves to `"pending" | "owner" | "denied"`. While pending the
selection reads as `null`; because the arbitration is a layout effect this is
never visible. A denied mount falls back to local state **identically in
development and production**, with a development error naming the key and
suggesting `routerId`.

Verified in the demo: canonical ids round-trip (`?fixture=uaight%3A1%7C…`),
a malformed id (`uaight:9|foo`, unknown version prefix) is removed with
`replaceState`, and a well-formed unknown id keeps its parameter and shows the
empty state.

Note that `?fixture=%%%broken` is *not* malformed: §3.2's convenience form
accepts a bare path, so it parses as `{ path: "%%%broken", name: null }` and is
correctly treated as well-formed-but-unknown.

### §3.5 progressive disclosure runs in the UI realm

There is no protocol message for "here are the real fixture names", so the
warm pass and progressive disclosure both load the module through
`fixtureModules[globPath]()` in the **host** realm — which is what §3.5 already
implies when it calls the warm pass development-only because "it executes
module-scope code". In frame mode the module is therefore evaluated once per
realm. Results are cached by content hash at module scope, so remounts and
StrictMode do not re-run it, and §3.4's reconciliation warning names the file
and both lists.

Selecting an undecidable file keeps the file node selected, renders the first
fixture and shows a note naming it — verified: deep-linking
`uaight:1|fixtures%2Fswatches` leaves the URL untouched and renders with
*Showing "Overview" — the first fixture in this file.*

### `names: []` — now fixed upstream; defence retained

Recorded in the plugin section above as a contradiction between §3.4's `[null]`
and `FixtureFileIndex.names: string[] | null`. Resolved during integration:
`names` is now `Array<string | null> | null`, `[null]` is canonical everywhere
and `[]` is not a legal value. `UaightUI` still normalizes an empty list to
`[null]` — one line, and it turns a silent "unselectable tree node" into a
renderer-reported empty module if any producer ever regresses.

### Theme: custom properties set inline, class kept in sync

`useResolvedTheme` resolves `light | dark | system` via `matchMedia` through
`useSyncExternalStore`, and `themeVars()` writes the palette as `--u-*` custom
properties in the root's `style`. The stylesheet declares its tokens as
`var(--u-bg, var(--uaight-surface))`, so the two cannot disagree; the root also
carries `uaight-theme-light` / `uaight-theme-dark` so the sheet's own light/dark
rules follow the resolved value rather than the media query alone. `theme` is
the only thing that decides — a mount with `theme="light"` inside a dark OS
renders light.

### `.uaight-root` is deliberately NOT an ancestor of the fixture

§6.2 step 3 says to write our scoped stylesheet into the frame document, and the
sheet's reset applies to `.uaight-root *`. Putting that class on `<body>` or
`<html>` would apply our reset — box-sizing, margins, font — to the fixture
itself, which is the one thing a component explorer must not do.

So the frame document is written as:

```html
<body>
  <div id="uaight-root"></div>                       <!-- the fixture, unstyled by us -->
  <div id="uaight-frame-chrome" class="uaight-root"></div>  <!-- for frame-realm chrome -->
</body>
```

The renderer currently styles its error panel with inline styles and does not
use the second div, so it is inert today. It costs nothing and is the right
mount point if frame-realm chrome ever wants our utilities.

### Bundle shape (§9.2, §20.3) — measured

```
dist/index.js            3.42 kB  │ gzip  1.51 kB   eager entry
dist/UaightUI-*.js     127.78 kB  │ gzip 32.71 kB   lazy explorer  (budget: 90 kB gz)
dist/InlineHost-*.js     2.20 kB  │ gzip  1.09 kB   lazy, frame mode never loads it
dist/chrome.js           0.10 kB  │ gzip  0.09 kB   + chrome-context 1.00 kB
```

`uaight/chrome` importing only `chrome-context` is the property that matters:
the frozen facade does not drag the explorer in behind it. `InlineHost` is
lazy for two reasons — it pulls `RendererApp`, and it evaluates the consumer's
preview entry, whose CSS imports would otherwise land in the **host** document
on a frame-mode mount.

### Not honoured from SPEC

- **Fixture-driven viewport defaults (§3.1).** `fileMeta.viewport` and
  `fixtureMeta.viewport` are declared as named exports, so the static index
  never sees them (`FixtureFileIndex` has no meta field) and no protocol
  message carries them to the host. `TreeNode.meta` therefore stays undefined
  and the viewport always starts at Fit. Fixing it needs either a meta field on
  the index or a message; both are contract changes.
- **§7.3 "reported once per input per revision" for dropped patches.** The
  count is correct and deduplicated per input per revision, but the panel shows
  one aggregate *"N settings no longer apply"* rather than naming which input
  lost what. The renderer's `RESYNC` only carries a count, not the paths.
- **Q14 (should overlay state persist across reloads?)** — not persisted.
  Overlays live for the session and are dropped on fixture change, per §7.3.
- **`?` help panel** is an addition, not a spec requirement. It is rendered
  inside the explorer root so it inherits the theme and the scoped sheet.

### Keyboard map

| Keys | Action |
| ---- | ------ |
| `/` | Focus this mount's search box |
| `Esc` | Clear the search; a second `Esc` returns focus to the tree |
| `j` / `k` | Select the next / previous fixture (drives the URL) |
| `↓` / `↑` | Move focus through the tree |
| `→` | Expand a group, or move into it if already open |
| `←` | Collapse a group, or move to its parent |
| `Home` / `End` | First / last visible row |
| `Enter` / `Space` | Select the focused row (or toggle a group) |
| `r` | Reset all controls |
| `?` | Toggle the shortcut list |

Selection in the tree is **explicit** — arrows move focus, `Enter` selects.
Auto-selecting on arrow would render a detected component on mere navigation,
which §12 forbids. `j`/`k` are the select-and-move pair for when that is what
you want. All shortcuts are suppressed while focus is in a text field.

### Verified end-to-end in the demo

`/uaight` against `examples/frosted-ui` (596 fixtures, 82 files): frame
bootstrap with no console errors, tree navigation, `/`-search filtering,
`j`/`k` selection driving `history.pushState`, deep links, malformed vs unknown
id handling, progressive disclosure, the full control panel (text, select,
radio, range, checkbox) with an edit round-tripping into the frame, `Reset` /
`Reset all` appearing on edit, and the inventory section listing detected
components.
