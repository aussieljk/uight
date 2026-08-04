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
read `#uaight-app` in the _host_ document. Fixtures render inside an iframe, so
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
directory's name _is_ that directory to a reader, so the two become one row. This
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
   into the renderer entry's body would run it _after_ every static import has
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
  some _other_ React plugin (swc, or plugin-react v4/v5) serves the refresh
  runtime. Carries the evaluation-order hazard described above; it is a
  fallback, not the path.
- `none` → nothing. Always the case for `command === "build"`.

**Bonus finding — the guard changed.** ARCHITECTURE's snippet sets
`window.__vite_plugin_react_preamble_installed__ = true`. That flag is
vestigial. In Vite 8.1 the Fast Refresh wrapper is a native Rolldown plugin
(`vite/internal` → `rolldown/experimental`), and the string in the binary is:

```js
if (!window.$RefreshReg$) {
	throw new Error("… can't detect preamble. Something is wrong.");
}
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

| `names` | Meaning                                                           |
| ------- | ----------------------------------------------------------------- |
| `null`  | Undecidable (§3.4). Triggers the warm pass (§3.5)                 |
| `[]`    | One fixture: the module's default export. `FixtureId.name = null` |
| `[…]`   | Keys of the default-exported object, in source order              |

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
const fixtures = { A: <X />, B: <Y /> };
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

| Upstream specifier                                                             | Rewritten to                |
| ------------------------------------------------------------------------------ | --------------------------- |
| `'..'`, `'../..'`, `'../index'`, `'../<sibling>'`, `'./<self>'`                | `'frosted-ui'`              |
| `'../../../src'`, `'../../../src/components'`, `'../../../src/components/<x>'` | `'frosted-ui'`              |
| `'../../theme'`, `'../../../src/theme'`                                        | `'frosted-ui'`              |
| `'../../helpers/emoji-colors'`, `'../../../src/helpers/emoji-colors'`          | `'frosted-ui'`              |
| `'../../icons'`                                                                | `'frosted-ui/icons'`        |
| `'@storybook/react'`                                                           | local shim `csf-types`      |
| `'@storybook/test'`                                                            | local shim `storybook-test` |

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

  One finding worth keeping: a fully permissive shim (`args?: any`) is _worse_
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
descendant.** ARCHITECTURE §3 promises every chrome element sits _under_ the
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
`src/styles/generated.ts` _contains the compiled CSS_, whose selectors the
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
_item_. shadcn publishes two schemas: `registry.json` describes the index,
`registry-item.json` describes an item, and an item carrying the index schema
does not validate. The emitted items therefore use `registry-item.json` and the
index uses `registry.json`. §11.1's "proof, not plausibility" test (Q8) would
have caught this on the first `shadcn add`.

### §11.3 registryDependencies, and the tokens file ejection actually needs

§11.2's example names `@uaight/tree-item`, which is not in §11.3's table. Rather
than publish a phantom dependency the registry could not resolve, the only
dependency emitted is the real one: `control-panel → @uaight/control-panel-inputs`.
Every dependency is asserted to be namespaced _and_ to name a published item.

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
`tests/helpers/optional.ts`, which imports by _variable_ specifier — a literal
would fail the type check for everyone the moment a file is missing. Specifiers
resolve relative to that helper, hence the `../../src/…` form. Each such suite
tries the ARCHITECTURE-documented barrel first (`src/vite/index.ts`,
`src/runtime/index.ts`) and falls back to the concrete module, and reports as
_skipped_ rather than passed when neither is there.

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

| new value                        | renderer state                         | message to the host                           |
| -------------------------------- | -------------------------------------- | --------------------------------------------- |
| serializes with no opaque leaf   | root patch, merged via `mergePatch`    | `OVERLAY { patches, fromRenderer: true }`     |
| contains a function/element/etc. | a **root override** held renderer-side | `RESYNC { wire }` — `Wire` may carry `opaque` |

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
back by identity from the _new_ module, and the untouched subtrees are
identical by reference (structural sharing).

Caveat, and it is inherent to §7.2 rather than to this implementation: a fixture
whose default is genuinely rebuilt every render (`useFixtureInput("t", new
Date())`) bumps its revision on every render, so the host resyncs on every
render and the panel never settles. `OverlayStore` counts consecutive bumps and
warns once at 25, naming the input and saying to hoist or memoize it, so this
reads as what it is rather than as a protocol fault.

### §7.3 rows — all implemented, none stubbed

| Row                                     | Where                                                                                                                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate input name                    | `OverlayStore.commitRegistration` — dev error naming the fixture, last registration wins (slots are `useId`, so two call sites are distinguishable)                                                                   |
| Input name changes between renders      | Overlays are keyed by name and outlive the registration; `releaseSlot` marks the record inactive rather than deleting it                                                                                              |
| Conditional registration                | Same; `INPUTS_SETTLED` carries the active names so the panel can grey the rest                                                                                                                                        |
| Fixture calls the setter itself         | `setFromRenderer` — see the table above                                                                                                                                                                               |
| Stale revision                          | `receiveOverlay` rejects `revision < record.revision` and replies `RESYNC`                                                                                                                                            |
| Patch path not in the new shape         | Presence checked with `wireAt` against the registered wire; dropped and counted; `reportDropped` reports once per input per revision                                                                                  |
| Array length shrinks                    | Same rule — `wireAt` bounds-checks the index                                                                                                                                                                          |
| Cyclic data                             | `serialize.ts` tracks the _ancestor path_, so DAG sharing is not misreported as a cycle; emits `opaque` labelled `[Circular]`                                                                                         |
| Depth > 8, payload > 256 KB             | `[depth limit]` / `[size limit]`, plus one dev warning naming the input                                                                                                                                               |
| Getters, proxies, non-plain objects     | `getOwnPropertyDescriptor` only — a getter becomes `opaque` labelled `[getter]` and is **never invoked**. A proxy is indistinguishable from its target and is documented as such, not pretended away                  |
| `__proto__`, `constructor`, `prototype` | Rejected at the transport boundary in `receiveOverlay` (whole message invalid), again in `applyOverlayToValue`, and skipped on deserialize, which builds with `defineProperty` so the prototype setter is unreachable |
| `Date`                                  | Built-in codec, ISO instant in UTC; the editor shows local time with a UTC toggle                                                                                                                                     |
| Reset                                   | Clears the overlay; the current module's default is what remains                                                                                                                                                      |

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
loaded, so there is nothing to skip. A preview-_shaped_ module (one exporting
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

`renderToCanvas` in `@storybook/react` renders the story function _as a
component_, which is why `render: function Render(args) { const [x] =
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

1. **No mutually supported version.** §8.2 wants _both_ sides to render a
   mismatch panel, but the message set has no "mismatch" message. The host
   therefore sends `INIT` carrying its **own** highest version, which the child
   rejects (it is not in `SUPPORTED_PROTOCOL_VERSIONS`), raises its own panel
   for, and does not ACK. Both sides end up explicit; neither degrades. A later
   `INIT_ACK` cannot clear a protocol error — that state is terminal.
2. **Opaque origins.** `exactTargetOrigin()` falls back to `'*'` when
   `location.origin` is `"null"` (a `file://` document, a sandboxed one),
   because `postMessage` rejects `"null"` as a target outright. A frame we
   created in our own realm is not a trust boundary anyway (§5.2).

`INIT` carries the host's _latest_ selection and overlays, not the ones the
transport was constructed with, so a reload replays current state.

### §16.2 version skew is checked in the renderer

`RendererApp` compares `config.protocolVersion` with `PROTOCOL_VERSION` and
`config.version` with `UAIGHT_VERSION`, and renders the mismatch panel plus a
`RENDERER_ERROR` instead of the fixture. That catches a stale build artefact or
a cached virtual module, which §16.2 says is the realistic skew.

### Deliberately left to the host realm

- **§3.5 warm pass and progressive disclosure.** No protocol message carries
  fixture _names_ (only `INPUTS_SETTLED`, which is inputs), so the renderer
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
  module on `uaight:index`; a _topology_ change (add/delete/rename) reaches the
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
- **(b)** It _is_ usable, we write into it, and the about:blank load that was
  already in flight then replaces the document — blanking our work.

Neither "write immediately" nor "write on load" survives both. `FrameHost`
does all three of the following, which between them cover every ordering:

1. **Write immediately**, and if `contentDocument` is absent, retry on
   animation frames within a 60-frame budget before reporting a bootstrap
   error. Covers (a).
2. **Keep a `load` listener attached for the frame's whole life.** On every
   load, check whether our `#uaight-root` marker survived; if it did not, write
   again. Covers (b) — and also covers a later navigation blanking the frame.
3. **Guard with a written-flag** so a load event that did _not_ blank us is a
   no-op rather than a second document and a second renderer.

The recovery path is not a special case: a rewrite re-runs the renderer entry,
which sends a second `READY`, and §8.2 already defines that as a frame reload
(same `mountId`, overlays replayed). `UaightUI` re-sends `SELECT_FIXTURE`
whenever the transport reports `ready`, so a reload lands on the right fixture.

Ordering that matters and is easy to get wrong:

- The transport is created in a **layout** effect that runs _before_ the
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
`FrameHost` instead listens for `securitypolicyviolation` on the _frame's_
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
facade is still the _merged_ tree from `buildTree`, for anyone ejecting one
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

Note that `?fixture=%%%broken` is _not_ malformed: §3.2's convenience form
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
_Showing "Overview" — the first fixture in this file._

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
	<div id="uaight-root"></div>
	<!-- the fixture, unstyled by us -->
	<div id="uaight-frame-chrome" class="uaight-root"></div>
	<!-- for frame-realm chrome -->
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
  one aggregate _"N settings no longer apply"_ rather than naming which input
  lost what. The renderer's `RESYNC` only carries a count, not the paths.
- **Q14 (should overlay state persist across reloads?)** — not persisted.
  Overlays live for the session and are dropped on fixture change, per §7.3.
- **`?` help panel** is an addition, not a spec requirement. It is rendered
  inside the explorer root so it inherits the theme and the scoped sheet.

### Keyboard map

| Keys              | Action                                                     |
| ----------------- | ---------------------------------------------------------- |
| `/`               | Focus this mount's search box                              |
| `Esc`             | Clear the search; a second `Esc` returns focus to the tree |
| `j` / `k`         | Select the next / previous fixture (drives the URL)        |
| `↓` / `↑`         | Move focus through the tree                                |
| `→`               | Expand a group, or move into it if already open            |
| `←`               | Collapse a group, or move to its parent                    |
| `Home` / `End`    | First / last visible row                                   |
| `Enter` / `Space` | Select the focused row (or toggle a group)                 |
| `r`               | Reset all controls                                         |
| `?`               | Toggle the shortcut list                                   |

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

---

## The contract pass — decisions taken before the v1.2 freeze

Everything below changes a published type or the host↔renderer protocol, so it
had to land before §11.4's facade freezes. Recorded here because each one was a
judgement call with a live alternative.

### Q11 — what goes on `UaightChromeApiV1`

**Answered.** Two groups were added and nothing else. The test applied was the
one the freeze implies: _would a chrome component be unable to do its job
without it?_ Anything that failed that test stays off, permanently.

**`component: { current, select, callSites }`.** §12's detected components were
unroutable local state, and the reason is a type: `selection.select` is
`(id: FixtureId | null) => void`, an `InventoryItem` has no fixture file and so
no path-and-name to serialize, and the call site chosen for it is a second axis
of the same selection. Widening `selection` to a union was rejected — the two
really are different selections, and every consumer would then destructure a
union to ask which one it got. `select(null)` clears the component without
selecting a fixture, which is the case local state could not express at all.
`callSites` sits in this group rather than beside `inventory` because a call
site is a usage _of_ a detected component; the palette is not its only reader.

**`palette: { open, setOpen, query, setQuery, items, select }`.** The palette is
ejectable and needs the whole catalogue — fixtures, components and call sites
ranked together. Today it receives that as props from the packaged layout, which
is exactly the arrangement ejection is supposed to survive. `items` is already
filtered and ranked, matching `CommandPaletteProps`, so an ejected palette does
not reimplement ranking to stay consistent with the packaged one.

Deliberately **not** added: the fixture index itself, the transport, the
serializer, the codec list, HMR state. All of them are §19.7 implementation, and
a frozen facade that exposes them freezes them too.

### `RESYNC` carries paths — protocol 2

§7.3 asks for the loss to be "reported once per input per revision"; the
deduplication was right and the payload was not. `RESYNC.dropped` was a count,
so the panel could only aggregate — _"6 settings no longer apply"_ — which tells
the user something is wrong and nothing about what. It now carries the dropped
patch **paths**; the message already carries the input's name, so together they
name the setting. The count is `dropped.length`, so nothing that only wanted a
number lost anything.

That is a shape change in both directions, so `PROTOCOL_VERSION` is 2 and 1 is
not in the supported set. Both halves ship in one package, so the only way to
meet a v1 renderer is a stale build artefact — which §16.2's version-skew panel
already exists to name, and which is better than reading an array as a number.

The host store keeps the same accounting rule and gains `droppedInputs:
DroppedPatchReport[]` beside the existing total, populated from both places a
patch can die: the renderer's report, and the host's own prune on
re-registration.

### Fixture-driven viewport defaults — the index, not a message

`fileMeta.viewport` and `fixtureMeta.viewport` are §3.1 named exports the static
index never saw. Two ways to fix it, and the choice is forced by
`index: "static"`: under it no fixture module is ever executed, so there is
nothing running to send a message _from_, and the viewport is needed **before
the first paint** — a message would arrive after the preview had already opened
at Fit and then resize it, which is worse than not honouring it. So the meta
rides on `FixtureFileIndex` as `fileMeta` and `fixtureMeta`, named after the
exports they mirror, populated by the parser when they are static object
literals and absent when they are not. The renderer still normalizes the real
exports and its answer wins once the module has loaded; the index's copy is a
head start, not a second source of truth.

`shared/meta.ts` owns the precedence — fixture, then file, then Fit — because
three consumers ask (tree, preview, renderer) and one of them getting it wrong
would be invisible.

### The theme stamp

`THEME_ATTRIBUTE = "data-uaight-theme"` on the renderer document's
`documentElement`, values `"light"` and `"dark"`, absent meaning light. An
attribute rather than a message, a context or a prop, because the reader is the
_preview entry_ — the host application's own provider tree, which is not a
fixture, does not use our hooks, and in frame isolation does not share our
realm. A DOM attribute is the one channel every provider can already read, it is
observable, and it adds nothing to the frozen facade. `system` is resolved by
the host before it is stamped; the frame never re-resolves it, so the two realms
cannot disagree. `uaight/runtime` exports `readUaightTheme`,
`subscribeUaightTheme` and `useUaightTheme` so a preview entry does not
hand-roll a `MutationObserver`.

### Q12 — the docgen interface, without the spike

The TypeScript 7.1 route is not attempted here; §15.2's three gates are
unchanged and still open. What ships is the seam, so v1.3 is an implementation
swap rather than a contract change: `DocgenResolver` (`name`, `limitations`,
`resolve`), producing `ComponentDoc[]` of `PropDoc`, carried on the index and
the runtime config as `docs`, keyed by glob path and absent unless `docgen` is
on. `DocgenLimitation` is reported per resolver and per entry rather than hidden
— a prop table that silently omits everything a component inherited is worse
than one that says it did, and `"inherited-props"` is precisely the Babel
resolver's documented blind spot.

D18 is unaffected: these are display metadata, and nothing in the type surface
can be read to infer a control.

### `IndexProblem.kind: "confinement"`

An out-of-root `fixturesDir` was reported as `unreadable`: true of the outcome,
wrong about the cause, since the directory usually reads fine. It is a refusal,
and now says so.

### `ControlPanelInputsProps` moved to `shared/types.ts`

§11.3 lists `ControlPanelInputs` as ejectable in its own right, so its props are
published surface and belong with the rest of it. The component file re-exports
the declaration, so every existing import keeps resolving.

---

## The chrome pass — the explorer as something to live in

The contract pass above settled the types. This one spends them, and everything
below is a judgement about what a keyboard-first tool owes someone who has it
open all day rather than for a screenshot.

### The tree is virtualized, and search is why

`FixtureTree` mapped every row, which was fine: files are leaves, so a collapsed
corpus is a few dozen rows. Search is not that case. Searching sets
`forceOpen: true`, which expands _everything_ — every directory and every file's
fixtures — so the demo's 591 fixtures across 82 files become hundreds of rows,
rebuilt and re-rendered on every keystroke.

Two fixes were available. Capping the result with a "47 more" row is less code
and was rejected: the row somebody is hunting for is as likely to be 60th as 6th,
and a search that hides matches is a worse tool than a slow one. So the list is
windowed, above a threshold (`VIRTUALIZE_ABOVE = 120`) the non-search case never
reaches — which means the ordinary tree is byte-for-byte what it was.

The parts worth recording are the ARIA ones, because a naive virtual list breaks
all of them:

- The padding standing in for the rows outside the window goes on the **scroll
  container itself**, not on spacer elements. `role="tree"` owns its `treeitem`
  children and a spacer `div` between them is a stranger in that relationship.
- `aria-setsize` and `aria-posinset` are **stated**, because a windowed list has
  fewer DOM children than rows and nothing could count them correctly.
- Roving focus goes through the scroll offset, not through `scrollIntoView`: the
  row `ArrowDown` wants may not exist yet. `focusRow` scrolls by index, and a
  `useLayoutEffect` focuses the element on the render where it appears.

### Selection and focus are different shapes now

Both were the accent — selection as `--u-accent-soft` fill, focus as the ring —
and in a tool where roving tabindex means they diverge constantly, two
intensities of one colour is not a distinction. Selection took a solid **left
bar** (`SELECTABLE` / `SELECTED` in `ui/cx.ts`), focus kept the ring. The
transparent bar is always present so selecting a row never shifts its text
sideways by two pixels.

### One overlay, one dismissal model

The palette was a `role="dialog"` with `aria-modal`, a backdrop and Escape; the
help panel was a bare floating `div` with none of the three, pinned bottom-right
over the region fixtures render into. That is two dismissal models in one tool,
which is a defect rather than a styling difference: learning that Escape closes
the palette taught a user nothing about the help panel, and a screen reader was
told one was modal and the other was a paragraph that appeared. `ui/Overlay.tsx`
now owns backdrop click, Escape, the Tab trap and focus restoration, and both
surfaces use it. `aria-modal` is a claim about the rest of the page that nothing
enforces for the Tab key, so the trap is real code.

### `r` is undoable, and the undo is deliberately one step

`r` wiped every tuned control with no way back — the values are not persisted
(Q14) and nothing kept history, so a mis-typed `r` over the tree was final. The
fix is not an undo stack. `OverlayStore.restore()` takes one snapshot the caller
kept and re-applies it against the **current** registration, pruned by the same
§7.3 rule as any other patch: an undo after an HMR restores what still fits and
drops what does not, which is the honest answer. It does not re-report the drop
— that loss was already accounted for when the shape changed, and an undo is not
a new one.

The toast carrying it is in the layout rather than floating over the preview, is
`role="status"`, never takes focus, and lives for 12 seconds when it has an
action — long enough to Tab to from wherever focus happens to be, which is the
constraint a toast with a button has and one without does not.

### Navigation persists; Q14 still stands

Q14 answered "should overlay state persist across reloads" with no. That is an
answer about **values**, and the reasoning — HMR can reshape the module under
them — does not transfer to navigation. A collapsed directory cannot go stale;
at worst it names a key that no longer exists, and an unknown key in that set is
inert. So `ui/session.ts` keeps the collapsed set, the last selection, the
palette MRU list, the two pane widths and the inventory disclosure in
`sessionStorage`, keyed by route _and_ mount for the same reason `routerId`
exists.

`sessionStorage` rather than `localStorage` throughout, including §12's safety
notice: a tab is long enough to survive HMR, a restart and a refresh, and short
enough that nothing accumulates on the user's machine forever. §5.4 is untouched
— the restore runs once, only into a vacuum, waits for the router binding to
resolve rather than guessing during the render where "no parameter yet" and "no
parameter" look identical, and writes with `replace` because reopening a tab is
not a navigation.

### The safety notice was dismissed for the wrong lifetime

`INVENTORY_NOTICE_KEY` lived in `localStorage`, so §12's warning — that rendering
a detected component runs real code with real network, storage and backend
effects — appeared once per browser, ever. It also appeared as soon as an
inventory existed, above an explorer nobody had clicked anything in. It is now
per tab and shown on the first detected component actually rendered, which is the
moment it is about. The text is unchanged: §12 says verbatim.

### Detected components, finished

Three dead ends in one flow, all of them now closed:

- **The first render.** It defaulted to "No props", which for most components is
  a click, a crash and a regex over the stack trace. It defaults to the first
  harvested call site — the most distinct real usage — and "No props" stays as an
  explicit chip, because it is the honest rendering of a component nobody has
  given props to.
- **The chips.** Each `CallSite` carries `globPath`, `line` and `column`, which
  is exactly the argument Vite's `/__open-in-editor` takes. "Open source" acts on
  the selected chip rather than nesting a button inside a `role="tab"`, and it
  distinguishes _no endpoint_ (the static build) from _the editor would not
  launch_, because those need different words. §1.4's "no file-writing endpoint"
  is about us writing files; handing a path to an editor the user is already
  running is not that.
- **The strip.** It carried `role="tablist"` and implemented none of the tab
  pattern — arrows worked only because the explorer's handler was listening
  several elements up. `ui/ChipStrip.tsx` does roving tabindex, automatic
  activation (which is what stepping variants already did), `Home`/`End`, and a
  gradient at each end that appears only when there is something past it.

### Viewport: manual choice is sticky, the fixture's is a default

The viewport reset to Fit on every selection, which defeats the only reason to
pin 375px — walking a list of components at 375px. The state is now
`ViewportPreset | null | undefined`: `undefined` means the user has not chosen
and the fixture's own `fileMeta` / `fixtureMeta` viewport applies (§3.1, via
`shared/meta.ts`); `null` and a preset are both _choices_, including choosing
Fit, and a choice survives changing fixture. A fixture viewport that matches a
preset is named after it, so the toolbar shows a row pressed rather than showing
nothing pressed at a preset's dimensions.

