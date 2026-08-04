# Roadmap

Last reviewed: 4 August 2026, at `0.0.1-canary.0`. Shipped work is in `CHANGELOG.md`;
the reasoning behind most items is in `NOTES.md`. Section numbers refer to `SPEC.md`.

**Versioning.** Everything published while the surface is still moving is
`0.0.1-canary.N`. The milestone names below (v1.1, v1.2, v1.3) are `SPEC.md` §21.2's
release plan, kept because they name coherent bundles of work — not because a `1.0.0`
tag is imminent. A canary can contain any of them.

---

## Where the canary stands

Everything in §21.2's v1.0 row is implemented and verified against a real corpus, plus
three rows that were scheduled later: the CSF subset (v1.1), the ejection registry (v1.2),
and a Storybook drop-in path §13 had ruled out entirely. On top of that,
`0.0.1-canary.0` adds call-site harvesting, `uaight/test`, `uaight/mcp`, the static
build, shareable state and the command palette.

336 unit tests and a golden-corpus suite pass. The demo indexes 82 files and 591 fixtures
with zero problems, and harvests 45 real usages across 26 components.

The gap is unchanged and is not features: **cross-browser proof**.

---

## Next

Ordered by what blocks trusting the canary.

### 1. The Playwright matrix (§20.2) — **built and running; six defects found**

`playwright.config.ts` + `tests/e2e/**`. Chromium, Firefox and WebKit all run, against a
purpose-built host app (`tests/e2e/fixture-app`) rather than the demo. 149 tests pass and
42 are `fixme`, each naming the defect it is blocked on rather than asserting less than
the spec requires. Every browser-level answer in `NOTES.md` that could be turned into an
assertion now is one — see NOTES.md § "The Playwright matrix" for what the run found.

Still open under this item: the six defects the matrix uncovered (control-panel edits not
reaching the frame; inline isolation never receiving a selection; two mounts under
StrictMode; a rename leaving its old path in the tree; a fixture edit reloading the host
document; the CSP message not naming the directive), and the UX-pass scenarios listed
below, which the suite does not cover yet.

The original statement of the item, kept because the scenario list is still the checklist:

- **Matrix:** Chromium, Firefox, WebKit × React 18 and 19 × dev server and production
  preview × default base, non-root base, relative base.
- **Scenarios:** frame bootstrap and handshake; HMR of a fixture; add, delete and rename;
  `matchMedia` inside the frame; portals and modals; keyboard-only tree, palette and
  panel; screen-reader labels; focus restoration after fixture change; CSP with nonces;
  two mounts on one page; the production gate removing the chunk; an ejected component
  under host Tailwind.
- **New since the canary, and untested in a browser:** ⌘K focus handling and the palette's
  scroll-into-view; a shared `?state=` link seeding overlays before inputs register; a
  call-site fixture whose props drive the control panel; the static build served from a
  non-root base.
- **New with the UX pass, and browser-shaped by nature:** roving focus across the tree's
  *virtualized* window (a focused row can leave the DOM); the shared overlay's focus trap
  and focus restoration for both the palette and the help dialog; `sessionStorage`
  restoration racing the router's first read; the pane resizers under pointer capture; and
  `/__open-in-editor` degrading in the static build.

The bootstrap race is still the highest-value scenario: `FrameHost` carries three defences
because each covers a different engine's ordering, and only one engine has been observed.

### 2. Budgets that fail on regression (§20.3) — **done for the Node rows**

`scripts/bench.ts` measures the four rows that do not need a browser, against a generated
synthetic corpus, and fails the build on a breach. CI runs it after `verify`, which is
what builds the bundle it measures.

| Metric                                         | Budget          | Status                      |
| ---------------------------------------------- | --------------- | --------------------------- |
| Plugin startup, 100 fixture modules            | < 300 ms        | **21–42 ms**, measured      |
| Plugin startup, 500 fixture modules            | < 1.2 s         | **95–114 ms**, measured     |
| Incremental index on one file change           | < 30 ms         | **0.1 ms**, measured        |
| Fixture selection to first paint (frame, warm) | < 250 ms        | **14 ms**, measured (Chromium) |
| Frame handshake                                | < 100 ms        | **10 ms**, measured (Chromium) |
| Chrome bundle, gzipped                         | < 90 KB         | **54.3 KB**, measured       |
| Memory after 100 mount/unmount cycles          | no upward trend | **+0.23 MB / 10 cycles**, measured |
| HMR latency, fixture edit to render            | < 150 ms        | **~880 ms — OVER BUDGET**, measured |

The four browser rows are now measured by `tests/e2e/specs/budgets.spec.ts`
(`--project=chromium-perf`), which prints every number on every run and fails on a breach.
Three are comfortably inside budget. **HMR latency is not**, and the cause is not a slow
update path: editing a fixture file reloads the whole host document, so every edit pays
for a navigation, a fresh explorer chunk and a fresh handshake. Since a warm selection is
14 ms and the handshake is 10 ms, 150 ms is reachable the moment an edit stops being a
page load. The test is `fixme` with the measured number rather than retuned, because
retuning it to 900 ms would enshrine the reload.

