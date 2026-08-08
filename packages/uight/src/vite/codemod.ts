/**
 * CSF → fixture codemod: `uight codemod`.
 *
 * §13 makes CSF readable in place, so nobody *has* to run this — it exists for
 * the team that has decided to stay, and wants its corpus in the plain-JSX
 * fixture form rather than carrying `storybook: true` forever.
 *
 * The rule is: convert a file completely or not at all. A story's `args` are
 * spliced into JSX **as the text they were written as** (offsets from the
 * parse, not a re-serialization), so any expression that was valid in `args`
 * is valid in the fixture and no value is ever re-invented. Anything this
 * cannot represent — `render`, `play`, `decorators`, a computed key, a spread
 * — skips the whole file with the reason named, because a half-converted
 * story file is two sources of truth for the same states.
 *
 * The original `.stories.*` file is left in place: the fixture is written
 * beside it and deleting the story is the user's commit, after `/uight`
 * shows both and they agree.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import { parseSync } from "oxc-parser";
import type { ResolvedUightConfig } from "./config.ts";
import { toGlobPath } from "./config.ts";
import { storybookPatterns } from "./scan.ts";
import { glob } from "tinyglobby";

/** Meta keys the conversion understands; everything else skips the file. */
const META_KEYS = new Set(["title", "component", "args", "tags"]);

/** Story keys the conversion understands; everything else skips the file. */
const STORY_KEYS = new Set(["args", "name", "tags"]);

export interface CodemodFileResult {
	/** Root-relative source path. */
	path: string;
	/** Root-relative fixture path this would write. Absent when skipped. */
	fixturePath?: string;
	action: "convert" | "skip";
	/** Why the file was skipped; empty when converted. */
	reasons: string[];
	/** Story exports found, converted or not. */
	stories: string[];
	/** The fixture module. Absent when skipped. */
	contents?: string;
}

export interface CodemodResult {
	root: string;
	files: number;
	converted: number;
	skipped: number;
	details: CodemodFileResult[];
	dryRun: boolean;
}

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
	return (
		typeof value === "object" && value !== null && typeof (value as Node).type === "string"
	);
}

function unwrap(node: unknown): unknown {
	let current = node;
	for (let guard = 0; guard < 16 && isNode(current); guard++) {
		if (
			current.type === "TSAsExpression" ||
			current.type === "TSSatisfiesExpression" ||
			current.type === "ParenthesizedExpression"
		) {
			current = current.expression;
			continue;
		}
		return current;
	}
	return current;
}

function staticKey(key: unknown): string | null {
	if (!isNode(key)) return null;
	if (key.type === "Identifier" && typeof key.name === "string") return key.name;
	if (key.type === "Literal" && typeof key.value === "string") return key.value;
	return null;
}

/** The text a node was written as. The only way values move — never rebuilt. */
function textOf(source: string, node: Node): string {
	return source.slice(Number(node.start), Number(node.end));
}

interface Arg {
	name: string;
	/** Verbatim source text of the value. */
	text: string;
	/** Set when the value is a plain string literal, for `attr="…"` form. */
	string?: string;
	/** Set when the value is the literal `true`, for the bare-attribute form. */
	isTrue: boolean;
}

/** `{ a: 1, b }` → Args, or a reason string when anything is not static. */
function readArgs(source: string, node: unknown, where: string): Arg[] | string {
	const value = unwrap(node);
	if (!isNode(value) || value.type !== "ObjectExpression") {
		return `${where} is not an object literal`;
	}
	const out: Arg[] = [];
	for (const property of (value.properties ?? []) as unknown[]) {
		if (!isNode(property) || property.type !== "Property") {
			return `${where} contains a spread`;
		}
		if (property.computed === true) return `${where} has a computed key`;
		const name = staticKey(property.key);
		if (name === null) return `${where} has a non-static key`;
		const propValue = unwrap(property.value);
		if (!isNode(propValue)) return `${where}.${name} is unreadable`;
		out.push({
			name,
			text: textOf(source, propValue),
			...(propValue.type === "Literal" && typeof propValue.value === "string"
				? { string: String(propValue.value) }
				: {}),
			isTrue: propValue.type === "Literal" && propValue.value === true,
		});
	}
	return out;
}

