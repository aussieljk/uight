/**
 * Call-site harvesting — fixtures nobody had to write.
 *
 * §12 gives a codebase with no fixtures a *list* of components. A list is not
 * the zero-config payoff: selecting a detected component usually renders a
 * crash, because a real component needs props. Its props are already written
 * down — in every place the app uses it.
 *
 * This is one more pass over the ASTs the inventory scan already parses. It
 * collects each `<Button …>` usage with statically readable props, so the
 * explorer can offer "Button — as used in checkout/PayNow.tsx:42" with the
 * props that ship in production.
 *
 * Two rules keep this honest:
 *
 *  1. **Syntax only**, exactly like the inventory (§12 step 2). Nothing is
 *     executed, no import is resolved to a module, no type checker runs. A prop
 *     whose value is not statically readable is *recorded as dynamic and
 *     skipped*, never guessed.
 *  2. **This is not docgen and it is not inference.** D18 forbids deriving
 *     control metadata from a prop name; nothing here does that. These values
 *     are code the user wrote, quoted back to them.
 */

import { parseSync } from "oxc-parser";
import type { CallSite, CallSiteGroup } from "../shared/types.ts";
import { isComponentName } from "./inventory.ts";

/** Per component, per file. A component used 200 times yields a readable few. */
export const DEFAULT_MAX_SITES = 8;

/** Beyond this, a prop value is more useful read in the source than inlined. */
const MAX_VALUE_DEPTH = 4;
const MAX_TEXT_LENGTH = 240;

interface RawSite {
	component: string;
	props: Record<string, unknown>;
	children?: string;
	dynamic: string[];
	offset: number;
}

/* ------------------------------------------------------------------ *
 * Static value reading
 * ------------------------------------------------------------------ */

const NOT_STATIC = Symbol("not-static");

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
	return (
		typeof value === "object" && value !== null && typeof (value as Node).type === "string"
	);
}

/**
 * The subset of expressions whose value is written down in the source. Anything
 * else — an identifier, a call, a member access, JSX — is dynamic by definition:
 * its value depends on a scope we are deliberately not resolving.
 */
function staticValue(node: unknown, depth = 0): unknown {
	if (!isNode(node) || depth > MAX_VALUE_DEPTH) return NOT_STATIC;

	switch (node.type) {
		case "Literal": {
			const value = node.value;
			// A regex literal has `value: null` plus a `regex` field; it is not JSON.
			if (node.regex !== undefined) return NOT_STATIC;
			if (node.bigint !== undefined) return NOT_STATIC;
			return value === undefined ? null : value;
		}
		case "TemplateLiteral": {
			const expressions = node.expressions as unknown[] | undefined;
			if (expressions?.length) return NOT_STATIC;
			const quasis = (node.quasis ?? []) as Array<{ value?: { cooked?: unknown } }>;
			const text = quasis.map((q) => String(q.value?.cooked ?? "")).join("");
			return text;
		}
		case "UnaryExpression": {
			// `-1`, `+1`, `!0` — the only unary forms worth reading.
			const argument = staticValue(node.argument, depth + 1);
			if (argument === NOT_STATIC) return NOT_STATIC;
			if (node.operator === "-" && typeof argument === "number") return -argument;
			if (node.operator === "+" && typeof argument === "number") return argument;
			if (node.operator === "!") return !argument;
			return NOT_STATIC;
		}
		case "ArrayExpression": {
			const out: unknown[] = [];
			for (const element of (node.elements ?? []) as unknown[]) {
				// A hole (`[1, , 2]`) and a spread both make the length a guess.
				if (element === null) return NOT_STATIC;
				if (isNode(element) && element.type === "SpreadElement") return NOT_STATIC;
				const value = staticValue(element, depth + 1);
				if (value === NOT_STATIC) return NOT_STATIC;
				out.push(value);
			}
			return out;
		}
		case "ObjectExpression": {
			const out: Record<string, unknown> = {};
			for (const property of (node.properties ?? []) as unknown[]) {
				if (!isNode(property)) return NOT_STATIC;
				if (property.type !== "Property") return NOT_STATIC;
				if (property.computed === true || property.kind !== "init") return NOT_STATIC;
				const key = staticKey(property.key);
				if (key === null) return NOT_STATIC;
				const value = staticValue(property.value, depth + 1);
				if (value === NOT_STATIC) return NOT_STATIC;
				out[key] = value;
			}
			return out;
		}
		case "Identifier":
			// `undefined` is the one identifier whose value is not in question.
			return node.name === "undefined" ? undefined : NOT_STATIC;
		case "ParenthesizedExpression":
		case "TSAsExpression":
		case "TSSatisfiesExpression":
		case "TSNonNullExpression":
			return staticValue(node.expression, depth);
		default:
			return NOT_STATIC;
	}
}

function staticKey(key: unknown): string | null {
	if (!isNode(key)) return null;
	if (key.type === "Identifier" && typeof key.name === "string") return key.name;
	if (key.type === "Literal") {
		if (typeof key.value === "string") return key.value;
		if (typeof key.value === "number") return String(key.value);
	}
	return null;
}

