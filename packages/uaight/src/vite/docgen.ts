/**
 * Prop metadata. SPEC.md §15.1, §15.2.
 *
 * §15.2 states three gates that must **all** pass before the TypeScript
 * resolver is adopted: that the 7.1 compiler API is sufficient for
 * `react-docgen-typescript` rather than merely present, that the integration
 * survives a real corpus, and that `oxlint-tsgolint` tracks 7.1 so the
 * repository does not lose type-aware linting by moving. ROADMAP Q12 records
 * all three as open, so this is the other branch of that sentence: the Babel
 * resolver, behind the interface a TypeScript one would later occupy, with its
 * blind spot documented rather than discovered.
 *
 * **The documented limitation is `inherited-props`.** `react-docgen` reads one
 * module's AST. A component whose props type extends an interface declared in
 * another file gets the props written in *this* file and nothing else — and
 * that is most design-system components, whose props extend
 * `React.ComponentPropsWithoutRef<"button">` or a shared `BaseProps`. A prop
 * table built from this must say so; `ComponentDoc.limitations` carries it per
 * entry so a consumer cannot render the table without the caveat in hand.
 *
 * **`react-docgen` is not a runtime dependency.** The package ships two, and
 * `docgen` defaults to `false` (§15.1) — making every install pay for a Babel
 * parser to support an off-by-default feature is the wrong trade. It is
 * imported dynamically and, when absent, the resolver reports that plainly and
 * returns nothing. Turning `docgen` on without installing it is a clear
 * message, not a crash and not silence.
 */

import type {
	ComponentDoc,
	DocgenLimitation,
	DocgenResolver,
	PropDoc,
} from "../shared/types.ts";

/** The npm package the Babel resolver needs, installed by the host. */
export const DOCGEN_PACKAGE = "react-docgen";

/**
 * What the Babel route cannot see. `generics` and `unions` are here for the
 * same reason `inherited-props` is: `react-docgen` reports a type as the text
 * it was written as, so a generic parameter and a union alias declared
 * elsewhere both arrive unresolved.
 */
export const BABEL_LIMITATIONS: readonly DocgenLimitation[] = [
	"inherited-props",
	"generics",
	"unions",
];

/**
 * The shape of `react-docgen`'s output that we read. Declared here rather than
 * imported: the package is optional, so its types must not be a build-time
 * requirement of this module.
 */
interface RawDoc {
	displayName?: string;
	description?: string;
	props?: Record<string, RawProp>;
}

interface RawProp {
	required?: boolean;
	description?: string;
	type?: { name?: string; raw?: string };
	tsType?: { name?: string; raw?: string };
	flowType?: { name?: string; raw?: string };
	defaultValue?: { value?: unknown };
}

export type ParseFn = (code: string, options: Record<string, unknown>) => RawDoc[];

/**
 * Resolved once and remembered, including the failure. A corpus of 500 modules
 * must not attempt 500 dynamic imports of a package that is not installed.
 */
let cached: { parse: ParseFn | null } | undefined;

async function loadParse(): Promise<ParseFn | null> {
	if (cached) return cached.parse;
	try {
		const mod = (await import(DOCGEN_PACKAGE)) as { parse?: ParseFn };
		cached = { parse: typeof mod.parse === "function" ? mod.parse : null };
	} catch {
		cached = { parse: null };
	}
	return cached.parse;
}

/** Test seam: forget the cached import so a test can exercise both branches. */
export function resetDocgenCache(): void {
	cached = undefined;
}

export interface BabelDocgenOptions {
	/**
	 * Called once, with a message, when `docgen` is on but `react-docgen` is not
	 * installed. The scan routes it to the Vite logger.
	 */
	onUnavailable?: (message: string) => void;
	/**
	 * How the optional dependency is loaded. Overridden only by tests: the
	 * "not installed" branch is the one that has to keep working on a machine
	 * where it *is* installed, and uninstalling it to check is not a test.
	 */
	load?: () => Promise<ParseFn | null>;
}

/**
 * §15.2's resolver, Babel-based.
 *
 * Never throws. A module `react-docgen` refuses — no component in it, a syntax
 * error, a shape it does not recognise — yields `[]`, exactly as the inventory
 * and call-site passes do, because one unreadable file must not take the index
 * down.
 */
export function createBabelDocgenResolver(
	options: BabelDocgenOptions = {},
): DocgenResolver {
	let warned = false;

	return {
		name: "babel",
		limitations: BABEL_LIMITATIONS,

		async resolve({ code, filename, globPath }) {
			const parse = await (options.load ?? loadParse)();
			if (!parse) {
				if (!warned) {
					warned = true;
					options.onUnavailable?.(
						`[uaight] docgen is on but "${DOCGEN_PACKAGE}" is not installed, so no prop ` +
							`metadata will be produced. Install it, or set docgen: false.`,
					);
				}
				return [];
			}

			let docs: RawDoc[];
			try {
				docs = parse(code, {
					filename,
					// Every exported component, not just the default one: the
					// inventory lists named exports too, and a doc joins to an
					// `InventoryItem` by name (§12, §15).
					handlers: undefined,
					babelOptions: { filename },
				});
			} catch {
				return [];
			}

			const out: ComponentDoc[] = [];
			for (const doc of docs) {
				const name = doc.displayName;
				if (!name) continue;
				out.push({
					name,
					// `react-docgen` reports a display name, not the binding it was
					// exported under. They coincide for every convention-following
					// component, and where they do not the display name is the one a
					// human recognises.
					exportName: name,
					globPath,
					...(doc.description ? { description: doc.description } : {}),
					props: toPropDocs(doc.props),
					limitations: [...BABEL_LIMITATIONS],
				});
			}
			return out;
		},
	};
}

function toPropDocs(props: Record<string, RawProp> | undefined): PropDoc[] {
	if (!props) return [];
	const out: PropDoc[] = [];
	for (const [name, prop] of Object.entries(props)) {
		// The type as written, not normalized — D18's rule that docgen is
		// display metadata means there is nothing downstream that would benefit
		// from a canonical form, and normalizing loses what the author typed.
		const type = prop.tsType ?? prop.type ?? prop.flowType;
		const written = type?.raw ?? type?.name;
		const defaultValue = prop.defaultValue?.value;
		out.push({
			name,
			required: prop.required === true,
			...(written ? { type: written } : {}),
			...(typeof defaultValue === "string" ? { defaultValue } : {}),
			...(prop.description ? { description: prop.description } : {}),
		});
	}
	return out;
}
