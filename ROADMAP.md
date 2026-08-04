# Roadmap

Last reviewed: 4 August 2026. Shipped work is in `CHANGELOG.md`; the reasoning behind most
items is in `NOTES.md`. Section numbers refer to `SPEC.md`.

The release order is §21.2's, with two rows already delivered: the CSF subset (planned for
v1.1) and the ejection registry (planned for v1.2) both shipped in 1.0. What remains under
those headings is the work that *was not* implied by writing the code — proof, hosting, and
the API commitments.

---

## Where 1.0 stands

Everything in §21.2's v1.0 row is implemented and verified against a real corpus: discovery
and normalization, the static index with warm pass and reconciliation, tree and inventory
and selection, inline and frame isolation, the preview entry, explicit `useFixtureInput`
controls with the overlay model and codecs, routing, production modes, and replaceable
chrome. 269 unit tests pass. The demo runs 589 fixtures from 82 files with zero index
problems.

The gap is not features. It is **cross-browser proof and CI**, and the package is not
published.

---

## Before 1.0 ships

Ordered by what blocks the release.

### 1. The Playwright matrix (§20.2)

§20.2 says "required, not optional", and it is the one part of §20 that does not exist. Every
browser-level answer in `NOTES.md` — the frame bootstrap race, the Refresh preamble, CSP,
`matchMedia` in-frame, focus, history — was established by hand in one engine against one
dev server. That is a finding, not a regression test.

- **Matrix:** Chromium, Firefox, WebKit × React 18 and 19 × dev server and production
  preview × default base, non-root base, relative base.
- **Scenarios:** frame bootstrap and handshake; HMR of a fixture; add, delete and rename;
  `matchMedia` inside the frame; portals and modals; keyboard-only tree and panel;
  screen-reader labels; focus restoration after fixture change; CSP with nonces; two mounts
  on one page; the production gate removing the chunk; an ejected component under host
  Tailwind.
- Pin the Playwright version, per §0.2.

The bootstrap race is the highest-value scenario: `FrameHost` carries three defences because
each covers a different engine's ordering, and only one engine has been observed.

### 2. CI, and budgets that fail on regression (§20.3)

No `.github/` exists. CI needs to run `oxlint` (with `oxlint-tsgolint`), `oxfmt --check`,
`tsc --noEmit`, `vitest`, `build-css.ts --check` (the stale-stylesheet guard already exists
and nothing runs it), and the Playwright matrix.

Then the §20.3 budgets, which are targets to validate rather than measurements:

| Metric                                         | Budget          | Status                        |
| ---------------------------------------------- | --------------- | ----------------------------- |
| Plugin startup, 100 fixture modules            | < 300 ms        | 105 ms for 77 files, one-off  |
| Plugin startup, 500 fixture modules            | < 1.2 s         | not measured                  |
| Incremental index on one file change           | < 30 ms         | not measured                  |
| Fixture selection to first paint (frame, warm) | < 250 ms        | not measured                  |
| Frame handshake                                | < 100 ms        | not measured                  |
| Chrome bundle, gzipped                         | < 90 KB         | 32.71 KB, one-off             |
| Memory after 100 mount/unmount cycles          | no upward trend | not measured                  |
| HMR latency, fixture edit to render            | < 150 ms        | not measured                  |

### 3. Prove the registry resolves (Q8)

The registry is generated and its shape is asserted by `tests/registry.test.ts`, but a real
`shadcn add` has never been run against it. §11.1 asks for proof, not plausibility — and the
`$schema` divergence recorded in `NOTES.md` is exactly the class of defect a first real
`shadcn add` catches. This needs the items hosted at the URLs `registry/v1.0/` already
points at (`https://uaight.dev/r/v1.0/…`), then a scratch project.

### 4. The two remaining M0 questions

- **Q9 — glob invalidation** under Vite 8.1, Rolldown and Bundled Dev Mode, across add,
  delete and rename. The plugin mirrors Vite's crawl options exactly so the index and the
  emitted glob cannot disagree, but the invalidation path itself has not been exercised
  under Bundled Dev Mode.
- **Q4 — is the warm pass acceptable on by default?** It executes module-scope code in
  development. It is implemented and on; nobody has measured what it costs on a large,
  side-effect-heavy corpus, or decided what the opt-out looks like if it is not free.

### 5. Q13 — the name

Trademark and npm availability for `uaight`. §22 lists this as blocking the first commit; it
is the reason the package version reads 1.0.0 with nothing published.

---

## v1.1 — MDX, and the honesty items

- **MDX fixtures (§14).** `.mdx` is in the default extension list and `parseFixtureFile`
  indexes it as a single default fixture, so the plugin half is done. What is missing is the
  documented story: the host adds `@mdx-js/rollup` (we do not detect it and do not order
  plugins for them), a demo fixture that proves the path end to end, and a test. Upstream
  treats this as bundler configuration; so should we, in writing.
- **Fixture-driven viewport defaults (§3.1).** `fileMeta.viewport` and
  `fixtureMeta.viewport` are named exports the static index never sees, so the viewport
  always starts at Fit. Fixing it needs either a meta field on `FixtureFileIndex` or a
  protocol message — both are contract changes, which is why they are here and not in a
  patch release.
