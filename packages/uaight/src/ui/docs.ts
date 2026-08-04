/**
 * Joining a detected component to its prop documentation — §15.2.
 *
 * The docgen pass (`vite/docgen.ts`) produces `ComponentDoc[]` keyed by glob
 * path and hands them to the runtime on `FixtureIndex.docs` / `RuntimeConfig.docs`.
 * Nothing consumed them until now. This module is the join, kept pure and free
 * of React so the unit suite (node env) can exercise it directly.
 *
 * **D18 is binding.** Everything here is DISPLAY metadata. No function in this
 * file — and nothing that calls one — may look at a prop's name, type or
 * default to decide that a control should exist. Controls are declared at the
 * call site (§7.6) and only there; a prop table that quietly grew controls
 * would make docgen's guesses load-bearing, which is exactly what D18 refuses.
 */

import type { ComponentDoc, DocgenLimitation, PropDoc } from "../shared/types.ts";

/** The subset of a selected component the join needs. */
export interface DocSubject {
	globPath: string;
	exportName: string;
}

/**
 * Finds the doc for one export.
 *
 * The map is keyed by glob path, and one module can export several components,
 * so the export name is the second half of the key. Falls back to `name` for
 * resolvers that record a display name and no export name — but never falls
 * back to "the only doc in the file", because a file with two exports would
 * then attach the wrong table to the wrong component, and a wrong prop table is
 * worse than no prop table.
 */
export function findDoc(
	docs: Record<string, ComponentDoc[]> | undefined,
	subject: DocSubject | null,
): ComponentDoc | null {
	if (!docs || !subject) return null;
	const entries = docs[subject.globPath];
	if (!entries?.length) return null;
	return (
		entries.find((doc) => doc.exportName === subject.exportName) ??
		entries.find((doc) => doc.name === subject.exportName) ??
		null
	);
}

/**
 * Required first, then alphabetical. A prop table is read to answer "what do I
 * have to pass", so the answer goes at the top; the source order a resolver
 * happens to emit carries no meaning worth preserving.
 */
export function sortProps(props: readonly PropDoc[]): PropDoc[] {
	const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
	return [...props].sort((a, b) =>
		a.required === b.required ? collator.compare(a.name, b.name) : a.required ? -1 : 1,
	);
}

/**
 * What each limitation means, in the words a reader needs rather than the
 * enum's.
 *
 * Every `ComponentDoc` carries `inherited-props` precisely so a table cannot be
 * rendered without its caveat, so this map is not decoration: dropping it would
 * present a partial list as a complete one. §15.2 makes the Babel resolver's
 * blind spot a documented limitation, and this is where it gets documented to
 * the person actually looking at the table.
 */
const LIMITATION_TEXT: Record<DocgenLimitation, string> = {
	"inherited-props": "Props inherited from a spread or an extended type are not listed.",
	generics: "Generic type parameters are shown unresolved.",
	unions: "Union members may be collapsed or incomplete.",
};

/** Human sentences for a doc's limitations, deduplicated and stable-ordered. */
export function limitationNotes(
	limitations: readonly DocgenLimitation[] | undefined,
): string[] {
	if (!limitations?.length) return [];
	const seen = new Set<DocgenLimitation>();
	const notes: string[] = [];
	for (const limitation of limitations) {
		const text = LIMITATION_TEXT[limitation];
		if (!text || seen.has(limitation)) continue;
		seen.add(limitation);
		notes.push(text);
	}
	return notes;
}
