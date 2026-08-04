# Changelog

Notable changes to `uaight`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project follows [semantic versioning](https://semver.org/spec/v2.0.0.html).

Section numbers refer to `SPEC.md`; the findings behind most entries are recorded in
`NOTES.md`. Planned work is in `ROADMAP.md`.

---

## [Unreleased]

Nothing yet.

---

## [1.0.0] — unreleased

The first release. Package version `1.0.0`, protocol version `1`. Not yet published to
npm — Q13 (name availability and trademark) is still open, see `ROADMAP.md`.

v1.0 is the product thesis: install the package, add the plugin, open `/uaight`. No config
file, no second process, no HTML file in the repository.

Two things landed **ahead of the §21.2 plan**: the declared Storybook CSF subset (planned
for v1.1) and the ejection registry (planned for v1.2). The facade does **not** freeze
here — that is still a v1.2 commitment.

### Added — discovery and the plugin (`uaight/vite`)

- `uaight()` Vite plugin. Serves `/uaight` from memory in `serve` mode; no HTML file is
  written to disk (§6.1, D16).
- Zero-config defaults for every option (D4). `uaight.config.json` is optional and
  discovered synchronously; `defineUaightConfig` types a `uaight.config.ts` you import into
  `vite.config.ts` yourself. Inline plugin options take precedence over the file.
- One static index scan with `oxc-parser` (D3, §3.4). `FixtureFileIndex.names` is
  `Array<string | null> | null`: one entry per fixture, `null` meaning "the module's default
  export is the fixture", the whole field `null` meaning undecidable.
- Warm pass and reconciliation for undecidable files (§3.5), run in the host realm.
- Component inventory (§12): syntax-only detection of exported PascalCase
  function / `memo` / `forwardRef` components, grouped by directory to merge with the fixture
  tree. On by default, development-only, excluded from production builds regardless of mode.
- Virtual modules of §4.3 (`runtime`, `renderer-url`, `preview-entry`, `inventory`) plus the
  dev endpoints `/@uaight/index.json`, `/@uaight/inventory.json`, `/@uaight/config.json`,
  `/@uaight/renderer` and `/@uaight/dev-entry`. The two dev URLs are registered in
  `resolveId` as well as served by middleware, so Vite's warm-up does not log a failure on
  every page load.
- Structural vs live option classification. Structural options rebuild the server;
  `index`, `production`, `storybook` and `docgen` reload in place. `fixtureFileSuffix`,
  `decoratorFileSuffix`, `caseSensitive` and `configFile` are treated as structural beyond
  §4.1's list, for §4.1's own stated reason.
- Display-path collision detection (§4.4): a build error naming every colliding file, a
  warning in `serve` because you are usually mid-rename.
- Index problems reported rather than thrown: unreadable, unparseable, collision. A
  `fixturesDir` outside the Vite root is reported with a suggestion that actually helps
  (`resolve.alias` or a different root), never `server.fs.allow`.
- Production modes with a compile-time gate (§9.2, D7). `production: 'exclude'` is the
  default and verifiably removes the explorer chunk and all fixture code from the bundle.
  `production: 'include'` emits the renderer through `emitFile` and resolves its URL in
  `generateBundle`, honouring the resolved `base`.
- `previewHtmlPath` merges with the project's own build input instead of replacing it.
- React Refresh preamble detection: `@vitejs/plugin-react/preamble` when the installed
  plugin publishes it, the `/@react-refresh` bootstrap inline as a fallback, nothing on
  `build`.

### Added — rendering and isolation

- Frame isolation (default) and inline isolation, configurable per mount (D8, §5.2).
- Frame bootstrap that survives every ordering of the `about:blank` race (Q1): write
  immediately, retry on animation frames within a 60-frame budget, keep a `load` listener
  for the frame's life and rewrite if the marker did not survive, guarded by a written-flag
  so a harmless load event does not produce a second renderer.
- Preview entry (§6.4, D15) for frame-realm CSS and providers.
- Protocol version 1 (§8): bootstrap messages unenveloped, mounted messages enveloped
  (D20); exact `targetOrigin`; `event.source` verified against `frame.contentWindow`;
  per-direction sequence numbers with gap warnings; `mountId` mismatches dropped and
  counted; queueing before ready with a flush on `INIT_ACK`; a 5s timeout that probes once
  and then reports a bootstrap error naming the renderer URL; duplicate `READY` treated as
  a frame reload with overlays replayed.
- Version mismatch is explicit on both sides and terminal — neither realm degrades quietly.
- `RESIZE` reported from a `ResizeObserver` on the frame's own `documentElement`.
- CSP (§6.7): the dev document goes through `transformIndexHtml` so `html.cspNonce` applies
  for free; the frame reports `securitypolicyviolation` with the violated directive and
  blocked URI rather than timing out into an empty frame.
- Renderer/plugin version skew check (§16.2) renders a panel and sends `RENDERER_ERROR`
  instead of the fixture.
- Error boundaries around every fixture, and around each fixture on a file overview page.

### Added — control state

- The overlay model (D17, §7.2): control state is a set of patches over the module's current
  value, not a canonical copy, so it survives HMR without holding a stale reference.
  Verified across HMR with opaque siblings (Q10).
- `useFixtureInput` with control metadata declared at the call site (D18, §7.6) —
  `control`, `options`, `min`/`max`/`step`, label and description. Nothing is inferred from
  a prop name.
- All of §7.3's rules implemented: duplicate names, renamed inputs, conditional
  registration, setter-driven values, stale revisions, patches whose path no longer exists,
  shrinking arrays, cycles, depth and size limits, getters, `__proto__` and friends, `Date`,
  reset.
- Values a patch cannot express (a function, an element) are held as a renderer-side root
  override for the current revision instead of being forced onto the wire.
- Serializer with an 8-level depth cap, a 256 KB payload cap, cycle detection by ancestor
  path (so DAG sharing is not misreported), and `getOwnPropertyDescriptor`-only reads, so a
  getter becomes an opaque chip and is never invoked.
- `__proto__`, `constructor` and `prototype` rejected at the transport boundary, again on
  apply, and skipped on deserialize.
- Built-in codecs: `date`, `regexp`, `url`, `map`, `set`, `file`, all written against the
  public `FixtureCodec` interface. Their editors live in a module the renderer bundle cannot
  reach (Q6).
- A once-only warning at 25 consecutive revision bumps, naming the input, for the fixture
  that rebuilds its default every render.

### Added — the explorer (`uaight`)

- `<Uaight />`, `<UaightProvider>`, `<Fixture>`, `<UaightErrorBoundary>`.
- Hooks: `useFixtureInput`, `useFixtureSelect`, `useFixtureViewport`, `useFixtureId`,
  `useSelectFixture`, `useFixtureIsolation`, `defineCodec`.
- Fixture tree grouped by directory, with self-titled files collapsed into their directory
  row — `accordion/accordion.stories.tsx` is one row, not two.
- A file is selectable in its own right and renders every fixture in it as one stacked
  page, each in its own error boundary.
- Inventory section listing detected components alongside the tree.
- Search (`/`), a full keyboard map (`j`/`k`, arrows, `Home`/`End`, `Enter`, `r`), and a `?`
  help panel.
- Control panel with per-input and global reset.
- Themes: `light`, `dark`, `system`, resolved through `matchMedia` and written as `--u-*`
  custom properties, so the prop wins over the OS in both directions.
- Explicit routing (D10, §5.4): `?fixture=` carrying `uaight:1|`-prefixed ids, ownership
  arbitrated by refcount in a layout effect so two mounts on one page cannot fight,
  malformed ids removed with `replaceState`, unknown-but-well-formed ids left alone.
- Chrome replacement through the `components` prop (D6, §1.4).
- Scoped Tailwind v4 stylesheet compiled at build time, confined with
  `:is(.uaight-root, .uaight-root *)` so a utility works on the root element itself. The
  scoping transform is a structural pass over balanced blocks, not a regex.
- `.uaight-root` is deliberately not an ancestor of the fixture, so our reset never reaches
  the component under test.
- Frozen chrome facade `useUaightChrome` / `UaightChromeApiV1` exported from
  `uaight/chrome`, which pulls in the context module alone and not the explorer.

### Added — Storybook CSF subset (§13, D11 — ahead of the §21.2 plan)

- CSF 3 normalization with the support matrix declared in config and anything outside it
  badged during normalization.
- `args` and `argTypes` at meta and story level, with each arg registered as a fixture input
  so `argTypes` drives real controls.
- Meta and story decorators, with Storybook's innermost-first array reversed for our
  outermost-first composition; precedence tested in both directions.
- The story body is rendered as a component, so `render: function Render(args) { … }` with
  hooks works as it does upstream.
- A story's identity is its export name (or a static literal `name`), byte-identical to what
  the parser sees, so deep links cannot disagree with the index. The prettier `startCase`
  form is display-only.
- `parameters` support gains a `'viewport-and-layout'` level between `'viewport-only'` and
  `true`.

### Added — ejection registry (§11 — ahead of the §21.2 plan)

- shadcn-compatible registry: 9 items (`fixture-tree`, `toolbar`, `control-panel`,
  `control-panel-inputs`, `preview-shell`, `viewport-toolbar`, `inventory-list`,
  `empty-state`, `error-state`) plus the index.
- Versioned copies under `registry/v1.0/` with dependencies rewritten to absolute URLs,
  because §11.1 only permits combining items within one minor and a namespace alone cannot
  express that.
- Every item ships `chrome-tokens.css`, defining each chrome token as
  `var(--color-neutral-200, …)` and so on, so an ejected component compiles under the host's
  Tailwind and picks up the host's own neutrals.

### Added — packaging, tests and the demo

- One package with subpath exports (D5, §16.1): `uaight`, `uaight/vite`, `uaight/runtime`,
  `uaight/chrome`, `uaight/client`, `uaight/styles.css`.
- Peers: React `^18 || ^19`, Vite `^8.1` (optional — the plugin is the only consumer),
  Node `>=20.19`.
- 269 unit tests across 12 files, covering §20.1's list. All passing.
- `examples/frosted-ui`: the explorer over Whop's frosted-ui, from 77 of its own CSF files
  (581 stories, none dropped) plus 5 hand-written fixture files — 82 files and 589 names
  with zero index problems.
- Measured bundle shape: 3.42 kB eager entry (1.51 kB gzipped), 127.78 kB lazy explorer
  (32.71 kB gzipped) against §20.3's 90 KB gzipped budget.

### Divergences from `SPEC.md`

Each is recorded with its reasoning in `NOTES.md`.

- **§4.5** `import.meta.ROLLDOWN_FILE_URL_<ref>` does not exist in rolldown 1 / Vite 8.1.
  The renderer URL is emitted as a placeholder and replaced in `generateBundle`.
- **§4.5** the `build.rollupOptions.input` sample silently deletes the consumer's own build
  entry. Inputs are merged instead.
- **§3.4** `names: [null]` is not representable as `string[] | null`; the type is now
  `Array<string | null> | null`.
- **§9.2** the sample keeps `React.lazy` at module scope, which leaves the dynamic import in
  the graph and emits the chunk regardless of the gate. The call sits inside the gate.
- **§13** `parameters` gains a `'viewport-and-layout'` support level rather than overstating
  support as `true`.
- **§11.2** registry items carry the `registry-item.json` schema; the index carries
  `registry.json`. An item carrying the index schema does not validate.
- **§11.2** the sample's `@uaight/tree-item` dependency does not exist in §11.3's table and
  is not emitted.
- **§7.7** no `bigint` codec: the wire format carries bigint natively and the `typeof` check
  precedes all object handling, so it could never be reached.
- **ARCHITECTURE §2** `serialize()` takes an optional third argument, because §7.3's
  "warning names the input" and §7.2's per-input opaque-id lifetime both need it.
- **ARCHITECTURE §1** `@vitejs/plugin-react` v6 *does* publish a preamble module; and the
  guard that matters in Vite 8.1 is `window.$RefreshReg$`, not
  `__vite_plugin_react_preamble_installed__`.
- **§9.3** the production summary reports the same four figures in the same order, but
  computes column widths rather than matching the sample byte for byte.

### Known limitations

- **No Playwright suite yet.** §20.2 calls it required; the browser-level findings in
  `NOTES.md` were established by hand against a real dev server. This is the largest gap.
- Fixture-driven viewport defaults (§3.1) are not honoured — `viewport` is a named export
  the static index never sees and no protocol message carries. The viewport always starts at
  Fit.
- `docgen` resolves and is echoed but nothing consumes it; prop tables are v1.3 by design
  (§15.1).
- Dropped patches are counted correctly but surfaced as one aggregate "N settings no longer
  apply" rather than naming which input lost what.
- Overlay state is not persisted across reloads (Q14).
- `useFixtureViewport()` inline reports the host element's box, and the fixture's media
  queries still see the page — §5.2's documented inline cost.
- `include` narrows the index but not the emitted glob, which cannot express an AND of two
  positive pattern sets. The module map may be a superset of the index.
- `IndexProblem.kind` has no `confinement` member, so an out-of-root `fixturesDir` is
  reported as `unreadable`.
- Selecting a detected component is local state: it is not routed and does not appear in the
  URL, because the frozen facade's `selection.current` is `FixtureId | null`.
- Passing `ControlPanelInputs` through `components` works at runtime but fails the type
  check, because `UaightComponents` has no member for it.
- `.mdx` files are indexed as a single fixture, but MDX is otherwise untested and
  undocumented — it is a v1.1 item.
- The scoped theme declares one font family and no `--font-mono`, per §10.1. A chrome
  component reaching for `font-mono` produces nothing.

### Resolved before release

Kept here because the fixes are load-bearing and the reasoning is in `NOTES.md`.

- **Every zero-config single-fixture file was invisible in the tree.** Three modules
  disagreed about how a single-fixture file is encoded and the type checker could not see
  it. `[null]` is now canonical, `[]` is illegal, and `tests/parse.test.ts` guards it.
- The related spurious reconciliation warning on every single-fixture file, which would have
  trained users to ignore the warning that exists to catch real drift.
- A verification sweep that read the host document instead of the frame, and so could have
  passed a completely blank explorer. Rebuilt against a deliberate negative control; 664
  pages then came back clean.

---

[unreleased]: https://github.com/aussieljk/uaight/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/aussieljk/uaight/releases/tag/v1.0.0
