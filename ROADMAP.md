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
`0.0.1-canary.0` adds call-site harvesting, `@aussieljk/uight/test`, `@aussieljk/uight/mcp`, the static
build, shareable state and the command palette.

**There are no automated tests.** The unit suite, the golden-corpus snapshot and the
§20.2 browser matrix were all removed deliberately. `bun run check` is now the stylesheet
freshness check, the build, the type check, lint and format — nothing executes the
package's behaviour. The demo indexes 84 files and 593 fixtures with zero problems and
harvests 61 usages across 26 components, but that is now a thing observed by running the
demo rather than a thing asserted on every change.

The gap is no longer only cross-browser proof: it is proof of any kind.

---

## Next

Ordered by what blocks trusting the canary.

### 1. Automated tests (§20.1, §20.2) — **removed**

`packages/uight/tests/**`, `playwright.config.ts` and `tests/e2e/**` are gone, along with
the `test` scripts and CI's `e2e` job. This was a deliberate decision, recorded here
because SPEC §20 still asks for both halves and the divergence should be visible rather
than inferred:

- **§20.1's unit suite** — 514 tests across 33 files, including the golden-corpus snapshot
  that pinned the indexer's output against a real 84-file project.
- **§20.2's browser matrix** — "required, not optional" in the spec. Chromium, Firefox and
  WebKit against a purpose-built host app, and the only thing that has ever exercised the
  frame bootstrap race across more than one engine.

**What this costs, stated plainly.** Every browser-level answer in `NOTES.md` reverts to
being a finding rather than a regression test: the frame bootstrap race and `FrameHost`'s
three defences, the Refresh preamble, CSP, `matchMedia` in-frame, focus and history. The
six defects that matrix found — the control-panel edit not reaching the frame, inline
isolation never receiving a selection, two mounts under StrictMode, the rename leaving its
old path, the host-document reload on edit, and the CSP message not naming its directive —
are still fixed in the source, but nothing now prevents any of them from returning
silently. `FrameHost` carries three defences because each covers a different engine's
ordering, and losing one of them is once again invisible.

The scenario checklist is kept below, because it remains the right list for whatever
replaces this.

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
  _virtualized_ window (a focused row can leave the DOM); the shared overlay's focus trap
  and focus restoration for both the palette and the help dialog; `sessionStorage`
  restoration racing the router's first read; the pane resizers under pointer capture; and
  `/__open-in-editor` degrading in the static build.

The bootstrap race is still the highest-value scenario: `FrameHost` carries three defences
because each covers a different engine's ordering, and only one engine has been observed.

### 2. Budgets that fail on regression (§20.3) — **done for the Node rows**

`scripts/bench.ts` measures the four rows that do not need a browser, against a generated
synthetic corpus, and fails the build on a breach. CI runs it after `verify`, which is
what builds the bundle it measures.

| Metric                                         | Budget          | Status                             |
| ---------------------------------------------- | --------------- | ---------------------------------- |
| Plugin startup, 100 fixture modules            | < 300 ms        | **21–42 ms**, measured             |
| Plugin startup, 500 fixture modules            | < 1.2 s         | **95–114 ms**, measured            |
| Incremental index on one file change           | < 30 ms         | **0.1 ms**, measured               |
| Fixture selection to first paint (frame, warm) | < 250 ms        | **14 ms**, measured (Chromium)     |
| Frame handshake                                | < 100 ms        | **10 ms**, measured (Chromium)     |
| Chrome bundle, gzipped                         | < 90 KB         | **57.8 KB**, measured              |
| Memory after 100 mount/unmount cycles          | no upward trend | **+0.23 MB / 10 cycles**, measured |
| HMR latency, fixture edit to render            | < 150 ms        | **37 ms**, measured (Chromium)     |

The four browser rows were measured once, by the browser matrix that item 1 removed.
**The numbers above are a historical observation, not a gate**: nothing measures them now,
and a regression in any of the four would land silently. HMR latency is the cautionary
one — it was 880 ms and over for as long as an edit was a page load, and only a measured
budget made that visible at all. The Node rows in `scripts/bench.ts` still run in CI and
still fail on a breach.

