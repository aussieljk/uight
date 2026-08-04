/**
 * The §20.2 matrix.
 *
 * SPEC §20.2 asks for Chromium, Firefox and WebKit × React 18 and 19 × dev
 * server and production preview × default, non-root and relative base. That is
 * 36 cells, and a 36-cell suite is a suite nobody runs.
 *
 * So the product is decomposed rather than enumerated:
 *
 *   - the **full engine sweep** runs on the default configuration (dev server,
 *     React 19, default base). Engine differences are what §20.2 exists for —
 *     `FrameHost` carries three defences precisely because each covers a
 *     different engine's ordering — so this axis is never sampled;
 *   - the **other axes** get one targeted project each, on Chromium, carrying
 *     only the tests that axis can actually break. A non-root base cannot
 *     change how WebKit orders an about:blank load; it can change whether the
 *     renderer URL resolves, and that is what the `@base` tests assert.
 *
 * `PLAYWRIGHT_FULL_MATRIX=1` expands every axis project across all three
 * engines, giving the literal cartesian product for a release run:
 *
 *     PLAYWRIGHT_FULL_MATRIX=1 tests/e2e/node_modules/.bin/playwright test
 *
 * Run one cell with `--project`, e.g. `--project=webkit` or
 * `--project=chromium-base-nonroot`.
 *
 * Type-only import: this file lives at the repository root, where
 * `@playwright/test` is not resolvable at runtime. Playwright erases types when
 * it loads a config, and the default export of a plain object is as valid as
 * `defineConfig`, which is identity.
 */

import type { PlaywrightTestConfig, Project } from "@playwright/test";

const ENGINES = [
	{ id: "chromium", browserName: "chromium" as const },
	{ id: "firefox", browserName: "firefox" as const },
	{ id: "webkit", browserName: "webkit" as const },
];

const FULL = process.env.PLAYWRIGHT_FULL_MATRIX === "1";

/* ------------------------------------------------------------------ *
 * Ports. Fixed, because every project's baseURL has to name one and a
 * Playwright `webServer` cannot report the port it chose back to a project.
 * ------------------------------------------------------------------ */

export const PORTS = {
	dev: 5271,
	preview: 5272,
	dev18: 5273,
	baseNonRoot: 5274,
	baseRelative: 5275,
	cspNonce: 5276,
	cspNoMeta: 5277,
};

const APP = "tests/e2e/fixture-app";
const APP18 = "tests/e2e/fixture-app-react18";
const VITE = "node_modules/.bin/vite";

/** Tags carried by tests that belong to a specific axis rather than the sweep. */
const AXIS_TAGS = /@prod|@base|@csp|@cspblocked|@perf|@react18/;

function engineProjects(): Project[] {
	return ENGINES.map((engine) => ({
		name: engine.id,
		use: { browserName: engine.browserName, baseURL: `http://localhost:${PORTS.dev}/` },
		grepInvert: AXIS_TAGS,
	}));
}

/** One axis project per engine when FULL, otherwise Chromium only. */
function axis(name: string, baseURL: string, grep: RegExp, extra: Record<string, unknown> = {}): Project[] {
	const engines = FULL ? ENGINES : [ENGINES[0]!];
	return engines.map((engine) => ({
		name: engines.length === 1 ? `chromium-${name}` : `${engine.id}-${name}`,
		use: { browserName: engine.browserName, baseURL, ...extra },
		grep,
	}));
}