### The type scale was flat, and the fix was not another size

Almost everything was `text-[11px]` or `text-[12px]`, with `14px` on two titles,
so a section header, a group row and a leaf looked alike. The arbitrary values
are gone in favour of the theme's three steps (`text-xs` 11, `text-sm` 12,
`text-base` 13) — which is the point of §10.1 declaring `--text-*: initial` and
then three sizes: a fourth size was never available, it was just spelled in a way
Tailwind could not stop. Hierarchy is weight, tracking and colour instead
(`SECTION_LABEL`), and the two 14px titles became 13px medium.

### What did not change, and why

- **`CommandPaletteProps` and `InventoryListProps` still receive props.** The
  facade now carries the same data (`palette`, `component`, `inventory`), which
  is what an _ejected_ copy needs — it can drop the props entirely and read the
  facade. The packaged layout keeps passing them because those props are the
  published ejection contract (§19.5) and the two sources are the same values;
  making the packaged components ignore their own props would leave a published
  type that does nothing.
- **No published type was widened.** The named-drop notice reads
  `ControlPanelProps.droppedInputs`, which the contract pass added; the tree's
  virtualization is internal; the resizers, the overlay primitive, the chip strip
  and the help dialog are all `src/ui/*`, not `src/ui/chrome/*`, so nothing
  ejectable gained a prop.
