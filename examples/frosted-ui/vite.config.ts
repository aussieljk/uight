import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import { uight } from "@aussieljk/uight/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		// SPEC §14: MDX is the host's bundler configuration, not a uight
		// feature — uight contributes the glob pattern and the one-fixture rule
		// and nothing else, and `src/fixtures/mdx-notes.fixture.mdx` proves the
		// path end to end. Written first by convention; Vite sorts `pre` plugins
		// ahead of it regardless, and `.mdx` compiles correctly either way, which
		// is why uight checks that an MDX plugin exists and never that it is
		// ordered. Remove this line and the dev server says what to install.
		mdx(),
		react(),
		uight({
			// frosted-ui ships 77 CSF files and no fixture files. Reading them
			// directly is the point of the demo (SPEC §13) — note that Storybook
			// itself is not installed.
			storybook: {
				csfVersion: 3,
				support: {
					// 71 of frosted-ui's 72 component files set `layout: 'centered'`,
					// which is how its authors intended these to read. `viewport-only`
					// would render every one of them flush to the top-left corner.
					parameters: "viewport-and-layout",
				},
			},
			// Global CSS and providers for the frame realm (§6.4).
			previewEntry: "src/uight.preview.tsx",
			// Makes `Money` and `Sku` editable instead of opaque chips (§7.7).
			codecs: "src/uight.codecs.tsx",
			// On by default; named here because it is half of what this demo shows.
			inventory: true,
		}),
	],

	/**
	 * Fixture and story modules are reached through `import.meta.glob` inside a
	 * virtual module, so Vite's dependency scanner never crawls them from the
	 * HTML entry. Without this list the first story you open triggers a
	 * mid-session re-optimize and a full frame reload. Everything here is a
	 * transitive dependency of a copied frosted-ui story, several of them CJS.
	 */
	optimizeDeps: {
		include: [
			"frosted-ui",
			"frosted-ui/icons",
			"@frosted-ui/icons",
			"@internationalized/date",
			"@react-aria/i18n",
			"@tanstack/react-form",
			"@tanstack/react-table",
			"credit-card-type",
			"input-otp",
			"react-aria-components",
			"react-hook-form",
			"zod",
		],
	},
});
