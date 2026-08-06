/**
 * The single-file classifier. SPEC.md §3.4, §13.
 *
 * Names live inside a module's default export. Loading every module to
 * enumerate them defeats lazy loading, so we parse instead: names are data,
 * modules are code, and a build step can read one without executing the other.
 *
 * §3.4's decision table, implemented literally:
 *
 *   | Default export                                          | Result            |
 *   | ------------------------------------------------------- | ----------------- |
 *   | Not an object literal                                   | single fixture    |
 *   | Object literal, all keys static                         | names: [...]      |
 *   | Object literal with spread, computed keys, or getters   | names: null       |
 *   | Identifier bound to a module-scope `const` initializer  | that initializer  |
 *   | Identifier assigned elsewhere                           | names: null       |
 *   | `export const fixtureNames` present                     | **Wins outright** |
 *
 * The identifier row moved. `const fixtures = {…}; export default fixtures` is
 * the shape half the real corpora are written in, and calling it undecidable
 * cost every one of those files a warm-pass module execution to learn something
 * the source says outright. The binding is resolved only when it is a
 * module-scope `const` with an initializer and nothing reassigns it — `let`,
 * `var`, a parameter, an import and a destructuring pattern all stay
 * undecidable, because in each of those the initializer is not the final value.
 * Resolution follows a chain of identifiers, so `const a = {…}; const b = a;
 * export default b` decides too, with a cycle guard.
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
import type { FixtureFileMeta, FixtureMeta } from "../shared/types.ts";

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
	/**
	 * The `fileMeta` named export (§3.1), when it is a static object literal.
	 *
	 * Read here rather than only at runtime because the one consumer that needs
	 * it — the viewport the preview opens at — has to know before the first
	 * paint, and under `index: "static"` no module is ever executed. Absent
	 * whenever the export is missing, dynamic, or not an object.
	 */
	fileMeta?: FixtureFileMeta;
	/** The `fixtureMeta` named export (§3.1), same rules, keyed by fixture name. */
	fixtureMeta?: Record<string, FixtureMeta>;
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
	// Its ESM exports are, though, and `fileMeta` is the only way an MDX page
	// can say where it belongs in the tree: the module is never warmed, because
	// `default-single` is already a decided answer, so nothing else would ever
	// read it.
	if (filename.endsWith(".mdx")) {
		return {
			names: [null],
			source: "default-single",
			csf,
			errors: [],
			...readMdxMetaExports(source, filename),
		};
	}

	let program: Program;
	let errors: string[];
	try {
		const result = parseSync(filename, source, { showSemanticErrors: false });
		program = result.program;
		errors = result.errors.filter((e) => e.severity === "Error").map((e) => e.message);
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

	// The two metadata exports ride along with every decision, including an
	// undecidable one: a file whose names the warm pass has to discover still
	// has a viewport the first paint needs (§3.1).
	const meta = readMetaExports(program);

	if (csf) {
		const names = readCsfStoryNames(program);
		return {
			names,
			source: names === null ? "undecidable" : "csf",
			csf: true,
			errors,
			...meta,
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
			...meta,
		};
	}

	const def = findDefaultExport(program);

	// No default export. The module is still one node in the tree; the runtime
	// reports the missing export when it loads, which is more useful than
	// hiding the file.
	if (def.kind === "absent") {
		return { names: [null], source: "default-single", csf: false, errors, ...meta };
	}

	// `export default function` / `class` — a component, never an object.
	if (def.kind === "callable") {
		return { names: [null], source: "default-single", csf: false, errors, ...meta };
	}

	// An identifier is followed to its module-scope `const` initializer before
	// the table is consulted, so `const fixtures = {…}; export default fixtures`
	// decides exactly as the literal would have (§3.4).
	const expr = resolveModuleScopeConst(unwrapExpression(def.expression), program);

	if (expr === null) {
		return { names: null, source: "undecidable", csf: false, errors, ...meta };
	}

	if (expr.type === "ObjectExpression") {
		const names = readObjectKeys(expr);
		return {
			names,
			source: names === null ? "undecidable" : "default-object",
			csf: false,
			errors,
			...meta,
		};
	}

	// Anything else — element, arrow, call — is a single fixture.
	return { names: [null], source: "default-single", csf: false, errors, ...meta };
}