- **The chrome bundle is 55.6 KB gzipped**, up from 41.2. Inside §20.3's 90 KB,
  and now the metric most likely to fail first.

---

## Plugin, CLI and CI pass

Node-side work: path aliases at call sites, the static build's scaffold, portless
MCP, `uaight doctor`, terminal problem reporting, measured budgets, MDX, and the
§3.4 identifier row.

### §3.4 — the identifier row changed, and the decision table with it

`const fixtures = {…}; export default fixtures` was undecidable. That was a
decision about effort rather than about knowability: the initializer is written
down in the same module, three statements up. It now resolves, and the table in
SPEC §3.4 and in `src/vite/parse.ts` gains a row above the old one:

| Default export                                         | Result           |
| ------------------------------------------------------ | ---------------- |
| Identifier bound to a module-scope `const` initializer | that initializer |
| Identifier assigned elsewhere                          | `names: null`    |

The binding qualifies only when it is a module-scope `const`, has an
initializer, and is the only module-scope declaration of that name. `let`, `var`,
an import, a destructuring pattern and a redeclaration all stay undecidable —
in every one of them the initializer is not the final value, and finding out
what is would need the scope analysis this pass exists to avoid. Chains resolve
(`const a = {…}; const b = a; export default b`) with a cycle guard, because a
half-typed file can contain `const a = b; const b = a` and must not hang.

