/**
 * `uaight doctor`, and the one-line summary the dev server prints.
 *
 * Both exist for the same user: the one whose tree is empty and who has no
 * reason to trust the explorer enough to open it and find out why. So the
 * tests are about what the output *says*, not about its shape — a report that
 * omits the fixtures directory, or names one of §4.2's two path
 * representations without the other, has failed at the only job it has.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveUaightConfig } from "../src/vite/config.ts";
import { doctorReport, formatDoctorReport } from "../src/vite/doctor.ts";
import { formatProblemSummary } from "../src/vite/index.ts";
import type { IndexProblem } from "../src/shared/types.ts";

let root: string;

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), "uaight-doctor-"));
	mkdirSync(path.join(root, "src"), { recursive: true });
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

function write(relative: string, source: string): void {
	const file = path.join(root, relative);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, source);
}

async function report(options: Record<string, unknown> = {}) {
	return doctorReport(resolveUaightConfig({ root, options, command: "serve" }));
}

describe("doctorReport", () => {
	it("counts what was indexed", async () => {
		write("src/Button.tsx", "export function Button() { return null; }\n");
		write("src/Button.fixture.tsx", "export default { A: <B />, C: <B /> };\n");
		write("src/Card.fixture.tsx", "export default <Card />;\n");

		const result = await report();
		expect(result.files).toBe(2);
		expect(result.fixtures).toBe(3);
		expect(result.components).toBeGreaterThan(0);
	});

	it("reports the undecidable count separately from the fixture count", async () => {
		write("src/Odd.fixture.tsx", "export default { ...base, A: <B /> };\n");

		const result = await report();
		expect(result.undecidable).toBe(1);
	});

	it("echoes both of §4.2's path representations, because confusing them is the bug", async () => {
		const result = await report();
		expect(result.fixturesDirFsPath).toBe(path.join(root, "src"));
		expect(result.fixturesDirGlobPath).toBe("/src");
	});

	it("echoes the patterns actually emitted, not the options that produced them", async () => {
		const result = await report({ fixtureFileSuffix: "story" });
		expect(result.fixturePatterns.some((p) => p.includes("*.story."))).toBe(true);
	});

	it("says whether docgen and the inventory are on", async () => {
		const on = await report({ docgen: true, inventory: false });
		expect(on.docgen).toBe(true);
		expect(on.inventory).toBe(false);

		const off = await report();
		expect(off.docgen).toBe(false);
		expect(off.inventory).toBe(true);
	});

	it("groups problems by kind", async () => {
		const result = await report({ fixturesDir: "../elsewhere" });
		expect(result.problemsByKind).toEqual([["confinement", 1]]);
	});
});

describe("formatDoctorReport", () => {
	it("prints the fixtures directory, the counts and the problems", async () => {
		write("src/Button.fixture.tsx", "export default { A: <B /> };\n");
		const text = formatDoctorReport(await report());

		expect(text).toContain(path.join(root, "src"));
		expect(text).toContain("/src");
		expect(text).toContain("files indexed");
		expect(text).toContain("Problems");
	});

	it("names the likely cause when nothing at all was found", async () => {
		const text = formatDoctorReport(await report({ fixturesDir: "does-not-exist" }));
		expect(text).toContain("Nothing was indexed");
		expect(text).toContain("does-not-exist");
	});

	it("prints a confinement problem in full, with the directory", async () => {
		const text = formatDoctorReport(await report({ fixturesDir: "../elsewhere" }));
		expect(text).toContain("confinement");
		expect(text).toContain("outside the Vite root");
	});
});

/* ------------------------------------------------------------------ *
 * The dev-server line
 * ------------------------------------------------------------------ */

const problem = (kind: IndexProblem["kind"], message: string): IndexProblem => ({
	kind,
	message,
	files: [],
});

describe("formatProblemSummary", () => {
	it("says nothing when there is nothing to say", () => {
		expect(formatProblemSummary([])).toBeNull();
	});

	it("counts by kind and quotes the first offender", () => {
		const summary = formatProblemSummary([
			problem("confinement", "[uaight] fixturesDir is outside the Vite root"),
			problem("collision", "[uaight] two files normalize to x"),
			problem("collision", "[uaight] two files normalize to y"),
		]);

		expect(summary).toContain("3 index problems");
		expect(summary).toContain("2 collision");
		expect(summary).toContain("1 confinement");
		// The first offender in full: a summary without an example tells nobody
		// which file to look at.
		expect(summary).toContain("fixturesDir is outside the Vite root");
		expect(summary).toContain("+2 more");
		expect(summary).toContain("uaight doctor");
	});

	it("does not offer `+0 more` for a single problem", () => {
		const summary = formatProblemSummary([problem("unreadable", "[uaight] nope")]);
		expect(summary).toContain("1 index problem ");
		expect(summary).not.toContain("more");
	});
});
