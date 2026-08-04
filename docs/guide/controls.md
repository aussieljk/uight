# Controls

Controls are declared where the value is used, and never inferred from a prop name. A
control that exists in the panel is one somebody wrote on purpose.

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

`useFixtureInput(name, initial, options?)` returns `[value, setValue]`, like `useState`.
Editing the panel updates the fixture; calling the setter updates the panel.

## Control kinds

`auto` picks from the initial value's type and is the default. Name one explicitly when
the type does not say enough:

`text` · `textarea` · `number` · `range` · `checkbox` · `select` · `radio` · `date` ·
`color` · `json`

```ts
useFixtureInput("padding", 8, { control: "range", min: 0, max: 64, step: 4 });
```

`label` and `description` change how the row reads. `options` supplies the choices for
`select` and `radio` — or use `useFixtureSelect`, which is the same thing with the option
list in the type:

```ts
const [size] = useFixtureSelect("size", { options: ["sm", "md", "lg"] as const });
```

## What happens across an edit

Control values are an **overlay** on the fixture's own defaults, not a rewrite of them.
That has three consequences worth knowing:

- Editing the fixture file keeps your values. When an edit removes an input, the status
  bar names the ones that no longer apply rather than silently dropping them.
- <kbd>r</kbd> resets everything, and the reset is undoable from the status bar.
- **Copy link** puts the current values in the URL, so a link to a fixture is a link to
  the state you are actually looking at.

## Values a JSON overlay cannot carry

A `Date`, a `Map`, a class instance — anything whose identity is lost by
`JSON.stringify` — needs a codec:

```ts
// src/uaight.codecs.ts
import { defineCodec } from "uaight";

export default [
	defineCodec<Date, string>({
		name: "date",
		test: (v): v is Date => v instanceof Date,
		serialize: (d) => d.toISOString(),
		deserialize: (s) => new Date(s),
	}),
];
```

```ts
uaight({ codecs: "src/uaight.codecs.ts" });
```

A codec may also supply an `editor`, which renders in the panel. The `serialize`,
`deserialize` and `test` halves run in the renderer realm and the editor renders in the
explorer's, which is why they live in one module both realms import.

## Other hooks

| Hook                    | Returns                                  |
| ----------------------- | ---------------------------------------- |
| `useFixtureViewport()`  | The viewport the preview is currently at |
| `useFixtureId()`        | The id of the fixture being rendered     |
| `useSelectFixture()`    | A function that selects another fixture  |
| `useFixtureIsolation()` | `"frame"` or `"inline"`                  |
