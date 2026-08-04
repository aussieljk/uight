# Getting started

uaight is a Vite plugin. There is no second server, no second port and no HTML file in
your repository.

```bash
bun add -D uaight
```

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { uaight } from "uaight/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), uaight()],
});
```

Start the dev server you already had and open **`/uaight`**.

## What you see before you write anything

Nothing needs to exist first. With no fixtures at all, uaight lists:

- **the components it found** — exported, PascalCase, function or `memo`/`forwardRef`
  shaped, by a syntax-only pass that imports nothing and runs nothing;
- **the places your own code already uses them** — real prop values, quoted from your
  source, so the first thing you look at is a state your product actually renders.

Selecting a component renders it. Rendering runs your component's real code: frame
isolation contains DOM, CSS and global listeners, and does not contain network requests,
storage, cookies or backend effects. Nothing renders on hover, on expansion or in bulk —
only on the selection you make.

## Then write fixtures, when you want to name a state

```tsx
// src/components/Button.fixture.tsx
export default {
	Primary: <Button variant="primary">Click me</Button>,
	Disabled: <Button disabled>Click me</Button>,
};
```

Every `**/*.fixture.{js,jsx,ts,tsx,mdx}` under `src` is picked up. See
[Fixtures](/guide/fixtures).

## Providers, global CSS and theme

The preview realm is a separate document, so your application's global stylesheet and
providers have to be named once:

```ts
uaight({ previewEntry: "src/uaight.preview.tsx" });
```

```tsx
// src/uaight.preview.tsx
import "./index.css";

export function Preview({ children }: { children: React.ReactNode }) {
	return <ThemeProvider>{children}</ThemeProvider>;
}
```

## When something is missing

```bash
bunx uaight doctor
```

It prints the resolved config, the fixtures directory in both of the path forms uaight
uses, what the index found, and every problem it knows about — which is faster than
guessing at a glob.

## Keyboard

The explorer is keyboard-first; `?` lists everything. The ones worth knowing on day one:

| Key | Does |
| --- | ---- |
| <kbd>⌘K</kbd> | Find any fixture, component or usage |
| <kbd>/</kbd> | Focus search |
| <kbd>↓</kbd> <kbd>↑</kbd> | Next / previous fixture |
| <kbd>→</kbd> <kbd>←</kbd> | Next / previous variant of this file |
| <kbd>g</kbd> | [Grid mode](/guide/grid) — every fixture at once |
| <kbd>r</kbd> | Reset all controls |