/** Story args override meta args, by name, keeping meta's order first. */
function mergeArgs(meta: Arg[], story: Arg[]): Arg[] {
	const overridden = new Set(story.map((arg) => arg.name));
	return [...meta.filter((arg) => !overridden.has(arg.name)), ...story];
}

const JSX_ATTRIBUTE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** One story as JSX, or a reason it cannot be. */
function toJsx(component: string, args: Arg[]): { jsx: string } | { reason: string } {
	const attributes: string[] = [];
	let children: string | null = null;
	for (const arg of args) {
		if (arg.name === "children") {
			// A plain string that JSX text can carry verbatim stays text; anything
			// else — an expression, or a string needing escapes — rides in braces.
			children =
				arg.string !== undefined && !/[{}<>\n]/.test(arg.string)
					? arg.string
					: `{${arg.text}}`;
			continue;
		}
		if (!JSX_ATTRIBUTE.test(arg.name)) {
			return { reason: `args key "${arg.name}" is not a valid JSX attribute` };
		}
		if (arg.isTrue) {
			attributes.push(arg.name);
		} else if (arg.string !== undefined && !arg.string.includes('"')) {
			attributes.push(`${arg.name}="${arg.string}"`);
		} else {
			attributes.push(`${arg.name}={${arg.text}}`);
		}
	}
	const open = [component, ...attributes].join(" ");
	return {
		jsx: children === null ? `<${open} />` : `<${open}>${children}</${component}>`,
	};
}

/** Local bindings the kept imports introduce. */
function importedNames(imports: Node[]): Set<string> {
	const names = new Set<string>();
	for (const declaration of imports) {
		for (const specifier of (declaration.specifiers ?? []) as unknown[]) {
			if (!isNode(specifier)) continue;
			const local = specifier.local;
			if (isNode(local) && typeof local.name === "string") names.add(local.name);
		}
	}
	return names;
}

interface Conversion {
	contents: string;
	stories: string[];
}

/**
 * Convert one CSF module, or say exactly why not. All-or-nothing by design.
 */
