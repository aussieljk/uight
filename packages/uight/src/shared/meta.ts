/**
 * Fixture metadata resolution — SPEC.md §3.1.
 *
 * `fileMeta` is file-level, `fixtureMeta` is keyed by fixture name, and the
 * viewport lives inside either. One rule decides which wins, in one place,
 * because three consumers ask the question: the tree (labels and order), the
 * preview (the viewport it opens at) and the renderer (layout).
 *
 * A single-fixture file is keyed by `DEFAULT_FIXTURE`, and the whole-file
 * `ALL_FIXTURES` selection has no per-fixture meta by construction — it is not
 * one fixture.
 */

import { ALL_FIXTURES, DEFAULT_FIXTURE } from "./types.ts";
import type { FixtureFileIndex, FixtureMeta, Viewport } from "./types.ts";

/** The key `fixtureMeta` uses for a `FixtureId.name`. */
export function fixtureMetaKey(name: string | null): string {
	return name === null ? DEFAULT_FIXTURE : name;
}

export function fixtureMetaFor(
	file: Pick<FixtureFileIndex, "fixtureMeta">,
	name: string | null,
): FixtureMeta | undefined {
	if (name === ALL_FIXTURES) return undefined;
	return file.fixtureMeta?.[fixtureMetaKey(name)];
}

/**
 * The viewport a fixture should open at: its own, else the file's, else none —
 * and "none" means Fit, which is what the preview already does.
 */
export function viewportFor(
	file: Pick<FixtureFileIndex, "fileMeta" | "fixtureMeta">,
	name: string | null,
): Viewport | undefined {
	return fixtureMetaFor(file, name)?.viewport ?? file.fileMeta?.viewport;
}
