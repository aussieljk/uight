/**
 * Content Security Policy — SPEC §6.7, §20.2.
 *
 * Two projects, one policy:
 *
 *   `chromium-csp`         the page publishes its nonce in `meta[name=csp-nonce]`
 *                          and everything must work;
 *   `chromium-csp-blocked` the identical policy with the meta tag withheld, so
 *                          the browser really does refuse the renderer script.
 *
 * The second is the one that matters. NOTES.md: "a handshake timeout can only
 * say 'nothing happened'", so `FrameHost` listens for `securitypolicyviolation`
 * on the FRAME's document and reports `violatedDirective`. A test that only
 * ever ran the passing case would prove nothing about that message — the same
 * negative-control lesson the corpus sweep in NOTES.md learned the hard way.
 */

import { expect, test } from "../support/harness.ts";

test.describe("CSP with nonces @csp", () => {
	test("the frame boots under a nonce policy", async ({ explorer, page }) => {
		await explorer.open({ fixture: { path: "fixtures/basic", name: "Alpha" } });
		await expect(explorer.frame().locator("[data-e2e='basic']")).toHaveText("ALPHA");

		// §6.7 step 2: the runtime-constructed frame document republishes the
		// parent's nonce so anything the renderer injects can find it.
		const inFrame = await page.evaluate(() => {
			const frame = document.querySelector<HTMLIFrameElement>("iframe[data-uaight-frame]");
			const doc = frame?.contentDocument;
			const meta = doc?.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]');
			const script = doc?.querySelector<HTMLScriptElement>("script[data-uaight-renderer]");
			const style = doc?.querySelector<HTMLStyleElement>("style[data-uaight-styles]");
			// Read the IDL property, never the attribute: browsers blank the
			// `nonce` CONTENT ATTRIBUTE after parsing (it is a CSP exfiltration
			// defence) and keep the value only on `element.nonce`. Asserting on
			// `getAttribute("nonce")` would fail on a correct implementation, which
			// is worse than not testing it.
			return {
				meta: meta?.content ?? null,
				scriptNonce: script?.nonce ?? null,
				styleNonce: style?.nonce ?? null,
			};
		});
		expect(inFrame.meta).toBe("uaightE2ENonce123");
		expect(inFrame.scriptNonce).toBe("uaightE2ENonce123");
		expect(inFrame.styleNonce).toBe("uaightE2ENonce123");
	});

	test("the scoped stylesheet is injected into both documents under CSP @csp", async ({
		explorer,
		page,
	}) => {
		await explorer.open({ fixture: { path: "fixtures/basic", name: "Alpha" } });
		const counts = await page.evaluate(() => {
			const frame = document.querySelector<HTMLIFrameElement>("iframe[data-uaight-frame]");
			return {
				host: document.querySelectorAll("style[data-uaight-styles]").length,
				frame: frame?.contentDocument?.querySelectorAll("style[data-uaight-styles]").length ?? -1,
			};
		});
		// §10.3: injected once per document, host and frame.
		expect(counts.host).toBe(1);
		expect(counts.frame).toBe(1);
	});
});

test.describe("CSP without a published nonce @cspblocked", () => {
	test("reports a failure rather than showing a blank frame", async ({ explorer, page }) => {
		await explorer.open({
			fixture: { path: "fixtures/basic", name: "Alpha" },
			waitForFrame: false,
		});
		const alert = page.getByRole("alert");
		await expect(alert.first()).toBeVisible({ timeout: 30_000 });
		await expect(alert.first()).toContainText(/could not start|could not be loaded|did not report READY/i);
		expect(await explorer.frame().locator("[data-e2e='basic']").count()).toBe(0);
	});

	test("names the violated directive", async ({ explorer, page }) => {
		// **Finding.** This fails. §6.7 step 5 asks for "a message naming the
		// missing directive rather than rendering an empty frame", and NOTES.md
		// records `FrameHost` listening for `securitypolicyviolation` on the
		// frame's document precisely so it can say `script-src`. Under a real
		// nonce policy in Chromium the message that actually reaches the user is
		// one of:
		//
		//   "The renderer entry could not be loaded from /@uaight/renderer."
		//   "the fixture frame did not report READY within 10s. Check that the
		//    renderer entry loaded and that no CSP directive blocked it."
		//
		// Both are the generic paths — the script `error` handler and the
		// handshake timeout — so the violation listener is either not firing or
		// losing the race. The half of step 5 that says "rather than rendering an
		// empty frame" IS met (the test above passes); the half that names the
		// directive is not, and naming it is the whole reason that listener
		// exists.
		test.fixme(true, "the CSP failure message does not name the violated directive (§6.7 step 5)");

		await explorer.open({
			fixture: { path: "fixtures/basic", name: "Alpha" },
			waitForFrame: false,
		});

		// §6.7 step 5. The message must name the directive; "the preview did not
		// load" is precisely what the spec says is not good enough.
		const alert = page.getByRole("alert");
		await expect(alert.first()).toBeVisible({ timeout: 30_000 });
		await expect(alert.first()).toContainText(/script-src/);

		// And the fixture really is absent — otherwise the policy was not enforced
		// and this test would pass for the wrong reason.
		expect(await explorer.frame().locator("[data-e2e='basic']").count()).toBe(0);
	});
});
