/**
 * Component inventory — the zero-config experience. SPEC.md §12.
 *
 * Step 2 of §12: "Filter with `oxc-parser`: exported names, PascalCase,
 * function or `memo`/`forwardRef` shape. **No docgen in v1** (§15) — this pass
 * is syntax only, which keeps it fast and dependency-light."
 *
 * Syntax only means exactly that. We never resolve imports, never consult a
 * type checker, and never execute anything. A false positive costs the user
 * one tree entry that fails to render behind an error boundary; a docgen
 * dependency would cost every user a build-time price for a v1.3 feature.
 *
 * Inventory is development-only and is excluded from production builds
 * regardless of `production` mode (§12, last line). That exclusion is enforced
 * by the scan and the virtual-module generators, not here.
 */

import { parseSync } from "oxc-parser";
import type {
	Class,
	Declaration,
	Expression,
	Function as OxcFunction,
	Program,
	VariableDeclaration,
} from "oxc-parser";
import type { InventoryItem } from "../shared/types.ts";
import { readStaticKeyName, unwrapExpression } from "./parse.ts";

export type InventoryKind = InventoryItem["kind"];

export interface DetectedComponent {
	/** The export key an importer would use. `default` for a default export. */
	exportName: string;
	/** Display name. A default export is recorded as its inferred name (§12). */
	name: string;
	kind: InventoryKind;
}

const REACT_CLASS_BASES = new Set(["Component", "PureComponent"]);

/**
 * PascalCase, in the sense React uses: an initial capital, and not a screaming
 * constant. The second clause is what keeps `API`, `MAX_WIDTH` and friends out
 * of the component list; a single capital letter is still a legal component
 * name, so length 1 is exempt from it.
 */
export function isComponentName(name: string): boolean {
	if (!/^[A-Z]/.test(name)) return false;
	return name.length === 1 || !/^[A-Z0-9_]+$/.test(name);
}

/**
 * Detect the components a module exports. Never throws; an unparseable file
 * yields no components rather than failing the scan.
 */
export function parseInventoryFile(
	source: string,
	filename: string,
): DetectedComponent[] {
	let program: Program;
	try {
		const result = parseSync(filename, source, { showSemanticErrors: false });
		if (result.errors.some((e) => e.severity === "Error")) return [];
		program = result.program;
	} catch {
		return [];
	}

	// Module-scope bindings, so `const X = memo(…); export { X as Y }` — the
	// single most common shape in a real design system — is detected.
	const bindings = collectBindings(program);
	const out: DetectedComponent[] = [];
	const seen = new Set<string>();

	const add = (exportName: string, name: string, kind: InventoryKind): void => {
		if (seen.has(exportName)) return;
		seen.add(exportName);
		out.push({ exportName, name, kind });
	};

	for (const stmt of program.body) {
		if (stmt.type === "ExportNamedDeclaration") {
			if (stmt.exportKind === "type") continue;

			if (stmt.declaration) {
				for (const [name, kind] of declarationBindings(stmt.declaration)) {
					if (kind && isComponentName(name)) add(name, name, kind);
				}
				continue;
			}

			for (const spec of stmt.specifiers) {
				if (spec.exportKind === "type") continue;
				const exported = readStaticKeyName(spec.exported);
				const local = readStaticKeyName(spec.local);
				if (exported === null || local === null) continue;
				if (!isComponentName(exported)) continue;
				const kind = bindings.get(local);
				if (kind) add(exported, exported, kind);
			}
			continue;
		}

		if (stmt.type === "ExportDefaultDeclaration") {
			const d = stmt.declaration;

			// `export default function Button() {}` / `export default class …`
			const declared = declarationBindings(d as Declaration);
			const first = declared[0];
			if (first && first[1]) {
				const [declaredName, kind] = first;
				const name = isComponentName(declaredName)
					? declaredName
					: inferNameFromFilename(filename);
				if (name) add("default", name, kind);
				continue;
			}

			// `export default Button` — resolve the local binding.
			const expr = unwrapExpression(d as Expression);
			if (expr.type === "Identifier") {
				const local = (expr as { name: string }).name;
				const kind = bindings.get(local);
				if (kind) {
					const name = isComponentName(local)
						? local
						: inferNameFromFilename(filename);
					if (name) add("default", name, kind);
				}
				continue;
			}

			// `export default memo(() => …)` — anonymous; name it after the file.
			const kind = detectExpressionKind(expr);
			if (kind) {
				const name = inferNameFromFilename(filename);
				if (name) add("default", name, kind);
			}
		}
	}

	return out;
}

