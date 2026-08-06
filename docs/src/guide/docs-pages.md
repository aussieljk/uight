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
fixture, with your providers and your stylesheet, because it _is_ a fixture in every
mechanical sense. One page per file, exactly as with any other MDX module.

## What you need

MDX is your bundler's configuration, not a uight feature:

```bash
bun add -D @mdx-js/rollup
```

```ts
import mdx from "@mdx-js/rollup";
plugins: [mdx(), react(), uight()];
```

If you have `.docs.mdx` files and no MDX plugin, the dev server says so on startup and
names what is missing. Ordering does not matter — Vite sorts `pre` plugins ahead of a
plain `mdx()` whatever your array says, and it compiles correctly either way.

## Options

```ts
uight({
	docs: { fileSuffix: "docs" }, // the default
});
```

`docs: false` turns the pattern off, which is what a project that writes its documentation
somewhere else wants.

## Ordering and titles

A page is a file, so the tree draws it where the filesystem puts it and calls it what the
file is called. `fileMeta` overrides both:

```mdx
export const fileMeta = { title: "Getting started", order: 10 };

# Getting started
```

`order` is a sort weight within the directory — lower first, unweighted pages after — and
a directory takes the weight of its earliest child, so a `guide/` of ordered pages sorts
ahead of a `reference/` of ordered pages without anyone saying so twice.

## What this is not

uight is not a documentation framework, and does not intend to become one. There is no
router, no navigation you can author beyond the two fields above, and no page hierarchy
separate from the fixture tree. A docs page is one more thing in that tree.

That is a narrower thing than a documentation site generator, and it is on purpose. It is
also, as it happens, enough: **this site is a uight instance**. Every page here is a
`.docs.mdx` in `docs/src/`, the sidebar you are reading is the fixture tree, and the whole
thing is `bunx uight build`. What it does not have is what the list above says it does not
have — no full-text search, no per-page URLs, no generated sitemap. If you need those,
you need a documentation site generator, and that is still the honest answer.
