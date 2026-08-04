import { defineConfig } from "vitepress";

/**
 * uaight.dev.
 *
 * VitePress rather than uaight's own MDX pages, deliberately: §1.4 lists
 * "becoming an MDX documentation framework" as a non-goal, and a project whose
 * docs site is its own unshipped feature cannot publish a page about a bug in
 * that feature. The docs pages uaight *does* have are for documenting a design
 * system next to its components, which is a different job from this.
 *
 * `scripts/sync.ts` copies the repository's own documents into `reference/` and
 * the built registry into `public/r/`, so the site has one source of truth for
 * each and never a second stale copy to maintain.
 */
export default defineConfig({
	title: "uaight",
	description:
		"A component explorer that runs inside your application's own Vite dev server.",
	cleanUrls: true,
	lastUpdated: true,

	head: [["meta", { name: "theme-color", content: "#111111" }]],

	themeConfig: {
		nav: [
			{ text: "Guide", link: "/guide/getting-started" },
			{ text: "Reference", link: "/reference/cli" },
			{ text: "Changelog", link: "/reference/changelog" },
		],

		sidebar: [
			{
				text: "Guide",
				items: [
					{ text: "Getting started", link: "/guide/getting-started" },
					{ text: "From Storybook", link: "/guide/storybook" },
					{ text: "Fixtures", link: "/guide/fixtures" },
					{ text: "Controls", link: "/guide/controls" },
					{ text: "Docs pages", link: "/guide/docs-pages" },
					{ text: "Grid mode", link: "/guide/grid" },
					{ text: "Shipping a static explorer", link: "/guide/static-build" },
				],
			},
			{
				text: "Reference",
				items: [
					{ text: "CLI", link: "/reference/cli" },
					{ text: "Plugin options", link: "/reference/config" },
					{ text: "Ejecting the chrome", link: "/reference/ejecting" },
					{ text: "Spec", link: "/reference/spec" },
					{ text: "Architecture", link: "/reference/architecture" },
					{ text: "Roadmap", link: "/reference/roadmap" },
					{ text: "Changelog", link: "/reference/changelog" },
				],
			},
		],

		socialLinks: [{ icon: "github", link: "https://github.com/aussieljk/uaight" }],

		search: { provider: "local" },

		editLink: {
			pattern: "https://github.com/aussieljk/uaight/edit/master/docs/:path",
			text: "Edit this page on GitHub",
		},

		footer: {
			message: "MIT licensed. Published as 0.0.1-canary.N while the surface settles.",
			copyright: "© uaight",
		},
	},
});
