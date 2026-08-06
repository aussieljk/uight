/**
 * A documentation page.
 *
 * Every page on this site is the same two files: the prose as plain Markdown,
 * and a four-line `.docs.mdx` beside it that states its title and its place in
 * the sidebar and hands the source to this component. That split is not
 * ceremony. MDX cannot hold SPEC.md — it is full of `{`, `<` and `|` that MDX
 * reads as expressions and JSX — and a site where four pages render one way and
 * sixteen render another has two stylesheets, two link behaviours and two
 * places for a bug to be. So all twenty are Markdown, and MDX is what carries
 * the metadata and anything on a page that has to be a component.
 *
 * The other thing this owns is navigation. A link between pages is a link
 * between *fixtures*, and the page is rendered inside the frame realm (§6.2),
 * so an `<a href>` would navigate the frame rather than the explorer around it.
 * `useSelectFixture` is the supported way across that boundary, and clicks are
 * caught here rather than rewritten into the HTML so that Markdown stays
 * Markdown.
 */

import { use, useCallback, useMemo } from "react";
import type { MouseEvent } from "react";
import { useSelectFixture } from "@aussieljk/uight";
import type { DocModule, Rendered } from "./doc.ts";

export interface PageProps {
	/** A `?docs` module — see `plugins/docs-markdown.ts`. */
	doc: DocModule;
}

/**
 * A build hands us finished HTML, so there is nothing to do but read it.
 */
function usePrerendered(doc: DocModule): Rendered {
	return { html: doc.html ?? "", headings: doc.headings ?? [] };
}

/**
 * Development renders in the browser, as this site always did — but once, and
 * out of a module that a build never loads. See `dev-render.ts` for both.
 */
const devReady = import.meta.env.DEV
	? import("./dev-render.ts").then((module) => module.ready)
	: null;

function useDevRendered(doc: DocModule): Rendered {
	const render = use(devReady!);
	return useMemo(() => render(doc.source), [render, doc.source]);
}

/**
 * Chosen once, at module scope, from a constant the bundler folds.
 *
 * A ternary rather than a branch inside the component: `import.meta.env.DEV` is
 * `false` in a build, so this collapses to `usePrerendered` and the dynamic
 * import above it — with `marked` and the whole of shiki behind it — is never
 * emitted. A branch inside `Page` would be a conditional hook.
 */
const useRendered: (doc: DocModule) => Rendered = import.meta.env.DEV
	? useDevRendered
	: usePrerendered;

export function Page({ doc }: PageProps) {
	const { html, headings } = useRendered(doc);

	const select = useSelectFixture();

	/**
	 * One handler on the article rather than one per link. A root-relative href
	 * is a page on this site — `/guide/fixtures` is the fixture at
	 * `guide/fixtures` — and anything else (an anchor, an external URL) is left
	 * to the browser, with `target="_blank"` added below so it does not open
	 * inside the preview frame.
	 */
	const onClick = useCallback(
		(event: MouseEvent<HTMLElement>) => {
			const anchor = (event.target as HTMLElement).closest("a");
			const href = anchor?.getAttribute("href");
			if (!href || !href.startsWith("/")) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

			event.preventDefault();
			const [path, hash] = href.slice(1).split("#");
			if (path) select({ path, name: null });
			if (hash) scrollToAnchor(hash);
		},
		[select],
	);

	return (
		<div className="doc-layout">
			<article
				className="doc"
				onClick={onClick}
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			{headings.length > 1 ? (
				<nav className="doc-toc" aria-label="On this page">
					<p className="doc-toc-title">On this page</p>
					<ul>
						{headings.map((heading) => (
							<li key={heading.id}>
								<a href={`#${heading.id}`}>{heading.text}</a>
							</li>
						))}
					</ul>
				</nav>
			) : null}
		</div>
	);
}

/**
 * The frame is not the top document, so `location.hash` is not ours to write —
 * setting it would put this site's section anchor in the explorer's address bar
 * next to the fixture parameter that means something. Scrolling is the whole of
 * what the link was for.
 */
function scrollToAnchor(id: string): void {
	document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
