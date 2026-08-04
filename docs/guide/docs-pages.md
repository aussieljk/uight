# Docs pages

A docs page is prose that lives in the tree beside the components it is about.

```
src/**/*.docs.mdx
```

```mdx
// src/components/Button.docs.mdx
import { Button } from "./Button";

# Button

Use `primary` for the one action a screen is for. Everything else is `secondary`.

<Button variant="primary">Save</Button>

Never put two primaries on one screen.
```

Select it in the tree — it is marked **Doc** — and it renders in the preview like any
fixture, with your providers and your stylesheet, because it *is* a fixture in every
mechanical sense. One page per file, exactly as with any other MDX module.

## What you need

MDX is your bundler's configuration, not a uaight feature:

```bash
bun add -D @mdx-js/rollup
```

```ts
import mdx from "@mdx-js/rollup";
plugins: [mdx(), react(), uaight()];
```

If you have `.docs.mdx` files and no MDX plugin, the dev server says so on startup and
names what is missing. Ordering does not matter — Vite sorts `pre` plugins ahead of a
plain `mdx()` whatever your array says, and it compiles correctly either way.

## Options

```ts
uaight({
	docs: { fileSuffix: "docs" }, // the default
});
```

`docs: false` turns the pattern off, which is what a project that writes its documentation
somewhere else wants.

## What this is not

uaight is not a documentation framework, and does not intend to become one. There is no
router, no navigation you can author and no page hierarchy separate from the fixture tree.
A docs page is one more thing in that tree. For a documentation *site* — like this one —
use a documentation site generator.
