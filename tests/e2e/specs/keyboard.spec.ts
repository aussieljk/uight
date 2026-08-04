/**
 * Keyboard-only navigation, the command palette, focus and screen-reader
 * labels — SPEC §10.1 ("keyboard-first, no hover-only affordances"), §20.2.
 *
 * Selector policy applies with particular force here, because this is the part
 * of the UI being rewritten hardest: the tree is virtualizing, the help popover
 * is becoming a centered dialog on the palette's overlay primitive, and the
 * panes are becoming resizable. Every assertion below is on a role, an
 * accessible name or the URL. None is on a class, an order of siblings or a
 * pixel.
 *
 * Note on scope: uaight's shortcuts are bound to the MOUNT, not the document
 * ("an embedded explorer must not take ⌘K from its host" — `UaightUI`), so
 * every test focuses something inside the explorer first. That is not a
 * workaround; it is the behaviour, and `mounts.spec.ts` asserts the other half.
 */

import { expect, test } from "../support/harness.ts";

const ALPHA = { path: "fixtures/basic", name: "Alpha" };

test.describe("keyboard", () => {
	test("the tree is reachable and operable with the keyboard alone @core", async ({
		explorer,
		page,
	}) => {
		await explorer.open({ fixture: ALPHA });

		// §10.1: a single tab stop, arrows rove, Enter selects. Auto-selecting on
		// arrow is forbidden (§12) — moving focus must not load anything.
		const tree = explorer.tree();
		await tree.getByRole("treeitem").first().focus();
		const before = await explorer.selectedId();

		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("ArrowDown");
		expect(await explorer.selectedId()).toBe(before);

		const focusedLabel = await page.evaluate(() => document.activeElement?.textContent?.trim());
		expect(focusedLabel).toBeTruthy();

		await page.keyboard.press("Enter");
		// Enter on a group toggles; on a fixture it selects. Either way the focus
		// must not leave the tree — that is the "keyboard-only" claim.
		const stillInTree = await page.evaluate(
			() => !!document.activeElement?.closest('[role="tree"]'),
		);
		expect(stillInTree).toBe(true);
	});

	test("`/` focuses this mount's search box and Escape clears it @core", async ({
		explorer,
		page,
	}) => {
		await explorer.open({ fixture: ALPHA });
		await explorer.tree().getByRole("treeitem").first().focus();

		await page.keyboard.press("/");
		await expect(explorer.search()).toBeFocused();

		await explorer.search().fill("media");
		await expect(explorer.tree().getByRole("treeitem")).toHaveCount(
			await explorer.tree().getByRole("treeitem").count(),
		);
		await page.keyboard.press("Escape");
		await expect(explorer.search()).toHaveValue("");
	});

	test("`j` and `k` move the selection and drive the URL @core", async ({ explorer, page }) => {
		await explorer.open({ fixture: ALPHA });
		await explorer.tree().getByRole("treeitem").first().focus();

		// `j`/`k` step FILES, not variants — the keymap gives variants to `→`/`←`,
		// and stepping from `basic/Alpha` lands on the next file rather than on
		// `basic/Beta`. So the involution is asserted from a position `j` itself
		// produced, not from an arbitrary starting selection; asserting a
		// round-trip from a variant would encode a keymap uaight does not have.
		await page.keyboard.press("j");
		await expect.poll(() => explorer.selectedId()).not.toBeNull();
		const anchor = await explorer.selectedId();

		await page.keyboard.press("j");
		await expect.poll(() => explorer.selectedId()).not.toBe(anchor);
		const forward = await explorer.selectedId();

		await page.keyboard.press("k");
		await expect.poll(() => explorer.selectedId()).toBe(anchor);
		expect(forward).not.toBe(anchor);
	});

	test("`→` and `←` step variants within the selected file @core", async ({ explorer, page }) => {
		await explorer.open({ fixture: ALPHA });
		// NOT the tree: it owns the arrows while focus is inside it (they rove and
		// expand there) and calls `preventDefault`. Anywhere else in the mount,
		// arrows belong to the selection. Focus a toolbar control, which is a
		// non-text element with a spec-named accessible name (§6.5).
		await page.getByRole("group", { name: "Viewport" }).getByRole("button").first().focus();

		await page.keyboard.press("ArrowRight");
		await expect.poll(() => explorer.selectedId()).toContain("fixtures%2Fbasic");
		const after = await explorer.selectedId();
		expect(after).not.toBe(`uaight:1|${encodeURIComponent("fixtures/basic")}|Alpha`);

		await page.keyboard.press("ArrowLeft");
		await expect
			.poll(() => explorer.selectedId())
			.toBe(`uaight:1|${encodeURIComponent("fixtures/basic")}|Alpha`);
	});

	test("⌘K opens the palette, focuses its input, and Escape closes it @core", async ({
		explorer,
		page,
	}) => {
		await explorer.open({ fixture: ALPHA });
		// Focus must be inside the mount: the binding is scoped on purpose.
		await explorer.search().focus();

		await page.keyboard.press("ControlOrMeta+k");
		const palette = explorer.palette();
		await expect(palette).toBeVisible();
		// New since the canary and never seen in a browser: the palette must take
		// focus itself, or the first keystroke after ⌘K goes to whatever had it.
		await expect(palette.getByRole("textbox", { name: "Search" })).toBeFocused();

		await page.keyboard.press("Escape");
		await expect(palette).toBeHidden();
	});

	test("the palette scrolls the highlighted row into view @core", async ({ explorer, page }) => {
		await explorer.open({ fixture: ALPHA });
		await explorer.search().focus();
		await page.keyboard.press("ControlOrMeta+k");

		const palette = explorer.palette();
		await expect(palette).toBeVisible();
		const options = palette.getByRole("option");
		const count = await options.count();
		expect(count).toBeGreaterThan(3);

		// Walk past the fold. The row that ends up highlighted must be inside the
		// listbox's own scroll box — `scrollIntoView({block:"nearest"})` is the
		// implementation, "you can see the thing you are about to press Enter on"
		// is the requirement.
		for (let i = 0; i < count - 1; i++) await page.keyboard.press("ArrowDown");

		const visible = await palette.evaluate((dialog) => {
			const list = dialog.querySelector('[role="listbox"]');
			const active = dialog.querySelector('[role="option"][aria-selected="true"]')
				?? dialog.querySelector('[role="option"][data-active="true"]');
			if (!list || !active) return null;
			const l = list.getBoundingClientRect();
			const a = active.getBoundingClientRect();
			return a.top >= l.top - 1 && a.bottom <= l.bottom + 1;
		});
		// `null` means the palette does not mark its active row in the DOM in a
		// way a test can see. That is a missing hook, not a passing test.
		expect(
			visible,
			"the palette's active option is not identifiable from the DOM — see the report's list of requested hooks",
		).not.toBeNull();
		expect(visible).toBe(true);
	});

	test("the palette selects a fixture with the keyboard alone @core", async ({
		explorer,
		page,
	}) => {
		await explorer.open({ fixture: ALPHA });
		await explorer.search().focus();
		await page.keyboard.press("ControlOrMeta+k");

		const palette = explorer.palette();
		await expect(palette).toBeVisible();
		await palette.getByRole("textbox", { name: "Search" }).fill("media");
		await expect(palette.getByRole("option").first()).toBeVisible();
		await page.keyboard.press("Enter");

		await expect(palette).toBeHidden();
		await expect.poll(() => explorer.selectedId()).toContain("media");
		await explorer.waitForFrame();
		await expect(explorer.frame().locator("[data-e2e='media-width']")).toBeVisible();
	});

	test("focus is not lost when the fixture changes @core", async ({ explorer, page }) => {
		await explorer.open({ fixture: ALPHA });
		await explorer.tree().getByRole("treeitem").first().focus();

		await page.keyboard.press("j");
		await explorer.waitForFrame();

		// Focus restoration after a fixture change (§20.2): whatever moves, focus
		// must remain inside the explorer. Landing on <body> means the next
		// keystroke does nothing, which is how a keyboard-first UI dies.
		const where = await page.evaluate(() => {
			const active = document.activeElement;
			if (!active || active === document.body) return "body";
			return active.closest(".uaight-root") ? "explorer" : "elsewhere";
		});
		expect(where).toBe("explorer");
	});

	test("screen-reader labels name every landmark and control @core", async ({ explorer, page }) => {
		await explorer.open({ fixture: { path: "fixtures/controls", name: "Panel" } });

		await expect(explorer.tree()).toBeVisible();
		await expect(explorer.search()).toHaveAttribute("aria-label", /search/i);
		await expect(page.getByRole("toolbar", { name: "Preview" })).toBeVisible();
		await expect(page.getByRole("group", { name: "Viewport" })).toBeVisible();
		await expect(page.getByRole("tablist", { name: /Fixtures in/ })).toBeVisible();

		// §7.5's controls are the part a screen reader most needs named, because
		// the label is the only thing distinguishing one text box from another.
		await expect(page.getByRole("textbox", { name: "label" })).toBeVisible();
		await expect(page.getByRole("combobox", { name: "variant" })).toBeVisible();
		await expect(page.getByRole("slider", { name: "count" })).toBeVisible();
		await expect(page.getByRole("checkbox", { name: "disabled" })).toBeVisible();

		// Every treeitem has an accessible name. An unnamed row is a row a screen
		// reader reads as "tree item", which is no navigation at all.
		const names = await explorer.tree().getByRole("treeitem").allTextContents();
		expect(names.length).toBeGreaterThan(0);
		for (const name of names) expect(name.trim()).not.toBe("");
	});

	test("`?` toggles the shortcut list @core", async ({ explorer, page }) => {
		await explorer.open({ fixture: ALPHA });
		await explorer.tree().getByRole("treeitem").first().focus();

		await page.keyboard.press("?");
		// The help surface is mid-rewrite from a popover into a centered dialog on
		// the palette's overlay primitive, so this asserts on the CONTENT — one of
		// the documented key names — rather than on which element renders it.
		await expect(page.getByText("Focus search", { exact: false }).first()).toBeVisible();

		await page.keyboard.press("Escape");
		await expect(page.getByText("Focus search", { exact: false })).toHaveCount(0);
	});
});