Once resolved, the _rest_ of the table applies unchanged: a resolved object with
a spread is still undecidable, a resolved element is still a single fixture.
That is what keeps this one row rather than a second table.

**It did not move the corpus.** frosted-ui's 83 files still report exactly one
undecidable file, because they are CSF modules and the undecidable one is
undecidable for a different reason. The win is for handwritten fixture files,
which is where the shape appears — it is worth having, and it is not worth
claiming a number for.

### §3.1 — `fileMeta` and `fixtureMeta` reach the index

Both are read by `parseFixtureFile` when they are static object literals and
carried on `FixtureFileIndex`. They are on the index rather than in a protocol
message for the reason the contract pass gave: the only consumer that needs them
is the viewport the preview opens at, which has to know before first paint, and
under `index: "static"` no module is ever executed to send a message from.

The reader is deliberately narrower than the call-site reader — JSON only, no
identifiers, no template interpolation. The value is embedded in the generated
runtime module and crosses a realm boundary; anything that is not JSON must not
enter it. Anything unreadable stays absent, and the renderer's normalization of
the real export wins once the module loads.

The one thing worth flagging for a future editor: both the initial scan and the
content-change path build index entries, and an earlier version of this change
added the fields to only one of them, so `fileMeta` vanished on the first edit.
Both now go through `fixtureEntry()`, and `tests/scan.test.ts` asserts the
rescan case specifically.

### Aliases at call sites — a prefix match, not the resolver

Call sites were name-matched, and `@/components/Button` never resolved because
doing it "properly" means running Vite's plugin container per import inside a
scan that is meant to be one cheap pass. It resolves now by prefix-matching
against the alias table, which costs a string comparison per import.

Three details that are not obvious:

- **RegExp finds are dropped, not approximated.** A regex alias can rewrite any
  part of a specifier, and a half-implementation produces a _wrong_ module path
  rather than no answer. Vite's own internal aliases are all RegExp, so dropping
  them also reduces the table to what the user wrote.
- **A string alias matches on a path boundary.** An alias of `@` must not
  swallow `@acme/ui`, which is a package.
- **No extension probing and no index-file resolution.** The display path is
  extension-free by construction, so `@/components/Button` and `./Button.tsx`
  normalize to the same string without either being stat'd. A specifier naming a
  directory resolves to that directory's path and simply matches no file, which
  is the same mild miss as not resolving it at all.

**Where the table comes from is a compromise.** The initial scan runs in
`config()`, because that is where `production: "error"` and collisions must be
decided; the authoritative alias table only exists at `configResolved`. So
`config()` reads `userConfig.resolve.alias` and `configResolved` compares the
resolved table against it, rescanning only if the _string_ entries actually
differ. In the ordinary case they do not — Vite's additions are all RegExp — so
the second scan almost never happens, and when a plugin really did add an alias
the index is right rather than nearly right.

### The static build no longer writes into the project root

`uaight build` wrote `uaight-explorer.html` and `uaight-explorer.entry.js` next
to the user's own `index.html` and removed them in a `finally`. A crash in
between left both in their working tree — `.gitignore` covered it, which is a
plaster, not a fix.

They live under `node_modules/.uaight/` now, which is the established place for
this (`.vite`, `.cache`, `.bin`), is git-ignored everywhere already, and makes a
leftover invisible and harmless. Rollup names an HTML output by its path
relative to the root, so the emitted document lands at
`node_modules/.uaight/uaight-explorer.html` inside the output directory and is
moved to `index.html` — one directory deeper than the rename the old placement
already needed. The now-empty `node_modules` tree is removed from the output, so
the site carries no trace of how it was made.

