/**
 * The single-file classifier. SPEC.md §3.4, §13.
 *
 * Names live inside a module's default export. Loading every module to
 * enumerate them defeats lazy loading, so we parse instead: names are data,
 * modules are code, and a build step can read one without executing the other.
 *
 * §3.4's decision table, implemented literally:
 *
 *   | Default export                                        | Result            |
 *   | ----------------------------------------------------- | ----------------- |
 *   | Not an object literal                                 | single fixture    |
 *   | Object literal, all keys static                       | names: [...]      |
 *   | Object literal with spread, computed keys, or getters | names: null       |
 *   | Identifier assigned elsewhere                         | names: null       |
 *   | `export const fixtureNames` present                   | **Wins outright** |
 *
 * **Encoding note.** A single fixture is `[null]`, exactly as §3.4's table
 * says: one entry, whose name is `null` because the module's default export is
 * the fixture. The whole field being `null` stays reserved for undecidable,
 * which is what triggers the warm pass (§3.5).
 *
 * The empty array is deliberately not a legal value. An earlier encoding used
 * it for the single-fixture case, which collided with "a file contributing no
 * fixtures" and made every zero-config single-fixture file invisible in the
 * tree — `buildTree` read it as a multi-fixture file with no children.
 */

import { parseSync } from "oxc-parser";
import type {
	Class,
	Declaration,
	Expression,
	Function as OxcFunction,
	ObjectExpression,
	Program,
	VariableDeclaration,
} from "oxc-parser";

/** Where a decided name list came from. Diagnostics and parse-coverage stats. */
export type NameSource =
	| "fixtureNames"
	| "default-object"
	| "default-single"
	| "csf"
	| "undecidable";

export interface ParsedFixtureFile {
	/**
	 * `null` — undecidable (§3.4); the warm pass resolves it.
	 * `[]`   — one fixture, the module's default export.
	 * `[…]`  — the keys of the default-exported object, in source order.
	 */
	names: Array<string | null> | null;
	source: NameSource;
	/** True when the module was read as Storybook CSF rather than a fixture. §13 */
	csf: boolean;
	/** Syntax errors reported by oxc. Non-empty means `names` is untrustworthy. */
	errors: string[];
}

export interface ParseFixtureFileOptions {
	/** Read the module as Storybook CSF (§13). Set by the scan from the suffix. */
	csf?: boolean;
}

/** One fixture: the module's default export. See the encoding note above. */
export const SINGLE_FIXTURE: string[] = [];

const CSF_NON_STORY_EXPORTS = new Set([
	"default",
	"__namedExportsOrder",
	"includeStories",
	"excludeStories",
]);

/**
 * Classify one module. Never throws: an unparseable file is reported through
 * `errors` and treated as undecidable, because a syntax error the user is
 * halfway through typing must not take the index down.
 */
export function parseFixtureFile(
	source: string,
	filename: string,
	options: ParseFixtureFileOptions = {},
): ParsedFixtureFile {
	const csf = options.csf ?? false;

	// MDX normalizes into exactly one fixture (§14) and is not JavaScript.
	if (filename.endsWith(".mdx")) {
		return { names: [null], source: "default-single", csf, errors: [] };
	}

	let program: Program;
	let errors: string[];
	try {
		const result = parseSync(filename, source, { showSemanticErrors: false });
		program = result.program;
		errors = result.errors
			.filter((e) => e.severity === "Error")
			.map((e) => e.message);
	} catch (err) {
		return {
			names: null,
			source: "undecidable",
			csf,
			errors: [(err as Error).message],
		};
	}

	// A file that does not parse tells us nothing. Undecidable, not empty.
	if (errors.length > 0) {
		return { names: null, source: "undecidable", csf, errors };
	}

	if (csf) {
		const names = readCsfStoryNames(program);
		return {
			names,
			source: names === null ? "undecidable" : "csf",
			csf: true,
			errors,
		};
	}

	// `export const fixtureNames` wins outright (§3.4).
	const declared = readFixtureNames(program);
	if (declared.present) {
		return {
			names: declared.names,
			source: declared.names === null ? "undecidable" : "fixtureNames",
			csf: false,
			errors,
		};
	}

	const def = findDefaultExport(program);

	// No default export. The module is still one node in the tree; the runtime
	// reports the missing export when it loads, which is more useful than
	// hiding the file.
	if (def.kind === "absent") {
		return { names: [null], source: "default-single", csf: false, errors };
	}

	// `export default function` / `class` — a component, never an object.
	if (def.kind === "callable") {
		return { names: [null], source: "default-single", csf: false, errors };
	}

	const expr = unwrapExpression(def.expression);

	if (expr.type === "ObjectExpression") {
		const names = readObjectKeys(expr);
		return {
			names,
			source: names === null ? "undecidable" : "default-object",
			csf: false,
			errors,
		};
	}

	// "Identifier assigned elsewhere" — undecidable by the table, even when the
	// binding is visible in this module. Resolving it is a warm-pass job (§3.5).
	if (expr.type === "Identifier") {
		return { names: null, source: "undecidable", csf: false, errors };
	}

	// Anything else — element, arrow, call — is a single fixture.
	return { names: [null], source: "default-single", csf: false, errors };
}

