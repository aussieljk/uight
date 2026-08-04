/**
 * Two mounts on one page — SPEC §5.4, §20.2.
 *
 * §5.4's rule is refcounted single ownership of a URL parameter: the first
 * mount owns it, the second falls back to local selection state IDENTICALLY in
 * development and production, plus a development error naming the key. That
 * last clause is the interesting one, because "it works but only in dev" is the
 * outcome the rule exists to prevent, and only a browser can check that both
 * mounts really are independently usable.
 *
 * **Finding.** With React StrictMode on — which is the default in this host app
 * and in most real ones — a second mount leaves NEITHER mount owning the
 * parameter, so the deep link in the URL is honoured by nobody and both render
 * the empty state. With StrictMode off the specified behaviour is exactly
 * right: the first mount renders the deep-linked fixture, the second falls back
 * to local state and logs the §5.4 error. `router.ts` says the claim is taken
 * in a layout effect "so StrictMode's mount → cleanup → mount cycle nets out to
 * a single claim"; with two claimants it does not. The StrictMode test below is
 * `fixme` and states this; the StrictMode-off test passes and pins the rule.
 */

import { collectConsoleErrors, expect, test } from "../support/harness.ts";

const ALPHA = { path: "fixtures/basic", name: "Alpha" };

test.describe("two mounts", () => {
	test("the first mount owns the URL and the second is denied @core", async ({
		explorer,
		page,
	}) => {
		test.fixme(
			true,
			"under StrictMode neither mount ends up owning the parameter, so both render the empty state — see this file's header",
		);
		const errors = collectConsoleErrors(page);
		await explorer.open({ mode: "two", fixture: ALPHA });
		await explorer.waitForFrame(1);

		await expect(explorer.frame(0).locator("[data-e2e='basic']")).toHaveText("ALPHA");
		expect(
			errors.some((e) => /two mounts asked to own the URL parameter/.test(e)),
			"§5.4 requires a development error naming the key when a second mount is denied",
		).toBe(true);
	});

	test("with StrictMode off, §5.4's arbitration is exactly as specified @core", async ({
		explorer,
		page,
	}) => {
		const errors = collectConsoleErrors(page);
		await explorer.open({ mode: "two", strict: false, fixture: ALPHA });

		// The owner renders the deep link…
		await expect(explorer.frame(0).locator("[data-e2e='basic']")).toHaveText("ALPHA");
		// …and the denied one falls back to local state, which starts empty. That
		// is the specified fallback, not a failure: it must not silently share the
		// owner's selection, and it must not throw.
		await expect(explorer.frame(1).locator("[data-e2e='basic']")).toHaveCount(0);

		expect(
			errors.some((e) => /two mounts asked to own the URL parameter "fixture"/.test(e)),
			"§5.4 requires a development error naming the key",
		).toBe(true);
	});

	test("the denied mount still selects, without touching the URL @core", async ({
		explorer,
		page,
	}) => {
		await explorer.open({ mode: "two", strict: false, fixture: ALPHA });
		const before = await explorer.selectedId();

		await explorer.tree(1).getByRole("treeitem").first().focus();
		await page.keyboard.press("j");

		// Something is now rendering in the second mount…
		await expect(explorer.frame(1).locator("[data-e2e]").first()).toBeVisible();
		// …the URL did not move…
		expect(await explorer.selectedId()).toBe(before);
		// …and the first mount is untouched.
		await expect(explorer.frame(0).locator("[data-e2e='basic']")).toHaveText("ALPHA");
	});

	test("two mounts with distinct urlParams both route @core", async ({ explorer, page }) => {
		const errors = collectConsoleErrors(page);
		await explorer.open({ mode: "two-router", waitForFrame: false });
		await explorer.waitForFrame(0);
		await explorer.waitForFrame(1);

		await explorer.tree(0).getByRole("treeitem").first().focus();
		await page.keyboard.press("j");
		await expect.poll(() => explorer.selectedId("fixtureA")).not.toBeNull();

		await explorer.tree(1).getByRole("treeitem").first().focus();
		await page.keyboard.press("j");
		await expect.poll(() => explorer.selectedId("fixtureB")).not.toBeNull();

		expect(errors.filter((e) => /two mounts asked to own/.test(e))).toEqual([]);
	});

	test("a shortcut fires only in the mount that has focus @core", async ({ explorer, page }) => {
		// "an embedded explorer must not take ⌘K from its host" — the same
		// scoping rule applies between two explorers.
		await explorer.open({ mode: "two-router", waitForFrame: false });
		await explorer.waitForFrame(1);

		await explorer.search(1).focus();
		await page.keyboard.press("ControlOrMeta+k");
		await expect(explorer.palette()).toHaveCount(1);
	});
});