/* ------------------------------------------------------------------ *
 * §3.4 — following an identifier default export
 * ------------------------------------------------------------------ */

/**
 * Follow an identifier to the expression it was initialized with, when that is
 * knowable from this module alone. Returns the expression to apply the table
 * to, or `null` for undecidable.
 *
 * The binding qualifies only when it is a module-scope `const` with an
 * initializer and no other module-scope declaration of the same name. `let` and
 * `var` are refused because a later assignment — anywhere, including inside a
 * function — replaces the value we would be reading, and finding those
 * assignments means the scope analysis this pass exists to avoid. An import is
 * refused because the value is in another module.
 */
function resolveModuleScopeConst(expr: Expression, program: Program): Expression | null {
	let current = expr;
	const seen = new Set<string>();

	for (let guard = 0; guard < 16; guard++) {
		if (current.type !== "Identifier") return current;
		const name = (current as { name: string }).name;
		// A cycle (`const a = b; const b = a;`) is not valid runtime code, but a
		// half-typed file can contain one and must not hang the index.
		if (seen.has(name)) return null;
		seen.add(name);

		const init = moduleScopeConstInit(program, name);
		if (init === null) return null;
		current = unwrapExpression(init);
	}
	return null;
}

/** The initializer of a uniquely declared module-scope `const`, or `null`. */
function moduleScopeConstInit(program: Program, name: string): Expression | null {
	let found: Expression | null = null;
	let count = 0;

	for (const stmt of program.body) {
		const decl =
			stmt.type === "VariableDeclaration"
				? (stmt as VariableDeclaration)
				: stmt.type === "ExportNamedDeclaration" &&
					  stmt.declaration?.type === "VariableDeclaration"
					? (stmt.declaration as VariableDeclaration)
					: null;
		if (!decl) continue;

		for (const d of decl.declarations) {
			// A destructuring pattern binds the name to a member of a value, not
			// to the initializer itself.
			if (d.id.type !== "Identifier") continue;
			if ((d.id as { name: string }).name !== name) continue;
			count++;
			if (decl.kind !== "const" || !d.init) return null;
			found = d.init;
		}
	}

	return count === 1 ? found : null;
}

/* ------------------------------------------------------------------ *
 * §3.1 — `fileMeta` and `fixtureMeta`
 * ------------------------------------------------------------------ */

/**
 * Read the two metadata exports as static object literals. Both are optional
 * and both are display metadata, so anything the parser cannot read stays
 * absent rather than becoming a problem: the renderer normalizes the real
 * exports once the module loads, and its answer wins.
 */
function readMetaExports(program: Program): {
	fileMeta?: FixtureFileMeta;
	fixtureMeta?: Record<string, FixtureMeta>;
} {
	const out: {
		fileMeta?: FixtureFileMeta;
		fixtureMeta?: Record<string, FixtureMeta>;
	} = {};

	for (const stmt of program.body) {
		if (stmt.type !== "ExportNamedDeclaration") continue;
		if (stmt.exportKind === "type") continue;
		const decl = stmt.declaration;
		if (!decl || decl.type !== "VariableDeclaration") continue;

		for (const d of (decl as VariableDeclaration).declarations) {
			if (d.id.type !== "Identifier" || !d.init) continue;
			const name = (d.id as { name: string }).name;
			if (name !== "fileMeta" && name !== "fixtureMeta") continue;

			const value = readStaticObject(unwrapExpression(d.init));
			if (value === null) continue;
			if (name === "fileMeta") out.fileMeta = value as FixtureFileMeta;
			else out.fixtureMeta = value as Record<string, FixtureMeta>;
		}
	}

	return out;
}

/**
 * The same two exports, out of an MDX document.
 *
 * MDX is not JavaScript and `parseSync` will not read it, but the ESM exports
 * inside one are ordinary JavaScript written at column zero — that is what MDX
 * guarantees about them. So the statement is cut out of the prose and parsed on
 * its own, rather than teaching this module a second language.
 *
 * Anything the cut cannot recover stays absent, exactly as elsewhere here: this
 * is display metadata, and a page whose `fileMeta` cannot be read sorts where
 * an unweighted page sorts instead of failing to appear.
 */
