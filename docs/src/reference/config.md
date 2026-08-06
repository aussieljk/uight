# Plugin options

```ts
uight({/* every option is optional */});
```

Options can also live in `uight.config.json` at the project root. Inline options win:
what is written in `vite.config.ts` is the more specific statement of intent.

## Where fixtures come from

| Option                | Default                               | What                                      |
| --------------------- | ------------------------------------- | ----------------------------------------- |
| `fixturesDir`         | `"src"`                               | Root of the crawl                         |
| `fixtureFileSuffix`   | `"fixture"`                           | `**/*.fixture.{js,jsx,ts,tsx,mdx}`        |
| `decoratorFileSuffix` | `"cosmos.decorator\|uight.decorator"` | `\|`-separated                            |
| `include`             | `[]`                                  | Narrows the crawl; empty means everything |
| `exclude`             | `["**/node_modules/**"]`              | Removes from it                           |
| `caseSensitive`       | `true`                                | Glob matching                             |

A `fixturesDir` outside the Vite root cannot be reached by a root-relative glob. uight
says so rather than emitting a glob that silently matches nothing.

## What else is listed

| Option      | Default | What                                                                                 |
| ----------- | ------- | ------------------------------------------------------------------------------------ |
| `inventory` | `true`  | Detected components. `{ include, exclude }` to narrow. Development only              |
| `callSites` | `true`  | Harvest real usages from your source. `{ max }` caps sites per component (default 8) |
| `storybook` | `false` | Read CSF. See [From Storybook](/guide/storybook)                                     |
| `docs`      | `true`  | MDX pages, `**/*.docs.mdx`. `{ fileSuffix }` to rename                               |
| `docgen`    | `false` | Prop metadata via `react-docgen`, if installed. Feeds the prop table and `from`      |

## The preview realm

| Option            | What                                                            |
| ----------------- | --------------------------------------------------------------- |
| `previewEntry`    | A module exporting `Preview` — your providers and global CSS    |
| `previewHtmlPath` | Your own preview document, when the generated one is not enough |
| `codecs`          | A module default-exporting `defineCodec(...)` results           |

## Indexing and shipping

| Option       | Default               | What                                                                                                                           |
| ------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `index`      | `"warm"`              | `"static"` never executes a module; `"warm"` executes only the files the parser could not decide; `"lazy"` defers to selection |
| `production` | `"exclude"`           | `"include"` ships the explorer; `"error"` fails the build if it would be                                                       |
| `eager`      | `false`               | Bundle fixtures into the entry chunk instead of one lazy chunk each. Build only — see below                                    |
| `route`      | `"/uight"`            | `false` disables the dev route entirely                                                                                        |
| `configPath` | `"uight.config.json"` | `false` ignores the config file                                                                                                |

`"warm"` is the default because it is the only one that both names every fixture up front
and executes almost nothing: on the demo corpus it runs 1 file out of 83.

### `eager`

Off by default, and it should stay off for a component library. Each fixture module is
normally its own lazy chunk, which is what stops the explorer's first download from
containing every component you have. `eager: true` gives that up and bundles them all into
the entry chunk.

It earns its place when the modules are small, few, and switched between constantly — the
case it exists for is a documentation site, where each page is a few kilobytes of prose
and the round trip for its chunk _is_ the time you wait. This site uses it. A corpus of
any size should not.

Independently of the option, the tree warms a file's chunk when you hover its row, so the
click that follows resolves from cache.

## The dev endpoints

| Option   | Default      | What                                                                          |
| -------- | ------------ | ----------------------------------------------------------------------------- |
| `devApi` | `"loopback"` | Who may reach `/@uight/*.json`. `"any"` for a proxy or container; `false` off |

The [read-only endpoints](/reference/cli) are development-only and write nothing, but
`config.json` echoes resolved filesystem paths and `index.json` lists every fixture file
in your project. On a default dev server nothing off-machine can reach them; run
`vite --host` and everything on the network could, and choosing `--host` is a statement
about your app rather than about these.

`false` removes them entirely. The explorer does not use them — it learns the index from
the virtual module and an HMR event — so the cost is `@aussieljk/uight/mcp` and any
external tooling you point at them.