/** Turn detections into indexed items. §12 groups by directory downstream. */
export function toInventoryItems(
	detected: DetectedComponent[],
	path: string,
	globPath: string,
): InventoryItem[] {
	return detected.map((d) => ({
		path,
		globPath,
		name: d.name,
		exportName: d.exportName,
		kind: d.kind,
	}));
}

/* ------------------------------------------------------------------ *
 * Shape detection — §12 step 2
 * ------------------------------------------------------------------ */

function collectBindings(program: Program): Map<string, InventoryKind> {
	const bindings = new Map<string, InventoryKind>();
	for (const stmt of program.body) {
		const decl =
			stmt.type === "ExportNamedDeclaration" ? stmt.declaration : (stmt as Declaration);
		if (!decl || typeof (decl as { type?: string }).type !== "string") continue;
		for (const [name, kind] of declarationBindings(decl)) {
			if (kind) bindings.set(name, kind);
		}
	}
	return bindings;
}

/** `[name, kind]` for every binding a declaration introduces. */
function declarationBindings(
	decl: Declaration,
): Array<[string, InventoryKind | null]> {
	switch (decl.type) {
		case "VariableDeclaration": {
			const out: Array<[string, InventoryKind | null]> = [];
			for (const d of (decl as VariableDeclaration).declarations) {
				if (d.id.type !== "Identifier") continue;
				const name = (d.id as { name: string }).name;
				out.push([name, d.init ? detectExpressionKind(unwrapExpression(d.init)) : null]);
			}
			return out;
		}
		case "FunctionDeclaration":
		case "TSDeclareFunction": {
			const id = (decl as OxcFunction).id;
			return id ? [[id.name, "function"]] : [];
		}
		case "ClassDeclaration": {
			const cls = decl as Class;
			if (!cls.id) return [];
			return [[cls.id.name, extendsReactComponent(cls) ? "class" : null]];
		}
		default:
			return [];
	}
}

function detectExpressionKind(expr: Expression): InventoryKind | null {
	switch (expr.type) {
		case "ArrowFunctionExpression":
		case "FunctionExpression":
			return "function";
		case "ClassExpression":
			return extendsReactComponent(expr as unknown as Class) ? "class" : null;
		case "CallExpression": {
			// The outermost wrapper wins: `memo(forwardRef(…))` is a memo.
			const callee = calleeName(expr as unknown as { callee: Expression });
			if (callee === "memo") return "memo";
			if (callee === "forwardRef") return "forwardRef";
			return null;
		}
		default:
			return null;
	}
}

/** `memo`, `React.memo`, `react.forwardRef` → the trailing identifier. */
function calleeName(call: { callee: Expression }): string | null {
	const callee = unwrapExpression(call.callee);
	if (callee.type === "Identifier") return (callee as { name: string }).name;
	if (callee.type === "MemberExpression") {
		const member = callee as unknown as { computed: boolean; property: Expression };
		if (member.computed) return null;
		return readStaticKeyName(member.property);
	}
	return null;
}

function extendsReactComponent(cls: Class): boolean {
	if (!cls.superClass) return false;
	const superClass = unwrapExpression(cls.superClass);
	if (superClass.type === "Identifier") {
		return REACT_CLASS_BASES.has((superClass as { name: string }).name);
	}
	if (superClass.type === "MemberExpression") {
		const member = superClass as unknown as {
			computed: boolean;
			property: Expression;
		};
		if (member.computed) return false;
		const prop = readStaticKeyName(member.property);
		return prop !== null && REACT_CLASS_BASES.has(prop);
	}
	return false;
}

/* ------------------------------------------------------------------ *
 * Naming
 * ------------------------------------------------------------------ */

/**
 * `src/components/base-button.tsx` → `BaseButton`; an `index` file takes its
 * directory's name. Returns `null` when nothing usable can be derived, which
 * drops the anonymous default export rather than listing a component with a
 * meaningless label.
 */
export function inferNameFromFilename(filename: string): string | null {
	const parts = filename.split(/[\\/]/).filter(Boolean);
	let base = parts.at(-1) ?? "";
	base = base.replace(/\.[^.]+$/, "");
	if (/^index$/i.test(base)) base = parts.at(-2) ?? "";
	const pascal = base
		.split(/[-_.\s]+/)
		.filter(Boolean)
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join("");
	return pascal && isComponentName(pascal) ? pascal : null;
}
