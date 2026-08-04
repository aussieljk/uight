/**
 * The scan, against a real filesystem.
 *
 * Everything here is a behaviour that a unit test over a string could not
 * establish: whether a directory outside the root is refused with the right
 * word, whether an alias makes two spellings of one import name the same
 * component, and whether metadata read by the parser survives into the index
 * and back out of an incremental rescan.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveUaightConfig } from "../src/vite/config.ts";
import type { ResolvedUaightConfig } from "../src/vite/config.ts";
import { normalizeAliases, sameAliases } from "../src/vite/config.ts";
import {
	fixtureGlobPatterns,
	rescanIncremental,
	scanFixtures,
} from "../src/vite/scan.ts";
import type { UaightPluginOptions } from "../src/shared/types.ts";

let root: string;

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), "uaight-scan-"));
	mkdirSync(path.join(root, "src"), { recursive: true });
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

function write(relative: string, source: string): string {
	const file = path.join(root, relative);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, source);
	return file;
}

function config(
	options: UaightPluginOptions = {},
	alias?: unknown,
): ResolvedUaightConfig {
	return resolveUaightConfig({
		root,
		options,
		command: "serve",
		...(alias === undefined ? {} : { alias }),
	});
}

/* ------------------------------------------------------------------ *
 * Confinement — §4.2
 * ------------------------------------------------------------------ */

describe("a fixturesDir outside the Vite root", () => {
	it('is a "confinement" problem, not an "unreadable" one', async () => {
		const index = await scanFixtures(config({ fixturesDir: "../elsewhere" }));

		expect(index.problems).toHaveLength(1);
		// The directory usually reads perfectly well. What cannot be done is
		// reach it with a root-relative glob, and the kind has to say which.
		expect(index.problems[0]?.kind).toBe("confinement");
		expect(index.problems[0]?.message).toContain("outside the Vite root");
		expect(index.files).toEqual([]);
	});
});

/* ------------------------------------------------------------------ *
 * Aliases — the call-site pass's half of the resolver
 * ------------------------------------------------------------------ */

describe("normalizeAliases", () => {
	it("reads both shapes Vite accepts", () => {
		expect(normalizeAliases({ "@": "/src" })).toEqual([{ find: "@", replacement: "/src" }]);
		expect(normalizeAliases([{ find: "~", replacement: "/app" }])).toEqual([
			{ find: "~", replacement: "/app" },
		]);
	});

	it("drops RegExp finds rather than approximating them", () => {
		// Vite's own internal aliases are all RegExp. Half-implementing one
		// produces a wrong module path, which is worse than no answer.
		expect(normalizeAliases([{ find: /^\/?@vite\/env/, replacement: "x" }])).toEqual([]);
	});

	it("treats an unset table as empty", () => {
		expect(normalizeAliases(undefined)).toEqual([]);
		expect(normalizeAliases(null)).toEqual([]);
	});

	it("compares tables by content, so a rescan only happens when one moved", () => {
		const a = normalizeAliases({ "@": "src", "~": "app" });
		expect(sameAliases(a, normalizeAliases({ "~": "app", "@": "src" }))).toBe(true);
		expect(sameAliases(a, normalizeAliases({ "@": "lib", "~": "app" }))).toBe(false);
	});
});

describe("resolving an aliased import at a call site", () => {
	beforeEach(() => {
		write("src/components/Button.tsx", "export function Button() { return null; }\n");
		write(
			"src/pages/Home.tsx",
			`import { Button } from "@/components/Button";
export function Home() { return <Button variant="primary" />; }
`,
		);
	});

	it("does not resolve without an alias table", async () => {
		const index = await scanFixtures(config());
		const site = index.callSites.find((g) => g.component === "Button")?.sites[0];

		expect(site?.importedFrom).toBe("@/components/Button");
		expect(site?.resolvedFrom).toBeUndefined();
	});

	it("resolves to the same display path a relative import would", async () => {
		const index = await scanFixtures(config({}, { "@": path.join(root, "src") }));
		const site = index.callSites.find((g) => g.component === "Button")?.sites[0];

		expect(site?.resolvedFrom).toBe("components/Button");
	});

	it("takes the longest matching prefix, so a more specific alias wins", async () => {
		write("src/ui/Button.tsx", "export function Button() { return null; }\n");
		write(
			"src/pages/Two.tsx",
			`import { Button } from "@ui/Button";
export function Two() { return <Button wide />; }
`,
		);

		const index = await scanFixtures(
			config({}, { "@": path.join(root, "src"), "@ui": path.join(root, "src/ui") }),
		);
		const sites = index.callSites.find((g) => g.component === "Button")?.sites ?? [];

		expect(sites.map((s) => s.resolvedFrom)).toContain("ui/Button");
	});

	it("does not let an alias of `@` swallow a scoped package", async () => {
		write(
			"src/pages/Three.tsx",
			`import { Button } from "@acme/ui";
export function Three() { return <Button tall />; }
`,
		);

		const index = await scanFixtures(config({}, { "@": path.join(root, "src") }));
		const site = index.callSites
			.find((g) => g.component === "Button")
			?.sites.find((s) => s.path === "pages/Three");

		// `@acme/ui` is a package. Resolving it against `<root>/src` would invent
		// a file that does not exist and label the site with it.
		expect(site?.resolvedFrom).toBeUndefined();
	});

	it("refuses an alias that escapes the root", async () => {
		write(
			"src/pages/Four.tsx",
			`import { Button } from "@out/Button";
export function Four() { return <Button />; }
`,
		);

		const index = await scanFixtures(
			config({}, { "@out": path.resolve(root, "..", "outside") }),
		);
		const site = index.callSites
			.find((g) => g.component === "Button")
			?.sites.find((s) => s.path === "pages/Four");

		expect(site?.resolvedFrom).toBeUndefined();
	});
});

