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
import { prepare } from "./tests/e2e/support/prepare.mjs";

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
	/* The mutating specs get their own app AND their own dev server, so a file
	   they delete is never visible to a spec that is reading the tree. */
	hmr: 5278,
	perf: 5279,
};

const APP = "tests/e2e/fixture-app";
const APP18 = "tests/e2e/fixture-app-react18";
const VITE = "node_modules/.bin/vite";

/** Tags carried by tests that belong to a specific axis rather than the sweep. */
const AXIS_TAGS = /@prod|@base|@csp|@cspblocked|@perf|@react18|@hmr/;

/**
 * The React 18 cell used to re-run the whole `@core` sweep. React 18 can break
 * the frame bootstrap, the scheduler's flush ordering and Fast Refresh; it
 * cannot plausibly break MRU ranking or a chip's scroll affordance, and running
 * three hundred assertions to learn that costs a minute of every run. `@react`
 * marks the tests whose outcome actually depends on the React major.
 */
const REACT_SENSITIVE = /@react18|@react\b/;

function engineProjects(): Project[] {
	return ENGINES.map((engine) => ({
		name: engine.id,
		use: { browserName: engine.browserName, baseURL: `http://localhost:${PORTS.dev}/` },
		grepInvert: AXIS_TAGS,
	}));
}

/* ------------------------------------------------------------------ *
 * Which servers this invocation actually needs.
 *
 * Playwright starts every `webServer` entry unconditionally, so iterating on
 * one keyboard test used to pay for two production builds and a React 18 dev
 * server. Each server is tagged with the projects that name it, and `--project`
 * on the command line (or `PLAYWRIGHT_SERVERS=all`) decides which start.
 * ------------------------------------------------------------------ */

function selectedProjects(): Set<string> | null {
	const argv = process.argv.slice(2);
	const names = new Set<string>();
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (arg.startsWith("--project=")) names.add(arg.slice("--project=".length));
		else if (arg === "--project" && argv[i + 1]) names.add(argv[++i]!);
	}
	if (process.env.PLAYWRIGHT_SERVERS === "all") return null;
	return names.size > 0 ? names : null;
}

/** One axis project per engine when FULL, otherwise Chromium only. */
function axis(
	name: string,
	baseURL: string,
	grep: RegExp,
	extra: Record<string, unknown> = {},
): Project[] {
	const engines = FULL ? ENGINES : [ENGINES[0]!];
	return engines.map((engine) => ({
		name: engines.length === 1 ? `chromium-${name}` : `${engine.id}-${name}`,
		use: { browserName: engine.browserName, baseURL, ...extra },
		grep,
	}));
}

const SELECTED = selectedProjects();

/** True when any selected project runs against this server. */
function needed(projects: string[]): boolean {
	return SELECTED === null || projects.some((name) => SELECTED.has(name));
}

/** Every project that talks to a given server, including the FULL-matrix names. */
function users(suffix: string): string[] {
	return [`chromium-${suffix}`, ...ENGINES.map((e) => `${e.id}-${suffix}`)];
}

const SERVERS = [
	{
		id: "dev",
		projects: ENGINES.map((e) => e.id),
		build: null,
		server: {
			// The default subject: dev server, React 19, default base.
			command: `${VITE} --port ${PORTS.dev} --strictPort`,
			cwd: APP,
			url: `http://localhost:${PORTS.dev}/`,
		},
	},
	{
		id: "prod",
		projects: users("prod"),
		build: "dist-include",
		server: {
			// §9.2: `production: "include"` is the only way a preview server has an
			// explorer at all. The build itself moved to `support/prepare.mjs`, so
			// a run that does not select this project does not pay for it.
			command: `${VITE} preview --outDir dist-include --port ${PORTS.preview} --strictPort`,
			cwd: APP,
			url: `http://localhost:${PORTS.preview}/`,
		},
	},
	{
		id: "react18",
		projects: users("react18"),
		build: null,
		server: {
			command: `${VITE} --port ${PORTS.dev18} --strictPort`,
			cwd: APP18,
			url: `http://localhost:${PORTS.dev18}/`,
		},
	},
	{
		id: "base-nonroot",
		projects: users("base-nonroot"),
		build: "dist-base",
		server: {
			// Non-root base. `base` reaches the renderer URL through the plugin's
			// own `generateBundle` placeholder replacement (NOTES.md, Q7), so this
			// is the cell that catches a base-unaware rewrite.
			command: `${VITE} preview --base=/explorer/ --outDir dist-base --port ${PORTS.baseNonRoot} --strictPort`,
			cwd: APP,
			url: `http://localhost:${PORTS.baseNonRoot}/explorer/`,
		},
	},
	{
		id: "base-relative",
		projects: users("base-relative"),
		build: "dist-relative",
		server: {
			// Relative base, served from a prefix chosen after the build — which is
			// the whole property `base: "./"` exists for, and the reason this build
			// could NOT be folded into the non-root one: that bundle carries
			// absolute `/explorer/` URLs and would 404 anywhere else.
			command: `node ../support/static-server.mjs dist-relative ${PORTS.baseRelative} /nested/deep/`,
			cwd: APP,
			url: `http://localhost:${PORTS.baseRelative}/nested/deep/`,
		},
	},
	{
		id: "csp",
		projects: users("csp"),
		build: null,
		server: {
			command: `UAIGHT_E2E_CSP=nonce ${VITE} --port ${PORTS.cspNonce} --strictPort`,
			cwd: APP,
			url: `http://localhost:${PORTS.cspNonce}/`,
		},
	},
	{
		id: "csp-blocked",
		projects: users("csp-blocked"),
		build: null,
		server: {
			// The negative control: the same policy, with the page declining to
			// publish its nonce. §6.7 step 5 must name the directive.
			command: `UAIGHT_E2E_CSP=no-meta ${VITE} --port ${PORTS.cspNoMeta} --strictPort`,
			cwd: APP,
			url: `http://localhost:${PORTS.cspNoMeta}/`,
		},
	},
	{
		id: "hmr",
		projects: ["chromium-hmr"],
		build: null,
		server: {
			command: `${VITE} --port ${PORTS.hmr} --strictPort`,
			cwd: `${APP}-hmr`,
			url: `http://localhost:${PORTS.hmr}/`,
		},
	},
	{
		id: "perf",
		projects: ["chromium-perf"],
		build: null,
		server: {
			command: `${VITE} --port ${PORTS.perf} --strictPort`,
			cwd: `${APP}-perf`,
			url: `http://localhost:${PORTS.perf}/`,
		},
	},
] as const;

