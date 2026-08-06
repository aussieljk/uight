# Roadmap

Last reviewed: 6 August 2026, at `0.0.1-canary.0`. Shipped work is in `CHANGELOG.md`;
the reasoning behind most items is in `NOTES.md`. Section numbers refer to `SPEC.md`.

**Versioning.** Everything published while the surface is still moving is
`0.0.x`. The milestone names below (v1.1, v1.2, v1.3) are `SPEC.md` §21.2's
release plan, kept because they name coherent bundles of work — not because a `1.0.0`
tag is imminent. A release can contain any of them.

---

## Where the package stands

Everything in §21.2's v1.0 row is implemented and verified against a real corpus, plus
three rows that were scheduled later: the CSF subset (v1.1), the ejection registry (v1.2),
and a Storybook drop-in path §13 had ruled out entirely. On top of that,
`0.0.1-canary.0` adds call-site harvesting, `@aussieljk/uight/test`, `@aussieljk/uight/mcp`, the static
build, shareable state and the command palette.

**The site is deployed.** `uight.dev` serves the explorer-as-documentation site and,
from the same deploy, the ejection registry at `/r` and `/r/v0.0`. That closed the last
two halves of item 3 at once.

**There is no test runner, by decision.** The unit suite, the golden-corpus snapshot and
the §20.2 browser matrix were removed and are not coming back; SPEC §20 has been
rewritten to say so rather than to keep asking for them. What runs instead is a set of
scripts, each a gate: `check` (stylesheet freshness, build, type check, lint), `verify`
(the release path, ending in `npm publish --dry-run`), `bench` (§20.2's four Node rows,
failing on breach and on drift) and `registry:resolve` (§20.3, a real `shadcn add`).

**What that still costs, stated plainly.** Nothing executes a fixture, applies an
overlay, runs a handshake or opens a browser. The demo indexes 84 files and 593 fixtures
with zero problems and harvests 61 usages across 26 components, but that is observed by
running the demo rather than asserted on every change.

---

## Next

Ordered by what blocks trusting the package.

### 1. Browser-shaped questions have no harness — **accepted, not scheduled**

`packages/uight/tests/**`, `playwright.config.ts` and `tests/e2e/**` are gone, with the
`test` scripts and CI's `e2e` job. SPEC §20 now describes the verification that exists
instead of the suites that do not, so this is no longer a divergence — it is a known
limit, and this section records exactly what sits behind it.

**Every browser-level answer in `NOTES.md` is a finding rather than a regression test:**
the frame bootstrap race and `FrameHost`'s three defences, the Refresh preamble, CSP,
`matchMedia` in-frame, focus and history. The six defects the matrix once found — the
control-panel edit not reaching the frame, inline isolation never receiving a selection,
two mounts under StrictMode, the rename leaving its old path, the host-document reload on
edit, and the CSP message not naming its directive — are still fixed in the source, but
nothing prevents any of them from returning silently. `FrameHost` carries three defences
because each covers a different engine's ordering, and losing one is invisible.

Two open questions are open _only_ because of this: **Q4** (what one warm-pass module
execution costs in a browser) and the second and third engines for **Q1** and **Q9**.

The scenario list is kept because it remains the right list for whatever ever replaces
this — not as a backlog item.

- **Matrix:** Chromium, Firefox, WebKit × React 18 and 19 × dev server and production
  preview × default base, non-root base, relative base.
- **Scenarios:** frame bootstrap and handshake; HMR of a fixture; add, delete and rename;
  `matchMedia` inside the frame; portals and modals; keyboard-only tree, palette and
  panel; screen-reader labels; focus restoration after fixture change; CSP with nonces;
  two mounts on one page; the production gate removing the chunk; an ejected component
  under host Tailwind.
- **Never observed in a browser at all:** ⌘K focus handling and the palette's
  scroll-into-view; a shared `?state=` link seeding overlays before inputs register; a
  call-site fixture whose props drive the control panel; the static build served from a
  non-root base; roving focus across the tree's _virtualized_ window (a focused row can
  leave the DOM); the shared overlay's focus trap and focus restoration; `sessionStorage`
  restoration racing the router's first read; the pane resizers under pointer capture;
  `/__open-in-editor` degrading in the static build; and grid mode's 30-frame budget,
  which was chosen by reasoning rather than measurement.

