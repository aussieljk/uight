import react from "@vitejs/plugin-react";
import { uaight } from "uaight/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		react(),
		uaight({
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
			previewEntry: "src/uaight.preview.tsx",
			// Makes `Money` and `Sku` editable instead of opaque chips (§7.7).
			codecs: "src/uaight.codecs.tsx",
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