The virtual-HTML-input route stays rejected, and ROADMAP's reason stands: Vite
resolves `<script src>` against the document's real location and rewrites asset
URLs from it, so a virtual document has to reimplement enough of that to become
its own source of defects.

A side benefit worth naming: the build no longer has to _reserve_ two filenames
in the user's root, so it no longer refuses to run because they happen to own a
file called `uaight-explorer.html`.

### MCP is portless, and discovery is lazy

`--url http://localhost:5173` was a default that is wrong for everybody running
two projects — Vite takes 5174 for the second — and the failure it produced was
a connection error naming a port the human never used.

The probe is `/@uaight/health`, not `GET /`. A port answering HTTP is not
evidence of anything, and attaching to the wrong project's dev server and
reporting its fixtures is worse than finding nothing; the response has to parse
as JSON and carry a numeric `protocolVersion`. Every candidate is probed
concurrently and the lowest answering port wins, so the answer does not depend
on which probe returned first.

**Discovery is deferred to first use, not done at startup.** An agent starts its
MCP servers before the human starts a dev server, so resolving eagerly would
fail every session that happened in that order. The _result_ is cached and the
_failure_ is not, so the next tool call after the dev server comes up succeeds
without restarting anything.

Failure is a message naming every port probed, what was asked of each, and the
three ways to fix it (`--url`, `UAIGHT_URL`, start the server). ROADMAP's
observation that MCP has no screenshot tool is untouched by any of this.

**Vite writes no discoverable state naming its port** — no lock file, no
`.vite/port`; the address lives only in the process that owns it. A sweep is
therefore the whole of what is possible from a separate process. That is a
finding, not a shortcut.

### `uaight doctor`

`/@uaight/config.json` already answered "why is my fixture not found", to a
client that can reach a running dev server. That is the wrong shape for the
moment the question is asked: the tree is empty, so the explorer is exactly what
the user does not trust, and "open the explorer to find out why the explorer is
empty" is a loop.

`uaight doctor` runs the same scan from a shell against a project that need not
be serving, and prints the resolved config, both of §4.2's path representations,
the patterns actually emitted, the counts, the feature flags and every problem
grouped by kind. It exits non-zero on a collision only — that is the one problem
kind that makes fixture ids ambiguous, so it is the one worth failing a CI step.

**Its documented blind spot:** options passed inline to `uaight()` in
`vite.config.ts` are arguments to a function call in a module the CLI does not
execute, so only `uaight.config.json` is visible. Run it against the demo and it
reports `storybook off` and 6 files, where the dev server reports 83 — which is
correct and would be baffling unsaid, so the report says it.

### One line in the terminal for index problems

A user who never opens `/uaight` never learned their `fixturesDir` was
unreadable. Startup now logs one line: a count per kind, the first offender's
message in full, and a pointer to `uaight doctor` for the rest. Counting without
an example tells nobody which file to look at; printing eleven of them is
scrollback nobody reads.

### §20.3 — the budgets, and what they actually measure

`scripts/bench.ts`, wired into CI. Measured on this machine at the time of
writing, best-of-N against a generated synthetic corpus:

| Metric                               | Budget   | Measured |
| ------------------------------------ | -------- | -------- |
| Plugin startup, 100 fixture modules  | < 300 ms | 21 ms    |
| Plugin startup, 500 fixture modules  | < 1.2 s  | 95 ms    |
| Incremental index on one file change | < 30 ms  | 0.1 ms   |
| Chrome bundle, gzipped               | < 90 KB  | 54.3 KB  |

Three decisions inside the harness are worth keeping:

- **Best-of-N, not the mean.** A budget asks whether the code _can_ meet a
  bound; the mean answers a question about the machine it ran on, and on a
  shared CI runner it is dominated by the neighbours. A budget that fails on a
  noisy neighbour is a budget that gets disabled.
- **A generated corpus, not the demo.** Otherwise the startup numbers drift with
  whatever the demo happens to contain, and a budget that moves for reasons
  unrelated to the code is not a budget.
- **"Chrome bundle" is the `UaightUI-*` chunk specifically.** That is the code a
  host downloads _because_ uaight is there and exactly what §9.2's production
  gate removes; summing every non-Node chunk would fold in the renderer and the
  serializer and stop tracking the thing that grows when a panel is added. It
  moved from 41.2 KB to 54.3 KB during this pass, entirely from concurrent UI
  work, and it remains the metric most likely to breach first.

**Four of §20.3's eight rows are not measured, deliberately.** First paint, the
frame handshake, memory across mount/unmount cycles and HMR latency all need a
browser driving a real dev server. A number produced for them by a Node stub
would read as proof and would not be. They stay with the Playwright matrix.

### §14 — MDX, and an ordering check that would have been wrong

The plugin's half was already done. Added: the demo fixture
(`examples/frosted-ui/src/fixtures/mdx-notes.fixture.mdx`, which the golden
corpus now indexes as file 83 and fixture 592 — one fixture, as §14 requires),
`@mdx-js/rollup` in the demo's config, a test suite, and a startup check that
names the missing plugin and the install command instead of letting Rollup
produce an `Unexpected token`.

**The ordering check was written, measured, and removed.** The obvious rule —
"MDX emits JSX, so `mdx()` must come before the React plugin" — fires on every
correctly configured project. Vite sorts by `enforce` before array order, and
`@vitejs/plugin-react`'s `vite:react-babel` is a `pre` plugin, so a plain
`mdx()` **always** resolves after it whatever the user wrote. Verified against
the demo: with `plugins: [mdx(), react(), uaight()]` the resolved order is

    vite:react-babel … vite:react-refresh … @mdx-js/rollup … uaight

and `transformRequest("/src/…/Notes.fixture.mdx")` returns compiled JSX regardless
— the output goes through Vite's own JSX pipeline downstream, not through the
`pre` plugin that ran before it. So there is no ordering mistake here for a user
to make, and only presence is checked. This is the second time in this project
that a plausible check turned out to be a false positive generator; the pattern
is worth noticing.

Nothing is injected and nothing is reordered: §14's "we do not try to detect
whether the host already has an MDX plugin" is about inferring configuration,
and reading the resolved list to say what is missing is the opposite of that.

### Q8 — the registry, and the honest boundary

`$schema` is settled. shadcn publishes two schemas — `registry.json` for the
index, `registry-item.json` for an item — and an item carrying the index schema
does not validate. The build already emitted the right one; SPEC §11.2's example
did not, and has been corrected, along with its `@uaight/tree-item` dependency,
which names an item §11.3 never listed.

`tests/registry-resolve.test.ts` is a client rather than another shape
assertion. It serves `registry/` over a real loopback HTTP server and walks it
the way `shadcn add` does: resolve a `{name}` URL template as a
`components.json` `registries` entry would, fetch the item, follow
`registryDependencies` transitively (dependencies before dependents), and write
every `files[]` entry to the path its `target` or its type dictates. It asserts
the resulting tree — that `ControlPanel.tsx` lands under the components
directory, that `uaight-chrome.css` lands where its `target` says, that no
item's files could escape the project, and that the versioned copies pin
absolute one-minor URLs.

