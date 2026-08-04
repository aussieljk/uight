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
		// **Was `fixme`.** The edit arrived as a fresh HOST document, so the frame
		// realm went with it. A fixture module is reached through the
		// `import.meta.glob` in `virtual:uaight/runtime`, which both realms import
		// and nobody accepted, and §3.1 allows a fixture file whose exports are
		// elements — which `plugin-react` has no component to make a Fast Refresh
		// boundary out of. So the update propagated to the host entry and Vite
		// full-reloaded. The plugin now appends an accept callback to every
		// fixture module it serves and hands the new namespace to
		// `runtime/hot.ts`, which is the half Fast Refresh could not supply.
		//
		// It matters beyond tidiness: a reload throws away renderer-side state,
		// including the root overrides §7.3 uses for a setter's non-serializable
		// value, and it is why the budget in `budgets.spec.ts` measured what it
		// measured.
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
		// **Was `fixme`.** Adding a file reloaded the whole host document: a new
		// file changes the set of paths `import.meta.glob` matched, so Vite
		// invalidated the virtual module and, with nobody accepting it, took the
		// full-reload path. The generated module accepts itself now and publishes
		// its fresh loaders, and the host hands the renderer the reconciled index
		// over the transport rather than each realm racing the dev server for it.
		//
		// The cost this was recording is real: control values are session state
		// (Q14, not persisted), so a fixture appearing elsewhere in the project
		// used to discard whatever the user had tuned.
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

			// **Was `fixme`.** The OLD name stayed in the tree. Asserted here rather
			// than in a separate test because it is the same event: a `rename(2)`
			// is one atomic move, reported as `unlink(old)` then `add(new)`
			// microseconds apart — and the plugin's topology debounce kept only the
			// arguments of the call that armed it, so the unlink was discarded. A
			// plain delete was unaffected, which is what made it look
			// rename-specific. The debounce coalesces the SET of changed files now.
			//
			// It was not cosmetic: the stale row was selectable, and selecting it
			// deep-linked to a path that no longer existed.
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