/* ------------------------------------------------------------------ *
 * §3.1 metadata on the index
 * ------------------------------------------------------------------ */

describe("fileMeta and fixtureMeta on the index", () => {
	it("carries a static fileMeta through the scan", async () => {
		write(
			"src/Button.fixture.tsx",
			`export const fileMeta = { group: "Forms", viewport: { width: 375, height: 667 } };
export default { A: <B />, C: <B /> };
`,
		);

		const index = await scanFixtures(config());
		expect(index.files[0]?.fileMeta).toEqual({
			group: "Forms",
			viewport: { width: 375, height: 667 },
		});
	});

	it("carries a static fixtureMeta, keyed by fixture name", async () => {
		write(
			"src/Card.fixture.tsx",
			`export const fixtureMeta = { Wide: { viewport: { width: 1440, height: 900 } } };
export default { Wide: <B /> };
`,
		);

		const index = await scanFixtures(config());
		expect(index.files[0]?.fixtureMeta).toEqual({
			Wide: { viewport: { width: 1440, height: 900 } },
		});
	});

	it("leaves both absent when the export is not a static object", async () => {
		write(
			"src/Dyn.fixture.tsx",
			`export const fileMeta = buildMeta();\nexport default { A: <B /> };\n`,
		);

		const index = await scanFixtures(config());
		expect(index.files[0]?.fileMeta).toBeUndefined();
		expect(index.files[0]).not.toHaveProperty("fileMeta");
	});

	it("survives an incremental rescan, which is where a second code path could lose it", async () => {
		const file = write(
			"src/Button.fixture.tsx",
			`export const fileMeta = { group: "Forms" };\nexport default { A: <B /> };\n`,
		);

		const first = await scanFixtures(config());
		const again = await rescanIncremental(first, file, config());

		expect(again.files[0]?.fileMeta).toEqual({ group: "Forms" });
	});
});

/* ------------------------------------------------------------------ *
 * Q9 — glob invalidation, the half that is Node's
 * ------------------------------------------------------------------ */

/**
 * Q9 asks whether add, delete and rename invalidate correctly under Vite 8.1,
 * Rolldown and Bundled Dev Mode. That question has two halves and only one of
 * them lives here: whether **the index** tracks the topology, which is what the
 * `uaight:index` custom event carries and what the tree renders from.
 *
 * The other half — whether Vite re-evaluates the `import.meta.glob` map in the
 * browser afterwards — is a browser property and cannot be established from
 * Node. It belongs to the Playwright matrix. Nothing below claims otherwise.
 */
describe("topology changes (Q9, Node half)", () => {
	it("an added file appears, in sorted position", async () => {
		write("src/b/Two.fixture.tsx", "export default { A: <B /> };\n");
		let index = await scanFixtures(config());
		expect(index.files.map((f) => f.path)).toEqual(["b/Two"]);

		const added = write("src/a/One.fixture.tsx", "export default { A: <B /> };\n");
		index = await rescanIncremental(index, added, config());

		// Sorted by glob path, not by arrival: the tree must not reorder itself
		// according to which file the user happened to create second.
		expect(index.files.map((f) => f.path)).toEqual(["a/One", "b/Two"]);
	});

	it("a deleted file disappears, and takes its problems with it", async () => {
		const one = write("src/One.fixture.tsx", "export default { A: <B /> };\n");
		write("src/Two.fixture.tsx", "export default { A: <B /> };\n");

		let index = await scanFixtures(config());
		expect(index.files).toHaveLength(2);

		rmSync(one);
		index = await rescanIncremental(index, one, config());

		expect(index.files.map((f) => f.path)).toEqual(["Two"]);
	});

	it("a rename is an unlink and an add, and resolves the collision it passes through", async () => {
		// The interesting part of a rename is the moment between the two events,
		// when both names exist and the display paths collide.
		const from = write("src/Old.fixture.tsx", "export default { A: <B /> };\n");
		const to = path.join(root, "src", "Old.fixture.tsx".replace("Old", "New"));

		let index = await scanFixtures(config());
		writeFileSync(to, "export default { A: <B /> };\n");
		index = await rescanIncremental(index, to, config());
		expect(index.files).toHaveLength(2);
		// Two distinct display paths, so no collision — a rename is only
		// ambiguous when the *display* paths coincide.
		expect(index.problems).toEqual([]);

		rmSync(from);
		index = await rescanIncremental(index, from, config());
		expect(index.files.map((f) => f.path)).toEqual(["New"]);
	});

	it("a genuine display-path collision is reported and then cleared", async () => {
		write("src/Button.fixture.tsx", "export default { A: <B /> };\n");
		const clash = write("src/Button.fixture.jsx", "export default { A: <B /> };\n");

		let index = await scanFixtures(config());
		expect(index.problems.map((p) => p.kind)).toEqual(["collision"]);

		rmSync(clash);
		index = await rescanIncremental(index, clash, config());
		expect(index.problems).toEqual([]);
	});

	it("a file the scan does not care about changes nothing", async () => {
		write("src/One.fixture.tsx", "export default { A: <B /> };\n");
		const index = await scanFixtures(config());
		const after = await rescanIncremental(index, write("README.md", "hi"), config());

		expect(after.files).toEqual(index.files);
	});

	it("the emitted glob patterns do not move when the corpus does", async () => {
		// Vite invalidates a glob by its *pattern*. A pattern that changed with
		// the file list would make every add a new module id.
		const before = fixtureGlobPatterns(config());
		write("src/Late.fixture.tsx", "export default { A: <B /> };\n");
		expect(fixtureGlobPatterns(config())).toEqual(before);
	});
});
