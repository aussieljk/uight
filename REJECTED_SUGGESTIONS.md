# Rejected suggestions

Improvement suggestions considered on 2026-08-08 and not pursued. Recorded so
they are not re-proposed from scratch, and so the reasoning is on hand if one
is picked up later.

## 1. Visual regression testing built in

A `uight snapshot` command that screenshots every fixture via the existing
Playwright peer dependency and diffs against committed baselines. The
zero-config angle (reusing the app's own Vite dev server, no separate
Storybook build) would make VRT setup unusually cheap.

## 3. Interaction / behavioral tests co-located with fixtures

A `play`-style function per fixture, runnable headlessly through Vitest
browser mode or Playwright, closing the gap where Storybook is currently
strongest. `src/test/index.ts` would be the seam.

## 5. Accessibility auditing per fixture

Run axe-core inside the renderer frame, surface violations in the explorer
chrome, and expose them over the MCP server. Cheap to add and pairs naturally
with the screenshot tooling.

## 7. Framework breadth beyond React

The Vite plugin / scan / manifest layer is mostly framework-agnostic; only the
runtime is React-bound. Vue or Svelte support — or a documented renderer
adapter API — would multiply the addressable audience.

## 10. Test coverage for the plugin itself

A fixture-repo test suite: small sample apps run through the scan / parse /
manifest pipeline with snapshotted output. That is exactly the code that
breaks across unusual user codebases (odd exports, decorators, monorepos).