/* ------------------------------------------------------------------ *
 * JSX
 * ------------------------------------------------------------------ */

/** `Button`, `Accordion.Item`, `UI.Form.Field` — written as the source has it. */
function jsxName(node: unknown): string | null {
	if (!isNode(node)) return null;
	if (node.type === "JSXIdentifier")
		return typeof node.name === "string" ? node.name : null;
	if (node.type === "JSXMemberExpression") {
		const object = jsxName(node.object);
		const property = jsxName(node.property);
		return object && property ? `${object}.${property}` : null;
	}
	// A namespaced name (`svg:circle`) is never a component.
	return null;
}

/** The identifier a dotted name is rooted at — what an import would bind. */
function rootName(name: string): string {
	return name.split(".")[0] ?? name;
}

/**
 * Text children, when *every* child is static text. A single expression child
 * (`{label}`) makes the content dynamic, and half a sentence is worse than none.
 */
function textChildren(children: unknown): string | typeof NOT_STATIC | undefined {
	if (!Array.isArray(children) || children.length === 0) return undefined;
	let text = "";
	for (const child of children as unknown[]) {
		if (!isNode(child)) return NOT_STATIC;
		if (child.type === "JSXText") {
			text += String(child.value ?? "");
			continue;
		}
		if (child.type === "JSXExpressionContainer") {
			const expression = child.expression;
			// `{/* a comment */}` contributes nothing and is not dynamic.
			if (isNode(expression) && expression.type === "JSXEmptyExpression") continue;
			const value = staticValue(expression);
			if (value === NOT_STATIC || typeof value === "object") return NOT_STATIC;
			text += String(value ?? "");
			continue;
		}
		return NOT_STATIC;
	}
	const collapsed = text.replace(/\s+/g, " ").trim();
	if (collapsed === "") return undefined;
	return collapsed.length > MAX_TEXT_LENGTH ? NOT_STATIC : collapsed;
}

function readOpeningElement(
	opening: Node,
	children: unknown,
	offset: number,
): RawSite | null {
	const component = jsxName(opening.name);
	if (!component || !isComponentName(rootName(component))) return null;

	const props: Record<string, unknown> = {};
	const dynamic: string[] = [];

	for (const attribute of (opening.attributes ?? []) as unknown[]) {
		if (!isNode(attribute)) continue;

		if (attribute.type === "JSXSpreadAttribute") {
			// A spread can contribute any number of props, so the shape is unknown
			// even when every prop we did read is static.
			dynamic.push("...");
			continue;
		}
		if (attribute.type !== "JSXAttribute") continue;

		const name = jsxName(attribute.name);
		if (!name) continue;

		const value = attribute.value;
		// `<Button disabled />` — a bare attribute is `true`.
		if (value === null || value === undefined) {
			props[name] = true;
			continue;
		}
		if (isNode(value) && value.type === "Literal") {
			props[name] = value.value ?? null;
			continue;
		}
		if (isNode(value) && value.type === "JSXExpressionContainer") {
			const read = staticValue(value.expression);
			if (read === NOT_STATIC) {
				dynamic.push(name);
				continue;
			}
			if (read === undefined) continue;
			props[name] = read;
			continue;
		}
		// A JSX element as a prop value (`icon={<Icon />}`) is real code.
		dynamic.push(name);
	}

	const text = textChildren(children);
	if (text === NOT_STATIC) dynamic.push("children");

	const site: RawSite = { component, props, dynamic, offset };
	if (typeof text === "string") site.children = text;
	return site;
}

/**
 * A generic walk rather than a typed visitor. The JSX node set is stable
 * ESTree, but the surrounding expression and statement unions are large and
 * shift between parser releases; walking every object property finds every JSX
 * element regardless of what encloses it, which is the property that matters.
 */
function walk(node: unknown, visit: (element: Node) => void, depth = 0): void {
	if (depth > 200) return;
	if (Array.isArray(node)) {
		for (const child of node) walk(child, visit, depth + 1);
		return;
	}
	if (!isNode(node)) return;
	if (node.type === "JSXElement") visit(node);
	for (const key of Object.keys(node)) {
		if (key === "type") continue;
		walk(node[key], visit, depth + 1);
	}
}

/* ------------------------------------------------------------------ *
 * Imports — which module a name came from
 * ------------------------------------------------------------------ */

/**
 * Local binding → import specifier, so a `Button` used here can be told from a
 * `Button` of the same name somewhere else. The specifier is recorded raw; the
 * caller resolves it against the file, because only the caller knows the roots.
 */
function importSources(program: Node): Map<string, string> {
	const sources = new Map<string, string>();
	for (const statement of (program.body ?? []) as unknown[]) {
		if (!isNode(statement) || statement.type !== "ImportDeclaration") continue;
		if (statement.importKind === "type") continue;
		const source = isNode(statement.source) ? statement.source.value : undefined;
		if (typeof source !== "string") continue;
		for (const specifier of (statement.specifiers ?? []) as unknown[]) {
			if (!isNode(specifier)) continue;
			if (specifier.importKind === "type") continue;
			const local = isNode(specifier.local) ? specifier.local.name : undefined;
			if (typeof local === "string") sources.set(local, source);
		}
	}
	return sources;
}

