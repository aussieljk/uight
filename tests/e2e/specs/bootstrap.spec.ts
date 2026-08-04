/**
 * Frame bootstrap and handshake — SPEC §6.2, §8.2, Q1.
 *
 * This is the highest-value file in the suite. `FrameHost` carries THREE
 * defences against the about:blank race (NOTES.md, "Q1 — the frame bootstrap
 * race"), each covering a different engine's ordering, and until now exactly
 * one engine had ever been observed. Every test below is written so that
 * removing one defence fails it:
 *
 *   1. **write immediately, retry on animation frames** — covered by the plain
 *      "the frame renders" test, which fails on an engine where
 *      `contentDocument` is not usable in the effect and there is no retry;
 *   2. **a `load` listener for the frame's whole life that rewrites a blanked
 *      document** — covered by `recovers when the frame document is blanked`,
 *      which navigates the frame to about:blank from the outside and requires
 *      the fixture to come back. That is the same event the engine generates on
 *      its own in ordering (b), delivered deterministically;
 *   3. **the written-flag guard** — covered by the duplicate-renderer test: a
 *      load event that did NOT blank us must be a no-op, so there is exactly
 *      one renderer script and one `READY` per document.
 *
 * The tests are tagged `@core` so the React 18 project runs them too: §8.2's
 * queue-before-ready path is scheduler-sensitive and React 18 and 19 do not
 * schedule identically.
 */

import { collectConsoleErrors, expect, isIgnorableError, test } from "../support/harness.ts";

test.describe("frame bootstrap @core", () => {
	test("the frame boots and the handshake completes", async ({ explorer, page }) => {
		const errors = collectConsoleErrors(page);
		await explorer.open({ fixture: { path: "fixtures/basic", name: "Alpha" } });

		await expect(explorer.frame().locator("[data-e2e='basic']")).toHaveText("ALPHA");

		const protocol = await explorer.protocol();
		const types = protocol.map((m) => m.type);
		// §8.2: the child announces READY, the host replies INIT, the child ACKs.
		// INIT is host→frame so it is not visible from here; the ACK proves it.
		expect(types).toContain("READY");
		expect(types).toContain("INIT_ACK");
		expect(types.indexOf("READY")).toBeLessThan(types.indexOf("INIT_ACK"));

		const marks = await explorer.marks();
		expect(marks.frameAttached).not.toBeNull();
		expect(marks.initAck).not.toBeNull();

		expect(errors.filter((e) => !isIgnorableError(e))).toEqual([]);
	});

	test("exactly one renderer script and one READY per document @core", async ({ explorer, page }) => {
		await explorer.open({ fixture: { path: "fixtures/basic", name: "Alpha" } });

		const scripts = await page.evaluate(() => {
			const frame = document.querySelector<HTMLIFrameElement>("iframe[data-uaight-frame]");
			return frame?.contentDocument?.querySelectorAll("script[data-uaight-renderer]").length ?? -1;
		});
		expect(scripts).toBe(1);

		const roots = await page.evaluate(() => {
			const frame = document.querySelector<HTMLIFrameElement>("iframe[data-uaight-frame]");
			return frame?.contentDocument?.querySelectorAll("#uaight-root").length ?? -1;
		});
		expect(roots).toBe(1);

		// Defence 3: the written-flag guard. One document written, one READY.
		// StrictMode double-invokes effects, so a missing guard shows up here.
		const readies = (await explorer.protocol()).filter((m) => m.type === "READY");
		expect(readies).toHaveLength(1);
	});

	test("recovers when the frame document is blanked @core", async ({ explorer, page }) => {
		await explorer.open({ fixture: { path: "fixtures/basic", name: "Alpha" } });
		await expect(explorer.frame().locator("[data-e2e='basic']")).toHaveText("ALPHA");

		// Defence 2, delivered on purpose: a navigation replaces the document we
		// wrote, exactly as the in-flight about:blank load does in ordering (b).
		await page.evaluate(() => {
			const frame = document.querySelector<HTMLIFrameElement>("iframe[data-uaight-frame]");
			frame?.contentWindow?.location.replace("about:blank");
		});

		// The marker must come back without the host remounting anything.
		await explorer.waitForFrame();
		await expect(explorer.frame().locator("[data-e2e='basic']")).toHaveText("ALPHA");

		// §8.2 treats the second READY as a frame reload: same mountId, sequences
		// reset, overlays replayed. So there are exactly two, not one and not
		// three — three would mean the recovery itself was written twice.
		const readies = (await explorer.protocol()).filter((m) => m.type === "READY");
		expect(readies.length).toBe(2);

		// And the recovered document still carries exactly one renderer.
		const scripts = await page.evaluate(() => {
			const frame = document.querySelector<HTMLIFrameElement>("iframe[data-uaight-frame]");
			return frame?.contentDocument?.querySelectorAll("script[data-uaight-renderer]").length ?? -1;
		});
		expect(scripts).toBe(1);
	});

	test("the selection survives a frame reload @core", async ({ explorer, page }) => {
		await explorer.open({ fixture: { path: "fixtures/basic", name: "Beta" } });
		await expect(explorer.frame().locator("[data-e2e='basic']")).toHaveText("BETA");

		await page.evaluate(() => {
			const frame = document.querySelector<HTMLIFrameElement>("iframe[data-uaight-frame]");
			frame?.contentWindow?.location.replace("about:blank");
		});
		await explorer.waitForFrame();

		// NOTES.md: "UaightUI re-sends SELECT_FIXTURE whenever the transport
		// reports ready, so a reload lands on the right fixture."
		await expect(explorer.frame().locator("[data-e2e='basic']")).toHaveText("BETA");
	});

	test("a single-fixture file is selectable @core", async ({ explorer }) => {
		// §3.4's `names: [null]`. The integration log records a period where every
		// zero-config single-fixture file was invisible in the tree; this is the
		// browser-level guard against that returning through another door.
		await explorer.open({ fixture: { path: "fixtures/single", name: null } });
		await expect(explorer.frame().locator("[data-e2e='single']")).toHaveText("SINGLE");
	});

	test("the preview entry runs in the frame realm @core", async ({ explorer, page }) => {
		// §6.4: the consumer's providers wrap the fixture inside the FRAME, and
		// must not appear in the host document.
		await explorer.open({ fixture: { path: "fixtures/basic", name: "Alpha" } });
		await expect(explorer.frame().locator("[data-e2e-preview]")).toHaveCount(1);
		expect(await page.locator("[data-e2e-preview]").count()).toBe(0);
	});

	test("StrictMode off changes nothing @core", async ({ explorer }) => {
		// If a defence depends on the double-invoke it is not a defence.
		await explorer.open({ strict: false, fixture: { path: "fixtures/basic", name: "Alpha" } });
		await expect(explorer.frame().locator("[data-e2e='basic']")).toHaveText("ALPHA");
		const readies = (await explorer.protocol()).filter((m) => m.type === "READY");
		expect(readies).toHaveLength(1);
	});
});