**Q8 stays open, and the two remaining unknowns are specific.** Nothing here
proves the items are reachable at `https://uaight.dev/r/…`, which is what the
versioned copies point at and what has never been hosted; and nothing here runs
shadcn's own resolver, so its schema validation, its `components.json` path
aliasing and its dependency installer are still untested against these files.
What is now proved is everything that is a property of the files themselves.

### Q9 — glob invalidation, and the half that Node can answer

Q9 has two halves and only one of them is a Node question: whether **the index**
tracks the topology, which is what the `uaight:index` event carries and what the
tree renders from. `tests/scan.test.ts` exercises add (appears in sorted
position, not arrival order), delete (disappears and takes its problems),
rename (both events, including the moment between them when both files exist), a
genuine display-path collision appearing and clearing, an irrelevant file
changing nothing, and that the emitted glob _patterns_ do not move when the
corpus does — which matters because Vite invalidates a glob by its pattern, so a
pattern that changed with the file list would make every add a new module id.

**Bundled Dev Mode was not exercised and this pass does not claim it was.** It
needs a browser re-evaluating the glob map after the server-side invalidation,
which is precisely what a Node test cannot observe. Q9 stays open on that half,
and it belongs to the Playwright matrix, not here.

### Q4 — the warm pass, still not measured where it counts

Q4 asks whether executing module-scope code in development is acceptable by
default. The Node-side half of the answer is now cheap to state: the warm pass
executes exactly the modules the static parser could not decide, and on the
demo corpus that is **1 file out of 83**. The §3.4 identifier row above can only
reduce that number.

That is the _count_, not the _cost_. What Q4 actually asks — what one of those
module executions costs on a large, side-effect-heavy corpus, in a browser,
after first paint — cannot be measured from Node, because the modules are JSX
that only exists compiled inside a dev server. Q4 remains open, with the
observation that the exposure is one module per undecidable file and that a
corpus with a low undecidable rate is barely exposed at all.

### §15.2 — the Babel docgen resolver

`createBabelDocgenResolver()` implements the `DocgenResolver` interface the
contract pass shipped, and `index.docs` is populated when `docgen` is on. This
is explicitly **not** the TypeScript 7.1 route, which Q12 blocks on all three of
§15.2's gates.

Two things about it are deliberate:

- **`react-docgen` is not a runtime dependency.** The package ships two, and
  `docgen` defaults to `false` (§15.1); making every install pay for a Babel
  parser to support an off-by-default feature is the wrong trade. It is imported
  dynamically, the import result is cached _including the failure_, and an
  absent package produces one message naming the package and the fix rather than
  a crash or silence.
- **The limitation is carried on every doc, not documented in a README.**
  `inherited-props` is the headline: `react-docgen` reads one module's AST, so a
  component whose props extend `React.ComponentPropsWithoutRef<"button">` or a
  shared `BaseProps` gets what is written in _this_ file and nothing else — and
  that is most design-system components. A prop table that silently omits
  everything a component inherited is worse than one that says so, so
  `ComponentDoc.limitations` makes the caveat impossible to render without.

Docgen rides the inventory pass rather than opening a second glob, which has a
consequence worth stating: with `inventory: false` there are no docs, and a
production build has none either, because the inventory pass is development-only
(§12). Nothing in the UI consumes `docs` yet, which is expected — v1.3.

### Repository scripts

- **`typecheck` was misleading.** A bare `tsc --noEmit` only means anything
  after a build, because `uaight/client` resolves `RuntimeConfig` through the
  package's own `dist`. The exposed script is now `build && tsc`, and the
  build-less form is `typecheck:only`, which `verify` and `check` call because
  they have already built.
- **`bun run check` is the local gate**, distinct from `verify`. `verify` ends
  in `npm publish --dry-run` and asserts version lockstep and the registry
  build; running it to answer "is my change alright" is asking npm about a
  publish nobody intends. `check` runs stylesheet freshness → build → typecheck
  → lint → format → test, in that order, and the first two orderings are rules
  rather than preferences (the stylesheet check before the build or it compares
  the build against itself; the build before the type check, as above).
- **`.oxfmtrc.json` is committed and `oxfmt --check` is in CI, but the repo is
  not reformatted.** The config is `useTabs`, `tabWidth: 1`, `printWidth: 90`,
  chosen by measurement: it disagrees with 165 files where the default config
  disagrees with 243. **CI's format step and `bun run check` will fail until the
  reformat commit lands** — that is the intended state, and the reformat is
  deliberately a separate change so it does not bury everything else in
  whitespace.

---

## The Playwright matrix (§20.2, §20.3)

`playwright.config.ts` at the repository root, everything else under `tests/e2e/`.
Chromium 145, Firefox 153 and WebKit 26.5 all installed and all actually run;
none is config-only. 149 tests pass, 42 are `fixme`, 0 fail.

### The shape of the matrix, and why it is not the cartesian product

§20.2 asks for 3 engines × 2 Reacts × 2 build modes × 3 bases = 36 cells. The
config decomposes it instead: the **full engine sweep** runs on the default
configuration, because engine differences are the entire reason §20.2 exists,
and each remaining axis gets one targeted Chromium project carrying only the
tests that axis can break. A non-root base cannot change how WebKit orders an
about:blank load; it can change whether the renderer URL resolves.
`PLAYWRIGHT_FULL_MATRIX=1` expands every axis project across all three engines
and gives the literal 36 cells for a release run — verified to enumerate.

The subject is a purpose-built host app (`tests/e2e/fixture-app`), not the demo.
It carries one mode switch (`?mode=`) covering two mounts, inline isolation, an
ejected `FixtureTree` under the host's own Tailwind, and a mount/unmount cycler,
so one built artefact serves every scenario. The React 18 cell is the _same_
application with `root` pointed at it and React aliased in — copying it would
let the two cells drift.

Selectors are roles, ARIA names and the documented data attributes only. Nothing
in the suite selects on a class or on DOM shape, because the UI is being
rewritten underneath it.

**One worker, deliberately.** `hmr.spec.ts` edits files on disk while every
project shares one dev server; with parallel workers those edits land in the
middle of unrelated tests as a frame reload, which reads as flake.

### Q1 — the frame bootstrap race: all three defences now have a test

The highest-value result. Each of `FrameHost`'s three defences fails a specific
test if removed:

1. write-immediately-and-retry — the plain "the frame renders" test;
2. the lifelong `load` listener that rewrites a blanked document — a test that
   navigates the frame to `about:blank` from the outside and requires the
   fixture to come back. That is the same event ordering (b) produces, delivered
   deterministically instead of hoped for;
3. the written-flag guard — exact counts: one `script[data-uaight-renderer]`,
   one `#uaight-root`, one `READY` per document; exactly **two** `READY`s after
   a deliberate blanking, never three.

All pass on Chromium, Firefox and WebKit, with StrictMode on and off. §8.2's
"the reload lands on the right fixture" is covered too. **Q1's answer now holds
in three engines rather than one.**

### Six defects the matrix found

Each is a `fixme` naming the defect, never a weakened assertion.

1. **A control-panel edit does not reach the frame.** The panel updates; the
   fixture keeps rendering its module default; no console error either side.
   Plain `useFixtureInput("label", "Click me")`, deep-linked, frame isolation,
   React 19, Chromium — and in a production build too. Everything downstream
   (Reset, drop-on-fixture-change, both `?state=` link tests) is blocked on it.
