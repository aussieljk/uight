/**
 * Decorator scope and composition — SPEC.md §3.3.
 *
 * Contract: props are `{ children }` only; scope is every fixture at or below
 * the decorator's directory; composition is **outermost-first by directory
 * depth**, so a root decorator wraps a nested one. A throwing decorator is
 * reported as a decorator error naming its file (see error-boundary.tsx), not
 * as a fixture error.
 *
 * JSX is deliberately absent so this file stays `.ts`; the boundaries are
 * interleaved with `createElement`.
 */

import * as React from "react";
import type { DecoratorFileIndex } from "../shared/types.ts";
import type { RendererError } from "../shared/types.ts";
import { RendererErrorBoundary } from "./error-boundary.tsx";

export type DecoratorComponent = React.ComponentType<{ children: React.ReactNode }>;

export interface LoadedDecorator {
	file: DecoratorFileIndex;
	Component: DecoratorComponent;
}

/** `dir` is relative to the fixtures dir, as is a fixture's display path. */
function normalizeDir(dir: string): string {
	const trimmed = dir.replace(/^[./]+/, "").replace(/\/+$/, "");
	return trimmed === "." ? "" : trimmed;
}

/**
 * The decorators that apply to `fixturePath`, outermost first.
 *
 * Sorting by depth is what makes a root decorator the outer wrapper. Ties are
 * broken by directory name so composition order is stable across platforms —
 * glob order is not.
 */
export function selectDecorators(
	decorators: readonly DecoratorFileIndex[],
	fixturePath: string,
): DecoratorFileIndex[] {
	return decorators
		.filter((decorator) => {
			const dir = normalizeDir(decorator.dir);
			if (dir === "") return true;
			return fixturePath === dir || fixturePath.startsWith(`${dir}/`);
		})
		.slice()
		.sort((a, b) => {
			const depth = (a.depth ?? normalizeDir(a.dir).split("/").length) -
				(b.depth ?? normalizeDir(b.dir).split("/").length);
			if (depth !== 0) return depth;
			return a.globPath.localeCompare(b.globPath);
		});
}

/** Loads a decorator module and validates its default export. */
export async function loadDecorator(
	file: DecoratorFileIndex,
	load: () => Promise<unknown>,
): Promise<LoadedDecorator> {
	const module = (await load()) as { default?: unknown };
	const Component = module?.default;
	if (typeof Component !== "function" && typeof Component !== "object") {
		throw new Error(
			`decorator ${file.globPath} must default-export a component receiving { children }`,
		);
	}
	return { file, Component: Component as DecoratorComponent };
}

export async function loadDecorators(
	files: readonly DecoratorFileIndex[],
	modules: Record<string, () => Promise<unknown>>,
): Promise<LoadedDecorator[]> {
	const loaded: LoadedDecorator[] = [];
	for (const file of files) {
		const load = modules[file.globPath];
		if (!load) continue;
		loaded.push(await loadDecorator(file, load));
	}
	return loaded;
}

/**
 * Wrap `children` in `decorators`, outermost first, each behind its own
 * boundary so an error can be attributed to the file that produced it.
 */
export function composeDecorators(
	children: React.ReactNode,
	decorators: readonly LoadedDecorator[],
	options: {
		onError?: (error: RendererError) => void;
		resetKey?: string;
	} = {},
): React.ReactNode {
	let node = children;
	// Innermost first when building, so index 0 ends up outermost.
	for (let index = decorators.length - 1; index >= 0; index--) {
		const decorator = decorators[index]!;
		node = React.createElement(RendererErrorBoundary, {
			key: decorator.file.globPath,
			kind: "decorator",
			file: decorator.file.globPath,
			onError: options.onError,
			resetKey: options.resetKey,
			children: React.createElement(decorator.Component, { children: node }),
		});
	}
	return node;
}
