/**
 * The production gate removes the chunk — SPEC §9.2, Q5, §20.2.
 *
 * NOTES.md records Q5 as answered against a real production build of the demo.
 * That answer was a one-off `grep` by a person; this is the same check wired to
 * fail. It builds the e2e application with the DEFAULT `production: "exclude"`
 * and asserts three separate things, because they fail independently:
 *
 *   1. no lazily-imported explorer chunk is emitted at all — §9.2's actual
 *      requirement, and the one SPEC's own sample code gets wrong (a
 *      module-scope `React.lazy` keeps the dynamic import in the graph);
 *   2. no fixture module's code survives — a gate that drops the UI but keeps
 *      the fixtures still ships the thing users care about not shipping;
 *   3. the application itself still builds and still contains its own markup,
 *      so "nothing was emitted" cannot pass this test.
 *
 * It shells out to a real `vite build`, so it is slow and lives in its own
 * project (`@prod`) rather than in the engine sweep.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { APP_ROOT } from "../support/edit.ts";

const OUT = "dist-gate";

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const file = join(dir, entry);
		if (statSync(file).isDirectory()) walk(file, out);
		else out.push(file);
	}
	return out;
}

test.describe("the production gate @prod", () => {
	test.setTimeout(300_000);

	test("`production: \"exclude\"` emits no explorer chunk and no fixture code", () => {
		const dist = join(APP_ROOT, OUT);
		rmSync(dist, { recursive: true, force: true });

		execFileSync("node_modules/.bin/vite", ["build", "--outDir", OUT], {
			cwd: APP_ROOT,
			stdio: "pipe",
			env: { ...process.env, UAIGHT_E2E_PRODUCTION: "exclude" },
		});

		const files = walk(dist);
		const js = files.filter((f) => f.endsWith(".js"));
		expect(js.length).toBeGreaterThan(0);

		// 1. No explorer chunk. The lazy chunk is named after its module.
		const explorerChunks = js.filter((f) => /UaightUI|InlineHost/i.test(f));
		expect(explorerChunks.map((f) => f.replace(dist, ""))).toEqual([]);

		const bundle = js.map((f) => readFileSync(f, "utf8")).join("\n");

		// 2. No fixture code. These strings exist only inside fixture modules.
		for (const marker of ["HMR_MARKER_V0", "late default", "Outer modal", "media-narrow"]) {
			expect(bundle.includes(marker), `${marker} survived the production gate`).toBe(false);
		}
		// Nor the chrome's own copy.
		expect(bundle.includes("Find a fixture, component or usage")).toBe(false);
		expect(bundle.includes("Rendering runs your component's real code")).toBe(false);

		// 3. The negative control: the app itself DID build. Without this, a
		// build that emitted an empty bundle would pass every assertion above.
		const html = readFileSync(join(dist, "index.html"), "utf8");
		expect(html).toContain("<div id=\"root\">");
		expect(bundle.includes("Save changes")).toBe(true);

		rmSync(dist, { recursive: true, force: true });
	});
});
