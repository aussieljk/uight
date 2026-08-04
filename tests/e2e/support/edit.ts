/**
 * File edits for the HMR and topology scenarios (§20.2, Q9).
 *
 * Every helper returns a restore function and every spec calls it in a
 * `finally`. The alternative — a global git checkout at the end of the run — is
 * exactly the arrangement that makes one failing HMR test poison the next
 * fifteen, which is how an HMR suite ends up disabled.
 */

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ROOT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../fixture-app",
);
export const FIXTURES_DIR = join(APP_ROOT, "src/fixtures");

/**
 * The app a mutating spec writes to. Never `APP_ROOT`: every other project's
 * dev server watches that directory, so an edit there lands in the middle of
 * unrelated tests as a tree change. `support/scratch-apps.mjs` makes one
 * private copy per mutating spec and Playwright gives each its own dev server.
 */
export function scratchRoot(app: "hmr" | "perf"): string {
	return resolve(dirname(fileURLToPath(import.meta.url)), `../fixture-app-${app}`);
}

/** Replace a substring in a fixture file, returning a restore function. */
export function patchFile(
	relative: string,
	from: string,
	to: string,
	root: string,
): () => void {
	const file = join(root, relative);
	const original = readFileSync(file, "utf8");
	if (!original.includes(from)) {
		throw new Error(
			`${relative} does not contain ${JSON.stringify(from)} — the HMR marker moved`,
		);
	}
	writeFileSync(file, original.split(from).join(to));
	return () => writeFileSync(file, original);
}

/** Create a new fixture file. Returns a remover. */
export function addFixture(name: string, source: string, root: string): () => void {
	const dir = join(root, "src/fixtures");
	const file = join(dir, `${name}.fixture.tsx`);
	mkdirSync(dir, { recursive: true });
	writeFileSync(file, source);
	return () => rmSync(file, { force: true });
}

/** Move a fixture file, returning a function that moves it back. */
export function renameFixture(from: string, to: string, root: string): () => void {
	const a = join(root, "src/fixtures", `${from}.fixture.tsx`);
	const b = join(root, "src/fixtures", `${to}.fixture.tsx`);
	// A real `rename`, not write-then-delete: the watcher sees one atomic move,
	// which is what an editor or a `git mv` produces, and which is the case Q9
	// asks about.
	renameSync(a, b);
	return () => renameSync(b, a);
}

/** Delete a fixture file, returning a function that writes it back. */
export function removeFixture(name: string, root: string): () => void {
	const file = join(root, "src/fixtures", `${name}.fixture.tsx`);
	const source = readFileSync(file, "utf8");
	rmSync(file, { force: true });
	return () => writeFileSync(file, source);
}
