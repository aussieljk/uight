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

### 1. The Playwright matrix (§20.2)

§20.2 says "required, not optional", and it is still the one part of §20 that does not
exist. Every browser-level answer in `NOTES.md` — the frame bootstrap race, the Refresh
preamble, CSP, `matchMedia` in-frame, focus, history — was established by hand in one
engine. That is a finding, not a regression test.

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

The bootstrap race is still the highest-value scenario: `FrameHost` carries three defences
because each covers a different engine's ordering, and only one engine has been observed.

### 2. Budgets that fail on regression (§20.3)

CI now runs version lockstep, build, typecheck, lint, tests, the registry build and the
stylesheet freshness check. It does not yet measure anything.

| Metric                                         | Budget          | Status                       |
| ---------------------------------------------- | --------------- | ---------------------------- |
| Plugin startup, 100 fixture modules            | < 300 ms        | 105 ms for 77 files, one-off |
| Plugin startup, 500 fixture modules            | < 1.2 s         | not measured                 |
| Incremental index on one file change           | < 30 ms         | not measured                 |
| Fixture selection to first paint (frame, warm) | < 250 ms        | not measured                 |
| Frame handshake                                | < 100 ms        | not measured                 |
| Chrome bundle, gzipped                         | < 90 KB         | 41.2 KB, one-off             |
| Memory after 100 mount/unmount cycles          | no upward trend | not measured                 |
| HMR latency, fixture edit to render            | < 150 ms        | not measured                 |

The chrome bundle grew from 32.7 KB to 41.2 KB gzipped with the palette and call-site UI.
Still comfortably inside the budget, but it is the number to watch.

### 3. Prove the registry resolves (Q8)

The registry is generated and its shape is asserted, but a real `shadcn add` has never
been run against it. §11.1 asks for proof, not plausibility — and the `$schema` divergence
in `NOTES.md` is exactly the class of defect a first real `shadcn add` catches. Needs the
items hosted at the URLs `registry/v0.0/` points at, then a scratch project.

### 4. Two open M0 questions

- **Q9 — glob invalidation** under Vite 8.1, Rolldown and Bundled Dev Mode, across add,
  delete and rename. The plugin mirrors Vite's crawl options exactly, but the invalidation
  path itself has not been exercised under Bundled Dev Mode.
- **Q4 — is the warm pass acceptable on by default?** It executes module-scope code in
  development. Implemented and on; nobody has measured what it costs on a large,
  side-effect-heavy corpus.

### 5. Follow-ups the canary created

- **Call sites are name-matched.** Two components sharing a name share a group unless an
  import resolved. Aliased specifiers (`@/components/Button`) do not resolve, because
  doing so means running Vite's resolver inside a scan meant to be one cheap pass. Worth
  revisiting with `configResolved`'s alias table.
- **`oxfmt --check` is not in CI.** oxfmt 0.61 with no config disagrees with 205 of 209
  files. Commit a config and reformat once, as its own change.
- **The static build writes two scaffold files** into the project root and removes them.
  A virtual HTML input would avoid that; Vite's HTML handling makes it fragile enough
  that real files were the safer choice for now.
- **MCP has no screenshot tool.** It returns URLs an agent with a browser can open. A real
  `render_fixture → image` needs the Playwright dependency item 1 brings anyway.

---

## v1.1 — MDX, and the honesty items

- **MDX fixtures (§14).** `.mdx` is in the default extension list and `parseFixtureFile`
  indexes it as a single fixture, so the plugin half is done. Missing: the documented
  story (the host adds `@mdx-js/rollup`; we do not detect it and do not order plugins for
  them), a demo fixture proving the path, and a test.
- **Fixture-driven viewport defaults (§3.1).** `fileMeta.viewport` and
  `fixtureMeta.viewport` are named exports the static index never sees, so the viewport
  always starts at Fit. Needs either a meta field on `FixtureFileIndex` or a protocol
  message — both contract changes.
- **Name the input that lost a patch.** §7.3 asks for "reported once per input per
  revision"; the count is right but the panel shows an aggregate, because `RESYNC` carries
  a count and not the paths.
- **Let the preview entry read the theme.** The cheapest contract is for the frame host to
  stamp `data-uaight-theme` on the frame's `documentElement`; the demo already reads it,
  and it needs no addition to the frozen surface.
- **Resolve an identifier default export in the index (§3.4).** `const fixtures = {…};
  export default fixtures` is deliberately undecidable today. Walking module-scope `const`
  initializers is straightforward but changes the decision table.

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
- **`IndexProblem.kind: "confinement"`** — an out-of-root `fixturesDir` is reported as
  `unreadable`, which is true but reads oddly.
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
documented limitation that inherited props will not appear. `docgen` already resolves and
is echoed; nothing consumes it.

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
| Q4  | Is the warm pass acceptable by default?                      | **Open** — implemented and on, never measured       |
| Q5  | Does the production gate remove the chunk?                   | Answered, affirmative, against a real build         |
| Q6  | Do codec editors stay out of the renderer chunk?             | Answered — enforced by imports, not tree-shaking    |
| Q7  | Rolldown file-URL token                                      | Answered — absent; `emitFile` + placeholder         |
| Q8  | Does a real `shadcn add` resolve from our registry?          | **Open** — never run                                |
| Q9  | Glob invalidation under Vite 8.1 / Rolldown / Bundled Dev     | **Open**                                            |
| Q10 | Overlay reapplication across HMR                             | Answered — nothing stale survives; one caveat       |
| Q11 | What goes in `UaightChromeApiV1`                             | **Open** — must close before the v1.2 freeze        |
| Q12 | TypeScript 7.1 API sufficiency, tsgolint parity              | **Open**                                            |
| Q13 | Trademark and npm availability for `uaight`                  | Answered — the name was free; published 4 Aug 2026  |
| Q14 | Should overlay state persist across reloads?                 | Answered — not persisted, but now *shareable*       |
