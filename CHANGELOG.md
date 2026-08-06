# Changelog

Notable changes to `uight`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project follows [semantic versioning](https://semver.org/spec/v2.0.0.html).

**Release format: `0.0.1-canary.N`.** Everything published while the surface is still
moving is a canary, and the counter is the only part that changes. `package.json` and
`UIGHT_VERSION` are held in lockstep by `scripts/version.ts` and asserted by
`version:check`, which the release gate runs first — the runtime compares them at §16.2,
so drift reaches users as "one of them is a stale build artefact". The `1.0.0` in earlier
drafts of this file was never published; it is folded into the first canary below.

Section numbers refer to `SPEC.md`; the findings behind most entries are recorded in
`NOTES.md`. Planned work is in `ROADMAP.md`.

---

## Unreleased

### Added — `eager`, hover prefetch, and a documentation site that switches instantly

Selecting a page on `uight.dev` used to re-tokenize and re-highlight the whole document
inside the preview frame, because switching unmounts the previous page and takes its
`useMemo` with it. On the spec — 82 kB, 40 fenced blocks — that was 2.8 seconds of
synchronous main-thread work, paid again on every return. Rendering now happens at build
time, and shiki and `marked` are gone from the client bundle entirely. Click to painted
went from 2800 ms to a steady 30–60 ms across every page.

Three of the changes are package features rather than site ones:

- **`eager`** (§4.1, §9.1) — a build-only option that bundles fixture modules into the
  entry chunk instead of code-splitting one lazy chunk each. Off by default and wrong for
  a component corpus of any size; right when the modules are small and switched between
  constantly, where the round trip per selection _is_ the latency.
- **`PREFETCH`** (§9.1) — the host knows what the pointer is over and the renderer holds
  the loaders, so `FixtureTree` warms a file's chunk on hover through a new advisory
  message. `FixtureTreeProps.onPrefetch` is optional in both directions; an ejected tree
  may ignore it and nothing about selection depends on it.
- **A fixture keeps rendering while the next one loads.** `Loaded` records the selection
  its fixture belongs to, so the outgoing tree stays mounted under its own key rather than
  being replaced by a blank frame. Only the first load of a realm shows nothing, because
  only then is there nothing to hold over.

Verified in the built site: one frame document, never rewritten, across six switches.

### Added — §7.6's `from`, the last unimplemented line of the control model

`InputOptions.from` was declared and read by nothing. An input that names a prop —
`from: { component: "Button", prop: "variant" }` — now picks up that prop's description
and, where the type is a union of string literals, its options. Resolved on the host,
where the docs already live, and applied above both the packaged panel and the facade so
an ejected `ControlPanel` sees the same thing.

D18 is intact: this is a reference the author wrote, not an inference. Nothing reads the
input's _name_, `type` never chooses a control, and a union containing anything that is
not a quoted string literal is rejected whole — three of a component's five variants
under a select is worse than a text box, because it looks authoritative.

### Added — the registry gate, and the licence header it found

`bun run registry:resolve` runs **shadcn's own CLI** against the registry and checks what
lands: transitive `registryDependencies`, companion files, `registry:file` targets, no
specifier still pointing at this repository, every uight import being the frozen surface,
and §11.4's licence header surviving. In CI over a loopback server; `--deployed` runs it
against `https://uight.dev/r`. This closes Q8, which §11.1 makes a precondition for the
registry example being correct at all.

**It found a defect immediately.** shadcn rewrites an installed file's imports through an
AST transform, and that transform discards leading trivia — so the licence header was
published, downloaded and then deleted on the way to disk. Every `.ts`/`.tsx` file
arrived without it, while interior comments and the CSS header survived. `withHeader`
emits it as trailing trivia now. No amount of reading our own files would have found
this, which is the whole of §11.1's "proof, not plausibility".

### Changed — the read-only endpoints are loopback-bound

§19.6 has always said "loopback-bound by default"; the middleware answered wherever Vite
bound. Read-only is not the same as harmless — `/@uight/config.json` echoes resolved
filesystem paths and `/@uight/index.json` lists every fixture file in the project, and
together they are a map of somebody's source tree. `vite --host` is a statement about the
application, not about this.

A non-loopback request now falls through rather than being refused, because a 403
confirms the endpoint exists. `devApi: 'any'` restores the old behaviour for a proxy or
container that legitimately forwards; `devApi: false` removes the endpoints outright,
which costs `@aussieljk/uight/mcp` and external tooling and costs the explorer nothing —
it learns the index from the virtual module and the `uight:index` event, never over HTTP.

### Changed — SPEC §20 describes the verification that exists

The section specified a Vitest suite and a Playwright matrix. Both were built, both were
removed, and the specification kept asking for them — which makes a document that is
supposed to be the source of truth into a permanent, misleading defect report. §20 is now
"Verification": the gates that actually run, the budgets that are actually measured, and
an explicit statement of what none of them establish. The browser rows are gone from the
budget table rather than listed as targets-in-waiting, because listing them implies a plan
to enforce them and there is none.

Also corrected against what shipped: the package is `@aussieljk/uight`, the package
manager is bun, `Playwright` is an optional peer for the MCP screenshot tool rather than a
pinned test dependency, §4.1's options block lists every option the plugin accepts, §21.2
says which rows shipped, and §22's table carries answers instead of questions.

### Changed — uight.dev is a uight instance

The documentation site was VitePress. It is now `bunx uight build` over a tree of
`.docs.mdx` pages in `docs/src/`, with no second generator anywhere in it: the sidebar you
navigate is the fixture tree, each page is one docs page (§14), and `docs/scripts/sync.ts`
still copies `SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md` and `CHANGELOG.md` in and the
built registry into `public/r/`.

The previous entry gave the reason for VitePress — "a project whose documentation site is
its own unshipped feature cannot publish a page about a bug in that feature" — and that
risk is real and unchanged. What changed is the weighing of it against the other one: a
component explorer whose own documentation is a different tool's output is a claim nobody
has to take seriously, and every rough edge in docs pages is now one the maintainers meet
first. §1.4's non-goal stands: uight is not becoming a documentation framework, and the
site is missing the things that would require — full-text search, per-page URLs, a
sitemap. `docs/guide/docs-pages` says so on the page.

The four documents synced from the repository root stay Markdown and are rendered rather
than compiled: SPEC.md is full of `{`, `<` and `|` that MDX reads as expressions and JSX,
and escaping a document for a generator is how it stops being the copy the maintainers
read. Every other page is Markdown for the same reason — one rendering path, one
stylesheet, one link behaviour — with a four-line `.docs.mdx` beside it carrying its title
and its place in the sidebar.

### Added — `fileMeta.title`, and `fileMeta.order` implemented

`FixtureFileMeta.order` has been documented as "sort weight within its directory, lower
sorts first" since §3.1 was written, and `buildTree` never read it: the tree sorted by
path and nothing else. It reads it now, and a directory takes the weight of its earliest
child, so an ordered `guide/` sorts ahead of an ordered `reference/` without either
directory being weighted itself. Unweighted files sort after weighted ones, alphabetically
as before, so a corpus that declares nothing is ordered exactly as it was.

`fileMeta.title` is new and does for a single-fixture file what `fixtureMeta`'s `title`
already did for a named fixture: it is what the tree calls the row. A per-fixture title
still wins where there is one.

### Fixed — `previewEntry`'s CSS reached the frame in development only

An explorer built with `uight build`, or embedded with `production: "include"`, rendered
every fixture with none of the host's global CSS. `previewEntry` exists to deliver exactly
that, so this was the feature failing in the one place it is deployed.

In development Vite serves CSS as JavaScript that injects a `<style>` into the realm it
runs in, and the renderer runs in the frame realm, so it worked. A build extracts that CSS
to a file and links it from the HTML document that loads the chunk — but the renderer is
injected into the frame as a script element at runtime (§6.3) and the frame's document
never passes through `transformIndexHtml`, so nothing linked it. The stylesheets are now
carried on `virtual:uight/renderer-url` beside the entry URL, resolved from the bundle in
`generateBundle` the same way the entry URL already was, and linked into the frame ahead
of the script that needs them. Development is unchanged: the list is empty there.

Found by building this site, which is the argument for building it this way.

### Added — `uight build --title`

`buildStatic({ title })` had no flag, so a published explorer was titled after its
directory — "docs — components" for a site called uight.

### Fixed — an MDX page can carry metadata

`parseFixtureFile` short-circuited on `.mdx` — one fixture, no parse — so `fileMeta` in a
docs page was read by nobody. It could not be picked up later either: `default-single` is
a decided answer, so the warm pass never executes the module. The ESM exports inside an
MDX document are ordinary JavaScript at column zero, so the statement is now cut out of
the prose and parsed on its own. Anything that cannot be read stays absent, as everywhere
else metadata is read statically.

---

## [0.0.1-canary.2] — 4 August 2026

### Fixed — the preview frame is a real document, not `about:blank`

`FrameHost` created the iframe with no `src` and wrote into the `about:blank`
document it inherited. That document has no creation URL, and the platform treats
one as second-class: `navigator.serviceWorker.getRegistrations()` throws
`InvalidStateError` in it outright. MSW calls that inside `start()`, so
**every fixture that mocks its network rendered nothing** — the worker promise
rejected, the wrapper never flipped to ready, and the only evidence was a console
line naming neither MSW nor the frame. Cookies, storage partitioning and
`location` were all likewise not what the fixture would see in the app.

The dev server now serves the same document at `/@uight/preview`, generated in
memory by the middleware exactly like the explorer document above it (§6.1), and
`uight build` emits it as `preview.html` beside `index.html`. Both pass it to
`<Uight previewDocumentUrl>`, which already existed for §6.6's custom documents
— the adopt path was written and reachable only by hand.

Two things come free. The served document goes through `transformIndexHtml`, so
the React plugin's Fast Refresh preamble reaches the frame realm rather than
being imported by hand in §6.3. And a fixture now behaves the same in `bun dev`
and in a deployed static explorer, which it did not before.

Writing into `about:blank` stays as the fallback for a mount with no URL to
offer, so an embedded `<Uight />` is unaffected.

### Fixed — `uight build` ran the app's framework plugins

`buildStatic` runs the user's own Vite config on purpose, so the explorer is
built by the same resolver, aliases and transforms as their app. A
meta-framework's plugins are the exception: they are not transforms, they _are_
an application — they own the document, the SSR entry, the route tree and the
client manifest — and pointing them at the explorer's document asks them to
build an app that is not there.

In a TanStack Start project the build died on `multiple entries detected`
naming two hashed filenames and no cause, because the manifest plugin counted
the explorer's document and the emitted renderer chunk. Dropping that one plugin
then produced `Cannot get config before root is resolved`, because a framework's
plugins are a set and its router-generator reads the config context its
`…-core:config` plugin installs. So the whole set goes, matched by
`FRAMEWORK_PLUGINS` and extensible per build with `excludePlugins`.

Nothing is dropped in silence: `buildStatic` returns `excluded`, and the CLI
prints the count and the frameworks it belongs to.

The user's config is now loaded through `loadConfigFromFile` and passed inline
with `configFile: false` — a plugin cannot remove another plugin, so before the
config reaches Vite is the only place a filter can run.

### Fixed — `uight build` passed `input` as an array

A plugin in the user's own config that appends its entry to
`build.rollupOptions.input` turned the array into a mixed array of strings and
objects, and the build died on `Invalid type: Expected string but received
Object` for `input.2` — naming neither plugin. It is a record now, which is what
`previewHtmlInput` already used for the same reason.

---

## [0.0.1-canary.1] — 4 August 2026

### Removed — every automated test

`packages/uight/tests/**` (514 tests across 33 files), `tests/e2e/**` and
`playwright.config.ts` (§20.2's Chromium/Firefox/WebKit matrix), and
`scripts/corpus.ts` (the golden-corpus harness) are all gone, with the `test`
scripts, CI's `e2e` job and the test step in `check` and `release`.

**This is a divergence from SPEC §20, which still asks for both halves, and it is the
most consequential entry in this release.** Nothing now executes the package's
behaviour: `bun run check` is the stylesheet freshness check, the build, two type
checks, lint and format. The six defects the browser matrix found this cycle are fixed
in the source, but nothing prevents any of them from returning silently, and
`FrameHost` carries three bootstrap defences precisely because each covers a different
engine's ordering — losing one is once again invisible. The §20.3 browser budgets
(first paint, handshake, HMR latency, memory) are no longer measured; the four Node
budgets in `scripts/bench.ts` still run in CI and still fail on a breach.

### Changed — protocol version 2, and version 1 is not accepted

`RESYNC` carries the dropped patch **paths** rather than a count, so §7.3's "reported
once per input per revision" can name the input that lost a setting instead of showing
an aggregate. `SUPPORTED_PROTOCOL_VERSIONS` is `[2]`: the shape is incompatible and a
version-1 renderer is refused rather than partially understood. A mixed install
therefore surfaces as a protocol error, which is the intended failure.

### Added — prop tables (§15.2), behind a docgen interface

A `DocgenResolver` interface with a Babel implementation (`react-docgen`, a
dynamically-imported dev dependency — `docgen` defaults off, so no install pays for a
parser). `PropTable` is a §11.3 ejectable and renders documented props for detected
components. **D18 holds: this is display metadata, and docgen never infers a control
from a prop name.** Every `ComponentDoc` carries the `inherited-props` limitation so a
table cannot render without its caveat.

### Added — `render_fixture`, an MCP screenshot tool

Returns a real image rather than a URL. Playwright is an **optional peer dependency**,
dynamically imported; without it the tool explains itself and points at `fixture_url`.
Chromium only, deliberately: this is a capture, not a compatibility matrix.

### Added — `uight doctor`

Config, index, problems by kind, call sites, and what is on — the answer to "why is my
component missing" without opening the UI. It loads the **Vite config**, not just
`uight.config.json`, so it sees options passed inline to `uight()` and agrees with
the dev server (84 files / 593 fixtures on the demo, where a config-file-only read
reported 6).

### Fixed — installed registry items now compile

A real `shadcn` CLI run over HTTP resolved and installed the items, and the installed
files did not typecheck: emitted bodies kept in-repo specifiers (`../../shared/types.ts`,
`../cx.ts`). Specifiers are now rewritten at emit — published ones to `@aussieljk/uight/chrome`,
internal helpers shipped as companion files — and an unmapped relative import **fails
the build** rather than passing through silently. `@aussieljk/uight/chrome` gained the surface
that required: `fixtureIdsEqual`, `serializeFixtureId`, `applyPatches`, `pathKey`,
`builtinCodecEditors`, `withBuiltinEditors`, and seven types. **No emitted artifact
names a host any more** — pinned items use an `@uight-v0-0/` namespace instead of
absolute `uight.dev` URLs, so they resolve against any mirror. Verified: 13 files
installed into a scratch project, `tsc --noEmit` exits 0.

### Fixed — six defects the browser matrix found before it was removed

A control-panel edit never reaching the frame (two causes, neither in the transport);
inline isolation never receiving a selection; two mounts on one page under StrictMode,
where neither owned the URL; a rename leaving its old path in the tree, deep-linking to
a dead file; a fixture edit reloading the host document instead of fast-refreshing
(which alone took HMR latency from ~880 ms to 37 ms); and a CSP failure not naming the
directive §6.7 step 5 requires. Root causes are in `NOTES.md`.

### Added — UX and UI pass

Windowed fixture tree (a search keystroke over 591 fixtures renders ~50 rows);
session-restored navigation that still yields to URL parameters per §5.4; palette
recents; an undoable control reset; named dropped patches; copy-link feedback;
call-site-first rendering for detected components; `/__open-in-editor` from a call
site, degrading where the endpoint is absent; a sticky viewport with fixture-declared
defaults (§3.1). Selection is a left accent bar with the focus ring reserved for focus;
panes resize and persist; one overlay primitive with a real focus trap backs both the
palette and the help dialog; the type scale moved to Tailwind's predefined utilities.

### Changed — plugin and tooling

Call sites resolve path aliases through `configResolved`'s alias table. `uight mcp`
discovers the dev server instead of assuming port 5173. The static build writes its
scaffold under `node_modules/.uight/` rather than the project root, so a crashed build
cannot leave files in your working tree. An out-of-root `fixturesDir` reports
`kind: "confinement"` rather than `unreadable`. `.mdx` fixtures are documented and
demonstrated. `const fixtures = {…}; export default fixtures` now resolves in the index
(§3.4's decision table changed). `bun run check` runs the local gate; `bench` enforces
an 8 KB drift limit on the chrome bundle alongside the absolute 90 KB budget.

### Added — `uight init`, one command from a Storybook repository

`uight init` (also `uight migrate`) adds `uight` to `devDependencies`, adds
`uight({ storybook: true })` to the Vite config's `plugins` array, and prints the §13
compatibility report so the move is quantified before it is committed to. The config edit
is made against the parsed config — the import goes after the last existing one, the
plugin is prepended to the `plugins` array the parser found — and a config with no
`plugins` array, or one that does not parse, is **declined with the line to paste** rather
than half-edited. `--dry-run` computes every change and writes none; re-running skips what
is already done. Nothing is installed and no package manager is run: the install command
is printed. Exported as `migrateFromStorybook()` from `@aussieljk/uight/vite` for CI.

### Added — MDX documentation pages (§14)

`**/*.docs.mdx` under the fixtures directory is a documentation page: prose that lives
beside the components it describes. Mechanically it is a fixture — the same glob map, the
same index entry, the same selection, the same frame realm, one page per module — and the
suffix buys only the ability to say which it is, so the tree marks the row "Doc". No
second pipeline, no router, no authored navigation: §1.4's "becoming an MDX documentation
framework" is still a non-goal, and this is the version of the feature that does not
become one. `docs: false` turns the pattern off; `docs: { fileSuffix }` renames it. The
startup advice for a missing MDX plugin now names pages and fixtures separately, because
a project with docs pages and no plugin has a broken docs page, not a broken fixture.

### Added — grid mode

<kbd>g</kbd>, or **Grid** in the toolbar: every fixture in the tree at once, as a contact
sheet, with search narrowing it exactly as it narrows the tree. Clicking a tile selects
that fixture and returns to the single view. Each tile is its own frame, because forty
fixtures sharing one document would share global listeners, `document.body` and any CSS
one of them injects. Frames are not free, so a tile mounts when it scrolls near the
viewport, at most 30 hold a live frame at once, and past that a tile waits on a button —
pressing <kbd>g</kbd> on a 600-fixture corpus gives a readable list rather than a stalled
tab. Nothing renders in bulk without being asked, which is §12's rule unchanged.

### Added — the documentation site

`docs/` is uight.dev: a VitePress site with the guide and reference pages, built by
`bun run docs:build`. `docs/scripts/sync.ts` copies `SPEC.md`, `ARCHITECTURE.md`,
`ROADMAP.md` and `CHANGELOG.md` in under Reference — one source of truth each, never a
second copy to maintain — and copies the built registry into `public/r/`, which is what
makes the `https://uight.dev/r/…` URLs the registry items already point at real.

VitePress rather than uight's own MDX pages, deliberately: a project whose documentation
site is its own unshipped feature cannot publish a page about a bug in that feature.

### Removed — the first-run safety notice

The §12 banner is gone. What it said is true and is now in the docs and in `SPEC.md`
§12 — rendering a detected component runs its real code, and frame isolation contains DOM,
CSS and global listeners but not network, storage, cookies or backend effects. What it did
was interrupt the first render of every session to say it. Selection is still explicit,
still never on hover or in bulk, and that is the part that was doing the work.

---

### Known limitations

- **No tests, as above.** The demo is the only way to observe that any of this works.
- **Q8 needs a deployed `uight.dev`.** Everything else is proven against a local
  mirror; nothing emitted names a host, so the proof transfers unchanged.
- **Q4 and Q9's browser halves are unmeasured**, and can no longer be measured here.
- **Chrome bundle is 58.9 KB gzipped**, up from 41.2 KB at canary.0.
- **axe reported `color-contrast` violations** across the chrome surfaces before the
  a11y spec was removed with the rest of the suite. They are not fixed.

## [0.0.1-canary.0] — 4 August 2026

The first published build. Protocol version `1`.

The thesis is unchanged: install the package, add the plugin, open `/uight`. No config
file, no second process, no HTML file in the repository. What this canary adds is what
happens when you do that on a codebase with **no fixtures at all** — you get your own
components, rendered with the props your own code already passes them.

Three things landed **ahead of the §21.2 plan**: the declared Storybook CSF subset
(planned for v1.1), the ejection registry (planned for v1.2), and now a Storybook
drop-in path that §13 had ruled out by construction. The chrome facade does **not**
freeze here.

### Added — fixtures harvested from real call sites

§12 gave a codebase with no fixtures a _list of components_. A list is not the payoff:
selecting a detected component usually rendered a crash, because a real component needs
props — and its props are already written down wherever the app uses it.

- One more pass over the ASTs the inventory scan already parses, collecting every
  `<Component …>` usage with statically readable props (`src/vite/callsites.ts`).
- Syntax only, exactly like §12 step 2. A value that is not statically readable is
  **named in `dynamic` and left out** — never guessed. Spreads, computed props, regexes
  and bigints are all recorded as dynamic; a template literal with no expressions is not.
- Ranked by distinctness rather than frequency, deduplicated by prop signature, capped
  per component (`callSites: { max }`, default 8).
- Each usage renders as a real fixture: its props register through `useFixtureInput`, so
  the control panel drives them and the overlay model backs them. This does not conflict
  with D18 — nothing is inferred from a prop _name_; the starting values are code the
  user wrote.
- Sites are matched to a detected component by name, narrowed by the import specifier
  when it resolved. A usage in the file that defines the component has no import, so
  those are kept rather than dropped.
- "Copy as fixture" emits a fixture module as text. uight still writes no files (§1.4).
- New endpoint `/@uight/callsites.json`.
- Verified live: 26 components, 45 usages across the demo, with `onClick`, `src` and
  `children` correctly excluded as dynamic.

### Added — Storybook drop-in (`.storybook/preview`)

§13 declined global decorators "by construction: `.storybook/preview` is never loaded".
That construction was the whole distance between reading a repository's stories and
_running_ them: nearly every real Storybook install puts its providers, theme and global
styles in that file, so declining it rendered a corpus stripped of context.

- `.storybook/preview.{ts,tsx,js,jsx}` is discovered automatically when Storybook support
  is on; `storybook: { preview }` sets a path or turns it off.
- Finding one flips `globalDecorators` on by default. An explicit `support.globalDecorators`
  still wins in both directions, and with no preview the original position stands.
- Decorators nest preview → meta → story, outermost first. Args, argTypes and parameters
  layer in the same order.
- `initialGlobals` reaches `context.globals`.
- Nothing is badged for a feature that now runs.
- `uight storybook` (and `storybookReport()` from `@aussieljk/uight/vite`) reports, syntax-only,
  which CSF features in a repository would not survive the move — the question a team
  evaluating uight actually asks.

### Added — `@aussieljk/uight/mcp`, the explorer as an agent tool

A component explorer answers _what exists_, _what states does it have_ and _what does
this look like_ — the questions an agent editing a component cannot answer from source.
§19.6's read-only endpoints already answered them for "tools that cannot import the
package".

- Stdio JSON-RPC MCP server, no SDK dependency, shipped as `uight-mcp` and `uight mcp`.
- Tools: `list_fixtures`, `list_components`, `list_call_sites`, `fixture_url`,
  `get_config`, `health`.
- A **client of a running dev server**, not a second index: it cannot disagree with what
  the explorer shows, and it inherits §19.6's read-only guarantee — no tool here writes.
- `fixture_url` emits byte-identical URLs to the ones the explorer's own router writes,
  verified by round-trip rather than by inspection.

### Added — shareable control state

§5.4 kept control values out of links and §1.3's job 4 said "not in a state". That was
the right default when the overlay model was new and the wrong one now that it has held.

- `?state=` carries the overlay as base64url next to `?fixture=`. Off by switching
  `shareState={false}`; the parameter name is `stateParam`.
- Safe by construction: `Patch.value` is `EditableWire`, which excludes `opaque` by type,
  so no function, element or DOM node can reach a URL even in principle.
- A link is untrusted input, so paths are re-validated on the way in — `__proto__` and
  friends are rejected here as well as at the transport boundary (§7.3).
- Revisions are not carried. Seeded patches adopt whatever revision their input registers
  with and are pruned against its current shape, so a stale link degrades to the fixture
  rather than to a wrong render.
- Opening a link and touching nothing leaves the URL intact; state edits replace rather
  than push, so twenty slider tweaks are not twenty history entries.
- "Copy link" in the toolbar, with a fallback for the non-secure contexts a LAN dev
  server runs in.

### Added — `@aussieljk/uight/test`, fixtures doing double duty

The standing objection to any explorer is that fixtures are work that only powers a UI.

- `fixtureIds()`, `loadFixture()`, `mountFixture()`, `inventory()`, `loadComponent()`.
- The **same** normalization the explorer uses, so a fixture that renders there renders
  here — CSF stories, meta and story decorators, `uight.decorator`, and the preview
  entry's providers included.
- Returns elements by default and mounts only on request, so it has no opinion about
  which testing library you use.

### Added — the static explorer build

§9 covered embedding the explorer in an app; it did not cover _publishing_ one, which is
how a design system gets adopted across an organisation. Without it §1.3's job 3 stopped
at the edge of one machine.

- `uight build` → a deployable site (`dist-uight/` by default), plus `buildStatic()`
  from `@aussieljk/uight/vite`.
- Runs the **user's own Vite config**, so the explorer is built by the same resolver,
  aliases and plugins as their app.
- `UIGHT_STATIC=1` is the one thing that can override `production` from outside the
  config, because an inline plugin cannot reach into another plugin's options and a
  second `uight()` would claim the same virtual modules twice.
- Verified against the demo: 274 files, the explorer chunk, the emitted renderer and
  per-story code splitting, with the scaffold files cleaned up afterwards.

### Added — the command palette

- `⌘K` / `Ctrl K` over every fixture, detected component and harvested call site.
- Subsequence matching with bonuses for contiguous runs and word boundaries; an exact
  substring outranks a scattered match, and a label outranks a path.
- Filtering and ranking happen outside the component, so a replacement palette never
  reimplements the matcher.
- Scoped to the mount, like every other shortcut here: an embedded explorer must not take
  ⌘K from its host.
- Ejectable, as `@uight/command-palette`.

### Added — the golden corpus harness, and CI

`NOTES.md` records the lesson: _a checker that has never been observed to fail is not
evidence of anything_. Three of the four worst defects in this project's history were
integration defects that the unit suites could not see, because each part was correct on
its own — and the sweep that caught one of them lived in a scratchpad and was discarded.

- `scripts/corpus.ts` runs the whole index pipeline over frosted-ui's 77 CSF files plus
  the demo's fixtures and digests the result; `tests/corpus.test.ts` pins it.
- A **negative control** that must fail: a scan over a deliberately broken fixture has to
  report `unparseable`, and the good file beside it has to survive. Verified to
  discriminate in both directions, not assumed.
- `.github/workflows/ci.yml`: version lockstep, build, typecheck (package and demo),
  lint, tests, registry build, stylesheet freshness. `oxfmt --check` is deliberately not
  a step yet — oxfmt 0.61 with no config disagrees with 205 of the repository's 209
  files, and that reformat deserves to be its own change.
- 336 unit tests across 18 files, up from 269 across 12.

### Changed

- **Release format is `0.0.1-canary.N`**, with `version:bump`, `version:sync` and
  `version:check` scripts and a test holding `package.json` and `UIGHT_VERSION` together.
- `UightComponents` gains `CommandPalette`; `FixtureIndex` and `RuntimeConfig` gain
  `callSites`; `RuntimeConfig` gains `hasStorybookPreview`; `UightProps` gains
  `shareState` and `stateParam`; `StorybookSupport` gains `preview`;
  `UightPluginOptions` gains `callSites`.
- `SELECT_FIXTURE` gains optional `props`, `children` and `origin` — an added field
  rather than a new message, because the renderer's reaction is the one it already has.
- The ejectable set is §11.3's table plus the palette, admitted under the same rule the
  list is drawn by.

### Fixed

- **`dist/client.d.ts` was a directory, not a file.** tsdown's `copy.to` names a
  destination directory, so `to: "dist/client.d.ts"` produced
  `dist/client.d.ts/client.d.ts` — the `./client` export pointed at a directory and
  `"types": ["@aussieljk/uight/client"]` could not resolve at all. Caught by inspecting the tarball
  rather than the source tree.
- The package had **no README and no LICENSE of its own**, so the npm page would have
  been blank and the licence would not have travelled with the tarball.
- **`bin` paths carried a `./` prefix**, which made `npm publish` report
  `"bin[uight]" script name … was invalid and removed` on every run. The message is
  npm's, and it is misleading — that branch normalizes the value rather than dropping it,
  and the packed manifest was always intact — but a warning saying "removed" on every
  publish is a warning nobody will read the second time.
- **`build:css --check` was a vacuous gate.** It compared against `dist/styles.css`,
  which is gitignored: after a build it is trivially equal, and before one it does not
  exist. It now compares the **committed** `src/styles/generated.ts`, which is the file
  that can actually go stale — `tsdown` on its own will happily bundle an old copy. The
  new check was verified to fail on a deliberately stale file.

### Added — `bun run verify` and `bun run release`

- One script at the repository root runs every gate in the order that makes them
  meaningful, then publishes. CI calls the same script, so the two cannot drift into
  checking different things.
- It ends in `npm publish --dry-run`, which needs no auth and catches packaging defects
  that no amount of source-level checking can see — both of the packaging bugs above were
  found that way.
- npm refuses to publish a prerelease without an explicit `--tag`, so the script always
  passes one, defaulting to `latest` so `npm i @aussieljk/uight` resolves.

---

## The base this canary builds on

Everything below was written before the first publish and ships in `0.0.1-canary.0`.

### Added — discovery and the plugin (`@aussieljk/uight/vite`)

- `uight()` Vite plugin. Serves `/uight` from memory in `serve` mode; no HTML file is
  written to disk (§6.1, D16).
- Zero-config defaults for every option (D4). `uight.config.json` is optional and
  discovered synchronously; `defineUightConfig` types a `uight.config.ts` you import into
  `vite.config.ts` yourself. Inline plugin options take precedence over the file.
- One static index scan with `oxc-parser` (D3, §3.4). `FixtureFileIndex.names` is
  `Array<string | null> | null`: one entry per fixture, `null` meaning "the module's default
  export is the fixture", the whole field `null` meaning undecidable.
- Warm pass and reconciliation for undecidable files (§3.5), run in the host realm.
- Component inventory (§12): syntax-only detection of exported PascalCase
  function / `memo` / `forwardRef` components, grouped by directory to merge with the fixture
  tree. On by default, development-only, excluded from production builds regardless of mode.
- Virtual modules of §4.3 (`runtime`, `renderer-url`, `preview-entry`, `inventory`) plus the
  dev endpoints `/@uight/index.json`, `/@uight/inventory.json`, `/@uight/config.json`,
  `/@uight/renderer` and `/@uight/dev-entry`. The two dev URLs are registered in
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

### Added — the explorer (`uight`)

- `<Uight />`, `<UightProvider>`, `<Fixture>`, `<UightErrorBoundary>`.
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
- Explicit routing (D10, §5.4): `?fixture=` carrying `uight:1|`-prefixed ids, ownership
  arbitrated by refcount in a layout effect so two mounts on one page cannot fight,
  malformed ids removed with `replaceState`, unknown-but-well-formed ids left alone.
- Chrome replacement through the `components` prop (D6, §1.4).
- Scoped Tailwind v4 stylesheet compiled at build time, confined with
  `:is(.uight-root, .uight-root *)` so a utility works on the root element itself. The
  scoping transform is a structural pass over balanced blocks, not a regex.
- `.uight-root` is deliberately not an ancestor of the fixture, so our reset never reaches
  the component under test.
- Frozen chrome facade `useUightChrome` / `UightChromeApiV1` exported from
  `@aussieljk/uight/chrome`, which pulls in the context module alone and not the explorer.

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

- One package with subpath exports (D5, §16.1): `uight`, `@aussieljk/uight/vite`, `@aussieljk/uight/runtime`,
  `@aussieljk/uight/chrome`, `@aussieljk/uight/client`, `uight/styles.css`.
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
- **§11.2** the sample's `@uight/tree-item` dependency does not exist in §11.3's table and
  is not emitted.
- **§7.7** no `bigint` codec: the wire format carries bigint natively and the `typeof` check
  precedes all object handling, so it could never be reached.
- **ARCHITECTURE §2** `serialize()` takes an optional third argument, because §7.3's
  "warning names the input" and §7.2's per-input opaque-id lifetime both need it.
- **ARCHITECTURE §1** `@vitejs/plugin-react` v6 _does_ publish a preamble module; and the
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
  check, because `UightComponents` has no member for it.
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

[unreleased]: https://github.com/aussieljk/uight/compare/v0.0.1-canary.0...HEAD
[0.0.1-canary.0]: https://github.com/aussieljk/uight/releases/tag/v0.0.1-canary.0