const ACTIVE = SERVERS.filter((entry) => needed([...entry.projects]));

/* The scratch apps and the production bundles, before any server starts. Only
   the builds the selected projects need, and only when they are stale. */
prepare(ACTIVE.map((entry) => entry.build).filter((name): name is string => !!name));

const config: PlaywrightTestConfig = {
	testDir: "tests/e2e/specs",
	/* A frame bootstrap plus a Vite dev transform of a cold module graph is
	   genuinely slow on the first hit in WebKit; 60s is the ceiling that keeps a
	   real hang distinguishable from a cold start. */
	timeout: 60_000,
	/* Two seconds. Fifteen made every genuine failure fifteen seconds slow, and
	   the waits that really need longer say so at the call site —
	   `waitForFrame` passes 20s, the HMR assertions pass 20s. */
	expect: { timeout: 5_000 },
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	/* No retries, in CI or out. A test that passes on the second attempt has
	   told you something, and `retries: 1` is the mechanism for not hearing it:
	   the run goes green and the flake becomes someone else's Tuesday. The
	   order-dependent HMR failure this suite HAD survived months of green runs
	   that way. If a test is flaky it is a bug, and it should read as one. */
	retries: 0,
	/* Parallel. The mutating specs used to force `workers: 1` on everything;
	   they now have their own app and their own dev server (`chromium-hmr`,
	   `chromium-perf`), so the other ten spec files are read-only and
	   embarrassingly parallel.

	   Four, not "as many as there are cores": each worker drives a browser AND
	   a share of one dev server's transform work, and past four the servers are
	   the bottleneck, so more workers only add contention — which shows up as
	   assertion timeouts rather than as speed.

	   `PLAYWRIGHT_SERIAL=1` drops to one worker. **`chromium-hmr` and
	   `chromium-perf` must run that way, in their own invocation.** Playwright
	   has no per-project worker count — `fullyParallel: false` orders a
	   project's own tests but does nothing about the three other projects
	   saturating the machine beside it. Both of those projects measure real
	   time: one waits on an HMR round trip, the other asserts a budget in
	   milliseconds. Measuring either under contention produces a number that
	   describes the load, not the product, and it flakes differently on every
	   run. `bun run test:e2e` runs the parallel sweep and then the serial pair;
	   do not fold them back into one invocation. */
	workers: process.env.PLAYWRIGHT_SERIAL === "1" ? 1 : 4,
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
		...axis("react18", `http://localhost:${PORTS.dev18}/`, REACT_SENSITIVE),
		...axis("base-nonroot", `http://localhost:${PORTS.baseNonRoot}/explorer/`, /@base/),
		...axis(
			"base-relative",
			`http://localhost:${PORTS.baseRelative}/nested/deep/`,
			/@base/,
		),
		...axis("csp", `http://localhost:${PORTS.cspNonce}/`, /@csp\b/),
		...axis("csp-blocked", `http://localhost:${PORTS.cspNoMeta}/`, /@cspblocked/),
		/* The budgets get their own project so `--project=chromium-perf` is one
		   command, and so they never share a worker with a spec that is editing
		   files on disk — a rebuild in the background is a timing artefact. */
		{
			name: "chromium-perf",
			use: { browserName: "chromium", baseURL: `http://localhost:${PORTS.perf}/` },
			grep: /@perf/,
			fullyParallel: false,
		},
		/* The specs that write to disk. Their own app, their own dev server, and
		   serial within the project. */
		{
			name: "chromium-hmr",
			use: { browserName: "chromium", baseURL: `http://localhost:${PORTS.hmr}/` },
			grep: /@hmr/,
			fullyParallel: false,
		},
	],

	webServer: ACTIVE.map((entry) => ({
		...entry.server,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	})),
};

export default config;
