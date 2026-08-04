# uaight

A component explorer that runs inside your application's own Vite dev server and needs no
configuration to be useful.

```bash
npm i -D uaight
```

```ts
// vite.config.ts
import { uaight } from "uaight/vite";
export default defineConfig({ plugins: [react(), uaight()] });
```

Then open `/uaight` alongside your app. With no config file and no fixtures, it finds your
components and lists them. Write fixtures when you want states and controls; you never
have to.

That is the whole onboarding. No second process, no second port, no `uaight.config.json`,
no HTML file in your repository, and no third step.

---

## Repository layout

| Path                   | What                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `SPEC.md`              | The requirements document. The source of truth for behaviour         |
| `ARCHITECTURE.md`      | The integration contract: which module owns which symbol             |
| `NOTES.md`             | Findings from implementation, including answers to SPEC.md's Q1–Q14  |
| `packages/uaight`      | The published package                                                |
| `examples/frosted-ui`  | Demo: the explorer showing Whop's frosted-ui design system           |

## Package entries (§16.1)

| Entry            | Contents                                            | Environment |
| ---------------- | --------------------------------------------------- | ----------- |
| `uaight`         | `<Uaight />`, fixture hooks, `defineCodec`, types   | Browser     |
| `uaight/vite`    | The plugin, config resolution, index builder        | Node        |
| `uaight/runtime` | Renderer mount, protocol, serializer, overlay store | Browser     |
| `uaight/chrome`  | `useUaightChrome`, chrome component types           | Browser     |
| `uaight/client`  | Virtual module declarations                         | Types only  |

## Development

```bash
bun install
bun run build      # compile scoped CSS, then bundle with tsdown
bun run demo       # the frosted-ui example on http://localhost:5173/uaight
bun run typecheck
bun run --cwd packages/uaight test
```

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

uaight's fixture format is **compatible with react-cosmos 7.x fixture files**, plus the
documented extensions in SPEC.md §3. It is an **independent implementation** (SPEC.md
§18): no upstream code, tests or documentation prose was copied into this repository, and
behavioural compatibility was established from public documentation rather than by reading
implementation source. uaight is **not affiliated with or endorsed by** the react-cosmos
project.

The example application renders [frosted-ui](https://github.com/whopio/frosted-ui), Whop's
MIT-licensed design system, from its own Storybook story files. frosted-ui is Whop's work,
included here under its licence as demonstration material. uaight is not affiliated with
or endorsed by Whop.

## Licence

MIT.
