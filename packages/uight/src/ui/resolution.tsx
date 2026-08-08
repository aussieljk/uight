/**
 * Chrome options (§5.1) and selection resolution (§3.5, §5.4).
 *
 * `resolve` is the single place that answers "given this selection and this
 * index, what does the renderer render and what does the user get told". It is
 * pure and total: every branch returns a `Resolution`, and the two failure
 * shapes — unknown path, unknown name — both PRESERVE the selection, because a
 * link that is wrong today may be right after the next HMR or deploy.
 */

import type { ReactNode } from "react";
import { ALL_FIXTURES } from "../shared/types.ts";
import type { FixtureFileIndex, FixtureId, UightProps } from "../shared/types.ts";

/* ------------------------------------------------------------------ *
 * Chrome options — §5.1
 * ------------------------------------------------------------------ */

export interface ResolvedChrome {
	tree: boolean;
	toolbar: boolean;
	controls: boolean;
	viewport: boolean;
	search: boolean;
}

export function resolveChrome(chrome: UightProps["chrome"]): ResolvedChrome {
	if (chrome === false) {
		return { tree: false, toolbar: false, controls: false, viewport: false, search: false };
	}
	if (chrome === true || chrome === undefined) {
		return { tree: true, toolbar: true, controls: true, viewport: true, search: true };
	}
	return {
		tree: chrome.tree ?? true,
		toolbar: chrome.toolbar ?? true,
		controls: chrome.controls ?? true,
		viewport: chrome.viewport ?? true,
		search: chrome.search ?? true,
	};
}

/* ------------------------------------------------------------------ *
 * Selection resolution — §3.5, §5.4
 * ------------------------------------------------------------------ */

export interface Resolution {
	/** What the renderer is asked to render. */
	target: FixtureId | null;
	/** §3.5 — the file node stays selected; say what is actually on screen. */
	note: string | null;
	empty: { title: string; description?: ReactNode } | null;
	/** An undecidable file whose module has to be loaded before we can resolve. */
	pendingFile: FixtureFileIndex | null;
}

export function resolve(
	selection: FixtureId | null,
	files: readonly FixtureFileIndex[],
): Resolution {
	const base: Resolution = { target: null, note: null, empty: null, pendingFile: null };

	if (!selection) {
		return {
			...base,
			empty: {
				title: "Nothing selected",
				description: "Pick a fixture from the list, or press / to search.",
			},
		};
	}

	const file = files.find((f) => f.path === selection.path);
	if (!file) {
		// §5.4 — well-formed but unknown: the parameter is PRESERVED, because it
		// may become valid after HMR or a deploy.
		return {
			...base,
			empty: {
				title: "That fixture is not here",
				description: (
					<>
						Nothing in this project resolves to <code>{selection.path}</code>. The link is kept,
						so it will start working if the file appears.
					</>
				),
			},
		};
	}

	if (file.names === null) return { ...base, pendingFile: file };

	// Every fixture in the file, as one page. Not a name in the index by
	// construction, so it has to be admitted before the membership check.
	if (selection.name === ALL_FIXTURES) {
		return file.names.length > 0
			? { ...base, target: selection }
			: {
					...base,
					empty: { title: "This file has no fixtures", description: selection.path },
				};
	}

	if (selection.name === null) {
		const first = file.names[0] ?? null;
		// `[null]` — the default export is the fixture, so the selection is exact.
		if (first === null) return { ...base, target: selection };

		// §3.5 — do NOT auto-select a child. Render the first one and say so.
		return {
			...base,
			target: { path: selection.path, name: first },
			note: `Showing "${first === "" ? "(empty name)" : first}" — the first fixture in this file. Pick one to link to it.`,
		};
	}

	if (file.names.includes(selection.name)) return { ...base, target: selection };

	return {
		...base,
		empty: {
			title: "That fixture name is not in this file",
			description: (
				<>
					<code>{selection.path}</code> has no fixture called{" "}
					<code>{selection.name === "" ? "(empty name)" : selection.name}</code>. The link is
					kept in case it comes back.
				</>
			),
		},
	};
}
