# uight × frosted-ui

The demo application for [uight](../../), a component explorer that runs inside
your application's own Vite dev server.

It renders **all 581 Storybook stories from [frosted-ui](https://storybook.whop.dev)**
as fixtures, without Storybook installed, plus a handful of hand-written
fixtures covering the things Component Story Format cannot express.

## Attribution

**frosted-ui is Whop's design system. It is not part of uight, and uight is
not affiliated with, endorsed by, or connected to Whop in any way.**

frosted-ui is MIT licensed, and this demo uses it in two ways:

- It installs the published `frosted-ui` package as a normal dependency.
- It vendors frosted-ui's 77 `*.stories.tsx` files into `src/stories/`, because
  a component explorer is only interesting when it is pointed at a real design
  system with real stories.

The vendored files keep their copyright. The full licence text is at
[`src/stories/LICENSE-frosted-ui.md`](src/stories/LICENSE-frosted-ui.md), and
every copied file carries a header naming the copyright holders and listing
what was changed. The changes are import rewriting and nothing else, apart from
three type references and two lines marked in place — see
[Vendored stories](#vendored-stories) below.

> MIT License
> Copyright (c) 2023 WorkOS
> Copyright (c) 2023 Whop

## Running it

From the repository root:

```bash
bun install
bun run demo          # or: bun run --cwd examples/frosted-ui dev
```

Then:

| URL      | What it is                                                   |
| -------- | ------------------------------------------------------------ |
| `/`      | The host application — a landing page that explains the demo |
| `/uight` | The explorer, served from memory by the plugin               |

Both come from the same Vite server on the same port. There is no second
process and no second config file.

> **Note.** This example consumes uight through the workspace symlink exactly
> as a published consumer would, so it resolves `uight` and `@aussieljk/uight/vite` from
> `dist/`. Run `bun run build` at the repository root first on a fresh clone.

## What it demonstrates

### The two-step install (§1.1)

The entire installation is `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { uight } from "@aussieljk/uight/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		react(),
		uight({ storybook: true, previewEntry: "src/uight.preview.tsx", inventory: true }),
	],
});
```

Everything past that is optional. `storybook`, `previewEntry`, `codecs` and
`optimizeDeps` are in the real config file because this demo needs them; a
project with no fixtures and no design system gets a useful explorer from
`uight()` with no arguments at all.

### Storybook stories as fixtures (§13)

`src/stories/` holds 77 CSF files exporting 581 stories, and **`@storybook/react`
is not a dependency of this project**. CSF is a file format — a default export
of metadata plus named exports of stories — so reading it needs a parser, not a
runtime.

uight supports a declared subset: meta and story `args`, `argTypes`, `render`,
and decorators at meta and story level. It does not run `play`, loaders,
interactions or globals, and badges the stories that ask for them rather than
quietly skipping them. The two Storybook types the copied files import come
from a local shim, [`src/stories/csf-types.ts`](src/stories/csf-types.ts),
which exists purely so the files type-check.

### Hand-written fixtures (§3, §7)

`src/fixtures/` covers what the CSF path cannot:

| File                            | Shows                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `controls.fixture.tsx`          | `useFixtureInput` with text, select, radio, range and checkbox controls (§7.6)                                  |
| `pricing.fixture.tsx`           | A multi-fixture object export with `fileMeta` and `fixtureMeta`, plus an empty-string fixture name (§3.1, §3.2) |
| `money.fixture.tsx`             | Class instances made editable by codecs instead of showing as opaque chips (§7.7)                               |
| `swatches.fixture.tsx`          | A default export whose names **cannot** be parsed statically — progressive disclosure (§3.4, §3.5)              |
| `swatches-declared.fixture.tsx` | The same file with `export const fixtureNames`, which wins outright                                             |
| `uight.decorator.tsx`           | A decorator scoped to this directory, calling `useFixtureId()` (§3.3)                                           |

### The component inventory (§12)

`src/components/` holds three components with **no fixture and no story**:
`StatCard`, `EmptyInbox` and `UserChip`. They exist so the zero-config
experience has something to show — detection is a syntax pass over exported
PascalCase names with a function, `memo` or `forwardRef` shape, so `UserChip`
being a `memo(forwardRef(…))` is part of the point.

`StatCard` takes required props on purpose: selecting it renders it with none,
which is how you see the error boundary catch the failure and report the
missing prop names. Selecting a component runs its real code, and the safety
wording is not decorative — frame isolation contains DOM, CSS and global
listeners, not network requests, storage, cookies or backend effects.

### The preview entry (§6.4)

[`src/uight.preview.tsx`](src/uight.preview.tsx) runs **inside the frame
realm**, once. It imports `frosted-ui/styles.css` and wraps every fixture in
frosted-ui's `<Theme>` with a `<Toaster />`, which is the supported equivalent
of the global decorator in frosted-ui's own `.storybook/preview.tsx`. Providers
that must not remount between fixtures belong here; per-fixture wrappers belong
in a decorator.

### Value codecs (§7.7)

[`src/uight.codecs.tsx`](src/uight.codecs.tsx) registers codecs for `Money`
and `Sku`, two class instances from `src/domain/money.ts`. Without them, a
non-plain object crosses the realm boundary as `opaque` and the control panel
shows an uneditable chip — "editable control panel" would quietly mean
"editable unless the value is interesting". `Money` gets a currency-aware
editor; `Sku` omits `editor` on purpose and is display-only.

### Both entry paths (§1.2)

The landing page in `src/App.tsx` mounts the explorer twice:

```tsx
// Pinned to one fixture, no chrome, sharing the host's realm.
<Uight fixture="fixtures/controls" chrome={false} isolation="inline" />

// Controlled selection — the host owns the URL (§5.4).
<Uight selected={parseFixtureId(param)} onSelect={(id) => setParam(id && serializeFixtureId(id))} />
```

Controlled selection is the recommended integration for any app that already
has a router, because `router="history"` calls `pushState` directly and
`pushState` does not emit `popstate` — a host router would never learn about the
navigation.

## Vendored stories

`src/stories/` mirrors frosted-ui's layout: `components/<name>/<name>.stories.tsx`
from `packages/frosted-ui/src/components/`, and `storybook/<name>.stories.tsx`
from `packages/frosted-ui/.storybook/stories/components/`.

Imports were rewritten by a script so the files resolve against the published
package instead of frosted-ui's own source tree:

| Upstream                                                                       | Rewritten to                          |
| ------------------------------------------------------------------------------ | ------------------------------------- |
| `'..'`, `'../..'`, `'../index'`, `'../<sibling>'`, `'./<self>'`                | `'frosted-ui'`                        |
| `'../../../src'`, `'../../../src/components'`, `'../../../src/components/<x>'` | `'frosted-ui'`                        |
| `'../../theme'`, `'../../../src/theme'`, `'../../helpers/emoji-colors'`        | `'frosted-ui'`                        |
| `'../../icons'`                                                                | `'frosted-ui/icons'`                  |
| `'@storybook/react'`                                                           | `'../../csf-types'` (local shim)      |
| `'@storybook/test'`                                                            | `'../../storybook-test'` (local shim) |

Multiple rewritten imports in one file are merged into a single
`import { … } from 'frosted-ui'`.

Three internals have no root export because they live inside a namespaced
`export * as X`; those references were retargeted rather than dropped:
`RootProps` → `Accordion.RootProps` and `Callout.RootProps`, and
`LightboxZoomRef` → `Lightbox.LightboxZoomRef`.

**No story file was dropped.** All 77 copied files type-check cleanly:

```bash
bun run --cwd examples/frosted-ui typecheck        # whole demo
bun x tsc --noEmit -p examples/frosted-ui/tsconfig.stories.json   # stories only
```

## Licence

The uight demo code in this directory follows the repository's licence. The
files under `src/stories/` are frosted-ui's, MIT, © 2023 WorkOS and © 2023 Whop
— see [`src/stories/LICENSE-frosted-ui.md`](src/stories/LICENSE-frosted-ui.md).
