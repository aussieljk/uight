# uight

A component explorer that runs inside your application's own Vite dev server and needs no
configuration to be useful.

```bash
npm i -D @aussieljk/uight
```

```ts
// vite.config.ts
import { uight } from "@aussieljk/uight/vite";
export default defineConfig({ plugins: [react(), uight()] });
```

Then open `/uight` alongside your app. With no config file and no fixtures, it finds your
components — **and the places your own code already uses them** — and lists both. Write
fixtures when you want to name states; you never have to.

That is the whole onboarding. No second process, no second port, no `uight.config.json`,
no HTML file in your repository, and no third step.

Published as `0.0.1-canary.N` while the surface settles, under the `latest` tag — so a
plain install gets the newest canary. Every push to master releases one.

---

## Repository layout

| Path                  | What                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| `SPEC.md`             | The requirements document. The source of truth for behaviour         |
| `ARCHITECTURE.md`     | The integration contract: which module owns which symbol             |
| `NOTES.md`            | Findings from implementation, including answers to SPEC.md's Q1–Q14  |
| `CHANGELOG.md`        | What shipped in each release, with divergences and known limitations |
| `ROADMAP.md`          | What is left, and what each milestone after this canary holds        |
| `packages/uight`      | The published package                                                |
| `examples/frosted-ui` | Demo: the explorer showing Whop's frosted-ui design system           |
| `docs`                | uight.dev — a uight instance, and the registry it hosts              |

## Package entries (§16.1)

| Entry                      | Contents                                            | Environment |
| -------------------------- | --------------------------------------------------- | ----------- |
| `uight`                    | `<Uight />`, fixture hooks, `defineCodec`, types    | Browser     |
| `@aussieljk/uight/vite`    | The plugin, config resolution, index builder        | Node        |
| `@aussieljk/uight/runtime` | Renderer mount, protocol, serializer, overlay store | Browser     |
| `@aussieljk/uight/chrome`  | `useUightChrome`, chrome component types            | Browser     |
| `@aussieljk/uight/test`    | Fixtures as test fixtures, for Vitest browser mode  | Browser     |
| `@aussieljk/uight/mcp`     | MCP server over the dev server's read-only API      | Node        |
| `@aussieljk/uight/client`  | Virtual module declarations                         | Types only  |

## Command line

```bash
uight init           # wire uight in — one command from a Storybook repository
uight build          # a deployable static explorer → dist-uight/
uight doctor         # why is my component missing: config, index, problems
uight storybook      # which CSF features would not survive the move
uight mcp            # MCP server over stdio; finds the dev server itself
```

`uight init` adds the dependency, adds the plugin to your Vite config's `plugins` array,
and prints how much of your CSF corpus survives the move. `--dry-run` shows every change
and writes none; re-running skips what is already done.

## Development

```bash
bun install
bun run build      # compile scoped CSS, then bundle with tsdown
bun run demo       # the frosted-ui example on http://localhost:5173/uight
bun run docs       # uight.dev at /uight — the site is the explorer, there is nothing else
bun run docs:build # …built, with SPEC/ARCHITECTURE/ROADMAP/CHANGELOG and /r synced in
bun run typecheck  # builds first: @aussieljk/uight/client resolves types through dist
bun run check      # the whole local gate, in the order that makes it mean something
bun run bench      # SPEC §20.3's budgets; fails on a breach
```

## Releasing

```bash
bun run verify              # every gate, ending in a publish dry run. What CI runs
bun run release             # verify, then publish
bun run release --bump      # move the canary counter first
bun run release --tag next  # publish under a different dist-tag
```

Releases are `0.0.1-canary.N` under the `latest` tag, and a push to master publishes one
automatically. `verify` and `release` run the same gates in the same
order, so CI and the release path cannot check different things. `bun run check` is the
same gates minus the release-only ones (version lockstep, the registry, the publish dry
run), for answering "is my change alright" without asking npm about a publish nobody
intends. Three ordering rules are
enforced there rather than remembered:

- the build precedes the type check, because `@aussieljk/uight/client` resolves `RuntimeConfig`
  through the package's own `dist` — checking against a stale one passes when it should not;
- the stylesheet check precedes the build, or it compares the build against itself;
- npm refuses to publish a prerelease without an explicit `--tag`, so the script always
  passes one (`latest` by default, so `npm i @aussieljk/uight` resolves).

`package.json` and `UIGHT_VERSION` are held in lockstep by `version:bump` and asserted by
`version:check`, which the release gate runs first — the runtime compares them at §16.2,
so drift reaches users as a version-skew error.

## Fixtures

```tsx
// src/components/Button.fixture.tsx
export default {
	Primary: <Button variant="primary">Click me</Button>,
	Disabled: <Button disabled>Click me</Button>,
};
```

Controls are declared at the call site — never inferred from a prop name (§7.6, D18):

```tsx
export default () => {
	const [label, setLabel] = useFixtureInput("label", "Click me");
	const [variant] = useFixtureInput("variant", "primary", {
		control: "select",
		options: ["primary", "secondary"] as const,
	});
	return <Button variant={variant}>{label}</Button>;
};
```

## Compatibility and attribution

uight's fixture format is **compatible with react-cosmos 7.x fixture files**, plus the
documented extensions in SPEC.md §3. It is an **independent implementation** (SPEC.md
§18): no upstream code, tests or documentation prose was copied into this repository, and
behavioural compatibility was established from public documentation rather than by reading
implementation source. uight is **not affiliated with or endorsed by** the react-cosmos
project.

The example application renders [frosted-ui](https://github.com/whopio/frosted-ui), Whop's
MIT-licensed design system, from its own Storybook story files. frosted-ui is Whop's work,
included here under its licence as demonstration material. uight is not affiliated with
or endorsed by Whop.

## Licence

MIT.
