/**
 * Viewport — §6.5, §3.1.
 *
 * Two sources, and the rule between them is stickiness.
 *
 * `undefined` means the user has not chosen: the fixture's own `fileMeta` /
 * `fixtureMeta` viewport applies (§3.1), and when it has none that is Fit,
 * which is what the preview did before. `null` and a preset are both *choices*
 * — including choosing Fit — and a choice survives changing fixture, because
 * the whole reason to pin 375px is to walk a list of components at 375px.
 * Resetting to Fit on every selection made the control useless for the one job
 * it exists to do.
 *
 * The meta rides on the index rather than arriving as a message precisely so
 * this is known before the first paint: under `index: "static"` no module is
 * executed, and a viewport applied after the preview opened would be a resize
 * the user watches happen.
 */

import { useCallback, useMemo, useState } from "react";
import { viewportFor } from "../shared/meta.ts";
import type { FixtureFileIndex, FixtureId, ViewportPreset } from "../shared/types.ts";
import { VIEWPORT_PRESETS } from "./constants.ts";

export interface Viewport {
	/** What the toolbar shows as pressed, before chrome/isolation gating. */
	viewport: ViewportPreset | null;
	setViewport: (next: ViewportPreset | null) => void;
}

export function useViewport(
	target: FixtureId | null,
	selection: FixtureId | null,
	files: readonly FixtureFileIndex[],
): Viewport {
	const [manualViewport, setManualViewport] = useState<ViewportPreset | null | undefined>(
		undefined,
	);

	const fixtureViewport = useMemo<ViewportPreset | null>(() => {
		const id = target ?? selection;
		if (!id) return null;
		const file = files.find((f) => f.path === id.path);
		const wanted = file ? viewportFor(file, id.name) : undefined;
		if (!wanted) return null;
		// Name it after the preset it matches, so the toolbar shows the row as
		// pressed rather than showing nothing pressed at a preset's dimensions.
		const preset = VIEWPORT_PRESETS.find(
			(p) => p.width === wanted.width && p.height === wanted.height,
		);
		return preset ?? { name: "Fixture", width: wanted.width, height: wanted.height };
	}, [target, selection, files]);

	const setViewport = useCallback((next: ViewportPreset | null) => {
		setManualViewport(next);
	}, []);

	return {
		viewport: manualViewport === undefined ? fixtureViewport : manualViewport,
		setViewport,
	};
}