const config: PlaywrightTestConfig = {
	testDir: "tests/e2e/specs",
	/* A frame bootstrap plus a Vite dev transform of a cold module graph is
	   genuinely slow on the first hit in WebKit; 60s is the ceiling that keeps a
	   real hang distinguishable from a cold start. */
	timeout: 60_000,
	expect: { timeout: 15_000 },
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	/* One worker, deliberately.
	   `hmr.spec.ts` adds, edits, renames and deletes files in the fixture app
	   while the dev server is running, and every project shares that server.
	   With parallel workers those edits land in the middle of unrelated tests as
	   a frame reload, which reads as flake and trains people to rerun rather
	   than to look. The suite is small enough that determinism is the better
	   trade; `--project=<name>` narrows it when iterating. */
	workers: 1,
	reporter: process.env.CI
		? [["github"], ["html", { open: "never", outputFolder: "tests/e2e/report" }], ["list"]]
		: [["list"]],
	outputDir: "tests/e2e/results",
	use: {
		trace: "retain-on-failure",
		video: "off",
		screenshot: "only-on-failure",
	},

	projects: [
		...engineProjects(),
		...axis("prod", `http://localhost:${PORTS.preview}/`, /@prod/),
		...axis("react18", `http://localhost:${PORTS.dev18}/`, /@react18|@core/),
		...axis("base-nonroot", `http://localhost:${PORTS.baseNonRoot}/explorer/`, /@base/),
		...axis("base-relative", `http://localhost:${PORTS.baseRelative}/nested/deep/`, /@base/),
		...axis("csp", `http://localhost:${PORTS.cspNonce}/`, /@csp\b/),
		...axis("csp-blocked", `http://localhost:${PORTS.cspNoMeta}/`, /@cspblocked/),
		/* The budgets get their own project so `--project=chromium-perf` is one
		   command, and so they never share a worker with a spec that is editing
		   files on disk — a rebuild in the background is a timing artefact. */
		{
			name: "chromium-perf",
			use: { browserName: "chromium", baseURL: `http://localhost:${PORTS.dev}/` },
			grep: /@perf/,
			fullyParallel: false,
			workers: 1,
		},
	],

	webServer: [
		{
			// The default subject: dev server, React 19, default base.
			command: `${VITE} --port ${PORTS.dev} --strictPort`,
			cwd: APP,
			url: `http://localhost:${PORTS.dev}/`,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
		{
			// §9.2: `production: "include"` is the only way a preview server has an
			// explorer at all. The `production: "exclude"` default is asserted by
			// `production-gate.spec.ts`, which runs its own build.
			command: `UAIGHT_E2E_PRODUCTION=include ${VITE} build --outDir dist-include && ${VITE} preview --outDir dist-include --port ${PORTS.preview} --strictPort`,
			cwd: APP,
			url: `http://localhost:${PORTS.preview}/`,
			reuseExistingServer: !process.env.CI,
			timeout: 300_000,
		},
		{
			command: `${VITE} --port ${PORTS.dev18} --strictPort`,
			cwd: APP18,
			url: `http://localhost:${PORTS.dev18}/`,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
		{
			// Non-root base. `base` reaches the renderer URL through the plugin's
			// own `generateBundle` placeholder replacement (NOTES.md, Q7), so this
			// is the cell that catches a base-unaware rewrite.
			command: `UAIGHT_E2E_PRODUCTION=include ${VITE} build --base=/explorer/ --outDir dist-base && ${VITE} preview --base=/explorer/ --outDir dist-base --port ${PORTS.baseNonRoot} --strictPort`,
			cwd: APP,
			url: `http://localhost:${PORTS.baseNonRoot}/explorer/`,
			reuseExistingServer: !process.env.CI,
			timeout: 300_000,
		},
		{
			// Relative base, served from a prefix chosen after the build.
			command: `UAIGHT_E2E_PRODUCTION=include ${VITE} build --base=./ --outDir dist-relative && node ../support/static-server.mjs dist-relative ${PORTS.baseRelative} /nested/deep/`,
			cwd: APP,
			url: `http://localhost:${PORTS.baseRelative}/nested/deep/`,
			reuseExistingServer: !process.env.CI,
			timeout: 300_000,
		},
		{
			command: `UAIGHT_E2E_CSP=nonce ${VITE} --port ${PORTS.cspNonce} --strictPort`,
			cwd: APP,
			url: `http://localhost:${PORTS.cspNonce}/`,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
		{
			// The negative control: the same policy, with the page declining to
			// publish its nonce. §6.7 step 5 must name the directive.
			command: `UAIGHT_E2E_CSP=no-meta ${VITE} --port ${PORTS.cspNoMeta} --strictPort`,
			cwd: APP,
			url: `http://localhost:${PORTS.cspNoMeta}/`,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
	],
};

export default config;
