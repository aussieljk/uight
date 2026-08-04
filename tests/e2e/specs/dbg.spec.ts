import { expect, test } from "../support/harness.ts";
test("dbg", async ({ explorer, page }) => {
	page.on("console", (m) => console.log("HOST:", m.text()));
	page.on("pageerror", (e) => console.log("ERR:", String(e)));
	await explorer.open({ fixture: { path: "fixtures/controls", name: "Panel" } });
	await page.getByRole("checkbox", { name: "disabled" }).check();
	await page.waitForTimeout(1500);
	console.log("DISABLED:", await explorer.frame().locator("[data-e2e='control-disabled']").textContent());
	await page.getByRole("combobox", { name: "variant" }).selectOption("secondary");
	await page.waitForTimeout(1000);
	console.log("VARIANT:", await explorer.frame().locator("[data-e2e='control-variant']").textContent());
	await page.getByRole("textbox", { name: "label" }).fill("Edited");
	await page.getByRole("textbox", { name: "label" }).press("Enter");
	await page.waitForTimeout(1000);
	console.log("LABEL:", await explorer.frame().locator("[data-e2e='control-label']").textContent());
});
