/**
 * The control panel, shared `?state=` links, and call-site driven props —
 * SPEC §7.2–§7.6, §5.4 as revisited by `ui/share.ts`, §12.2.
 *
 * The `?state=` tests never construct a token by hand. They make an edit in the
 * UI, read the URL the UI produced, and open it in a fresh page — which is what
 * a user does, and which means the encoder and the decoder are tested against
 * each other rather than against a copy of the encoder living in the test.
 */

import { expect, test } from "../support/harness.ts";

const PANEL = { path: "fixtures/controls", name: "Panel" };
const LATE = { path: "fixtures/controls", name: "Late" };

/**
 * **Was `fixme`, now fixed.** An edit made in the control panel did not reach
 * the frame. Two independent causes, both in the UI half:
 *
 *  - `ControlPanelInputs`'s text editors reported only on blur or Enter, so the
 *    panel's own `draft` state showed the new value while no patch was ever
 *    produced. They are live now, and `draft` still keeps the keystroke;
 *  - the `?state=` parameter of the fixture just left was seeded onto the
 *    fixture just arrived, so overlays appeared to survive a fixture change in
 *    breach of §7.3 — and patches that never found their input stayed pending
 *    for a later fixture using the same input name.
 */
test.describe("controls", () => {
	test("an edit in the panel reaches the frame @core", async ({ explorer, page }) => {
		await explorer.open({ fixture: PANEL });
		await expect(explorer.frame().locator("[data-e2e='control-label']")).toHaveText(
			"Click me",
		);

		await page.getByRole("textbox", { name: "label" }).fill("Edited");
		await expect(explorer.frame().locator("[data-e2e='control-label']")).toHaveText(
			"Edited",
		);

		await page.getByRole("combobox", { name: "variant" }).selectOption("secondary");
		await expect(explorer.frame().locator("[data-e2e='control-variant']")).toHaveText(
			"secondary",
		);

		await page.getByRole("checkbox", { name: "disabled" }).check();
		await expect(explorer.frame().locator("[data-e2e='control-disabled']")).toHaveText(
			"true",
		);
	});

	test("Reset returns the module's own default @core", async ({ explorer, page }) => {
		await explorer.open({ fixture: PANEL });
		await page.getByRole("textbox", { name: "label" }).fill("Edited");
		await expect(explorer.frame().locator("[data-e2e='control-label']")).toHaveText(
			"Edited",
		);

		// `r` is the documented shortcut and it only fires when something is
		// overlaid, which is exactly the condition we are in.
		await explorer.tree().getByRole("treeitem").first().focus();
		await page.keyboard.press("r");
		await expect(explorer.frame().locator("[data-e2e='control-label']")).toHaveText(
			"Click me",
		);
	});

	test("overlays are dropped when the fixture changes @core", async ({
		explorer,
		page,
	}) => {
		// §7.3: overlays live for the session and are dropped on fixture change.
		await explorer.open({ fixture: PANEL });
		await page.getByRole("textbox", { name: "label" }).fill("Edited");
		await expect(explorer.frame().locator("[data-e2e='control-label']")).toHaveText(
			"Edited",
		);

		await explorer.select("fixtures/basic", "Alpha");
		await expect(explorer.frame().locator("[data-e2e='basic']")).toHaveText("ALPHA");
		await explorer.select("fixtures/controls", "Panel");
		await expect(explorer.frame().locator("[data-e2e='control-label']")).toHaveText(
			"Click me",
		);
	});

	test("a shared `?state=` link reproduces the control values @core", async ({
		explorer,
		page,
	}) => {
		await explorer.open({ fixture: PANEL });
		await page.getByRole("textbox", { name: "label" }).fill("From a link");
		await expect(explorer.frame().locator("[data-e2e='control-label']")).toHaveText(
			"From a link",
		);

		// The link is whatever the UI put in the URL — not something we encoded.
		const shared = await page.evaluate(() => location.href);
		expect(new URL(shared).searchParams.get("state")).toBeTruthy();

		await page.goto(shared);
		await explorer.waitForFrame();
		await expect(explorer.frame().locator("[data-e2e='control-label']")).toHaveText(
			"From a link",
		);
		await expect(page.getByRole("textbox", { name: "label" })).toHaveValue("From a link");
	});

	test("a shared link seeds an input that registers late @core", async ({
		explorer,
		page,
	}) => {
		// New since the canary and never seen in a browser: the seeded overlay
		// exists before any input has registered, and `Late` does not register
		// until after a paint. A host that only applies seeded patches at
		// selection time loses this one silently.
		await explorer.open({ fixture: LATE });
		const label = explorer.frame().locator("[data-e2e='late-label']");
		await expect(label).toHaveText("late default");

		await page.getByRole("textbox", { name: "lateLabel" }).fill("seeded late");
		await expect(label).toHaveText("seeded late");

		const shared = await page.evaluate(() => location.href);
		await page.goto(shared);
		await explorer.waitForFrame();
		await expect(label).toHaveText("seeded late", { timeout: 20_000 });
	});

	test("a malformed `?state=` lands on the fixture rather than an error @core", async ({
		explorer,
		page,
	}) => {
		// `ui/share.ts`: "a bad link should land you on the fixture rather than on
		// an error". Total by construction, so this must be quiet.
		await explorer.open({ fixture: PANEL, state: "%%%not-base64%%%" });
		await expect(explorer.frame().locator("[data-e2e='control-label']")).toHaveText(
			"Click me",
		);
		expect(await page.locator("[role='alert']").count()).toBe(0);
	});

	test("a call site's props drive the control panel @core", async ({ explorer, page }) => {
		// §12.2. `src/main.tsx` writes `<Button label="Save changes" variant="primary" />`,
		// and the panel must offer those props with those values — quoting what the
		// user wrote, never inferring a control from a prop name (D18).
		await explorer.open({ fixture: { path: "fixtures/basic", name: "Alpha" } });

		await page.getByRole("button", { name: "Button", exact: true }).click();
		await expect(page.getByRole("tablist", { name: /Usages of Button/ })).toBeVisible();

		const label = page.getByRole("textbox", { name: "label" });
		await expect(label).toBeVisible({ timeout: 20_000 });

		// Which call site is selected first is not specified, so this asserts the
		// property that is: the panel quotes a value the user actually wrote at a
		// call site, and switching call site switches to the other one.
		const seen = new Set<string>();
		const tabs = page.getByRole("tablist", { name: /Usages of Button/ }).getByRole("tab");
		const count = await tabs.count();
		// Two call sites are written in `src/main.tsx`; the tablist also carries
		// whatever aggregate row the UI offers, so the assertion is on the values,
		// not on the row count.
		expect(count).toBeGreaterThanOrEqual(2);
		for (let i = 0; i < count; i++) {
			await tabs.nth(i).click();
			// The panel re-registers its inputs through the renderer, so the value
			// arrives a frame or two after the click. Settle before reading, or the
			// previous call site's value is what gets recorded.
			await page.waitForTimeout(750);
			if (!(await label.isVisible())) continue;
			seen.add(await label.inputValue());
		}
		expect([...seen].sort()).toContain("Cancel");
		expect([...seen].sort()).toContain("Save changes");

		// D18: nothing here was inferred from a prop NAME. `variant` is offered
		// because the call site wrote it, with the literal the call site used.
		await expect(page.getByRole("textbox", { name: "variant" })).toHaveValue(
			/^(primary|secondary)$/,
		);
	});
});
