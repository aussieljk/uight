/**
 * The production preview and the base-path axis — SPEC §4.5, §9.2, §20.2, Q7.
 *
 * `base` is not cosmetic here. NOTES.md's Q7 answer records that
 * `import.meta.ROLLDOWN_FILE_URL_<ref>` does not exist, so the plugin emits a
 * placeholder and string-replaces it in `generateBundle`, "prefixed with the
 * resolved `base`". That replacement is the single point where a base-unaware
 * URL would be produced, and the only way to see it is to load a built explorer
 * from somewhere other than `/`.
 *
 * Three cells, three projects:
 *
 *   `chromium-prod`           default base, `vite preview`
 *   `chromium-base-nonroot`   built and served at `/explorer/`
 *   `chromium-base-relative`  built with `--base=./` and served, by a static
 *                             server that knows nothing about Vite, under
 *                             `/nested/deep/` — a prefix chosen AFTER the build
 */

import {
	collectConsoleErrors,
	expect,
	isIgnorableError,
	test,
} from "../support/harness.ts";

const ALPHA = { path: "fixtures/basic", name: "Alpha" };

test.describe("production preview @prod", () => {
	test("the built explorer boots and the handshake completes", async ({
		explorer,
		page,
	}) => {
		const errors = collectConsoleErrors(page);
		await explorer.open({ fixture: ALPHA });
		await expect(explorer.frame().locator("[data-e2e='basic']")).toHaveText("ALPHA");

		const types = (await explorer.protocol()).map((m) => m.type);
		expect(types).toContain("READY");
		expect(types).toContain("INIT_ACK");

		// There is no Vite client in a built frame document (§6.2), so any
		// `/@vite/` request would be a 404 and a broken build.
		const frameScripts = await page.evaluate(() => {
			const frame = document.querySelector<HTMLIFrameElement>("iframe[data-uaight-frame]");
			return [...(frame?.contentDocument?.querySelectorAll("script") ?? [])].map(
				(s) => s.src,
			);
		});
		expect(frameScripts.some((s) => s.includes("/@vite/"))).toBe(false);
		expect(frameScripts.some((s) => s.includes("/@uaight/renderer"))).toBe(false);

		expect(errors.filter((e) => !isIgnorableError(e))).toEqual([]);
	});

	test("controls still drive the frame in a build", async ({ explorer, page }) => {
		// Worth its own cell: the defect `controls.spec.ts` records was not a
		// dev-server artefact, so the fix has to hold in a build too.
		await explorer.open({ fixture: { path: "fixtures/controls", name: "Panel" } });
		await page.getByRole("textbox", { name: "label" }).fill("Built");
		await expect(explorer.frame().locator("[data-e2e='control-label']")).toHaveText(
			"Built",
		);
	});
});

test.describe("base path @base", () => {
	test("the renderer entry resolves under this base", async ({ explorer, page }) => {
		const failures: string[] = [];
		page.on("response", (response) => {
			if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
		});

		await explorer.open({ fixture: ALPHA });
		await expect(explorer.frame().locator("[data-e2e='basic']")).toHaveText("ALPHA");

		// Q7's placeholder replacement is base-prefixed. If it were not, the
		// renderer chunk would 404 and the frame would never paint — but assert on
		// the URL too, so a failure says WHY rather than "it timed out".
		const src = await page.evaluate(() => {
			const frame = document.querySelector<HTMLIFrameElement>("iframe[data-uaight-frame]");
			return (
				frame?.contentDocument
					?.querySelector("script[data-uaight-renderer]")
					?.getAttribute("src") ?? null
			);
		});
		expect(src).toBeTruthy();

		const base = new URL(page.url()).pathname.replace(/[^/]*$/, "");
		const resolved = new URL(src!, page.url()).pathname;
		expect(
			resolved.startsWith(base),
			`the renderer entry resolved to ${resolved}, outside this deployment's base ${base}`,
		).toBe(true);

		expect(failures.filter((f) => !/favicon/.test(f))).toEqual([]);
	});

	test("deep links and selection work under this base @base", async ({
		explorer,
		page,
	}) => {
		await explorer.open({ fixture: ALPHA });
		await explorer.select("fixtures/media", "Report");
		await explorer.waitForFrame();
		await expect(explorer.frame().locator("[data-e2e='media-width']")).toBeVisible();

		// §5.4 rule 1: routing touches ONLY the query parameter, never the
		// pathname — which is exactly why a non-root base is supposed to be a
		// non-event. A base-aware router would corrupt the path here.
		const path = new URL(page.url()).pathname;
		const base = path.replace(/[^/]*$/, "");
		expect(base).not.toBe("/");
		await expect.poll(() => new URL(page.url()).pathname).toBe(path);
	});
});
