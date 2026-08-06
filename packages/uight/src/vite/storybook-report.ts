/**
 * Storybook compatibility report — what will not survive the move.
 *
 * §13's position is that "a story that appears to work while silently skipping
 * its interaction logic is worse than one that says it cannot run here". The
 * badge does that per story, at render time. This does it for a whole
 * repository, before anyone commits to the move — which is the question a team
 * evaluating uight actually asks: *how much of our corpus works?*
 *
 * Syntax only, like every other scan we run: nothing is imported, nothing is
 * executed. That makes it cheap enough to run in CI and safe to point at a
 * repository you have never opened.
 */

import fsp from "node:fs/promises";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { glob } from "tinyglobby";
import type { ResolvedUightConfig } from "./config.ts";
import { toGlobPath } from "./config.ts";
import { displayPathOf, storybookPatterns } from "./scan.ts";

/** Features §13 declines. `parameters.*` is reported by key. */
const DECLINED = new Set(["play", "loaders", "globals"]);

/** Parameters we do honour at the highest declared level (§13). */
const HONOURED_PARAMETERS = new Set(["viewport", "layout"]);

export interface StorybookFileReport {
	path: string;
	globPath: string;
	/** Named exports that look like stories. */
	stories: number;
	/** Feature → how many places in this file use it. */
	unsupported: Record<string, number>;
}

export interface StorybookReport {
	files: number;
	stories: number;
	/** Files with nothing unsupported in them. */
	clean: number;
	/** The `.storybook/preview` module in play, as a root-relative path. */
	preview: string | null;
	/** Totals across the corpus, most common first. */
	unsupported: Record<string, number>;
	details: StorybookFileReport[];
}

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
	return (
		typeof value === "object" && value !== null && typeof (value as Node).type === "string"
	);
}

