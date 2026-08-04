/**
 * The golden corpus. SPEC.md §20.1, and NOTES.md's integration log.
 *
 * The unit suites cover each part in isolation, which is exactly why they
 * missed the three worst defects this project has had: the `[null]`/`[]`
 * encoding that made every zero-config single-fixture file invisible, a story
 * importing a CSS file that is not in the published package, and a verification
 * sweep reading the host document instead of the frame. Each part was correct;
 * the seams were not.
 *
 * This runs the real pipeline over real files and pins the result. Two halves,
 * and the second is the one that matters:
 *
 *  1. **The corpus** — frosted-ui's 77 CSF files plus the demo's own fixtures,
 *     scanned exactly as the demo scans them, digested and compared.
 *  2. **The negative control** — a scan that MUST report a problem. NOTES.md:
 *     "a checker that has never been observed to fail is not evidence of
 *     anything." If the control ever passes, this file is lying about the
 *     corpus too.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
	SNAPSHOT_PATH,
	buildCorpusSnapshot,
	runNegativeControl,
} from "../scripts/corpus.ts";
import type { CorpusSnapshot } from "../scripts/corpus.ts";

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) as CorpusSnapshot;

const temporaries: string[] = [];
afterAll(() => {
	for (const dir of temporaries) fs.rmSync(dir, { recursive: true, force: true });
});

function scratch(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uaight-corpus-"));
	temporaries.push(dir);
	return dir;
}

describe("the frosted-ui corpus", () => {
	it("indexes every file, with no problems", async () => {
		const current = await buildCorpusSnapshot();

		expect(current.problems).toBe(0);
		expect(current.files).toBe(snapshot.files);
		expect(current.fixtures).toBe(snapshot.fixtures);
		expect(current.decorators).toBe(snapshot.decorators);
	}, 60_000);

	it("produces the same names it produced when the snapshot was written", async () => {
		const current = await buildCorpusSnapshot();
		// The digest covers every path and every name in index order. A failure
		// here is a real change in what the tree would show; regenerate with
		// `bun run corpus --write` and read the diff before accepting it.
		expect(current.digest).toBe(snapshot.digest);
	}, 60_000);

	it("keeps the undecidable count where it was", async () => {
		const current = await buildCorpusSnapshot();
		// §3.5's warm pass exists for these. The count creeping up means the
		// static parser lost ground against a real corpus.
		expect(current.undecidable).toBe(snapshot.undecidable);
	}, 60_000);

	it("still detects components and harvests their call sites", async () => {
		const current = await buildCorpusSnapshot();
		expect(current.components).toBe(snapshot.components);
		expect(current.callSiteGroups).toBe(snapshot.callSiteGroups);
		expect(current.callSiteGroups).toBeGreaterThan(0);
	}, 60_000);
});

describe("the negative control", () => {
	it("reports an unparseable file rather than indexing it silently", async () => {
		const result = await runNegativeControl(scratch());

		// The whole point: this assertion has been observed to fail — remove the
		// broken file from NEGATIVE_CONTROL_FILES and it does.
		expect(result.problems).toContain("unparseable");
	});

	it("still indexes the good file beside the broken one", async () => {
		const result = await runNegativeControl(scratch());

		// A control that fails everything proves nothing about the case it is
		// controlling for: one bad file must not take the corpus down (§3.4).
		expect(result.indexedFine).toBe(2);
	});
});
