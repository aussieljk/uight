/**
 * The shape a `?docs` import has, and the shape `Page` renders.
 *
 * Two states, distinguished by whether `html` is there: a build ships the
 * rendered page, a dev server ships the source and lets the browser render it.
 * See `plugins/docs-markdown.ts` for why the two differ.
 */

import type { Heading } from "./markdown.ts";

export interface Rendered {
	html: string;
	headings: Heading[];
}

export interface DocModule extends Partial<Rendered> {
	/** The Markdown source. Empty in a build — nothing left needs it. */
	source: string;
}