export function convertCsf(
	source: string,
	filename: string,
): { conversion?: Conversion; reasons: string[]; stories: string[] } {
	let program: Node;
	try {
		const result = parseSync(filename, source, { showSemanticErrors: false });
		if (result.errors.some((e) => e.severity === "Error")) {
			return { reasons: ["the file does not parse"], stories: [] };
		}
		program = result.program as unknown as Node;
	} catch {
		return { reasons: ["the file does not parse"], stories: [] };
	}

	const reasons: string[] = [];
	const keptImports: Node[] = [];
	let meta: Node | null = null;
	const storyNodes: Array<{ name: string; value: Node }> = [];
	const storyNames: string[] = [];

	/* Top-level `const x = {…}`, so `export default meta` resolves — the shape
	   `const meta = {…} satisfies Meta<…>; export default meta;` is the one the
	   Storybook docs teach. */
	const topLevelObjects = new Map<string, Node>();
	for (const statement of (program.body ?? []) as unknown[]) {
		const declaration =
			isNode(statement) && statement.type === "VariableDeclaration"
				? statement
				: isNode(statement) &&
					  statement.type === "ExportNamedDeclaration" &&
					  isNode(statement.declaration) &&
					  statement.declaration.type === "VariableDeclaration"
					? statement.declaration
					: null;
		if (!declaration) continue;
		for (const declarator of (declaration.declarations ?? []) as unknown[]) {
			if (!isNode(declarator)) continue;
			const id = declarator.id;
			const value = unwrap(declarator.init);
			if (
				isNode(id) &&
				id.type === "Identifier" &&
				isNode(value) &&
				value.type === "ObjectExpression"
			) {
				topLevelObjects.set(String(id.name), value);
			}
		}
	}

	for (const statement of (program.body ?? []) as unknown[]) {
		if (!isNode(statement)) continue;
		if (statement.type === "ImportDeclaration") {
			const from = (statement.source as Node | undefined)?.value;
			const isStorybook =
				typeof from === "string" && /^(@storybook\/|storybook(\/|$))/.test(from);
			// A type-only Storybook import (`Meta`, `StoryObj`) vanishes with the
			// format; a value import from Storybook means code this cannot carry.
			if (isStorybook && statement.importKind !== "type") {
				reasons.push(`imports code from ${String(from)}`);
			}
			if (!isStorybook) keptImports.push(statement);
			continue;
		}
		if (statement.type === "ExportDefaultDeclaration") {
			let value = unwrap(statement.declaration);
			if (isNode(value) && value.type === "Identifier") {
				value = topLevelObjects.get(String(value.name)) ?? value;
			}
			if (isNode(value) && value.type === "ObjectExpression") meta = value;
			else reasons.push("the default export is not an object literal");
			continue;
		}
		if (statement.type === "ExportNamedDeclaration" && statement.exportKind !== "type") {
			const declaration = statement.declaration;
			if (!isNode(declaration) || declaration.type !== "VariableDeclaration") continue;
			for (const declarator of (declaration.declarations ?? []) as unknown[]) {
				if (!isNode(declarator)) continue;
				const id = declarator.id;
				if (!isNode(id) || id.type !== "Identifier") continue;
				const name = String(id.name);
				if (name === "__namedExportsOrder") continue;
				storyNames.push(name);
				const value = unwrap(declarator.init);
				if (isNode(value) && value.type === "ObjectExpression") {
					storyNodes.push({ name, value });
				} else {
					reasons.push(`${name} is not an object literal`);
				}
			}
		}
	}

	if (!meta) {
		if (!reasons.length) reasons.push("no default export");
		return { reasons, stories: storyNames };
	}

	/* The meta: component is required, and nothing unconvertible may ride along. */
	let component: string | null = null;
	let metaArgs: Arg[] = [];
	for (const property of (meta.properties ?? []) as unknown[]) {
		if (!isNode(property) || property.type !== "Property") {
			reasons.push("the meta contains a spread");
			continue;
		}
		const key = staticKey(property.key);
		if (key === null || !META_KEYS.has(key)) {
			reasons.push(`meta.${key ?? "<computed>"}`);
			continue;
		}
		if (key === "component") {
			const value = unwrap(property.value);
			if (isNode(value) && value.type === "Identifier") component = String(value.name);
			else reasons.push("meta.component is not a plain identifier");
		}
		if (key === "args") {
			const read = readArgs(source, property.value, "meta.args");
			if (typeof read === "string") reasons.push(read);
			else metaArgs = read;
		}
	}
	if (!component) {
		reasons.push("the meta names no component");
		return { reasons: [...new Set(reasons)], stories: storyNames };
	}
	if (!importedNames(keptImports).has(component)) {
		reasons.push(`${component} is not imported — it may be declared in this file`);
	}

	/* The stories. */
	const fixtures: Array<{ key: string; jsx: string }> = [];
	for (const story of storyNodes) {
		let args: Arg[] = [];
		let displayName: string | null = null;
		for (const property of (story.value.properties ?? []) as unknown[]) {
			if (!isNode(property) || property.type !== "Property") {
				reasons.push(`${story.name} contains a spread`);
				continue;
			}
			const key = staticKey(property.key);
			if (key === null || !STORY_KEYS.has(key)) {
				reasons.push(`${story.name}.${key ?? "<computed>"}`);
				continue;
			}
			if (key === "args") {
				const read = readArgs(source, property.value, `${story.name}.args`);
				if (typeof read === "string") reasons.push(read);
				else args = read;
			}
			if (key === "name") {
				const value = unwrap(property.value);
				if (isNode(value) && value.type === "Literal" && typeof value.value === "string") {
					displayName = value.value;
				}
			}
		}
		const rendered = toJsx(component, mergeArgs(metaArgs, args));
		if ("reason" in rendered) {
			reasons.push(rendered.reason);
			continue;
		}
		const key = displayName ?? story.name;
		fixtures.push({
			key: IDENTIFIER.test(key) ? key : JSON.stringify(key),
			jsx: rendered.jsx,
		});
	}

	if (reasons.length) return { reasons: [...new Set(reasons)], stories: storyNames };
	if (!fixtures.length) return { reasons: ["no stories to convert"], stories: storyNames };

	const imports = keptImports.map((node) => textOf(source, node)).join("\n");
	const body = fixtures.map((f) => `\t${f.key}: ${f.jsx},`).join("\n");
	return {
		conversion: {
			contents: `${imports ? `${imports}\n\n` : ""}export default {\n${body}\n};\n`,
			stories: storyNames,
		},
		reasons: [],
		stories: storyNames,
	};
}