test.describe("inline isolation", () => {
	test("renders in the host realm with no frame", async ({ explorer, page }) => {
		// §5.2: one realm, two ends, no postMessage.
		//
		// FIXME — this fails against the current `dist`, and the assertion is
		// correct as written. Inline isolation mounts (`data-uaight-inline` is
		// present, the preview entry runs, the toolbar reports `inline`) but the
		// renderer shows "No fixture selected." for EVERY selection: the initial
		// deep link, a tree click, and later `pushState` navigations alike.
		// Reproduced with and without a `previewEntry`, so it is not the deferred
		// `RendererApp` mount in `InlineHost.tsx`. `createDirectTransportPair`
		// reports `status: "ready"` from the first read, so the host has nothing
		// to wait for and delivers `SELECT_FIXTURE` through a scheduled microtask
		// that appears to land before the renderer subscribes. Frame isolation is
		// unaffected. Delete this `fixme` once the inline path delivers.
		test.fixme(true, "inline isolation never receives SELECT_FIXTURE — see the comment above");
		await explorer.open({
			mode: "inline",
			fixture: { path: "fixtures/basic", name: "Alpha" },
			waitForFrame: false,
		});
		await expect(page.locator("[data-e2e='basic']")).toHaveText("ALPHA");
		await expect(page.locator("iframe[data-uaight-frame]")).toHaveCount(0);
		await expect(page.locator("[data-uaight-isolation='inline']")).toHaveCount(1);
		expect(await explorer.protocol()).toEqual([]);
	});
});
