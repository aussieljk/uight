# From Storybook

uaight reads Component Story Format directly. You do not port anything, and you do not
have to delete Storybook to try it.

## One command

```bash
bunx uaight init
```

It adds `uaight` to `devDependencies`, adds `uaight({ storybook: true })` to your Vite
config's plugins array, and then prints the honest half: how many of your stories use
features uaight declines, and which ones.

```
Storybook found: .storybook/; @storybook/react-vite, storybook in package.json

  ✓ package.json  uaight@latest → devDependencies
  ✓ vite.config.ts  uaight({ storybook: true }) → the plugins array

42 CSF files, 180 stories — 31 use nothing uaight declines

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

| Feature | Status |
| ------- | ------ |
| `meta.args`, `story.args` | Supported |
| `argTypes` | Supported |
| `render` | Supported |
| Meta and story decorators | Supported |
| Global decorators from `.storybook/preview` | Supported when a preview module is found |
| `parameters.viewport`, `parameters.layout` | Honoured at the highest declared level |
| Other `parameters.*` | Badged |
| `play`, `loaders`, `globals` | Declined, and badged |

`.storybook/preview.{ts,tsx,js,jsx}` is discovered automatically — which usually matters
more than the table does, because that is where a design system keeps its providers,
theme and global styles.

## The report on its own

```bash
bunx uaight storybook          # a summary
bunx uaight storybook --json   # per file, for CI
```

Syntax only: nothing is imported and nothing is executed, so it is cheap enough to run in
CI and safe to point at a repository you have never opened. A corpus whose unsupported
count grows is a corpus drifting away from being portable.

## Options

```ts
uaight({
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
