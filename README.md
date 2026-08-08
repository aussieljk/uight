# uight

A component explorer that runs inside your application's own Vite dev server.
No second server, no second port, no HTML file in your repository — add one
plugin and open **`/uight`**.

```bash
bun add -D @aussieljk/uight
```

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { uight } from "@aussieljk/uight/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), uight()],
});
```

Start the dev server you already had and open `/uight`. Coming from Storybook
or react-cosmos? One command wires everything up and reports what will and
won't survive the move:

```bash
bunx @aussieljk/uight init
```

## Why

Storybook is a second application: its own server, its own builder config, its
own copy of your aliases and plugins. uight is a Vite plugin, so your
components render with **your own config** — the same resolver, the same
Tailwind, the same providers — and there is nothing to keep in sync.

- **Zero config is a real mode, not a demo.** With no fixtures written, uight
  lists every component it detects (syntax-only scan, nothing imported or
  executed) and the **real call sites** where your own code already uses them,
  with the props quoted from source. Selecting one renders it.
- **Fixtures are just JSX.**

  ```tsx
  // src/components/Button.fixture.tsx
  export default {
  	Primary: <Button variant="primary">Click me</Button>,
  	Disabled: <Button disabled>Click me</Button>,
  };
  ```

- **Your Storybook stories already work.** CSF is read natively
  (`uight({ storybook: true })`); anything uight declines is badged in the UI,
  never silently skipped, and `uight storybook` reports it per file before you
  commit to anything.
- **Built for coding agents.** `uight mcp` exposes the explorer over MCP: an
  agent can list fixtures, find real usages of a component, and screenshot a
  fixture as it actually renders. See the agents guide in the docs.
- **Deployable.** `uight build` emits a static explorer — one directory, a URL
  your whole organisation can open. Links carry fixture *and control state*,
  so a bug report link reproduces the exact props.
- **Keyboard-first.** `⌘K` finds anything; `g` shows every fixture at once;
  `?` lists the rest.

## CLI

```
uight build       Build a deployable static explorer
uight init        Wire uight into this project (Storybook / cosmos aware)
uight doctor      Why is my component missing: config, index, problems
uight storybook   Per-file report of CSF features uight declines
uight codemod     Rewrite simple CSF stories as plain-JSX fixtures
uight cosmos      Per-file report for a react-cosmos corpus
uight mcp         MCP server for coding agents (stdio)
```

## Documentation

The docs live in [`docs/`](docs/) and at the deployed docs site — start with
*Getting started*, then *Fixtures*, *Controls*, *Static build*, and
*Storybook*.

## Repository

Bun workspaces monorepo: the package is
[`packages/uight`](packages/uight), a demo app is `examples/ljkui`, the docs
site is `docs/`. Note: pushing to `master` publishes a canary release.

## License

MIT