2. **Inline isolation never receives a selection.** `data-uaight-inline` is
   present, the preview entry runs, the toolbar says `inline` — and the renderer
   shows "No fixture selected." for the initial deep link, a tree click and a
   later `pushState` alike. Reproduced with and without a `previewEntry`, so it
   is not `InlineHost`'s deferred `RendererApp` mount.
   `createDirectTransportPair` reports `status: "ready"` from the first read, so
   the host has nothing to wait for.
3. **Two mounts under StrictMode: neither ends up owning the URL.** With
   StrictMode off, §5.4 is exactly right — the first mount renders the deep
   link, the second falls back to local state and logs the error naming the key.
   With StrictMode on (the default here and in most real apps) _both_ render the
   empty state. `router.ts` claims in a layout effect "so StrictMode's mount →
   cleanup → mount cycle nets out to a single claim"; with two claimants it does
   not.
4. **A rename leaves the old path in the tree.** `rename(2)`, one atomic move:
   the new path appears and is selectable, the old row stays and is still
   selectable, deep-linking to a file that no longer exists. A plain _delete_
   prunes correctly, so it is the rename path specifically. Q9, with a
   browser-level answer for the rename case.
5. **A fixture edit reloads the host document.** The update does arrive, but as
   a fresh realm: a `window` expando set before the edit is gone after it, and
   `page.evaluate` dies with "execution context destroyed". NOTES.md's model is
   "React Fast Refresh… preserves the component tree and re-renders in place".
   Adding a file reloads too, which is the expected `import.meta.glob`
   invalidation; an in-place _edit_ reloading is not.
6. **The CSP failure does not name the violated directive.** §6.7 step 5's
   "rather than rendering an empty frame" half is met — an alert appears. The
   naming half is not: under a real nonce policy with the nonce withheld,
   Chromium produces "The renderer entry could not be loaded from
   /@uaight/renderer." or the 10 s handshake timeout, never `script-src`. Both
   are the generic paths, so the `securitypolicyviolation` listener is not
   firing or is losing the race — and naming the directive is the only reason
   that listener exists.

### The six defects, fixed — and what each one actually was

Every `fixme` above is gone; the assertions are unchanged. None of the six was
where its symptom pointed, and two were not regressions from the concurrent UI
work at all — they were in files untouched since the initial upload.

1. **The control-panel edit.** Two independent causes, and the transport was
   innocent — `OVERLAY` was never sent, so there was nothing to lose. First,
   `ControlPanelInputs`'s text editors reported only on blur or Enter, so the
   panel's own `draft` state showed the new value while no patch existed; a
   `select` and a `checkbox` on the same fixture always worked, which is what
   made it look like a text-specific transport fault. They are live now, and the
   `draft` still owns the keystroke, which is what "typing must never fight the
   renderer" actually required. Second, the `?state=` parameter of the fixture
   being _left_ was seeded onto the fixture being _arrived at_: `UaightUI`'s seed
   effect ran on the commit where `targetKey` changed but the URL had not yet
   been rewritten, so §7.3's "overlays are dropped on fixture change" was
   observably false. A token equal to our own last write is no longer seeded, and
   `store.seed` is now called unconditionally — patches that never found their
   input used to lie in wait for a later fixture using the same input name.
2. **Inline isolation.** Also two, and both are StrictMode-shaped.
   `InlineHost`'s layout-effect cleanup disposed the `useMemo`-created transport
   pair, so StrictMode's setup → cleanup → setup published a pair that had
   already latched `disposed`: correct for a resource an effect acquired, wrong
   for one `useMemo` produced. A direct pair owns no listener and no timer, so
   nothing is leaked by not disposing it. Underneath that,
   `createDirectTransportPair` delivered into whatever subscriber set existed at
   send time, and the two ends of a direct pair never come up together — the host
   end sends `SELECT_FIXTURE` from a layout effect, the renderer end does not
   exist until `InlineHost` has measured its root and imported the preview entry.
   It queues per direction while that direction has no subscriber now, which is
   the frame path's INIT queue by another name.
3. **Two mounts under StrictMode.** A refcount cannot say _who_. React remounts
   effects one fiber at a time, so with two claimants the real order is
   `A.setup(1) B.setup(2) A.cleanup(1) A.setup(2) B.cleanup(1) B.setup(2)` — the
   count never returns to zero while A re-claims, so A was denied its own key and
   nobody owned the parameter. Ownership is arbitrated by a stable per-instance
   sequence now: A's `seq` is below B's however many times either re-claims.
   Releasing also re-announces, so the second mount takes over when the first
   really unmounts, which the refcount could never express either.
4. **The rename.** Not the rename path at all: the plugin's topology debounce
   carried the _arguments of the call that armed it_. A `rename(2)` arrives as
   `unlink(old)` then `add(new)` microseconds apart, so the unlink was discarded
   and the departed path stayed in the tree, selectable, deep-linking to nothing.
   A plain delete was unaffected, which is exactly why it looked rename-specific.
   The debounce coalesces the _set_ of changed files now. **Q9's Bundled Dev Mode
   half now has an answer for add, delete and rename.**
5. **The fixture edit reloading the host.** The model in this file was wrong
   rather than unimplemented. A fixture module is reached through the
   `import.meta.glob` in `virtual:uaight/runtime`, which _both_ realms import and
   which accepted nothing, and §3.1 allows a fixture file whose exports are
   elements — a module `plugin-react` has no component to build a Fast Refresh
   boundary out of. So the update propagated to the host entry and Vite took the
   only option left. Three changes: the plugin appends an
   `import.meta.hot.accept` callback to every fixture module it serves, handing
   the new namespace to `runtime/hot.ts`; the generated runtime module accepts
   itself, so adding a file no longer reloads either; and the host sends the
   renderer its reconciled index as `SET_INDEX`, because the renderer resolves
   ids against `config.files` and Vite re-globs the instant a file lands —
   _before_ the plugin's debounced rescan has produced the index that goes with
   it. That race is unwinnable from inside the dev server and trivial from the
   host, which already has the answer.
6. **The CSP message.** The `securitypolicyviolation` listener fires exactly as
   designed. Three things notice a blocked renderer — the violation, the script's
   own `error` event, and the 10 s handshake timeout — and the host took whichever
   spoke last, which under a real nonce policy in Chromium is never the one that
   knows the directive. A message naming a directive is sticky now, and the
   `error` handler defers to a violation it has already seen.

**`import.meta.hot.accept` on a user's fixture module is the one thing here that
writes into code we do not own.** It is dev-only, it is appended (so the
sourcemap above it stands), and where Fast Refresh _is_ in play the fixture's
components go into the refresh family as usual — a re-render with the new type
reconciles rather than remounting, so fixture-local state survives. A fixture
file exporting elements has no state to survive and no boundary either way.

### §20.3's HMR budget, after that

