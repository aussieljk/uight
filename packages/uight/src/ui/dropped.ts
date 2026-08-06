/**
 * Naming the settings a re-render threw away. SPEC.md §7.3.
 *
 * The count was always right and never useful: "6 settings no longer apply"
 * tells the user something broke and gives them nothing to look at. The
 * protocol now carries the paths, so the panel can say which — and the only
 * thing standing between the two is this formatter, which is a pure function so
 * the phrasing can be tested without a renderer.
 *
 * A patch at the root of an input names the input; a patch below it names the
 * path from the input, because `label.text` and `label` are different losses
 * and a user who tuned one of them needs to be told which one went.
 */

import type { DroppedPatchReport, PathSegment } from "../shared/types.ts";

/** How many are named before the tail becomes "and N more". */
const NAMED = 2;

/** `input`, or `input.label.text` — the setting as the user would point at it. */
export function droppedLabel(input: string, path: readonly PathSegment[]): string {
	return path.length === 0 ? input : `${input}.${path.join(".")}`;
}

/**
 * Every dropped setting, newest input first, deduplicated. Order follows
 * `droppedInputs`, which the store keeps newest-first, so the thing that just
 * went is the thing that gets named.
 */
export function droppedLabels(reports: readonly DroppedPatchReport[]): string[] {
	const seen = new Set<string>();
	const labels: string[] = [];
	for (const report of reports) {
		for (const path of report.paths) {
			const label = droppedLabel(report.input, path);
			if (seen.has(label)) continue;
			seen.add(label);
			labels.push(label);
		}
	}
	return labels;
}

/**
 * The sentence, minus the setting names themselves — those are rendered as
 * `<code>` so they read as identifiers rather than prose, which is why this
 * returns the parts rather than a finished string.
 *
 * `total` is passed separately because `ControlPanelProps.droppedPatches` is
 * the authority on the count: a report the panel has not been given (an older
 * host, a replaced store) must not silently reduce the number.
 */
export interface DroppedSummary {
	/** The settings to name, in order. Empty when there is nothing to say. */
	named: string[];
	/** How many more there are beyond `named`. */
	more: number;
	/** "no longer applies" / "no longer apply", agreeing with the whole list. */
	verb: string;
}

export function summarizeDropped(
	reports: readonly DroppedPatchReport[],
	total: number,
): DroppedSummary {
	const labels = droppedLabels(reports);
	const count = Math.max(total, labels.length);
	const named = labels.slice(0, NAMED);
	return {
		named,
		more: Math.max(0, count - named.length),
		verb: count === 1 ? "no longer applies" : "no longer apply",
	};
}
