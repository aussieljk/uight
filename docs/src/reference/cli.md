# CLI

```bash
bunx uight <command>
```

Everything the CLI does is also callable from `@aussieljk/uight/vite` as a function, which is the
supported path for CI. The CLI exists so trying it costs one command.

## `uight init`

Wire uight into this project — one command from a Storybook or react-cosmos repository
to a working `/uight`. See [From Storybook](/guide/storybook) and
[From react-cosmos](/guide/cosmos).

| Flag                      | Default  | Notes                                        |
| ------------------------- | -------- | -------------------------------------------- |
| `--root <dir>`            | cwd      | Project root                                 |
| `--dry-run`               | off      | Print every change and write nothing         |
| `--no-rename`             | off      | Leave cosmos `__fixtures__/` filenames alone |
| `--version-range <range>` | `latest` | What is written to `devDependencies`         |

It adds the dependency and edits the Vite config's plugins array. In a Storybook project
it prints the CSF compatibility report; in a react-cosmos project it also translates
`cosmos.config.json`, renames `__fixtures__/` files so the scan can see them, and points
cosmos hook imports at `uight`. It installs nothing and runs no package manager — the install
command is printed, not executed. Re-running is safe.

## `uight cosmos`

What a react-cosmos move would rename and decline, without moving anything.

| Flag           | Default | Notes                           |
| -------------- | ------- | ------------------------------- |
| `--root <dir>` | cwd     | Project root                    |
| `--json`       | off     | The full report as JSON, for CI |

## `uight build`

Build a deployable static explorer. See [Shipping a static explorer](/guide/static-build).

| Flag              | Default            |
| ----------------- | ------------------ |
| `--out <dir>`     | `dist-uight`       |
| `--base <path>`   | `/`                |
| `--root <dir>`    | cwd                |
| `--config <file>` | discovered         |
| `--title <text>`  | the directory name |

## `uight doctor`

Why is my component missing. Prints the resolved config, the fixtures directory in both
path forms, what the index found, and every problem.

| Flag           | Notes                   |
| -------------- | ----------------------- |
| `--root <dir>` | Project root            |
| `--json`       | The full report as JSON |

Exits non-zero when the index contains a **collision** — two files producing the same
fixture id — because that is the one problem that makes ids ambiguous, and so the one
worth failing a CI step over.

## `uight storybook`

Report which CSF features would not survive the move, per file and in total. Syntax only:
nothing is imported and nothing is executed.

| Flag           | Notes                   |
| -------------- | ----------------------- |
| `--root <dir>` | Project root            |
| `--json`       | The full report as JSON |

## `uight codemod`

Rewrite simple CSF stories as plain-JSX fixture files, next to the originals. A file
converts completely or not at all; anything the fixture form cannot represent skips the
whole file with the reason named. See [From Storybook](/guide/storybook).

| Flag           | Notes                                |
| -------------- | ------------------------------------ |
| `--root <dir>` | Project root                         |
| `--dry-run`    | Print every change and write nothing |
| `--json`       | The full report as JSON              |

## `uight mcp`

Run the MCP server over stdio, against the dev server's read-only API. `--url` is
optional — the dev server is found by probing `/@uight/health`, so nobody has to know
which port Vite took. See [Coding agents (MCP)](/guide/agents).

It answers questions about the index — fixtures, detected components, real call sites,
prop metadata when `docgen` is on — returns fixture URLs, and with the optional
`playwright` package installed, `render_fixture` returns a real screenshot.
