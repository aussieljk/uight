/**
 * Scratch copies of the fixture app for the specs that WRITE to disk.
 *
 * `hmr.spec.ts` and the HMR budget in `budgets.spec.ts` add, edit, rename and
 * delete files under `src/fixtures/`. When they did that in the shared
 * `fixture-app/` every other project's dev server saw the change, so an
 * unrelated spec could be reading the tree at the instant a file vanished.
 * That was a real, order-dependent failure, and `workers: 1` did not contain it
 * because the mutation is asynchronous with respect to the test that caused it.
 *
 * So each mutating spec gets its own copy of the app, with its own dev server.
 * The copy is a plain file copy plus a symlink to the original's
 * `node_modules`, which is what makes it cheap enough to rebuild every run.
 */

import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SOURCE_APP = resolve(HERE, "../fixture-app");

/** The scratch app names, one per mutating spec. */
export const SCRATCH_APPS = ["fixture-app-hmr", "fixture-app-perf"];

export function scratchAppRoot(name) {
	return resolve(HERE, "..", name);
}

/** (Re)create every scratch app from the pristine source app. */
export function createScratchApps() {
	for (const name of SCRATCH_APPS) {
		const target = scratchAppRoot(name);
		rmSync(target, { recursive: true, force: true });
		mkdirSync(target, { recursive: true });
		for (const entry of ["index.html", "package.json", "vite.config.ts", "src"]) {
			cpSync(join(SOURCE_APP, entry), join(target, entry), { recursive: true });
		}
		// Symlinked, not copied: the app's whole dependency tree — including the
		// linked `uaight` package — has to be the same one the shared app uses,
		// or the copies would test a different build.
		if (!existsSync(join(target, "node_modules"))) {
			symlinkSync(join(SOURCE_APP, "node_modules"), join(target, "node_modules"), "dir");
		}
	}
}