The startup rows are ranges because the harness reports best-of-N and the two figures are
an idle machine and a loaded one; both are an order of magnitude inside the budget. The
chrome bundle has gone 32.7 → 41.2 → 54.3 → 57.8 KB gzipped, the last step being grid
mode. Still inside its budget, and by some distance the metric that would fail first.

### 3. Prove the registry resolves (Q8) — **partly**

The `$schema` divergence is settled: the emitted items always used `registry-item.json`,
and SPEC §11.2's example — which named the _index_ schema on an item, and depended on an
`@uight/tree-item` that §11.3 never listed — has been corrected.

Resolution was proven by a since-deleted test (`tests/registry-resolve.test.ts`) that
served `registry/` over a real loopback HTTP server and resolved it the way `shadcn add`
does — a `{name}` URL template as a `components.json` `registries` entry, transitive
`registryDependencies` resolved dependencies-first, files written to their `target` — and
asserts the installed tree.

**Hosting now exists in the repository:** `docs/` is the uight.dev site, and its sync
script copies the built registry into `public/r/`, so the URLs the versioned copies point
at are served by the same deploy as the page documenting them. That closes the _where_,
not the _whether_ — nothing has resolved from a deployed origin yet, because nothing has
been deployed.

**Still open, and specific:** nothing proves the items are reachable at
`https://uight.dev/r/…` from a real deploy; and nothing runs shadcn's own resolver, so its schema validation,
`components.json` path aliasing and dependency installer remain untested against these
files. Needs hosting, then a scratch project.

### 4. Two open M0 questions — **narrowed**

- **Q9 — glob invalidation.** ~~The browser half is open.~~ **Answered.** The Node half was
  already exercised: add (in sorted position, not arrival order), delete, rename (both
  events, and the moment between them when both files exist), a display-path collision
  appearing and clearing, an irrelevant file changing nothing, and the emitted glob
  _patterns_ staying fixed while the corpus moves. The browser half was proven by the
  since-deleted `hmr.spec.ts`: add, delete and rename all move the tree with no page
  reload, and the added file is selectable and renders. Nothing re-checks it now. It took three changes — the generated runtime module accepts its
  own update, the host sends the renderer its reconciled index (`SET_INDEX`) because Vite
  re-globs before the plugin's debounced rescan produces the index that goes with it, and
  the debounce coalesces the _set_ of changed files so a rename's `unlink` is not
  discarded.
- **Q4 — is the warm pass acceptable on by default?** The exposure is now quantified: the
  warm pass executes exactly the modules the static parser could not decide, which on the
  demo corpus is 1 file of 83, and §3.4's new identifier row can only reduce it. What one
  such execution _costs_, in a browser, on a side-effect-heavy corpus, is still unmeasured
  and still needs item 1.

### 5. Follow-ups the canary created

- **The docs site is written and unhosted.** `bun run docs:build` produces it; no deploy
  exists, no domain is pointed at it, and item 3 above stays open until one is. Deploying
  it is also what makes `/r` real, so the two are one task.
- **Grid mode's budget is a guess.** 30 live frames was chosen by reasoning about what two
  screens of tiles costs, not by measuring — and the corpus that would prove it wrong (591
  fixtures) is the one the demo already ships. Measuring it needs a browser harness, which
  the repository no longer has.

- ~~**Call sites are name-matched.**~~ **Done.** Aliased specifiers resolve through
  `configResolved`'s alias table, by prefix match against its string entries rather than by
  running Vite's resolver per import. RegExp finds are dropped rather than approximated,
  because a half-implemented regex alias produces a _wrong_ path. Two components sharing a
  name still share a group when no import resolved at all — a bare specifier is a package,
  and that stays name-matched.
- **`oxfmt --check` is in CI; the reformat has not happened.** `.oxfmtrc.json` is
  committed — tabs, width 90, chosen by measurement: 165 files disagree with it against
  243 for the default. CI's format step and `bun run check` fail until the reformat commit
  lands, which is deliberately its own change.
- ~~**The static build writes two scaffold files** into the project root.~~ **Done.** They
  live under `node_modules/.uight/` now, so a crashed build leaves nothing in the working
  tree — and the build no longer has to reserve two filenames in the user's root. The
  virtual-HTML-input route stays rejected for the reason given.
