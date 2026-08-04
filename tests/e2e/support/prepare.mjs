/**
 * Everything the matrix needs on disk BEFORE a server starts.
 *
 * Two jobs, both of which used to be paid for on every run:
 *
 *  1. the scratch copies of the fixture app for the specs that write to disk
 *     (see `scratch-apps.mjs`);
 *  2. the production bundles. `prod`, `base-nonroot` and `base-relative` each
 *     used to run `vite build` inside their own `webServer` command, so even
 *     `--project=chromium` paid for three builds. The builds happen here, once,
 *     and only when the output is older than its inputs; the servers only
 *     SERVE.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createScratchApps, SOURCE_APP } from "./scratch-apps.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The newest mtime anywhere under `path` (a file or a directory tree). */
function newest(path) {
	let stat;
	try {
		stat = statSync(path);
	} catch {
		return 0;
	}
	if (!stat.isDirectory()) return stat.mtimeMs;
	let max = stat.mtimeMs;
	for (const entry of readdirSync(path)) {
		if (entry === "node_modules") continue;
		max = Math.max(max, newest(join(path, entry)));
	}
	return max;
}

function sourcesChangedAt() {
	return Math.max(
		newest(join(SOURCE_APP, "src")),
		newest(join(SOURCE_APP, "index.html")),
		newest(join(SOURCE_APP, "vite.config.ts")),
		newest(join(SOURCE_APP, "package.json")),
		// The apps consume the BUILT package, so a rebuild of it invalidates them.
		newest(join(REPO, "packages/uaight/dist")),
	);
}

/** The production outputs, by the name each `webServer` serves. */
export const BUILDS = {
	"dist-include": ["build", "--outDir", "dist-include"],
	"dist-base": ["build", "--base=/explorer/", "--outDir", "dist-base"],
	"dist-relative": ["build", "--base=./", "--outDir", "dist-relative"],
};

/**
 * Builds the named outputs if they are missing or older than the sources.
 * `names` is whatever the SELECTED projects actually need, so iterating on one
 * browser test builds nothing at all.
 */
export function prepare(names) {
	// The config is re-evaluated in every worker process. The preparation is the
	// main process's job only; doing it again in a worker would delete the app a
	// running dev server is watching.
	if (process.env.TEST_WORKER_INDEX !== undefined) return;
	createScratchApps();
	if (names.length === 0) return;

	const changed = sourcesChangedAt();
	for (const name of names) {
		const out = join(SOURCE_APP, name);
		const stamp = join(out, "index.html");
		if (existsSync(stamp) && statSync(stamp).mtimeMs > changed) {
			console.log(`[uaight-e2e] ${name} is up to date`);
			continue;
		}
		console.log(`[uaight-e2e] building ${name}…`);
		execFileSync(join(SOURCE_APP, "node_modules/.bin/vite"), BUILDS[name], {
			cwd: SOURCE_APP,
			stdio: "inherit",
			env: { ...process.env, UAIGHT_E2E_PRODUCTION: "include" },
		});
	}
}
