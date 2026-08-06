# uight

A component explorer that runs inside your application's own Vite dev server and needs no
configuration to be useful.

> **Early days.** Published as `0.0.x` while the API settles. It is complete and
> tested, but the surface can still move between releases — see
> [ROADMAP.md](https://github.com/aussieljk/uight/blob/master/ROADMAP.md).

```bash
npm i -D @aussieljk/uight
```

```ts
// vite.config.ts
import { uight } from "@aussieljk/uight/vite";
export default defineConfig({ plugins: [react(), uight()] });
```

Then open `/uight` alongside your app. With no config file and no fixtures, it finds your
components, **and the places your own code already uses them**, and lists both. Write
fixtures when you want to name states; you never have to.

No second process, no second port, no `uight.config.json`, no HTML file in your
repository, and no third step.

---

## What you get with no configuration

|                                     |                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| **Components you never documented** | Every exported component, detected by syntax alone — no docgen, no type checker   |
| **Fixtures you never wrote**        | Real `<Button …>` usages harvested from your source, with the props written there |
| **Your existing stories**           | `.stories.tsx` files run, including `.storybook/preview` decorators and globals   |
| **⌘K over everything**              | Fixtures, components and usages in one palette                                    |
| **Shareable links**                 | A URL that reproduces the fixture _and the control values_ the sender saw         |

## Fixtures

```tsx
// src/components/Button.fixture.tsx
export default {
	Primary: <Button variant="primary">Click me</Button>,
	Disabled: <Button disabled>Click me</Button>,
};
```

Controls are declared at the call site — never inferred from a prop name:

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

## Package entries

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
uight build          # a deployable static explorer → dist-uight/
uight init           # wire it in — one command from Storybook or react-cosmos
uight storybook      # which CSF features would not survive the move
uight cosmos         # what a react-cosmos move would rename and decline
uight mcp            # MCP server over stdio, for a coding agent
```

## Fixtures as tests

```ts
import { fixtureIds, loadFixture } from "@aussieljk/uight/test";
import { render } from "@testing-library/react";

test.each(await fixtureIds())("%s renders", async (id) => {
	const { element } = await loadFixture(id);
	render(element);
});
```

Same normalization the explorer uses, so a fixture that renders there renders here —
decorators, CSF stories and preview providers included.

## For coding agents

```jsonc
{ "command": "npx", "args": ["-y", "uight-mcp"] }
```

No port. The dev server is discovered on first use by probing the common Vite ports for
`/@uight/health`, so one agent config keeps working whichever port Vite took. `--url` or
`UIGHT_URL` override it; when nothing answers, the error names every port it probed.

Exposes `list_fixtures`, `list_components`, `list_call_sites`, `fixture_url`,
`render_fixture`, `get_config` and `health` — a read-only client of the running dev
server, so it can never disagree with what the explorer shows.

`render_fixture` is the one that returns an **image**: it drives a headless browser to the
fixture's deep link, waits for the renderer to actually paint into `#uight-root`, and
returns a PNG of the fixture frame (`fullPage: true` captures the whole explorer instead).
It takes `path`, optional `name`, a `viewport` preset (`small`, `mobile`, `tablet`,
`laptop`, `desktop`) or an explicit `width`/`height` pair, and `theme` (`light` | `dark`).

Playwright is an **optional** dependency — an install of uight does not pay for three
browser engines. Install it only if you want screenshots:

```sh
bun add -d playwright && bunx playwright install chromium
```

Without it every other tool still works and `render_fixture` returns one message naming
the package and the fix.

## Compatibility and attribution

uight's fixture format is **compatible with react-cosmos 7.x fixture files**, plus
documented extensions. It is an **independent implementation**: no upstream code, tests or
documentation prose was copied into this repository, and behavioural compatibility was
established from public documentation rather than by reading implementation source. uight
is **not affiliated with or endorsed by** the react-cosmos project, nor by Storybook.

## Requirements

Vite `^8.1`, React `^18 || ^19`, Node `>=20.19`.

## Licence

MIT.
