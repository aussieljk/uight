# Fixtures

A fixture is a module that exports something renderable. There is no registration step and
no manifest — the file's location and name are the registration.

```
src/**/*.fixture.{js,jsx,ts,tsx,mdx}
```

## The three shapes

**A single fixture** — the default export is the whole thing:

```tsx
// src/components/Button.fixture.tsx
export default <Button>Click me</Button>;
```

**Named fixtures** — an object of them, which is the common case:

```tsx
export default {
	Primary: <Button variant="primary">Click me</Button>,
	Disabled: <Button disabled>Click me</Button>,
};
```

**A component** — when the fixture needs hooks, state or [controls](/guide/controls):

```tsx
export default () => {
	const [count, setCount] = useState(0);
	return <Counter value={count} onChange={setCount} />;
};
```

## How names are found

The names in the tree come from a **syntax-only parse**. Nothing is imported and nothing is
executed to build the index, which is what makes a 500-file corpus start in under a tenth
of a second.

When the parser cannot decide — the default export is a call, a spread, an import — the
file appears as one row with a `…` badge, and its names are discovered by loading the
module the moment you select it. Nothing is hidden; it is just not known yet.

## Metadata

Two optional named exports, read statically, so the preview can open at the right size
before the first paint:

```tsx
export const fileMeta = { viewport: { width: 375, height: 667 } };
export const fixtureMeta = {
	Disabled: { viewport: { width: 1280, height: 800 } },
};
```

A viewport you pick in the toolbar is sticky across selections and outranks the fixture's.

## Decorators

A `uight.decorator.tsx` (or `cosmos.decorator.tsx`) wraps every fixture in its directory
and below:

```tsx
// src/components/uight.decorator.tsx
export default ({ children }: { children: React.ReactNode }) => (
	<div style={{ padding: 24 }}>{children}</div>
);
```

Use `previewEntry` instead when what you need is global — providers, the app's stylesheet,
a theme. The decorator is for a subtree.

## MDX

`.mdx` is a fixture extension, and an MDX module is exactly **one** fixture. Compiling it
is your bundler's job, not uight's:

```bash
bun add -D @mdx-js/rollup
```

```ts
import mdx from "@mdx-js/rollup";
plugins: [mdx(), react(), uight()];
```

If you have `.mdx` files and no MDX plugin, the dev server says so on startup and names the
install command. For prose _about_ your components rather than a fixture written in MDX,
see [Docs pages](/guide/docs-pages).

## Compatibility

The fixture format is compatible with react-cosmos 7.x fixture files, plus the documented
extensions in the spec. It is an independent implementation and is not affiliated with or
endorsed by the react-cosmos project.