- ~~**MCP has no screenshot tool.**~~ **Done.** `render_fixture` drives a headless
  Chromium to the fixture's deep link, waits for `#uight-root` inside the frame document
  to have children — an attached iframe proves nothing — and returns a PNG image block of
  the frame (`fullPage` for the whole explorer), with viewport presets and a resolved
  theme. Playwright is an **optional** peer, imported dynamically the way `react-docgen`
  is, so no install pays for three browser engines; absent, the tool says so and names the
  fix. (`--url` is not required: the dev server is discovered via `/@uight/health`.)

---

## v1.1 — MDX, and the honesty items

- ~~**MDX documentation pages (§14).**~~ **Done.** `**/*.docs.mdx` is a page rather than a
  fixture, and differs from one only in what the tree calls it: the same glob map, index
  entry, selection and frame realm carry it, which is what kept the feature from turning
  into the documentation framework §1.4 rules out. The demo carries one.
- ~~**MDX fixtures (§14).**~~ **Done.** The demo carries an `.mdx` fixture the golden
  corpus indexes as one fixture, `@mdx-js/rollup` is in the demo's config, and startup
  names the missing plugin and its install command when a project has `.mdx` fixtures and
  none installed. Ordering is deliberately _not_ checked: Vite sorts `pre` plugins ahead of
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
  `data-uight-theme` on the frame document's `documentElement`, and `InlineHost` stamps
  this page's — inline, the renderer document is this one.
- ~~**Resolve an identifier default export in the index (§3.4).**~~ **Done.** §3.4's table
  gained a row above the identifier row: a uniquely declared module-scope `const` with an
  initializer resolves to that initializer, chains included. `let`, `var`, imports,
  destructuring patterns and redeclarations stay undecidable. SPEC §3.4 and the tests are
  updated.

## v1.2 — the facade freezes

The registry shipped early, so this is about the commitment rather than the code.
**Everything that changes a published type must land before the freeze:**

- **Q11 — settle `UightChromeApiV1`.** What belongs on it, given it is permanent after.
  The palette raised a concrete candidate: it needs call sites and the inventory together,
  and today it gets them as props rather than from the facade.
- **`UightComponents.ControlPanelInputs`** — §11.3 lists the component as ejectable but
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

Blocked on **Q12**, which §15.2 states as three gates that must _all_ pass:

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
  addressing make uight a substrate any VRT tool can drive
- Storybook `play`, loaders and interactions
- Remote renderers, React Native
- Becoming an MDX documentation framework
- A plugin or slot system. Replacement is `components` and ejection

---

## Open questions

| #   | Question                                                  | Status                                                                                                                                         |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Frame bootstrap race across engines                       | Answered; needs all three defences. One engine only                                                                                            |
| Q2  | Exact preamble specifier                                  | Answered — `@vitejs/plugin-react/preamble`                                                                                                     |
| Q3  | Which scheduler; does anything tear?                      | Answered — microtask default, injectable                                                                                                       |
| Q4  | Is the warm pass acceptable by default?                   | **Open** — exposure quantified (1 file of 83); cost is browser-only                                                                            |
| Q5  | Does the production gate remove the chunk?                | Answered, affirmative, against a real build                                                                                                    |
| Q6  | Do codec editors stay out of the renderer chunk?          | Answered — enforced by imports, not tree-shaking                                                                                               |
| Q7  | Rolldown file-URL token                                   | Answered — absent; `emitFile` + placeholder                                                                                                    |
| Q8  | Does a real `shadcn add` resolve from our registry?       | **Open** — resolves from local files; the docs site serves `/r`, but nothing has resolved from a deploy, and shadcn's own resolver is untested |
| Q9  | Glob invalidation under Vite 8.1 / Rolldown / Bundled Dev | Answered — add, delete and rename, in a browser, with no reload                                                                                |
| Q10 | Overlay reapplication across HMR                          | Answered — nothing stale survives; one caveat                                                                                                  |
| Q11 | What goes in `UightChromeApiV1`                           | Answered — `component` and `palette` groups; NOTES                                                                                             |
| Q12 | TypeScript 7.1 API sufficiency, tsgolint parity           | **Open**                                                                                                                                       |
| Q13 | Trademark and npm availability for `uight`                | Answered — the name was free; published 4 Aug 2026                                                                                             |
| Q14 | Should overlay state persist across reloads?              | Answered — not persisted, but now _shareable_                                                                                                  |
