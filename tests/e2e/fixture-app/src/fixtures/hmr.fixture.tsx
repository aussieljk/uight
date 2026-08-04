/**
 * The HMR target. `tests/e2e/support/edit.ts` rewrites the marker string in
 * this file and the suite waits for the frame to show the new text — that is
 * the §20.3 "HMR latency, fixture edit to render" measurement, and the §20.2
 * "HMR of a fixture" scenario.
 *
 * Keep this file boring: no imports beyond React, so a reload of it cannot be
 * confused with a reload of something it depends on.
 */

export default {
	Marker: <p data-e2e="hmr-marker">HMR_MARKER_V0</p>,
};
