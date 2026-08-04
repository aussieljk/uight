# uaight

A component explorer that runs inside your application's own Vite dev server and needs no
configuration to be useful.

> **Canary.** Published as `0.0.1-canary.N` while the API settles. It is complete and
> tested, but the surface can still move between canaries — see
> [ROADMAP.md](https://github.com/aussieljk/uaight/blob/master/ROADMAP.md).

```bash
npm i -D uaight
```

```ts
// vite.config.ts
import { uaight } from "uaight/vite";
export default defineConfig({ plugins: [react(), uaight()] });
```

Then open `/uaight` alongside your app. With no config file and no fixtures, it finds your
components, **and the places your own code already uses them**, and lists both. Write
fixtures when you want to name states; you never have to.

No second process, no second port, no `uaight.config.json`, no HTML file in your
repository, and no third step.

---

## What you get with no configuration

| | |
| --- | --- |
| **Components you never documented** | Every exported component, detected by syntax alone — no docgen, no type checker |
| **Fixtures you never wrote** | Real `<Button …>` usages harvested from your source, with the props written there |
| **Your existing stories** | `.stories.tsx` files run, including `.storybook/preview` decorators and globals |
| **⌘K over everything** | Fixtures, components and usages in one palette |
| **Shareable links** | A URL that reproduces the fixture *and the control values* the sender saw |

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

| Entry            | Contents                                            | Environment |
| ---------------- | --------------------------------------------------- | ----------- |
| `uaight`         | `<Uaight />`, fixture hooks, `defineCodec`, types   | Browser     |
| `uaight/vite`    | The plugin, config resolution, index builder        | Node        |
| `uaight/runtime` | Renderer mount, protocol, serializer, overlay store | Browser     |
| `uaight/chrome`  | `useUaightChrome`, chrome component types           | Browser     |
| `uaight/test`    | Fixtures as test fixtures, for Vitest browser mode  | Browser     |
| `uaight/mcp`     | MCP server over the dev server's read-only API      | Node        |
| `uaight/client`  | Virtual module declarations                         | Types only  |

## Command line

```bash
uaight build          # a deployable static explorer → dist-uaight/
uaight storybook      # which CSF features would not survive the move
uaight mcp            # MCP server over stdio, for a coding agent
```

## Fixtures as tests

```ts
import { fixtureIds, loadFixture } from "uaight/test";
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
{ "command": "npx", "args": ["-y", "uaight-mcp"] }
```

No port. The dev server is discovered on first use by probing the common Vite ports for
`/@uaight/health`, so one agent config keeps working whichever port Vite took. `--url` or
`UAIGHT_URL` override it; when nothing answers, the error names every port it probed.

Exposes `list_fixtures`, `list_components`, `list_call_sites`, `fixture_url`,
`get_config` and `health` — a read-only client of the running dev server, so it can
never disagree with what the explorer shows.

## Compatibility and attribution

uaight's fixture format is **compatible with react-cosmos 7.x fixture files**, plus
documented extensions. It is an **independent implementation**: no upstream code, tests or
documentation prose was copied into this repository, and behavioural compatibility was
established from public documentation rather than by reading implementation source. uaight
is **not affiliated with or endorsed by** the react-cosmos project, nor by Storybook.

## Requirements

Vite `^8.1`, React `^18 || ^19`, Node `>=20.19`.

## Licence

MIT.