function staticKey(key: unknown): string | null {
	if (!isNode(key)) return null;
	if (key.type === "Identifier" && typeof key.name === "string") return key.name;
	if (key.type === "Literal" && typeof key.value === "string") return key.value;
	return null;
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

/** Top-level object literals a CSF module exports: the meta and each story. */
function exportedObjects(program: Node): Node[] {
	const out: Node[] = [];
	for (const statement of (program.body ?? []) as unknown[]) {
		if (!isNode(statement)) continue;

		if (statement.type === "ExportDefaultDeclaration") {
			const value = unwrap(statement.declaration);
			if (isNode(value) && value.type === "ObjectExpression") out.push(value);
			continue;
		}
		if (statement.type !== "ExportNamedDeclaration") continue;
		const declaration = statement.declaration;
		if (!isNode(declaration) || declaration.type !== "VariableDeclaration") continue;
		for (const declarator of (declaration.declarations ?? []) as unknown[]) {
			if (!isNode(declarator)) continue;
			const value = unwrap(declarator.init);
			if (isNode(value) && value.type === "ObjectExpression") out.push(value);
		}
	}
	return out;
}

function countStories(program: Node): number {
	let count = 0;
	for (const statement of (program.body ?? []) as unknown[]) {
		if (!isNode(statement) || statement.type !== "ExportNamedDeclaration") continue;
		if (statement.exportKind === "type") continue;
		const declaration = statement.declaration;
		if (!isNode(declaration) || declaration.type !== "VariableDeclaration") continue;
		for (const declarator of (declaration.declarations ?? []) as unknown[]) {
			if (!isNode(declarator)) continue;
			const id = declarator.id;
			if (isNode(id) && id.type === "Identifier" && id.name !== "__namedExportsOrder")
				count++;
		}
	}
	return count;
}

function inspect(
	source: string,
	filename: string,
): {
	stories: number;
	unsupported: Record<string, number>;
} {
	const unsupported: Record<string, number> = {};
	const bump = (key: string): void => {
		unsupported[key] = (unsupported[key] ?? 0) + 1;
	};

	let program: Node;
	try {
		const result = parseSync(filename, source, { showSemanticErrors: false });
		if (result.errors.some((e) => e.severity === "Error")) {
			return { stories: 0, unsupported: { "parse error": 1 } };
		}
		program = result.program as unknown as Node;
	} catch {
		return { stories: 0, unsupported: { "parse error": 1 } };
	}

	for (const object of exportedObjects(program)) {
		for (const property of (object.properties ?? []) as unknown[]) {
			if (!isNode(property) || property.type !== "Property") continue;
			const key = staticKey(property.key);
			if (key === null) continue;

			if (DECLINED.has(key)) {
				bump(key);
				continue;
			}
			if (key !== "parameters") continue;

			const parameters = unwrap(property.value);
			if (!isNode(parameters) || parameters.type !== "ObjectExpression") continue;
			for (const entry of (parameters.properties ?? []) as unknown[]) {
				if (!isNode(entry) || entry.type !== "Property") continue;
				const name = staticKey(entry.key);
				if (name === null || HONOURED_PARAMETERS.has(name)) continue;
				bump(`parameters.${name}`);
			}
		}
	}

	return { stories: countStories(program), unsupported };
}

/**
 * Read every CSF module the config would pick up and report what §13 declines.
 *
 * Exported from `@aussieljk/uight/vite` so it can run in CI: a corpus whose unsupported
 * count grows is a corpus drifting away from being portable.
 */
export async function storybookReport(
	cfg: ResolvedUightConfig,
): Promise<StorybookReport> {
	const patterns = storybookPatterns(cfg);
	const empty: StorybookReport = {
		files: 0,
		stories: 0,
		clean: 0,
		preview: cfg.storybookPreview ?? null,
		unsupported: {},
		details: [],
	};
	if (!patterns.length) return empty;

	const matched = await glob(patterns, {
		cwd: cfg.fixturesDirFsPath,
		absolute: true,
		dot: false,
		expandDirectories: false,
		extglob: false,
		caseSensitiveMatch: cfg.caseSensitive,
		ignore: ["**/node_modules/**", ...cfg.exclude],
	});

	const details: StorybookFileReport[] = [];
	const totals: Record<string, number> = {};
	let stories = 0;
	let clean = 0;

	for (const file of matched.sort()) {
		let source: string;
		try {
			source = await fsp.readFile(file, "utf8");
		} catch {
			continue;
		}
		const globPath = toGlobPath(cfg.root, file);
		const result = inspect(source, file);
		stories += result.stories;

		const keys = Object.keys(result.unsupported);
		if (keys.length === 0) clean++;
		for (const key of keys) {
			totals[key] = (totals[key] ?? 0) + (result.unsupported[key] ?? 0);
		}

		details.push({
			path: displayPathOf(
				globPath,
				cfg,
				cfg.storybook ? cfg.storybook.fileSuffix : "stories",
			),
			globPath,
			stories: result.stories,
			unsupported: result.unsupported,
		});
	}

	const sorted: Record<string, number> = {};
	for (const [key, count] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
		sorted[key] = count;
	}

	return {
		files: details.length,
		stories,
		clean,
		preview: cfg.storybookPreview ?? null,
		unsupported: sorted,
		details,
	};
}

/** A short human-readable summary, used by the CLI. */
export function formatStorybookReport(report: StorybookReport): string {
	const lines: string[] = [];
	lines.push(
		`${report.files} CSF files, ${report.stories} stories — ` +
			`${report.clean} files use nothing uight declines`,
	);
	lines.push(
		report.preview
			? `preview: ${report.preview} (global decorators and preview parameters are applied)`
			: "preview: none found — global decorators are not applied",
	);

	const entries = Object.entries(report.unsupported);
	if (!entries.length) {
		lines.push("no unsupported features found");
		return lines.join("\n");
	}

	lines.push("");
	lines.push("declined, by frequency:");
	const width = Math.max(...entries.map(([key]) => key.length));
	for (const [key, count] of entries) {
		lines.push(`  ${key.padEnd(width)}  ${count}`);
	}
	return lines.join("\n");
}

/** Resolve a report against a project directory, for the CLI and CI. */
export function reportPath(cfg: ResolvedUightConfig, file: string): string {
	return path.relative(cfg.root, file);
}