The startup rows are ranges because the harness reports best-of-N and the two figures are
an idle machine and a loaded one; both are an order of magnitude inside the budget. The
chrome bundle has gone 32.7 → 41.2 → 54.3 KB gzipped. Still inside its budget, and by
some distance the metric that would fail first.

### 3. Prove the registry resolves (Q8) — **partly**

The `$schema` divergence is settled: the emitted items always used `registry-item.json`,
and SPEC §11.2's example — which named the *index* schema on an item, and depended on an
`@uaight/tree-item` that §11.3 never listed — has been corrected.

`tests/registry-resolve.test.ts` is now a client rather than another shape assertion. It
serves `registry/` over a real loopback HTTP server and resolves it the way `shadcn add`
does — a `{name}` URL template as a `components.json` `registries` entry, transitive
`registryDependencies` resolved dependencies-first, files written to their `target` — and
asserts the installed tree.

**Still open, and specific:** nothing proves the items are reachable at
`https://uaight.dev/r/…`, which is what the versioned copies point at and what has never
been hosted; and nothing runs shadcn's own resolver, so its schema validation,
`components.json` path aliasing and dependency installer remain untested against these
files. Needs hosting, then a scratch project.

### 4. Two open M0 questions — **narrowed**

- **Q9 — glob invalidation.** The Node half is exercised: add (appears in sorted position,
  not arrival order), delete, rename (both events, and the moment between them when both
  files exist), a display-path collision appearing and clearing, an irrelevant file
  changing nothing, and the emitted glob *patterns* staying fixed while the corpus moves.
  **Bundled Dev Mode was not exercised** — it needs a browser re-evaluating the glob map
  after a server-side invalidation, which a Node test cannot observe. That half belongs to
  item 1.
- **Q4 — is the warm pass acceptable on by default?** The exposure is now quantified: the
  warm pass executes exactly the modules the static parser could not decide, which on the
  demo corpus is 1 file of 83, and §3.4's new identifier row can only reduce it. What one
  such execution *costs*, in a browser, on a side-effect-heavy corpus, is still unmeasured
  and still needs item 1.

### 5. Follow-ups the canary created

- ~~**Call sites are name-matched.**~~ **Done.** Aliased specifiers resolve through
  `configResolved`'s alias table, by prefix match against its string entries rather than by
  running Vite's resolver per import. RegExp finds are dropped rather than approximated,
  because a half-implemented regex alias produces a *wrong* path. Two components sharing a
  name still share a group when no import resolved at all — a bare specifier is a package,
  and that stays name-matched.
- **`oxfmt --check` is in CI; the reformat has not happened.** `.oxfmtrc.json` is
  committed — tabs, width 90, chosen by measurement: 165 files disagree with it against
  243 for the default. CI's format step and `bun run check` fail until the reformat commit
  lands, which is deliberately its own change.
- ~~**The static build writes two scaffold files** into the project root.~~ **Done.** They
  live under `node_modules/.uaight/` now, so a crashed build leaves nothing in the working
  tree — and the build no longer has to reserve two filenames in the user's root. The
  virtual-HTML-input route stays rejected for the reason given.
- **MCP has no screenshot tool.** It returns URLs an agent with a browser can open. A real
  `render_fixture → image` needs the Playwright dependency item 1 brings anyway. (`--url`
  is no longer required: the dev server is discovered by probing `/@uaight/health`.)

---

## v1.1 — MDX, and the honesty items

- ~~**MDX fixtures (§14).**~~ **Done.** The demo carries an `.mdx` fixture the golden
  corpus indexes as one fixture, `@mdx-js/rollup` is in the demo's config, and startup
  names the missing plugin and its install command when a project has `.mdx` fixtures and
  none installed. Ordering is deliberately *not* checked: Vite sorts `pre` plugins ahead of
  a plain `mdx()` whatever the array says, and `.mdx` compiles correctly anyway, so the
  check would fire on every correct project. See NOTES.md.
- ~~**Fixture-driven viewport defaults (§3.1).**~~ Done. The meta rides on
  `FixtureFileIndex` (`fileMeta` / `fixtureMeta`) rather than arriving as a message,
  `shared/meta.ts` owns the precedence, and the preview opens at the fixture's viewport.
  A viewport the user chose is sticky across selections and outranks the fixture's.
- ~~**Name the input that lost a patch.**~~ Done. `RESYNC` carries the paths,
  `OverlayState.droppedInputs` carries them per input, and the panel says
  "`variant`, `size` and 2 more no longer apply".
- ~~**Let the preview entry read the theme.**~~ Done. `FrameHost` stamps
  `data-uaight-theme` on the frame document's `documentElement`, and `InlineHost` stamps
  this page's — inline, the renderer document is this one.