/* ------------------------------------------------------------------ *
 * Positions
 * ------------------------------------------------------------------ */

/** Offset → 1-based line and column. One pass, because sites are few. */
function positionAt(source: string, offset: number): { line: number; column: number } {
	let line = 1;
	let lineStart = 0;
	for (let i = 0; i < offset && i < source.length; i++) {
		if (source.charCodeAt(i) === 10) {
			line++;
			lineStart = i + 1;
		}
	}
	return { line, column: offset - lineStart + 1 };
}

/* ------------------------------------------------------------------ *
 * The pass
 * ------------------------------------------------------------------ */

export interface ParseCallSitesOptions {
	/** Display path of the file being read, used to label a site. */
	path: string;
	globPath: string;
	/** Resolves an import specifier to a display path, when it can. */
	resolve?: (specifier: string) => string | null;
}

/**
 * Every component usage in one module. Never throws: an unparseable file yields
 * nothing, exactly like the inventory pass.
 */
export function parseCallSites(
	source: string,
	filename: string,
	options: ParseCallSitesOptions,
): CallSite[] {
	let program: Node;
	try {
		const result = parseSync(filename, source, { showSemanticErrors: false });
		if (result.errors.some((e) => e.severity === "Error")) return [];
		program = result.program as unknown as Node;
	} catch {
		return [];
	}

	const imports = importSources(program);
	const raw: RawSite[] = [];

	walk(program, (element) => {
		const opening = element.openingElement;
		if (!isNode(opening)) return;
		const offset = typeof element.start === "number" ? element.start : 0;
		const site = readOpeningElement(opening, element.children, offset);
		if (site) raw.push(site);
	});

	return raw.map((site) => {
		const { line, column } = positionAt(source, site.offset);
		const specifier = imports.get(rootName(site.component));
		const resolved = specifier ? (options.resolve?.(specifier) ?? null) : null;

		const out: CallSite = {
			component: site.component,
			props: site.props,
			path: options.path,
			globPath: options.globPath,
			line,
			column,
			dynamic: site.dynamic,
		};
		if (site.children !== undefined) out.children = site.children;
		if (specifier !== undefined) out.importedFrom = specifier;
		if (resolved) out.resolvedFrom = resolved;
		return out;
	});
}

/* ------------------------------------------------------------------ *
 * Ranking and grouping
 * ------------------------------------------------------------------ */

/** Two usages with the same props are the same example twice. */
function signature(site: CallSite): string {
	const keys = Object.keys(site.props).sort();
	const props = keys.map((key) => `${key}=${JSON.stringify(site.props[key])}`).join(",");
	return `${site.component}(${props})[${site.children ?? ""}]`;
}

/**
 * Distinctness, not frequency. The most-repeated usage of a component is
 * usually its plainest one, and a fixture list of eight identical buttons is
 * worth less than one button per variant — so a site scores by how much it
 * says: static props first, then content, and a spread counts against it
 * because the rendered result is not what the source shows.
 */
function score(site: CallSite): number {
	const props = Object.keys(site.props).length;
	const spread = site.dynamic.includes("...") ? 3 : 0;
	return props * 2 + (site.children ? 1 : 0) - spread - site.dynamic.length * 0.25;
}

export interface GroupCallSitesOptions {
	max?: number;
}

/**
 * Group by component name, dedupe by signature, keep the most distinct few.
 *
 * Grouping is by the name as written, so two different components that share a
 * name share a group. The UI narrows with `resolvedFrom` when the import told
 * us where the name came from; where it did not, an extra example from a
 * same-named component is a mild wrong answer rather than a broken one, and
 * both are labelled with the file they came from.
 */
export function groupCallSites(
	sites: readonly CallSite[],
	options: GroupCallSitesOptions = {},
): CallSiteGroup[] {
	const max = options.max ?? DEFAULT_MAX_SITES;
	const byComponent = new Map<string, CallSite[]>();

	for (const site of sites) {
		const list = byComponent.get(site.component);
		if (list) list.push(site);
		else byComponent.set(site.component, [site]);
	}

	const groups: CallSiteGroup[] = [];
	for (const [component, list] of [...byComponent].sort((a, b) =>
		a[0] < b[0] ? -1 : 1,
	)) {
		const seen = new Set<string>();
		const unique: CallSite[] = [];
		for (const site of list) {
			const key = signature(site);
			if (seen.has(key)) continue;
			seen.add(key);
			unique.push(site);
		}
		unique.sort(
			(a, b) => score(b) - score(a) || a.path.localeCompare(b.path) || a.line - b.line,
		);
		groups.push({
			component,
			sites: unique.slice(0, max),
			total: list.length,
		});
	}
	return groups;
}
