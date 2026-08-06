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

## Borrowing a prop's documentation

A control's metadata is declared where the control is, never guessed from its name —
there is no reliable mapping from an input called `variant` to a particular prop, because
a fixture may compose several components, transform values, or expose a control matching
no prop at all.

The one exception is a reference you write yourself:

```ts
const [variant] = useFixtureInput("variant", "primary", {
	from: { component: "Button", prop: "variant" },
});
```

That says _which_ prop this input stands for, which is the thing that cannot be derived.
With [`docgen`](/reference/config) on, the control then takes:

- the prop's **description**, verbatim; and
- its **options**, but only when the type is a union of string literals —
  `'primary' | 'secondary'` becomes a select, while `'sm' | number` is left alone.

A union that is only partly understood is rejected whole. Three of a component's five
variants under a select looks authoritative and is wrong, which is worse than the text box
you would otherwise have got.

Anything you declare yourself wins, and everything else the prop knows is deliberately
ignored: its type never chooses a control, and its default is the component's while the
input's is the fixture's. With `docgen` off — the default — `from` does nothing at all,
and the input renders exactly as declared.

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
// src/uight.codecs.ts
import { defineCodec } from "@aussieljk/uight";

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
uight({ codecs: "src/uight.codecs.ts" });
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