- ~~**Resolve an identifier default export in the index (§3.4).**~~ **Done.** §3.4's table
  gained a row above the identifier row: a uniquely declared module-scope `const` with an
  initializer resolves to that initializer, chains included. `let`, `var`, imports,
  destructuring patterns and redeclarations stay undecidable. SPEC §3.4 and the tests are
  updated.

## v1.2 — the facade freezes

The registry shipped early, so this is about the commitment rather than the code.
**Everything that changes a published type must land before the freeze:**

- **Q11 — settle `UaightChromeApiV1`.** What belongs on it, given it is permanent after.
  The palette raised a concrete candidate: it needs call sites and the inventory together,
  and today it gets them as props rather than from the facade.
- **`UaightComponents.ControlPanelInputs`** — §11.3 lists the component as ejectable but
  the type has no member for it, so passing one through `components` works at runtime and
  fails the type check.
- **A `component: { current, select }` group on the facade**, if shareable links to
  detected components (and to a specific call site) are wanted. `onSelect` is
  `(id: FixtureId | null) => void` and an `InventoryItem` is not a `FixtureId`, so both
  are unroutable local state until the facade can express them.
- ~~**`IndexProblem.kind: "confinement"`**~~ **Done.** An out-of-root `fixturesDir` is
  reported as `confinement`; `unreadable` described the outcome and named the wrong cause.
- **Registry hosting and versioning** made real, and a documented upgrade path for anyone
  who ejected from a canary.

## v1.3 — docgen and prop tables

Blocked on **Q12**, which §15.2 states as three gates that must *all* pass:

1. Is the TypeScript 7.1 API **sufficient** for `react-docgen-typescript`, not merely
   present?
2. Does the integration work against a real corpus — cross-file inheritance, generics,
   unions?
3. Has `oxlint-tsgolint` shipped a build tracking 7.1?

Until all three hold, ship the Babel resolver behind the same interface, with the
documented limitation that inherited props will not appear. **That resolver now exists** —
`createBabelDocgenResolver()` behind `DocgenResolver`, populating `FixtureIndex.docs` when
`docgen` is on and carrying `inherited-props` on every entry, so a prop table cannot render
without the caveat. `react-docgen` is optional, imported dynamically, and absent by
default. Nothing consumes `docs` yet: the prop table itself is the v1.3 work.

D18 stands regardless: prop tables are display metadata, and docgen never starts inferring
controls from prop names. Call-site harvesting is not a hole in that rule — it quotes
values the user wrote, and invents no control metadata.

---

## Post-v1, and not planned

**Post-v1, if it earns its cost:** fixture scaffolding and any file-writing endpoint.
§21.2's judgement is that on current evidence it does not. "Copy as fixture" was added
instead, which gives the same output without the endpoint.

**Not planned (§1.4).** Non-goals, not backlog:

- Bundlers other than Vite 8.1+
- SSR of the explorer chrome, React Server Components
- Visual regression testing and screenshots — but the static build and the fixture-id
  addressing make uaight a substrate any VRT tool can drive
- Storybook `play`, loaders and interactions
- Remote renderers, React Native
- Becoming an MDX documentation framework
- A plugin or slot system. Replacement is `components` and ejection

---

## Open questions

| #   | Question                                                     | Status                                              |
| --- | ------------------------------------------------------------ | --------------------------------------------------- |
| Q1  | Frame bootstrap race across engines                          | Answered; needs all three defences. One engine only |
| Q2  | Exact preamble specifier                                     | Answered — `@vitejs/plugin-react/preamble`          |
| Q3  | Which scheduler; does anything tear?                         | Answered — microtask default, injectable            |
| Q4  | Is the warm pass acceptable by default?                      | **Open** — exposure quantified (1 file of 83); cost is browser-only |
| Q5  | Does the production gate remove the chunk?                   | Answered, affirmative, against a real build         |
| Q6  | Do codec editors stay out of the renderer chunk?             | Answered — enforced by imports, not tree-shaking    |
| Q7  | Rolldown file-URL token                                      | Answered — absent; `emitFile` + placeholder         |
| Q8  | Does a real `shadcn add` resolve from our registry?          | **Open** — resolves from local files; hosting and shadcn's own resolver untested |
| Q9  | Glob invalidation under Vite 8.1 / Rolldown / Bundled Dev     | **Open** — Node half exercised; Bundled Dev Mode not |
| Q10 | Overlay reapplication across HMR                             | Answered — nothing stale survives; one caveat       |
| Q11 | What goes in `UaightChromeApiV1`                             | Answered — `component` and `palette` groups; NOTES  |
| Q12 | TypeScript 7.1 API sufficiency, tsgolint parity              | **Open**                                            |
| Q13 | Trademark and npm availability for `uaight`                  | Answered — the name was free; published 4 Aug 2026  |
| Q14 | Should overlay state persist across reloads?                 | Answered — not persisted, but now *shareable*       |