- **Honour `parameters.layout` at the declared level.** A one-line change gated on the
  support level, now that `'viewport-and-layout'` exists. 71 of frosted-ui's 72 story files
  set `layout`, and at `'viewport-only'` every one renders flush to the top-left.
- **Name the input that lost a patch.** §7.3 asks for "reported once per input per
  revision"; the count is right but the panel shows an aggregate, because `RESYNC` carries a
  count and not the paths. Widening `RESYNC` is a protocol addition.
- **Let the preview entry read the theme.** A frame-realm module cannot ask the explorer
  what `theme` it was given. The cheapest contract is for the frame host to stamp
  `data-uaight-theme` on the frame's `documentElement`; the demo already reads it, and it
  needs no addition to the frozen surface.
- **Resolve an identifier default export in the index (§3.4).** `const fixtures = {…};
  export default fixtures` is deliberately left undecidable today. Walking module-scope
  `const` initializers is straightforward, but it changes the decision table, so it is a
  spec change.

---

## v1.2 — the facade freezes

The registry shipped early, so this release is about the commitment rather than the code.
**Everything that changes a published type must land before the freeze**, because after it
these become breaking changes:

- **Q11 — settle `UaightChromeApiV1`.** What belongs on it, given it is permanent from here.
- **`UaightComponents.ControlPanelInputs`.** §11.3 lists the component as ejectable but the
  type has no member for it, so passing one through `components` works at runtime and fails
  the type check. It is reached through a context today as a workaround.
- **A `component: { current, select }` group on the facade**, if shareable links to detected
  components are wanted. `onSelect` is `(id: FixtureId | null) => void` and an
  `InventoryItem` is not a `FixtureId`, so component selection is unroutable local state
  until the facade can express it. Nothing else moves.
- **`IndexProblem.kind: "confinement"`.** An out-of-root `fixturesDir` is reported as
  `unreadable` — literally true, and it reads oddly.
- **Registry hosting and versioning** made real: `uaight.dev/r/`, the `v1.x` pinning story,
  and a documented upgrade path for someone who ejected at 1.0.

---

## v1.3 — docgen and prop tables

Blocked on **Q12**, which §15.2 states as three gates that must *all* pass before the
TypeScript resolver is adopted:

1. Is the TypeScript 7.1 API sufficient for `react-docgen-typescript`'s needs, not merely
   present?
2. Does the integration work against a real corpus — cross-file interface inheritance,
   generics, unions?
3. Has `oxlint-tsgolint` shipped a build tracking 7.1, so the repository can move without
   losing type-aware linting?

Until all three hold, v1.3 ships the Babel resolver behind the same interface, with the
documented limitation that props inherited from another file will not appear. The `docgen`
option already resolves and is echoed through config; nothing consumes it.

Note that prop tables are **display metadata only**. D18 stands: control metadata is
declared at the call site, and docgen never starts inferring controls from prop names.

---

## Post-v1, and not planned

**Post-v1, if it earns its cost:** fixture scaffolding and any file-writing endpoint.
§21.2's judgement is that on current evidence it does not — it carried disproportionate
security and maintenance liability for something peripheral to the thesis.

**Not planned (§1.4).** These are non-goals, not backlog:

- Bundlers other than Vite 8.1+
- SSR of the explorer chrome, React Server Components
- Visual regression testing and screenshots
- Storybook `play`, loaders and interactions
- Remote renderers, React Native
- Becoming an MDX documentation framework — we export a component; docs pages are the
  host's job
- A plugin or slot system. Replacement is `components` and ejection

---

## Open questions

Status as of this review; the questions themselves are §22's.

| #   | Question                                                     | Blocks      | Status                                             |
| --- | ------------------------------------------------------------ | ----------- | -------------------------------------------------- |
| Q1  | Frame bootstrap race across engines                          | M0          | Answered; needs all three defences. One engine only |
| Q2  | Exact preamble specifier                                     | M0          | Answered — `@vitejs/plugin-react/preamble`         |
| Q3  | Which scheduler; does anything tear?                         | M0          | Answered — microtask default, injectable           |
| Q4  | Is the warm pass acceptable by default?                      | M0          | **Open** — implemented and on, never measured      |
| Q5  | Does the production gate remove the chunk?                   | M0          | Answered, affirmative, against a real build        |
| Q6  | Do codec editors stay out of the renderer chunk?             | v1.0        | Answered — enforced by imports, not tree-shaking   |
| Q7  | Rolldown file-URL token                                      | M0          | Answered — does not exist; `emitFile` + placeholder |
| Q8  | Does a real `shadcn add` resolve from our registry?          | M0          | **Open** — never run                               |
| Q9  | Glob invalidation under Vite 8.1 / Rolldown / Bundled Dev     | M0          | **Open**                                           |
| Q10 | Overlay reapplication across HMR                             | M0          | Answered — nothing stale survives; one caveat      |
| Q11 | What goes in `UaightChromeApiV1`                             | v1.0 design | **Open** — must close before the v1.2 freeze       |
| Q12 | TypeScript 7.1 API sufficiency, tsgolint parity              | v1.3        | **Open**                                           |
| Q13 | Trademark and npm availability for `uaight`                  | first commit| **Open** — blocks publishing                       |
| Q14 | Should overlay state persist across reloads?                 | v1.0        | Answered — no; session-scoped, dropped on change   |