function readMdxMetaExports(
	source: string,
	filename: string,
): { fileMeta?: FixtureFileMeta; fixtureMeta?: Record<string, FixtureMeta> } {
	const statements: string[] = [];
	const pattern = /^export\s+const\s+(?:fileMeta|fixtureMeta)\s*=\s*\{/gm;

	for (const match of source.matchAll(pattern)) {
		const end = endOfObjectLiteral(source, match.index + match[0].length - 1);
		if (end === -1) continue;
		statements.push(`${source.slice(match.index, end + 1)};`);
	}

	if (!statements.length) return {};

	try {
		const { program, errors } = parseSync(`${filename}.ts`, statements.join("\n"), {
			showSemanticErrors: false,
		});
		if (errors.some((e) => e.severity === "Error")) return {};
		return readMetaExports(program);
	} catch {
		return {};
	}
}

/**
 * Index of the `}` closing the `{` at `open`, or -1. Counts braces, and skips
 * the ones inside strings and template literals so a title containing one does
 * not end the object early.
 */
function endOfObjectLiteral(source: string, open: number): number {
	let depth = 0;
	let quote = "";

	for (let i = open; i < source.length; i++) {
		const char = source[i]!;

		if (quote) {
			if (char === "\\") i++;
			else if (char === quote) quote = "";
			continue;
		}

		if (char === '"' || char === "'" || char === "`") quote = char;
		else if (char === "{") depth++;
		else if (char === "}" && --depth === 0) return i;
	}

	return -1;
}

/**
 * A JSON-shaped object literal, or `null`. Deliberately narrower than the
 * call-site reader: this value is embedded in the generated runtime module and
 * crosses a realm boundary, so nothing that is not JSON may enter it.
 */
function readStaticObject(expr: Expression): Record<string, unknown> | null {
	const value = readStaticValue(expr, 0);
	if (value === NOT_STATIC || value === null || typeof value !== "object") return null;
	if (Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

const NOT_STATIC = Symbol("not-static");
const MAX_META_DEPTH = 6;

function readStaticValue(expr: Expression, depth: number): unknown {
	if (depth > MAX_META_DEPTH) return NOT_STATIC;
	const node = unwrapExpression(expr);

	switch (node.type) {
		case "Literal": {
			const raw = node as { value: unknown; regex?: unknown; bigint?: unknown };
			if (raw.regex !== undefined || raw.bigint !== undefined) return NOT_STATIC;
			return raw.value ?? null;
		}
		case "UnaryExpression": {
			const unary = node as unknown as { operator: string; argument: Expression };
			const argument = readStaticValue(unary.argument, depth + 1);
			if (typeof argument !== "number") return NOT_STATIC;
			return unary.operator === "-"
				? -argument
				: unary.operator === "+"
					? argument
					: NOT_STATIC;
		}
		case "ArrayExpression": {
			const out: unknown[] = [];
			for (const element of (node as unknown as { elements: unknown[] }).elements) {
				if (element === null) return NOT_STATIC;
				const item = element as { type: string };
				if (item.type === "SpreadElement") return NOT_STATIC;
				const value = readStaticValue(element as Expression, depth + 1);
				if (value === NOT_STATIC) return NOT_STATIC;
				out.push(value);
			}
			return out;
		}
		case "ObjectExpression": {
			const out: Record<string, unknown> = {};
			for (const prop of (node as ObjectExpression).properties) {
				if (prop.type === "SpreadElement") return NOT_STATIC;
				if (prop.computed || prop.kind !== "init") return NOT_STATIC;
				const key = readStaticKeyName(prop.key);
				if (key === null) return NOT_STATIC;
				const value = readStaticValue(prop.value as Expression, depth + 1);
				if (value === NOT_STATIC) return NOT_STATIC;
				out[key] = value;
			}
			return out;
		}
		default:
			return NOT_STATIC;
	}
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
