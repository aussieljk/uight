/**
 * `?docs` — see `plugins/docs-markdown.ts`. Declared here because it is this
 * site's own query, not one `vite/client` knows about.
 */
declare module "*.md?docs" {
	const doc: import("./doc.ts").DocModule;
	export default doc;
}