**37 ms**, against a 150 ms budget, from 880 ms. The measurement changed with
the defect and only because its own stated blocker went away: it used to time
`expect(...).toHaveText` polling from Node because "an in-page observer… cannot
be used: editing a fixture file reloads the HOST document, which destroys the
execution context mid-measurement". It no longer does, so the clock stops on a
`MutationObserver` in the frame document. The clock still starts in Node the
instant before the write, so the filesystem event, the dev server, the socket
and the re-render are all still inside it — what left is ~130 ms of Playwright's
polling interval, which was never latency.

### What passes, and is therefore now proven rather than hand-verified

Frame bootstrap and handshake (3 engines); the preview entry running in the
frame realm and not the host; portals landing in the frame document, stacking,
and being torn down on fixture change; `matchMedia` measuring the frame, and a
viewport preset moving both the frame width and the fixture's media query; the
theme stamp on the frame's `documentElement`; the scoped sheet not reaching the
fixture and the host's Georgia not reaching our chrome; keyboard-only tree
operation with no selection on arrow (§12); `/`, Escape, `j`/`k`, `→`/`←`, `?`;
⌘K opening the palette, focusing its input, scrolling the active row into view
and selecting a fixture with the keyboard alone; focus staying inside the
explorer across a fixture change; screen-reader labels on every landmark and
control; a call site's props driving the panel; a malformed `?state=` landing on
the fixture rather than an error; the production preview booting with no Vite
client and no `/@uaight/renderer` in the frame; the renderer entry resolving
under `/explorer/` **and** under a relative-base build served from a prefix
chosen after the build; routing never touching the pathname under a non-root
base; CSP nonces reaching the frame's meta, script and style; the production
gate emitting no explorer chunk and no fixture code, with a negative control
proving the app itself still built; an ejected `FixtureTree` compiled by the
host's Tailwind (`p-2` → 8 px) and driving selection.

**A nonce is read from `element.nonce`, never `getAttribute("nonce")`.**
Browsers blank the content attribute after parsing as a CSP exfiltration
defence. A test asserting on the attribute fails against a correct
implementation, which is worse than not testing it.

**A linked `uaight` needs `resolve.dedupe: ["react", "react-dom"]`.** Vite
realpaths a linked package, so the explorer chunk resolved React from
`packages/uaight/node_modules` and the app resolved its own. The dev optimizer
hid it; the _build_ shipped two Reacts and the explorer died on
`Cannot read properties of null (reading 'useContext')`. Any consumer linking
the package locally hits this.

### §20.3 — the browser budgets, measured

Chromium, `--project=chromium-perf`, medians of repeated samples with the cold
first sample discarded. Printed on every run so the table can be updated from a
run rather than from a memory.

| Metric                                        | Budget          | Measured                                   |
| --------------------------------------------- | --------------- | ------------------------------------------ |
| Frame handshake (attach → `INIT_ACK`)         | < 100 ms        | **10 ms** (`READY` → `INIT_ACK` is 0.2 ms) |
| Fixture selection → first paint (frame, warm) | < 250 ms        | **14 ms**                                  |
| HMR, fixture edit → render                    | < 150 ms        | **37 ms**                                  |
| Memory, 100 mount/unmount cycles              | no upward trend | **+0.23 MB per 10 cycles** (7.8 → 10.3 MB) |

The HMR number was 880 ms and over budget for as long as an edit was a page
load (defect 5). With the reload gone the clock stops on a `MutationObserver` in
the frame document rather than on Playwright's polling interval, and the number
is 37 ms — consistent with a warm selection at 14 ms and a handshake at 10 ms,
which is what said 150 ms was reachable.

The memory trend is a least-squares slope over ten post-warm-up samples plus a
"has not doubled" backstop. It is Chromium-only, because the heap counters are;
the other engines are covered by the same leak's other symptom, the exact
document-and-script counts asserted in `bootstrap.spec.ts`.

### Two ways to the same data — kept, and why (§11.3, §11.4)

`UaightChromeApiV1` carries the palette catalogue and the inventory list, and
`CommandPaletteProps` / `InventoryListProps` carry the same data as props. At
the v1.2 freeze that duplication becomes permanent, so it is recorded as a
decision rather than left to look like an oversight.

**Kept.** Removing the props would break the thing ejection is for. §11.3's
promise is that you copy the file out, hand it what the explorer handed it, and
it works — including in a test, a docs page, or any tree with no explorer above
it, where the context is `null` and `useUaightChrome()` throws by design. A
props-less chrome component is not ejectable; it is a component that only runs
inside us.

**Which one an ejected copy should prefer: the props.** They are the narrower
dependency and the one that keeps the copy standalone. The facade exists for a
_replacement_ that needs more than its props carry — the whole ranked catalogue
when the packaged layout only passes one slice, or the current selection to
filter against. Reaching for it is a real trade, not a stylistic choice: it buys
reach and it spends portability.

Neither source is the "real" one; both are produced by the same explorer state
in the same render, and the facade's `items` are ranked exactly as the props'
are. Documented on both props types and on `palette` in `ui/chrome-context.ts`
so the answer is wherever the question gets asked. No published type changed.

### Navigation and preferences are two lifetimes (`ui/session.ts`)

Everything the explorer remembered lived in `sessionStorage`, on the argument
that a tab is the right lifetime for _where you were_. That argument is sound
and it still holds — for navigation. It was quietly also applied to pane widths
and the inventory disclosure, which are not a place you were: they are how you
like the tool set up, and losing them when a tab closes means re-dragging the
sidebar in every new tab. So the record is split by lifetime:

- `sessionStorage` — `collapsed`, `selection`, `recents`. Per-tab navigation and
  the MRU that follows from it.
- `localStorage` — `sidebarWidth`, `panelWidth`, `inventoryOpen`. Preferences.

Same `<route>:<mountId>` namespacing on both halves, under a `uaight:prefs:`
prefix instead of `uaight:session:`, so the two records can never be confused
and two mounts stay independent in both stores. Q14 is untouched: overlay values
are still not persisted anywhere. `writeSession` writes only the half a patch
touches, so a pane drag no longer rewrites the navigation record. Both halves
are still best-effort — `localStorage` throws in private mode just as readily,
and neither read nor write may surface that.

### §15.2 — prop tables, and the D18 line they must not cross

The docgen interface shipped with nothing consuming it. `ui/PropTable.tsx` now
renders `FixtureIndex.docs` for the selected detected component, joined by
`(globPath, exportName)` in `ui/docs.ts`.

Three things worth recording:

1. **D18 is structural here, not just a rule.** The table sits _beside_ the
   control panel in the right pane and shares no code with it. Nothing reads a
   prop's name, type or default to decide a control should exist. A prop table
   that grew controls would make docgen's guesses load-bearing, which is exactly
   what D18 refuses.
2. **The limitation is rendered, always.** Every `ComponentDoc` carries
   `inherited-props`, so the caveat is not conditional on anything — a table
   that silently omits inherited props while looking complete is worse than no
   table. The enum is translated into a sentence a reader can act on.
3. **No fallback to "the only doc in the file".** If the export name does not
   match, nothing renders. A file with two exports would otherwise attach one
   component's props to another, and a wrong prop table is worse than a missing
   one.

Internal for now: §11.3 wants an ejectable chrome component's props type in
`shared/types.ts`, and `PropTableProps` has not been added there. Until it is,
the file stays outside `ui/chrome/` rather than half-following the pattern.
