/**
 * Joining a detected component to its prop documentation — §15.2.
 *
 * The docgen pass (`vite/docgen.ts`) produces `ComponentDoc[]` keyed by glob
 * path and hands them to the runtime on `FixtureIndex.docs` / `RuntimeConfig.docs`.
 * This module is the join: the prop table reads it, and so does §7.6's `from`.
 * Kept pure and free of React, so it can be reasoned about — and driven — on
 * its own.
 *
 * **D18, revised.** For fixtures, D18 stands unchanged: everything docgen
 * knows about a *fixture's* inputs is display metadata, controls are declared
 * at the call site (§7.6), and nothing here may second-guess that. The
 * revision is `docControls` at the bottom of this file: a **detected
 * component with no fixture and no call site** has no declaration to defer
 * to, so for that case — and only that case — a conservatively-read prop type
 * may become a control. D18's rationale ("no reliable mapping from an input
 * name to a component prop") does not apply there, because the input name IS
 * the prop name by construction, exactly as it already is for call-site
 * props.
 */

import type {
	ComponentDoc,
	DocgenLimitation,
	InputOptions,
	InputOptionsWire,
	PropDoc,
} from "../shared/types.ts";

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

/* ------------------------------------------------------------------ *
 * §7.6's `from` — the one sanctioned path from docgen to a control
 * ------------------------------------------------------------------ */

/**
 * Fills an input's display metadata from the prop it explicitly named.
 *
 * D18 says control metadata is declared, not inferred, and §7.6 gives exactly
 * one way for docgen to contribute: `from: { component, prop }`, written by
 * hand at the call site. That is a reference, not a guess — the author has
 * stated which prop of which component this input stands for, which is the
 * mapping D18 says cannot be derived. Nothing here looks at the input's *name*.
 *
 * Two fields are taken, and only when the call site left them out:
 *
 *   - `description`, verbatim from the prop's doc comment.
 *   - `options`, but only from a union of string literals — see `unionOptions`.
 *
 * Everything else a `PropDoc` carries is deliberately ignored. `type` does not
 * choose a control (that would be inference), `required` is not a validation
 * rule uight enforces, and `defaultValue` is the component's default while the
 * input's default is the fixture's — using one for the other would silently
 * disagree with what is on screen.
 *
 * Resolution failures are silent by design. A `from` naming a component that
 * docgen did not cover, or a prop it could not read, leaves the input exactly
 * as the call site declared it: `docgen` defaults to off (§15.1), so the common
 * case is no docs at all, and an input that degrades to its declaration is
 * correct rather than broken.
 */
export function resolveInputDoc(
	options: InputOptionsWire | undefined,
	docs: Record<string, ComponentDoc[]> | undefined,
): InputOptionsWire | undefined {
	const ref = options?.from;
	if (!options || !ref || !docs) return options;

	const prop = findProp(docs, ref.component, ref.prop);
	if (!prop) return options;

	const resolved: InputOptionsWire = { ...options };
	if (resolved.description === undefined && prop.description) {
		resolved.description = prop.description;
	}
	if (!resolved.options?.length) {
		const literals = unionOptions(prop.type);
		if (literals) resolved.options = literals.map((v) => ({ t: "prim", v }) as const);
	}
	return resolved;
}

/**
 * A prop by component name, across every module docgen covered.
 *
 * By `name` rather than by glob path because that is what the author wrote:
 * `from: { component: "Button", prop: "variant" }` names the component the way
 * the fixture imports it, and the fixture is not required to know which file it
 * came from. Two components sharing a name is possible and the first match
 * wins, which is the same compromise call-site grouping already makes for a
 * bare package specifier — and unlike that one, this is opt-in per input.
 */
function findProp(
	docs: Record<string, ComponentDoc[]>,
	component: string,
	prop: string,
): PropDoc | null {
	for (const entries of Object.values(docs)) {
		for (const doc of entries) {
			if (doc.name !== component && doc.exportName !== component) continue;
			const found = doc.props.find((p) => p.name === prop);
			if (found) return found;
		}
	}
	return null;
}