### 2. Budgets that fail on regression (§20.2) — **done**

`scripts/bench.ts` measures the four rows that do not need a browser, against a generated
synthetic corpus, and fails the build on a breach _and_ on drift from a committed
baseline. CI runs it after `verify`, which is what builds the bundle it measures.

| Metric                               | Budget   | Status                  |
| ------------------------------------ | -------- | ----------------------- |
| Plugin startup, 100 fixture modules  | < 300 ms | **21–42 ms**, measured  |
| Plugin startup, 500 fixture modules  | < 1.2 s  | **95–114 ms**, measured |
| Incremental index on one file change | < 30 ms  | **0.1 ms**, measured    |
| Chrome bundle, gzipped               | < 90 KB  | **57.8 KB**, measured   |

The four browser rows are no longer budgets — SPEC §20.2 lists only what is measured, on
the grounds that a budget nothing runs is a number rather than a gate. They were, once,
by the harness item 1 describes: first paint 14 ms, handshake 10 ms, HMR 37 ms, memory
+0.23 MB per 10 cycles, all on Chromium. HMR is the cautionary one — it sat at 880 ms for
as long as an edit was a page load, and only a measured budget made that visible.

The startup rows are ranges because the harness reports best-of-N across an idle machine
and a loaded one; both are an order of magnitude inside budget. The chrome bundle has
gone 32.7 → 41.2 → 54.3 → 57.8 KB gzipped, the last step being grid mode, and remains by
some distance the metric that would fail first.

### 3. Prove the registry resolves (Q8) — **done**

`scripts/registry-resolve.ts` runs **shadcn's own CLI** against the registry, in CI,
failing the build if anything about the install is wrong. It scaffolds a project, points
`components.json` at a `{name}` template, installs three items chosen to cover every
mechanism, and then checks the tree that landed: transitive `registryDependencies`,
companion files, `registry:file` targets, no specifier still pointing at this
repository's layout, every uight import being the frozen surface, and §11.4's licence
header surviving. A bare item URL is exercised separately, with no namespace configured.

Both halves are now closed:

- **Locally**, over a loopback server, on every commit. No deploy required, so the gate
  cannot go stale.
- **From the deployed origin**, `https://uight.dev/r`, with `--deployed`. Run after
  publishing rather than per commit.

**It found a real defect on its first run.** shadcn rewrites an installed file's imports
through an AST transform, and that transform discards the file's leading trivia — so
§11.4's licence header was published, downloaded and then deleted on the way to disk.
Every `.ts`/`.tsx` file arrived without it while interior comments and the CSS header
survived. `withHeader` in `build-registry.ts` now emits it as trailing trivia. That is
precisely the class of defect §11.1's "proof, not plausibility" exists to catch, and no
amount of reading our own files would have found it.

### 4. One open M0 question — **narrowed**

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

### 5. Follow-ups the early releases created

- ~~**The docs site is written and unhosted.**~~ **Done.** `uight.dev` is deployed, and
  the same deploy serves `/r` — which is what made item 3's second half checkable.
- ~~**Grid mode's budget is a guess.**~~ Still true, and moved into item 1's list of
  things no harness observes, where it belongs. 30 live frames was chosen by reasoning
  about what two screens of tiles costs, not by measuring.
- ~~**Call sites are name-matched.**~~ **Done.** Aliased specifiers resolve through
  `configResolved`'s alias table, by prefix match against its string entries rather than
  by running Vite's resolver per import. RegExp finds are dropped rather than
  approximated, because a half-implemented regex alias produces a _wrong_ path. Two
  components sharing a name still share a group when no import resolved at all — a bare
  specifier is a package, and that stays name-matched.
- ~~**`oxfmt --check` is in CI; the reformat has not happened.**~~ **Done.** The tree is
  formatted against the committed `.oxfmtrc.json` and CI's format step passes.
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
  fix. This is the one browser dependency the repository keeps, and it is a feature rather
  than a harness.

### 6. Documentation-site performance — **done**

Every page is rendered to HTML at build time by `docs/plugins/docs-markdown.ts`, so
shiki and `marked` leave the client bundle entirely; development renders in the browser
through a source-keyed cache that survives the unmount a `useMemo` cannot. With `eager`,
a hover prefetch and a fixture that stays mounted while the next one loads, a page switch
went from 2.8 s on the largest page to a steady 30–60 ms. The `eager` and `PREFETCH`
halves are package features, not site ones (§9.1).

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
- ~~**`UightComponents.ControlPanelInputs`**~~ **Done.** The type has the member, so
  passing a replacement through `components` type-checks.
