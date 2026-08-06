/**
 * uight.dev — a uight instance, and nothing else.
 *
 * The site used to be VitePress, for a reason worth restating before it is
 * overruled: SPEC §1.4 lists "becoming an MDX documentation framework" as a
 * non-goal, and a docs site built on an unshipped feature cannot publish a page
 * about a bug in that feature. That risk has not gone away. What has changed is
 * the judgement about which risk is worse — a component explorer whose own
 * documentation is a *different* tool's output is a claim nobody has to
 * believe, and every rough edge in the docs pages is now one the maintainers
 * meet before anyone else does.
 *
 * So the site is `bunx uight build` over the tree in `src/`, and there is no
 * second generator. `docs` pages are the navigation, `fileMeta.order` is the
 * sidebar, and `scripts/sync.ts` still brings the repository's own documents in
 * so there is one source of truth for each.
 */

import mdx from "@mdx-js/rollup";
import { uight } from "@aussieljk/uight/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { docsMarkdown } from "./plugins/docs-markdown.ts";

export default defineConfig({
	// §14: MDX is the host's bundler configuration, not a uight feature. The
	// site is made entirely of `.docs.mdx`, so this plugin is load-bearing here
	// in a way it is not in an app that merely has a few pages.
	plugins: [
		// Before `mdx()`, because it claims the `?docs` imports the pages make.
		docsMarkdown(),
		mdx(),
		react(),
		uight({
			// Every page is prose. There are no components in this project to
			// detect and no call sites to harvest, and leaving the inventory on
			// would put this site's own `src/site/` helpers in the sidebar
			// alongside the documentation.
			inventory: false,
			callSites: false,
			docs: true,
			// Global CSS and the syntax highlighter, inside the frame realm (§6.4).
			previewEntry: "src/site/preview.tsx",
			// An MDX page is one fixture by construction, so every name here is
			// decided statically and there is nothing for the warm pass to do.
			index: "static",
			// Twenty pages of prose, each a few kilobytes with its HTML already
			// rendered into it. Split into a chunk apiece, every navigation on the
			// site was a network round trip before anything could render; bundled,
			// every navigation after the first paint is synchronous. This is the
			// case the option exists for — see its documentation for why it is not
			// the default.
			eager: true,
		}),
	],

	// Vite copies `public/` into the output, which is what hosts the registry
	// at https://uight.dev/r/… — see `scripts/sync.ts`.
	build: { chunkSizeWarningLimit: 1500 },
});
