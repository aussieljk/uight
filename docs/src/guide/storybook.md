# From Storybook

uight reads Component Story Format directly. You do not port anything, and you do not
have to delete Storybook to try it.

## One command

```bash
bunx uight init
```

It adds `uight` to `devDependencies`, adds `uight({ storybook: true })` to your Vite
config's plugins array, and then prints the honest half: how many of your stories use
features uight declines, and which ones.

```
Storybook found: .storybook/; @storybook/react-vite, storybook in package.json

  ✓ package.json  uight@latest → devDependencies
  ✓ vite.config.ts  uight({ storybook: true }) → the plugins array

42 CSF files, 180 stories — 31 use nothing uight declines

declined, by frequency (each is badged in the UI, never silently skipped):
  parameters.docs  27
  play             9
```

(Illustrative — the numbers are your corpus's.)

Run it with `--dry-run` first to see every change and write none. Running it twice is
safe: it skips what is already done rather than editing it again. If your Vite config is
shaped in a way it cannot edit confidently, it says so and prints the line to paste
instead of half-editing the file.

## What survives

CSF 3 is supported as a **declared subset**, and the declaration is the point: a story
that appears to work while silently skipping its interaction logic is worse than one that
says it cannot run here. Anything outside the subset is badged on the story itself.

| Feature                                     | Status                                   |
| ------------------------------------------- | ---------------------------------------- |
| `meta.args`, `story.args`                   | Supported                                |
| `argTypes`                                  | Supported                                |
| `render`                                    | Supported                                |
| Meta and story decorators                   | Supported                                |
| Global decorators from `.storybook/preview` | Supported when a preview module is found |
| `parameters.viewport`, `parameters.layout`  | Honoured at the highest declared level   |
| Other `parameters.*`                        | Badged                                   |
| `play`, `loaders`, `globals`                | Declined, and badged                     |

`.storybook/preview.{ts,tsx,js,jsx}` is discovered automatically — which usually matters
more than the table does, because that is where a design system keeps its providers,
theme and global styles.

## The report on its own

```bash
bunx uight storybook          # a summary
bunx uight storybook --json   # per file, for CI
```

Syntax only: nothing is imported and nothing is executed, so it is cheap enough to run in
CI and safe to point at a repository you have never opened. A corpus whose unsupported
count grows is a corpus drifting away from being portable.

## Options

```ts
uight({
	storybook: {
		csfVersion: 3,
		fileSuffix: "stories",
		preview: true, // or a path, or false to load nothing
		support: {
			parameters: "viewport-and-layout",
		},
	},
});
```

`parameters: "viewport-only"` is the stricter reading. Most design systems set
`layout: "centered"` on nearly every story, so `"viewport-and-layout"` is usually what
makes a corpus read the way its authors intended.

## Leaving CSF behind: `uight codemod`

Reading CSF in place means nobody *has* to convert anything. But a team that has
decided to stay may not want to carry `storybook: true` forever, and for them there is
a codemod:

```bash
bunx uight codemod --dry-run   # see what would happen
bunx uight codemod             # write the fixture files
```

A story whose states are `args` becomes a plain-JSX fixture, written next to the
original:

```tsx
// Button.stories.tsx (before)
const meta = { component: Button, args: { size: "md" } };
export default meta;
export const Primary = { args: { variant: "primary", children: "Click me" } };
```

```tsx
// Button.fixture.tsx (after)
import { Button } from "./Button";

export default {
	Primary: <Button size="md" variant="primary">Click me</Button>,
};
```

Arg values are spliced in **as the text they were written as** — any expression that
was valid in `args` is valid in the fixture, and nothing is re-invented.

The rule is convert a file completely or not at all. Anything the fixture form cannot
represent — `render`, `play`, `decorators`, `argTypes`, a spread, a computed key —
skips the whole file, with every reason named in the transcript, because a
half-converted story file is two sources of truth for the same states.

The `.stories` originals are left in place: check `/uight` shows both and they agree,
then delete the stories in their own commit.