- ~~**A `component: { current, select }` group on the facade**~~ **Done.** The facade
  carries `component` and `palette` groups, which is what Q11 was asking. Detected
  components and their call sites are expressible.

- **`FixtureTreeProps.onPrefetch`** is optional and not on the facade. It is a hint about
  a file, not state, and putting it on a surface that freezes permanently for the sake of
  a performance affordance would be the wrong trade — but the decision should be made
  deliberately before the freeze rather than by omission.
- ~~**`IndexProblem.kind: "confinement"`**~~ **Done.** An out-of-root `fixturesDir` is
  reported as `confinement`; `unreadable` described the outcome and named the wrong cause.
- ~~**Registry hosting and versioning** made real~~ **Done.** `uight.dev/r` serves both
  the latest items and the per-minor copies under `/r/v0.0`, and a real `shadcn add`
  resolves from both (item 3). Still to write: **a documented upgrade path for anyone who
  ejected from an early release** — the items say which minor they came from, and nothing yet
  tells a reader what to do when that minor moves.

## v1.3 — docgen and prop tables

Blocked on **Q12**, which §15.2 states as three gates that must _all_ pass:

1. Is the TypeScript 7.1 API **sufficient** for `react-docgen-typescript`, not merely
   present?
2. Does the integration work against a real corpus — cross-file inheritance, generics,
   unions?
3. Has `oxlint-tsgolint` shipped a build tracking 7.1?

Until all three hold, ship the Babel resolver behind the same interface, with the
documented limitation that inherited props will not appear. **That resolver exists** —
`createBabelDocgenResolver()` behind `DocgenResolver`, populating `FixtureIndex.docs` when
`docgen` is on and carrying `inherited-props` on every entry, so a prop table cannot render
without the caveat. `react-docgen` is optional, imported dynamically, and absent by
default.

**Both consumers now exist.** `PropTable` renders the docs for a selected component, and
§7.6's `from` resolves an input against them — the one sanctioned path from docgen to a
control, and the last unimplemented line of the spec's control model. `resolveInputDoc`
takes a prop's description verbatim and its options only from a union of string literals,
rejecting a partially-understood union whole rather than offering three of five variants
under a select that looks authoritative.

What remains for v1.3 is Q12 itself: which resolver ships.

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

| #   | Question                                                  | Status                                                                                                                               |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Frame bootstrap race across engines                       | Answered; needs all three defences. One engine only                                                                                  |
| Q2  | Exact preamble specifier                                  | Answered — `@vitejs/plugin-react/preamble`                                                                                           |
| Q3  | Which scheduler; does anything tear?                      | Answered — microtask default, injectable                                                                                             |
| Q4  | Is the warm pass acceptable by default?                   | **Open** — exposure quantified (1 file of 83); cost is browser-only                                                                  |
| Q5  | Does the production gate remove the chunk?                | Answered, affirmative, against a real build                                                                                          |
| Q6  | Do codec editors stay out of the renderer chunk?          | Answered — enforced by imports, not tree-shaking                                                                                     |
| Q7  | Rolldown file-URL token                                   | Answered — absent; `emitFile` + placeholder                                                                                          |
| Q8  | Does a real `shadcn add` resolve from our registry?       | **Answered** — shadcn's own CLI, over loopback in CI and against `uight.dev/r` on demand. Found the stripped licence header (item 3) |
| Q9  | Glob invalidation under Vite 8.1 / Rolldown / Bundled Dev | Answered — add, delete and rename, in a browser, with no reload                                                                      |
| Q10 | Overlay reapplication across HMR                          | Answered — nothing stale survives; one caveat                                                                                        |
| Q11 | What goes in `UightChromeApiV1`                           | Answered — `component` and `palette` groups; NOTES                                                                                   |
| Q12 | TypeScript 7.1 API sufficiency, tsgolint parity           | **Open**                                                                                                                             |
| Q13 | Trademark and npm availability for `uight`                | Answered — the name was free; published 4 Aug 2026                                                                                   |
| Q14 | Should overlay state persist across reloads?              | Answered — not persisted, but now _shareable_                                                                                        |
