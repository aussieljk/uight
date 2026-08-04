# Plugin options

```ts
uaight({
	/* every option is optional */
});
```

Options can also live in `uaight.config.json` at the project root. Inline options win:
what is written in `vite.config.ts` is the more specific statement of intent.

## Where fixtures come from

| Option | Default | What |
| ------ | ------- | ---- |
| `fixturesDir` | `"src"` | Root of the crawl |
| `fixtureFileSuffix` | `"fixture"` | `**/*.fixture.{js,jsx,ts,tsx,mdx}` |
| `decoratorFileSuffix` | `"cosmos.decorator\|uaight.decorator"` | `\|`-separated |
| `include` | `[]` | Narrows the crawl; empty means everything |
| `exclude` | `["**/node_modules/**"]` | Removes from it |
| `caseSensitive` | `true` | Glob matching |

A `fixturesDir` outside the Vite root cannot be reached by a root-relative glob. uaight
says so rather than emitting a glob that silently matches nothing.

## What else is listed

| Option | Default | What |
| ------ | ------- | ---- |
| `inventory` | `true` | Detected components. `{ include, exclude }` to narrow. Development only |
| `callSites` | `true` | Harvest real usages from your source. `{ max }` caps sites per component (default 8) |
| `storybook` | `false` | Read CSF. See [From Storybook](/guide/storybook) |
| `docs` | `true` | MDX pages, `**/*.docs.mdx`. `{ fileSuffix }` to rename |
| `docgen` | `false` | Prop metadata via `react-docgen`, if installed. Nothing renders it yet |

## The preview realm

| Option | What |
| ------ | ---- |
| `previewEntry` | A module exporting `Preview` — your providers and global CSS |
| `previewHtmlPath` | Your own preview document, when the generated one is not enough |
| `codecs` | A module default-exporting `defineCodec(...)` results |

## Indexing and shipping

| Option | Default | What |
| ------ | ------- | ---- |
| `index` | `"warm"` | `"static"` never executes a module; `"warm"` executes only the files the parser could not decide; `"lazy"` defers to selection |
| `production` | `"exclude"` | `"include"` ships the explorer; `"error"` fails the build if it would be |
| `route` | `"/uaight"` | `false` disables the dev route entirely |
| `configPath` | `"uaight.config.json"` | `false` ignores the config file |

`"warm"` is the default because it is the only one that both names every fixture up front
and executes almost nothing: on the demo corpus it runs 1 file out of 83.
