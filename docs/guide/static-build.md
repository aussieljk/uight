# Shipping a static explorer

```bash
bunx uaight build          # → dist-uaight/
```

A deployable explorer: one directory of static files, no dev server, no checkout. This is
how a design system actually gets adopted across an organisation — a URL everyone can
open, linked from wherever your team already reads things.

```bash
bunx uaight build --out dist-uaight --base /design/ --root .
```

| Flag | Default | Notes |
| ---- | ------- | ----- |
| `--out` | `dist-uaight` | Output directory |
| `--base` | `/` | Public base path — set it when you deploy under a subpath |
| `--root` | cwd | Project root |
| `--config` | discovered | An explicit Vite config file |

## What it builds with

Your own Vite config: the same resolver, the same aliases, the same plugins, the same
Tailwind. A second config would be a second way for the build to be wrong.

The build runs the plugin's production path with the explorer chunk deliberately included.
That is the opposite of the default in your application bundle, where `production:
"exclude"` removes the explorer entirely so it cannot ship to users by accident.

## What is not in it

The component inventory and call-site harvesting are **development-only**. A static build
therefore shows your fixtures and CSF stories, not the "detected components" list — the
zero-config experience is a dev-server experience by design.

`/__open-in-editor` also has no server to talk to, so "Open source" degrades to nothing in
a static build.

## Embedding instead

If you want the explorer inside an application you already ship — an internal tools page,
an admin area — mount it directly and keep the dev-server experience out of it:

```tsx
import { Uaight } from "uaight";

<Uaight height={720} />;
```

```ts
uaight({ production: "include" });
```

`production: "error"` is the third option: fail the build if the explorer would be
included. Use it when the point is that it must never ship.