/* ------------------------------------------------------------------ *
 * §3.4 — the default export
 * ------------------------------------------------------------------ */

type DefaultExport =
	| { kind: "absent" }
	| { kind: "callable" }
	| { kind: "expression"; expression: Expression };

const CALLABLE_DECLARATIONS = new Set([
	"FunctionDeclaration",
	"FunctionExpression",
	"TSDeclareFunction",
	"TSEmptyBodyFunctionExpression",
	"ClassDeclaration",
	"ClassExpression",
	"TSInterfaceDeclaration",
]);

function findDefaultExport(program: Program): DefaultExport {
	for (const stmt of program.body) {
		if (stmt.type !== "ExportDefaultDeclaration") continue;
		const d = stmt.declaration;
		if (CALLABLE_DECLARATIONS.has(d.type)) return { kind: "callable" };
		return { kind: "expression", expression: d as Expression };
	}
	return { kind: "absent" };
}

/**
 * Object literal keys. Spread, computed keys and accessors make the shape
 * undecidable — a spread can contribute any number of names, and an accessor
 * means the value is produced rather than written down.
 */
function readObjectKeys(node: ObjectExpression): string[] | null {
	const names: string[] = [];
	for (const prop of node.properties) {
		if (prop.type === "SpreadElement") return null;
		if (prop.computed) return null;
		if (prop.kind !== "init") return null; // get / set
		const key = readStaticKeyName(prop.key);
		if (key === null) return null;
		names.push(key);
	}
	return names;
}

/**
 * Identifier or string/number literal key. `null` when it is neither, which
 * covers computed keys and private identifiers. Takes `unknown` because the
 * AST spells "a key" as half a dozen different node unions.
 */
export function readStaticKeyName(key: unknown): string | null {
	if (typeof key !== "object" || key === null) return null;
	const node = key as { type?: unknown; name?: unknown; value?: unknown };
	if (node.type === "Identifier" && typeof node.name === "string") {
		return node.name;
	}
	if (node.type === "Literal") {
		if (typeof node.value === "string") return node.value;
		if (typeof node.value === "number") return String(node.value);
	}
	return null;
}

/** Peel type-only and grouping wrappers so the table sees the real node. */
export function unwrapExpression(expr: Expression): Expression {
	let current: Expression = expr;
	for (let guard = 0; guard < 32; guard++) {
		switch (current.type) {
			case "ParenthesizedExpression":
			case "TSAsExpression":
			case "TSSatisfiesExpression":
			case "TSNonNullExpression":
			case "TSTypeAssertion":
			case "TSInstantiationExpression":
				current = (current as unknown as { expression: Expression }).expression;
				break;
			default:
				return current;
		}
	}
	return current;
}

/* ------------------------------------------------------------------ *
 * §3.1 — `export const fixtureNames`
 * ------------------------------------------------------------------ */

function readFixtureNames(program: Program): {
	present: boolean;
	names: string[] | null;
} {
	for (const stmt of program.body) {
		if (stmt.type !== "ExportNamedDeclaration") continue;
		if (stmt.exportKind === "type") continue;
		const decl = stmt.declaration;
		if (!decl || decl.type !== "VariableDeclaration") continue;
		for (const d of decl.declarations) {
			if (d.id.type !== "Identifier") continue;
			if ((d.id as { name: string }).name !== "fixtureNames") continue;
			if (!d.init) return { present: true, names: null };
			return { present: true, names: readStringArray(unwrapExpression(d.init)) };
		}
	}
	return { present: false, names: null };
}

