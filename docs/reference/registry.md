# The registry

The ejection registry (SPEC §11.3, ROADMAP item 3) is hosted by this site. Every item is
a static JSON file under `/r/`, copied out of `packages/uight/registry` by
`docs/scripts/sync.ts` at build time, so the URLs an item advertises and the URLs this
site serves are the same paths by construction rather than by agreement.

## URLs

| URL                                    | What it is                                      |
| -------------------------------------- | ----------------------------------------------- |
| `https://uight.dev/r/registry.json`    | The registry index — every item, no file bodies |
| `https://uight.dev/r/{name}.json`      | An item, tracking the latest minor              |
| `https://uight.dev/r/v0.0/{name}.json` | The same item, pinned to a minor                |

Items carry their file contents inline, so `shadcn add` needs exactly one request per
item plus one per registry dependency.

## Adding an item

```bash
npx shadcn add https://uight.dev/r/fixture-tree.json
```

Or name the registry once, which is what the namespaced dependencies expect:

```json
// components.json
{
	"registries": {
		"@uight": "https://uight.dev/r/{name}.json",
		"@uight-v0-0": "https://uight.dev/r/v0.0/{name}.json"
	}
}
```

```bash
npx shadcn add @uight/control-panel        # tracks the latest minor
npx shadcn add @uight-v0-0/control-panel   # pinned to v0.0
```

The namespace form is the better one: items that depend on other items — `control-panel`
pulls in `control-panel-inputs` — reference them as `@uight/…` (or `@uight-vX-Y/…` on
the pinned copies), and the CLI can only follow that once the namespace is defined.
Neither form names a host, so both resolve against whatever URL the `registries` map
points at — a mirror, a preview deploy, or a local server.

## What an item installs

An item ships more than its component. §11.3's chrome components import three kinds of
thing, and each is handled differently at emit time so that the installed file compiles:

| In this repository                                                                                                                       | In your project                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `react`                                                                                                                                  | unchanged — you already have it                                                |
| `../../shared/types.ts`, `../chrome-context.ts`, `../../shared/wire.ts`, `../../shared/fixture-id.ts`, `../../runtime/codec-editors.tsx` | `uight/chrome` — the frozen surface (§11.4)                                    |
| `../cx.ts`, `../dropped.ts`, `../docs.ts`, `../constants.ts`, `../wire-view.ts`, `../Overlay.tsx`                                        | a **companion file** installed beside the component                            |
| `./ControlPanelInputs.tsx`                                                                                                               | `./ControlPanelInputs` — the sibling item, pulled in by `registryDependencies` |

Companion files are internal helpers with no published home. Copying them is the point:
they are small, they are yours now, and the alternative — publishing them — would freeze
API that was never meant to be frozen.

Every source file in an item is emitted into **one flat directory**, so a `./sibling`
specifier resolves wherever shadcn decides to put them. Nothing an item ships imports
outside that directory; the build fails rather than emit a specifier it has no mapping
for, and the tests assert both.

## What has actually been proven

Honesty about the state of this, because "it should work" is how registries stay broken:

- The real `shadcn` CLI (4.16.1) has resolved and installed these items over HTTP, from
  this site's built `public/` served at a URL root — the flat `@uight/{name}` form, the
  direct-URL form, the pinned `@uight-v0-0/{name}` form, and registry dependencies
  followed from one item to another (including from a pinned item to a pinned item).
  Files land in `components/` and `styles/uight-chrome.css`, and `uight` is added to
  `dependencies`.
- **The installed files compile.** In a scratch project with a stock `tsconfig.json` —
  no `allowImportingTsExtensions`, `moduleResolution: "bundler"` — `tsc --noEmit` passes
  over all thirteen files that `@uight/fixture-tree`, `@uight/control-panel`,
  `@uight/prop-table`, `@uight/command-palette`, `@uight/viewport-toolbar` and the
  pinned `@uight-v0-0/*` items install, typechecked against the real `uight/chrome`
  declarations. This is the claim §11.1 asks for; it was false until the specifiers were
  rewritten at emit time.
- What that does **not** prove is `https://uight.dev` itself. The domain has to be
  serving this build before any of the URLs above are real. Nothing in the emitted items
  names a host any more, so the proof above transfers to the deploy the moment it exists
  — but the deploy does not exist yet.