export interface CodemodOptions {
	/** Compute every change and write none. */
	dryRun?: boolean;
}

/**
 * Run the codemod over every CSF module the config would pick up.
 *
 * Exported from `@aussieljk/uight/vite` like the reports are — the CLI is one
 * caller, not the only one.
 */
export async function csfCodemod(
	cfg: ResolvedUightConfig,
	options: CodemodOptions = {},
): Promise<CodemodResult> {
	const dryRun = options.dryRun === true;
	const patterns = storybookPatterns(cfg);
	const details: CodemodFileResult[] = [];

	const matched = patterns.length
		? await glob(patterns, {
				cwd: cfg.fixturesDirFsPath,
				absolute: true,
				dot: false,
				expandDirectories: false,
				extglob: false,
				caseSensitiveMatch: cfg.caseSensitive,
				ignore: ["**/node_modules/**", ...cfg.exclude],
			})
		: [];

	const storySuffix = cfg.storybook ? cfg.storybook.fileSuffix : "stories";
	for (const file of matched.sort()) {
		const globPath = toGlobPath(cfg.root, file);
		const relative = globPath.replace(/^\//, "");
		let source: string;
		try {
			source = await fsp.readFile(file, "utf8");
		} catch {
			details.push({
				path: relative,
				action: "skip",
				reasons: ["unreadable"],
				stories: [],
			});
			continue;
		}

		const result = convertCsf(source, file);
		if (!result.conversion) {
			details.push({
				path: relative,
				action: "skip",
				reasons: result.reasons,
				stories: result.stories,
			});
			continue;
		}

		const fixtureFile = file.replace(
			new RegExp(`\\.${storySuffix}(\\.[^./]+)$`),
			`.${cfg.fixtureFileSuffix}$1`,
		);
		const fixturePath = toGlobPath(cfg.root, fixtureFile).replace(/^\//, "");
		if (fixtureFile === file || fs.existsSync(fixtureFile)) {
			details.push({
				path: relative,
				action: "skip",
				reasons: [
					fixtureFile === file
						? "could not derive a fixture filename"
						: `${fixturePath} already exists`,
				],
				stories: result.stories,
			});
			continue;
		}

		if (!dryRun) await fsp.writeFile(fixtureFile, result.conversion.contents, "utf8");
		details.push({
			path: relative,
			fixturePath,
			action: "convert",
			reasons: [],
			stories: result.stories,
			contents: result.conversion.contents,
		});
	}

	const converted = details.filter((d) => d.action === "convert").length;
	return {
		root: cfg.root,
		files: details.length,
		converted,
		skipped: details.length - converted,
		details,
		dryRun,
	};
}

/** The human-readable transcript the CLI prints. */
export function formatCodemod(result: CodemodResult): string {
	const lines: string[] = [];
	lines.push(
		`${result.files} CSF file(s) — ${result.converted} converted, ${result.skipped} skipped`,
	);
	lines.push("");
	for (const detail of result.details) {
		if (detail.action === "convert") {
			const mark = result.dryRun ? "→" : "✓";
			lines.push(`  ${mark} ${detail.path} → ${detail.fixturePath}`);
		} else {
			lines.push(`  · ${detail.path}  ${detail.reasons.join("; ")}`);
		}
	}
	lines.push("");
	if (result.dryRun) {
		lines.push("Nothing was written. Re-run without --dry-run.");
	} else if (result.converted > 0) {
		lines.push(
			"The .stories files were left in place. Check /uight, then delete them " +
				"in their own commit.",
		);
	}
	return lines.join("\n");
}
