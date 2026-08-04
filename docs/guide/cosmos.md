# From react-cosmos

uaight's fixture format is compatible with react-cosmos 7.x fixture files, so the
fixtures themselves move unchanged. What does not move for free is everything around
them — the config file, the `__fixtures__/` naming convention, and the imports of a
package you are about to uninstall. `uaight init` does all three.

## One command

```bash
bunx uaight init
```

```
react-cosmos found: cosmos.config.json; react-cosmos in package.json

  ✓ package.json  uaight@latest → devDependencies
  ✓ vite.config.ts  uaight({ storybook: true }) → the plugins array
  ✓ uaight.config.json  rootDir → fixturesDir: src
  ↦ src/__fixtures__/button.fixture.tsx  from src/__fixtures__/button.tsx — uaight finds
    fixtures by name, not by directory; react-cosmos → uaight (useValue → useFixtureInput)

18 cosmos fixtures — the format itself moves unchanged
```

(Illustrative — the numbers are your corpus's.)

Run it with `--dry-run` first to see every change and write none. Running it twice is
safe: the second run finds nothing left to do.

## What it changes

**The config.** `cosmos.config.json` becomes `uaight.config.json`, key by key:

| cosmos              | uaight              | Note                                                   |
| ------------------- | ------------------- | ------------------------------------------------------ |
| `rootDir`           | `fixturesDir`       | Where the scan starts                                  |
| `fixtureFileSuffix` | `fixtureFileSuffix` | Same meaning                                           |
| `ignore`            | `exclude`           | Same meaning                                           |
| `lazy`              | `index: "lazy"`     | Same meaning                                           |
| `fixturesDir`       | —                   | A directory _name_ in cosmos; drives the renames below |

Keys that described cosmos's own dev server — `port`, `hostname`, `staticPath`,
`exportPath`, `watchDirs`, `webpack` — have no equivalent because Vite owns all of it
now. They are named in the transcript rather than dropped silently, with what to do
instead.

**The filenames.** cosmos finds a fixture two ways: by the `.fixture.` suffix, or by any
file inside a `__fixtures__/` directory. uaight only does the first. So
`__fixtures__/button.tsx` is renamed in place to `__fixtures__/button.fixture.tsx` — the
file does not move, only its name changes. `index.ts` barrels and files that already
carry the suffix are left alone. Pass `--no-rename` to do this yourself; the command
then tells you how many fixtures would not be found.

**The imports.** `react-cosmos/client` becomes `uaight`:

| cosmos             | uaight             |
| ------------------ | ------------------ |
| `useValue`         | `useFixtureInput`  |
| `useSelect`        | `useFixtureSelect` |
| `useFixtureInput`  | `useFixtureInput`  |
| `useFixtureSelect` | `useFixtureSelect` |
| `useSelectFixture` | `useSelectFixture` |

The old name is kept as the local binding — `import { useFixtureInput as useValue }` —
because the call sites in the fixture body are not rewritten. The file compiles
unchanged; rename the binding at your leisure.

## What it declines

`useFixtureState`, `setFixtureState`, `useCosmosConfig` and cosmos's renderer plugin API
have no equivalent, so they are **left exactly where they are** rather than rewritten
into something that would compile and mean something else. The file then imports from
both packages, which is an accurate description of its state: half moved, and visibly so.

`cosmos.decorator.tsx` needs no change at all — uaight recognizes both that name and
`uaight.decorator.tsx`.

## The report on its own

```bash
bunx uaight cosmos          # a summary
bunx uaight cosmos --json   # per file, for CI
```

Nothing is imported or executed: the config is JSON and the imports are read from the
parse, so this is safe to point at a repository you have never opened.

## Attribution

uaight is an independent implementation and is not affiliated with or endorsed by the
react-cosmos project. Compatibility was established from public documentation.