/**
 * `"'sm' | 'md' | 'lg'"` → `["sm", "md", "lg"]`. Anything else → `null`.
 *
 * Deliberately the narrowest possible reading. Every member must be a quoted
 * string literal: a union containing `string`, a number, a reference to a named
 * type, or anything the resolver collapsed is rejected whole rather than
 * partially understood. A select offering three of a component's five variants
 * is worse than a text box, because it looks authoritative.
 *
 * `PropDoc.type` is the type *as written* and this parse is string-shaped
 * accordingly — it does not see through an alias, and it is not supposed to.
 * When it declines, the input keeps whatever the call site declared.
 */
/* ------------------------------------------------------------------ *
 * Docgen-derived controls for a bare detected component
 * ------------------------------------------------------------------ */

/** What `docControls` synthesizes: initial props plus per-prop options. */
export interface DocControls {
	props: Record<string, unknown>;
	options: Record<string, InputOptions<unknown>>;
}

/**
 * Controls for a detected component that has no fixture and no call site.
 *
 * The reading is deliberately the narrowest that is still useful, and a prop
 * it cannot read with confidence is **skipped, never guessed**:
 *
 *   - `boolean` → checkbox, starting from the written default or `false`;
 *   - `string` → text, starting from the written default or `""`;
 *   - `number` → number, starting from the written default or `0`;
 *   - a union of quoted string literals → select (via `unionOptions`),
 *     starting from the default when it is a member, else the first member.
 *
 * Everything else — functions, elements, objects, generics, anything the
 * resolver collapsed — is left to the prop table. The result is partial by
 * design (and the Babel resolver cannot see inherited props at all, §15.2),
 * which is why the panel this feeds must sit next to the limitation notes
 * rather than presenting itself as the component's whole API.
 *
 * Returns `null` rather than an empty set when nothing was readable, so the
 * caller can fall back to rendering the component bare.
 */
export function docControls(doc: ComponentDoc | null): DocControls | null {
	if (!doc) return null;
	const props: Record<string, unknown> = {};
	const options: Record<string, InputOptions<unknown>> = {};

	for (const prop of sortProps(doc.props)) {
		const type = prop.type?.trim();
		if (!type) continue;
		const opts: InputOptions<unknown> = {};
		if (prop.description) opts.description = prop.description;

		const literals = unionOptions(type);
		if (literals) {
			const written = literalDefault(prop.defaultValue);
			props[prop.name] =
				typeof written === "string" && literals.includes(written) ? written : literals[0];
			opts.control = "select";
			opts.options = literals;
		} else if (type === "boolean") {
			const written = literalDefault(prop.defaultValue);
			props[prop.name] = typeof written === "boolean" ? written : false;
		} else if (type === "string") {
			const written = literalDefault(prop.defaultValue);
			props[prop.name] = typeof written === "string" ? written : "";
		} else if (type === "number") {
			const written = literalDefault(prop.defaultValue);
			props[prop.name] = typeof written === "number" ? written : 0;
		} else {
			continue;
		}
		options[prop.name] = opts;
	}

	return Object.keys(props).length ? { props, options } : null;
}

/**
 * `PropDoc.defaultValue` is the default *as written in the source*, so it is
 * parsed as the literal it might be and ignored when it is anything else — a
 * call, a reference, a template — because the wrong default rendered
 * confidently is worse than the type's zero value.
 */
function literalDefault(written: string | undefined): string | number | boolean | null {
	if (written === undefined) return null;
	const text = written.trim();
	if (text === "true") return true;
	if (text === "false") return false;
	const quoted = /^(['"])(.*)\1$/.exec(text);
	if (quoted) return quoted[2] ?? "";
	const num = Number(text);
	return text !== "" && Number.isFinite(num) ? num : null;
}

function unionOptions(type: string | undefined): string[] | null {
	if (!type || !type.includes("|")) return null;
	const members = type.split("|").map((part) => part.trim());
	if (members.length < 2) return null;

	const values: string[] = [];
	for (const member of members) {
		const match = /^(['"])(.*)\1$/.exec(member);
		if (!match) return null;
		values.push(match[2] ?? "");
	}
	return values;
}