/** A statically readable array of string literals, or `null`. */
function readStringArray(expr: Expression): string[] | null {
	if (expr.type !== "ArrayExpression") return null;
	const out: string[] = [];
	for (const element of expr.elements) {
		if (element === null) return null;
		if (element.type === "SpreadElement") return null;
		const inner = unwrapExpression(element);
		if (inner.type !== "Literal") return null;
		const value = (inner as { value: unknown }).value;
		if (typeof value !== "string") return null;
		out.push(value);
	}
	return out;
}

/* ------------------------------------------------------------------ *
 * §13 — CSF named exports
 * ------------------------------------------------------------------ */

interface StoryFilters {
	include: string[] | null;
	exclude: string[] | null;
}

/**
 * Every exported binding that is not `default` or CSF bookkeeping is a story.
 * A static `name:` string property renames it, matching Storybook. When
 * `includeStories` / `excludeStories` are statically readable they are
 * honoured, which is what keeps helper exports out of the tree.
 */
function readCsfStoryNames(program: Program): string[] | null {
	const filters = readStoryFilters(program);
	const names: string[] = [];
	const seen = new Set<string>();

	const push = (name: string): void => {
		if (seen.has(name)) return;
		seen.add(name);
		names.push(name);
	};

	for (const stmt of program.body) {
		if (stmt.type !== "ExportNamedDeclaration") continue;
		if (stmt.exportKind === "type") continue;

		if (stmt.declaration) {
			for (const exportName of declaredNames(stmt.declaration)) {
				if (!isStoryExport(exportName, filters)) continue;
				push(storyDisplayName(stmt.declaration, exportName) ?? exportName);
			}
			continue;
		}

		for (const spec of stmt.specifiers) {
			if (spec.exportKind === "type") continue;
			const exported = readStaticKeyName(spec.exported);
			if (exported === null) continue;
			if (!isStoryExport(exported, filters)) continue;
			push(exported);
		}
	}

	return names;
}

function isStoryExport(name: string, filters: StoryFilters): boolean {
	if (CSF_NON_STORY_EXPORTS.has(name)) return false;
	if (filters.exclude && filters.exclude.includes(name)) return false;
	if (filters.include && !filters.include.includes(name)) return false;
	return true;
}

function readStoryFilters(program: Program): StoryFilters {
	let include: string[] | null = null;
	let exclude: string[] | null = null;
	for (const stmt of program.body) {
		if (stmt.type !== "ExportNamedDeclaration") continue;
		const decl = stmt.declaration;
		if (!decl || decl.type !== "VariableDeclaration") continue;
		for (const d of decl.declarations) {
			if (d.id.type !== "Identifier" || !d.init) continue;
			const name = (d.id as { name: string }).name;
			const init = unwrapExpression(d.init);
			if (name === "includeStories") include = readStringArray(init);
			if (name === "excludeStories") exclude = readStringArray(init);
		}
	}
	return { include, exclude };
}

/** Names a declaration binds, so `export const A = …, B = …` yields both. */
function declaredNames(decl: Declaration): string[] {
	if (decl.type === "VariableDeclaration") {
		const out: string[] = [];
		for (const d of (decl as VariableDeclaration).declarations) {
			if (d.id.type === "Identifier") out.push((d.id as { name: string }).name);
		}
		return out;
	}
	const id = (decl as OxcFunction | Class).id;
	return id ? [id.name] : [];
}

/** `export const Foo = { name: "Bar" }` displays as `Bar`. §13 */
function storyDisplayName(decl: Declaration, exportName: string): string | null {
	if (decl.type !== "VariableDeclaration") return null;
	for (const d of (decl as VariableDeclaration).declarations) {
		if (d.id.type !== "Identifier") continue;
		if ((d.id as { name: string }).name !== exportName) continue;
		if (!d.init) return null;
		const init = unwrapExpression(d.init);
		if (init.type !== "ObjectExpression") return null;
		for (const prop of init.properties) {
			if (prop.type === "SpreadElement") continue;
			if (prop.computed || prop.kind !== "init") continue;
			if (readStaticKeyName(prop.key) !== "name") continue;
			const value = unwrapExpression(prop.value);
			if (value.type !== "Literal") return null;
			const raw = (value as { value: unknown }).value;
			return typeof raw === "string" ? raw : null;
		}
	}
	return null;
}
