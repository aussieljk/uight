# Sharing — links that reproduce, previews per PR

## The Share button

Every fixture URL carries the fixture _and the current control values_. The
**Share** button in the toolbar copies it. That makes a link a reproduction,
not a bookmark: a QA report that says "open this" puts the exact props on the
reader's screen, including everything they changed in the control panel.

The state rides in the URL as a compact token, so it survives chat clients and
issue trackers; a link that would be too long to survive pasting falls back to
carrying just the fixture. A malformed or stale token degrades to the fixture
with default values — never to an error.

## A deployed explorer for every pull request

`uight build` emits one directory of static files, which is exactly the shape
preview deployments want. Wire it up once and every PR gets a URL where
reviewers click through the changed components — with shareable control state
— instead of reading JSX diffs.

### Vercel

```json
// vercel.json
{
	"buildCommand": "bunx uight build --out dist-uight",
	"outputDirectory": "dist-uight"
}
```

Import the repository in Vercel and preview deployments are on by default:
every push to a PR gets its own URL.

### Cloudflare Pages

Set the build command to `bunx uight build --out dist-uight` and the output
directory to `dist-uight`. Preview deployments per branch are the default
there too.

### GitHub Actions, any static host

```yaml
- run: bun install
- run: bunx uight build --out dist-uight --base /
- uses: actions/upload-pages-artifact@v3
  with: { path: dist-uight }
```

Deploy under a subpath? Pass `--base /design/`.

### What a static build shows

Your fixtures and CSF stories, built with your own Vite config — same
resolver, same aliases, same Tailwind. The zero-config inventory and call-site
lists are development-only and are not in it; see
[Shipping a static explorer](/guide/static-build) for the full picture.
