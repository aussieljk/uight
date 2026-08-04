/**
 * HMR and index topology — SPEC §3.5, §4.4, §20.2, Q9.
 *
 * Two different mechanisms are under test and they fail differently:
 *
 *   - **editing a fixture's body** goes through React Fast Refresh INSIDE the
 *     frame. NOTES.md: "the runtime does not re-import the module on
 *     `uaight:index`" — so if the preamble is not installed in the frame realm
 *     (Q2), this is where it shows up, as a full frame reload or a hard error
 *     rather than an in-place update;
 *   - **adding, deleting or renaming a file** changes the INDEX, which reaches
 *     the host over the dev-server channel and must move the tree without a
 *     page reload. That is Q9, and it is still open.
 *
 * These tests write to disk, so the file is serial and every test restores its
 * edit in a `finally`. A partial restore poisons every later test in the run,
 * which is how an HMR suite ends up commented out.
 */

import { addFixture, patchFile, removeFixture, renameFixture } from "../support/edit.ts";
import { expect, test } from "../support/harness.ts";

test.describe.configure({ mode: "serial" });

test.describe("HMR", () => {
	test("a fixture edit reaches the frame", async ({ explorer }) => {
		await explorer.open({ fixture: { path: "fixtures/hmr", name: "Marker" } });
		const marker = explorer.frame().locator("[data-e2e='hmr-marker']");
		await expect(marker).toHaveText("HMR_MARKER_V0");

		const restore = patchFile("src/fixtures/hmr.fixture.tsx", "HMR_MARKER_V0", "HMR_MARKER_V1");
		try {
			await expect(marker).toHaveText("HMR_MARKER_V1", { timeout: 20_000 });
		} finally {
			restore();
		}
		await expect(marker).toHaveText("HMR_MARKER_V0", { timeout: 20_000 });
	});

	test("a fixture edit re-renders in place rather than reloading the frame", async ({
		explorer,
		page,
	}) => {
		// **Finding.** This fails. NOTES.md states the model — "HMR of a fixture
		// module relies on React Fast Refresh, which preserves the component tree
		// and re-renders in place. The runtime does not re-import the module on
		// `uaight:index`" — and the update does arrive (the test above passes),
		// but it arrives as a fresh frame realm: a `window` expando set before the
		// edit is gone afterwards. Whether that is a Fast Refresh boundary the
		// fixture module does not satisfy, or the index invalidation remounting
		// `FrameHost`, is a question for whoever owns the plugin and the UI; from
		// here it is only observable as "the realm did not survive".
		//
		// It matters beyond tidiness: a reload throws away renderer-side state,
		// including the root overrides §7.3 uses for a setter's non-serializable
		// value, and it is why the budget in `budgets.spec.ts` measures what it
		// measures.
		test.fixme(true, "the frame realm is replaced on a fixture edit rather than fast-refreshed");

		await explorer.open({ fixture: { path: "fixtures/hmr", name: "Marker" } });
		const marker = explorer.frame().locator("[data-e2e='hmr-marker']");
		await expect(marker).toHaveText("HMR_MARKER_V0");

		await page.evaluate(() => {
			const frame = document.querySelector<HTMLIFrameElement>("iframe[data-uaight-frame]");
			(frame?.contentWindow as unknown as Record<string, unknown>).__hmrWitness = 1;
		});

		const restore = patchFile("src/fixtures/hmr.fixture.tsx", "HMR_MARKER_V0", "HMR_MARKER_V1");
		try {
			await expect(marker).toHaveText("HMR_MARKER_V1", { timeout: 20_000 });
			const survived = await page.evaluate(() => {
				const frame = document.querySelector<HTMLIFrameElement>("iframe[data-uaight-frame]");
				return (frame?.contentWindow as unknown as Record<string, unknown>).__hmrWitness === 1;
			});
			expect(survived).toBe(true);
		} finally {
			restore();
		}
		await expect(marker).toHaveText("HMR_MARKER_V0", { timeout: 20_000 });
	});

	test("adding a fixture file makes it appear in the tree", async ({ explorer }) => {
		await explorer.open({ fixture: { path: "fixtures/basic", name: "Alpha" } });

		const remove = addFixture(
			"added",
			`export default {\n\tAdded: <p data-e2e="added">ADDED</p>,\n};\n`,
		);
		try {
			await expect(explorer.treeItem("added")).toHaveCount(1, { timeout: 20_000 });

			// And it is actually selectable, not merely listed.
			await explorer.select("fixtures/added", "Added");
			await explorer.waitForFrame();
			await expect(explorer.frame().locator("[data-e2e='added']")).toHaveText("ADDED");
		} finally {
			remove();
		}
		await expect(explorer.treeItem("added")).toHaveCount(0, { timeout: 20_000 });
	});

	test("adding a fixture file does not reload the host page", async ({ explorer, page }) => {
		// **Finding.** This fails: adding a file reloads the whole host document.
		// A new file changes the set of paths `import.meta.glob` matched, so Vite
		// invalidates the virtual module and takes the full-reload path — which is
		// Q9 ("glob invalidation under Vite 8.1, Rolldown, Bundled Dev Mode"),
		// still open, now with a browser-level answer for the add case.
		//
		// The user-visible cost is not the reload itself but what it throws away:
		// control values are session state (Q14, not persisted), so a fixture
		// appearing elsewhere in the project discards whatever the user had tuned.
		// The test above proves the file DOES appear and IS selectable; this one
		// records what it costs.
		test.fixme(true, "adding a fixture file triggers a full page reload (Q9)");

		await explorer.open({ fixture: { path: "fixtures/basic", name: "Alpha" } });
		await page.evaluate(() => {
			(window as unknown as Record<string, unknown>).__noReloadWitness = 1;
		});

		const remove = addFixture(
			"added2",
			`export default {\n\tAdded: <p data-e2e="added2">ADDED</p>,\n};\n`,
		);
		try {
			await expect(explorer.treeItem("added2")).toHaveCount(1, { timeout: 20_000 });
			expect(
				await page.evaluate(
					() => (window as unknown as Record<string, unknown>).__noReloadWitness === 1,
				),
			).toBe(true);
		} finally {
			remove();
		}
	});

	test("deleting the selected fixture's file leaves a stated empty state", async ({ explorer }) => {
		const remove = addFixture(
			"doomed",
			`export default {\n\tDoomed: <p data-e2e="doomed">DOOMED</p>,\n};\n`,
		);
		try {
			await explorer.open({ fixture: { path: "fixtures/doomed", name: "Doomed" } });
			await expect(explorer.frame().locator("[data-e2e='doomed']")).toHaveText("DOOMED");

			const restore = removeFixture("doomed");
			try {
				await expect(explorer.treeItem("doomed")).toHaveCount(0, { timeout: 20_000 });
				// §5.3: a well-formed id that names nothing keeps its parameter and
				// shows the empty state. It must not throw and must not silently
				// select something else.
				expect(await explorer.selectedId()).toContain("doomed");
			} finally {
				restore();
			}
		} finally {
			remove();
		}
	});

	test("renaming a fixture file moves it in the tree", async ({ explorer }) => {
		test.fixme(true, "a rename leaves the old path in the tree — see the comment below (Q9)");
		const remove = addFixture(
			"before-rename",
			`export default {\n\tOnly: <p data-e2e="renamed">RENAMED</p>,\n};\n`,
		);
		let restore: (() => void) | null = null;
		try {
			await explorer.open({ fixture: { path: "fixtures/basic", name: "Alpha" } });
			await expect(explorer.treeItem("before-rename")).toHaveCount(1, { timeout: 20_000 });

			restore = renameFixture("before-rename", "after-rename");
			await expect(explorer.treeItem("after-rename")).toHaveCount(1, { timeout: 20_000 });

			// **Finding.** The OLD name stays in the tree. Asserted here rather than
			// in a separate test because it is the same event: a `rename(2)` is one
			// atomic move, and the index picks up the arrival without pruning the
			// departure — even though a plain delete (the test above) prunes
			// correctly, so it is the rename path specifically. Q9, with a
			// browser-level answer for the rename case.
			//
			// It is not cosmetic: the stale row is selectable, and selecting it
			// deep-links to a path that no longer exists.
			await expect(
				explorer.treeItem("before-rename"),
				"a renamed fixture file leaves its old path in the tree (Q9)",
			).toHaveCount(0, { timeout: 30_000 });

			await explorer.select("fixtures/after-rename", "Only");
			await explorer.waitForFrame();
			await expect(explorer.frame().locator("[data-e2e='renamed']")).toHaveText("RENAMED");
		} finally {
			restore?.();
			remove();
		}
	});
});
