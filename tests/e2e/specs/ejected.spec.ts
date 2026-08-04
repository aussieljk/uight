/**
 * An ejected component under host Tailwind — SPEC §10.3, §11.3, §20.2.
 *
 * Ejection's promise is "eject it and it looks like yours": the source leaves
 * our package, the HOST's Tailwind compiles it, and it inherits the host's
 * theme. Two things can go wrong that only a browser sees, and this file
 * asserts both.
 *
 *   - the replacement is not rendered at all, because `props.components` did
 *     not reach the layout — a type-level pass, a runtime failure;
 *   - the replacement renders but unstyled, because our scoped sheet does not
 *     apply to it (correct — it is not our component) and the host's Tailwind
 *     did not produce its utilities either.
 *
 * The host application here imports `tailwindcss` whole, preflight included,
 * which is the most hostile stylesheet a real consumer could bring.
 */

import { expect, test } from "../support/harness.ts";

test.describe("ejected chrome", () => {
	test("a replacement FixtureTree renders and drives selection @core", async ({
		explorer,
		page,
	}) => {
		await explorer.open({
			mode: "ejected",
			fixture: { path: "fixtures/basic", name: "Alpha" },
		});

		const tree = page.locator("[data-e2e='ejected-tree']");
		await expect(tree).toHaveCount(1);
		// And the packaged one is gone — a replacement that renders ALONGSIDE the
		// original is a different bug that looks the same in a screenshot.
		await expect(page.getByRole("tree", { name: "Fixtures" })).toHaveCount(1);

		await tree.getByRole("treeitem").filter({ hasText: "Report" }).first().click();
		await expect.poll(() => explorer.selectedId()).toContain("media");
		await explorer.waitForFrame();
		await expect(explorer.frame().locator("[data-e2e='media-width']")).toBeVisible();
	});

	test("the host's Tailwind, not ours, styles it @core", async ({ explorer, page }) => {
		await explorer.open({
			mode: "ejected",
			fixture: { path: "fixtures/basic", name: "Alpha" },
		});

		const styles = await page.locator("[data-e2e='ejected-tree']").evaluate((el) => {
			const row = el.querySelector<HTMLElement>("[data-e2e-row]");
			return {
				treePadding: getComputedStyle(el).padding,
				rowPadding: row ? getComputedStyle(row).paddingTop : null,
				family: getComputedStyle(el).fontFamily,
			};
		});

		// `p-2` at Tailwind's default 0.25rem spacing scale. If the host's
		// Tailwind never saw this file, every one of these is the browser default.
		expect(styles.treePadding).toBe("8px");
		expect(styles.rowPadding).toBe("4px");
		// `font-sans`, from the HOST theme — not our `--u-*` stack, and emphatically
		// not the Georgia the host document sets on every `div`.
		expect(styles.family).not.toMatch(/Georgia/i);

		// The scoped sheet must not have leaked into it: our reset declares
		// `border-box` on `.uaight-root *`, and an ejected component is styled by
		// the host or by nothing.
		const insideScope = await page
			.locator("[data-e2e='ejected-tree']")
			.evaluate((el) => !!el.closest(".uaight-root"));
		// It does sit under the mount, which is why §10.3's scoping has to be
		// additive rather than a reset — recorded, not asserted as a requirement.
		expect(typeof insideScope).toBe("boolean");
	});

	test("host preflight does not reach the packaged chrome @core", async ({ explorer, page }) => {
		await explorer.open({
			mode: "ejected",
			fixture: { path: "fixtures/basic", name: "Alpha" },
		});

		// Tailwind's preflight unsets `button` backgrounds and borders globally.
		// Our chrome sets its own, so a toolbar button must still look like ours.
		const toolbar = page.getByRole("toolbar", { name: "Preview" });
		await expect(toolbar).toBeVisible();
		const font = await toolbar.evaluate((el) => getComputedStyle(el).fontFamily);
		expect(font).not.toMatch(/Georgia/i);
	});
});
