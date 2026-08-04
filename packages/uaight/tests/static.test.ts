/**
 * `uaight build` — where the scaffold lives.
 *
 * The build writes two real files and removes them. Where it writes them is a
 * correctness question, not a tidiness one: a crash between the write and the
 * cleanup used to leave `uaight-explorer.html` and `uaight-explorer.entry.js`
 * in the user's repository, next to their own `index.html`. A tool is not
 * entitled to make that mess.
 *
 * Running a real Vite build here would cost minutes and prove something Vite's
 * own tests already cover, so these tests exercise the placement rather than
 * the build: the scaffold path, that it does not collide with a file the user
 * owns, and that the cleanup is total.
 */

import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildStatic } from "../src/vite/static.ts";

let root: string;

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), "uaight-static-"));
	mkdirSync(path.join(root, "src"), { recursive: true });
	writeFileSync(path.join(root, "index.html"), "<!doctype html><div id=app></div>");
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

/** Run the build far enough to place the scaffold, then let it fail. */
async function attempt(): Promise<unknown> {
	// No Vite config, no React, no `uaight` resolvable from this temp root — the
	// build throws, which is exactly the crash the placement has to survive.
	return buildStatic({ root, quiet: true, configFile: false }).catch(
		(err: unknown) => err,
	);
}

describe("the scaffold", () => {
	it("leaves nothing in the project root, even when the build fails", async () => {
		await attempt();

		expect(existsSync(path.join(root, "uaight-explorer.html"))).toBe(false);
		expect(existsSync(path.join(root, "uaight-explorer.entry.js"))).toBe(false);
	});

	it("cleans up its own directory under node_modules", async () => {
		await attempt();
		expect(existsSync(path.join(root, "node_modules", ".uaight"))).toBe(false);
	});

	it("does not refuse to run because the user owns a file of that name", async () => {
		// The old placement had to reserve two names in the project root and
		// refuse the build if either was taken. Nothing is reserved now.
		writeFileSync(path.join(root, "uaight-explorer.html"), "mine");
		writeFileSync(path.join(root, "uaight-explorer.entry.js"), "mine too");

		const result = await attempt();
		expect(String((result as Error)?.message ?? "")).not.toContain("already exists");
		// And it did not touch them.
		expect(existsSync(path.join(root, "uaight-explorer.html"))).toBe(true);
	});
});
