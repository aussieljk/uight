# Ejecting the chrome

Two levels, and most needs stop at the first.

## Replace a component

Every chrome component is a prop:

```tsx
<Uight components={{ FixtureTree: MyTree, PreviewShell: MyShell }} />
```

| Ejectable                                                                                                                                      | Not ejectable                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `PreviewShell`, `FixtureTree`, `ControlPanel`, `ControlPanelInputs`, `ViewportToolbar`, `Toolbar`, `EmptyState`, `ErrorState`, `InventoryList` | `FrameHost`, the renderer bootstrap, the frame transport, the overlay store and serializer |

The rule behind the table: anything that renders chrome is ejectable; anything that
defines fixture semantics or owns the realm is not.

## Take the source

When replacing is not enough, the registry ships uight's own implementations into your
components directory, as yours:

```bash
npx shadcn add https://uight.dev/r/fixture-tree.json
```

Or configure the namespace once:

```json
// components.json
{ "registries": { "@uight": "https://uight.dev/r/{name}.json" } }
```

```bash
npx shadcn add @uight/fixture-tree
```

Items are published per minor at `/r/v{major}.{minor}/{name}.json`, with `/r/{name}.json`
tracking latest. Items from different versions may be combined only within one minor.

An ejected file records the version it came from in a header **at the end of the file**,
which looks odd and is not a preference: `shadcn add` rewrites an installed file's imports
through an AST transform, and that transform discards whatever comment the file starts
with. A header on line one is published, downloaded, and then deleted on the way to your
disk. At the end it is trailing trivia, and it survives.

## The frozen surface

An ejected component reads the explorer through one hook:

```ts
import { useUightChrome } from "@aussieljk/uight/chrome";

const chrome = useUightChrome(); // UightChromeApiV1
```

That facade — not the component props, not the internal modules — is what is committed to.
It is still settling during the canary; see the roadmap's v1.2 milestone for what has to
land before it freezes.
