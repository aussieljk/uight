/**
 * The browser-side performance budgets — SPEC §20.3.
 *
 * "Measured in CI, failing on regression beyond a threshold." So these fail.
 * The Node-side budgets (plugin startup, incremental index, bundle size) belong
 * to the Vitest suite; the four here need a real frame in a real engine:
 *
 *   | Metric                                         | Budget          |
 *   | ---------------------------------------------- | --------------- |
 *   | Fixture selection to first paint (frame, warm) | < 250 ms        |
 *   | Frame handshake                                | < 100 ms        |
 *   | HMR latency, fixture edit to render            | < 150 ms        |
 *   | Memory after 100 mount/unmount cycles          | no upward trend |
 *
 * Three rules keep these honest rather than decorative:
 *
 *  1. **Every number is a median of repeated samples**, not one reading. A
 *     single sample on a shared CI box measures the box.
 *  2. **Every number is printed**, pass or fail, so the ROADMAP table can be
 *     updated from a run rather than from a memory.
 *  3. **"Warm" is stated and produced.** §20.3 says "frame, warm", so the
 *     measurement discards the first selection, which pays for the module
 *     graph, the optimizer and the frame document all at once.
 *
 * They run in their own single-worker project (`chromium-perf`) because a
 * parallel worker rebuilding a module graph is a timing artefact, not a
 * regression.
 */

import { patchFile } from "../support/edit.ts";
import { expect, test } from "../support/harness.ts";

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function report(name: string, value: number, budget: string): void {
	// eslint-disable-next-line no-console
	console.log(`[budget] ${name}: ${value.toFixed(1)} ms (budget ${budget})`);
}

test.describe("budgets @perf", () => {
	test.setTimeout(180_000);

	test("frame handshake < 100 ms", async ({ explorer }) => {
		const samples: number[] = [];
		for (let i = 0; i < 7; i++) {
			await explorer.open({ fixture: { path: "fixtures/basic", name: "Alpha" } });
			const marks = await explorer.marks();
			expect(marks.frameAttached).not.toBeNull();
			expect(marks.initAck).not.toBeNull();
			// Attach → INIT_ACK: the whole of §8.2's bootstrap, which is what a
			// user experiences as "the handshake". The READY→INIT_ACK round trip
			// alone is reported too, because they regress for different reasons.
			samples.push(marks.initAck! - marks.frameAttached!);
			if (i === 0) samples.pop(); // discard the cold first load
		}
		const value = median(samples);
		report("frame handshake (attach → INIT_ACK)", value, "< 100 ms");

		const marks = await explorer.marks();
		report("  of which READY → INIT_ACK", marks.initAck! - marks.ready!, "informational");

		expect(value).toBeLessThan(100);
	});

	test("fixture selection to first paint (frame, warm) < 250 ms", async ({
		explorer,
		page,
	}) => {
		await explorer.open({ fixture: { path: "fixtures/basic", name: "Alpha" } });

		// Warm: every module in the rotation has already been imported once, so
		// this measures selection, not the module graph.
		const rotation: Array<[string, string]> = [
			["fixtures/basic", "Beta"],
			["fixtures/media", "Report"],
			["fixtures/modal", "Single"],
			["fixtures/basic", "Alpha"],
		];
		for (const [path, name] of rotation) {
			await explorer.select(path, name);
			await page.waitForTimeout(300);
		}

		const samples: number[] = [];
		for (let i = 0; i < 12; i++) {
			const [path, name] = rotation[i % rotation.length]!;
			const elapsed = await page.evaluate(
				async ({ id }) => {
					const frame = document.querySelector<HTMLIFrameElement>("iframe[data-uaight-frame]");
					const root = frame?.contentDocument?.getElementById("uaight-root");
					if (!root) return -1;
					const before = root.innerHTML;
					const started = performance.now();
					const url = new URL(location.href);
					url.searchParams.set("fixture", id);
					history.pushState(null, "", url);
					dispatchEvent(new PopStateEvent("popstate"));
					return await new Promise<number>((resolve) => {
						const tick = () => {
							if (root.innerHTML !== before) resolve(performance.now() - started);
							else requestAnimationFrame(tick);
						};
						requestAnimationFrame(tick);
					});
				},
				{
					id: `uaight:1|${encodeURIComponent(path)}|${encodeURIComponent(name)}`,
				},
			);
			expect(elapsed).toBeGreaterThan(0);
			samples.push(elapsed);
		}

		const value = median(samples);
		report("fixture selection → first paint (warm)", value, "< 250 ms");
		expect(value).toBeLessThan(250);
	});

	test("HMR latency, fixture edit to render < 150 ms", async ({ explorer, page }) => {
		// **Was `fixme` at ~880 ms.** There was no update path: editing a fixture
		// file reloaded the whole HOST document, so every edit paid for a
		// navigation, a fresh explorer chunk, a fresh frame document and a fresh
		// handshake. See `hmr.spec.ts` › "a fixture edit re-renders in place…"
		// for the cause and the fix.
		//
		// The measurement changed with it, and only because its own stated
		// blocker is gone: the note below used to say an in-page observer "is
		// more precise, and it cannot be used" because the reload destroyed the
		// execution context mid-measurement. It no longer does, so the clock now
		// stops on a `MutationObserver` in the frame document instead of on
		// Playwright's polling interval — which was itself ~130 ms of what was
		// being reported. The budget is unchanged and the clock still starts in
		// Node, the instant before the write, so nothing about the edit is
		// excluded from it.
		await explorer.open({ fixture: { path: "fixtures/hmr", name: "Marker" } });
		const marker = explorer.frame().locator("[data-e2e='hmr-marker']");
		await expect(marker).toHaveText("HMR_MARKER_V0");

		const samples: number[] = [];
		let current = "HMR_MARKER_V0";
		const restores: Array<() => void> = [];
		try {
			for (let i = 1; i <= 6; i++) {
				const next = `HMR_MARKER_V${i}`;
				// Armed BEFORE the write, so nothing between the write and the
				// repaint can fall outside the window. It resolves the moment the
				// frame document shows the new text; the clock is Node's, started
				// the instant before the write, so the number includes the
				// filesystem event, the dev server, the socket and the re-render.
				const painted = page.evaluate((text) => {
					return new Promise<void>((resolve) => {
						const frame = document.querySelector<HTMLIFrameElement>(
							"iframe[data-uaight-frame]",
						);
						const doc = frame?.contentDocument;
						if (!doc) return resolve();
						const seen = (): boolean =>
							doc.querySelector("[data-e2e='hmr-marker']")?.textContent === text;
						if (seen()) return resolve();
						const observer = new MutationObserver(() => {
							if (!seen()) return;
							observer.disconnect();
							resolve();
						});
						observer.observe(doc.documentElement, {
							subtree: true,
							childList: true,
							characterData: true,
						});
					});
				}, next);
				// The observer is installed on the browser side before the write.
				await page.waitForTimeout(50);

				const started = Date.now();
				restores.push(patchFile("src/fixtures/hmr.fixture.tsx", current, next));
				await painted;
				const elapsed = Date.now() - started;
				await expect(marker).toHaveText(next, { timeout: 20_000 });
				// The first edit after a cold start pays for the dev server's first
				// invalidation of this module; §20.3's budget is the steady state.
				if (i > 1) samples.push(elapsed);
				current = next;
			}
		} finally {
			// Restores are stacked; the earliest one holds the original bytes.
			restores[0]?.();
		}
		await expect(marker).toHaveText("HMR_MARKER_V0", { timeout: 20_000 });

		const value = median(samples);
		report("HMR: fixture edit → render (wall clock, to repaint)", value, "< 150 ms");
		expect(value).toBeLessThan(150);
	});

	test("no upward memory trend over 100 mount/unmount cycles", async ({
		explorer,
		page,
	}) => {
		// `performance.memory` and the CDP heap counters are Chromium-only, and
		// this project IS Chromium. Rather than write a cross-engine memory test
		// that measures nothing, the trend is measured where it can be, and the
		// other engines are covered by the leak's other symptom: `mounts.spec.ts`
		// and `bootstrap.spec.ts` both assert exact listener-and-document counts,
		// which is what a leak of this shape looks like from the DOM.
		const client = await page.context().newCDPSession(page);
		await explorer.open({ mode: "cycles", waitForFrame: false });
		await expect(page.locator("[data-e2e='cycler']")).toHaveText("idle");

		const sample = async (): Promise<number> => {
			await client.send("HeapProfiler.collectGarbage");
			const { usedSize } = await client.send("Runtime.getHeapUsage");
			return usedSize;
		};

		const series: number[] = [];
		// Warm-up cycles first: the first mount loads the lazy explorer chunk and
		// its module-scope caches, which is a step change, not a trend.
		await page.evaluate(() => window.__uaightCycle!(10));
		series.push(await sample());

		for (let batch = 0; batch < 10; batch++) {
			await page.evaluate(() => window.__uaightCycle!(10));
			series.push(await sample());
		}

		const mb = series.map((b) => b / 1024 / 1024);
		// eslint-disable-next-line no-console
		console.log(
			`[budget] heap after each 10 cycles (MB): ${mb.map((v) => v.toFixed(1)).join(", ")}`,
		);

		// "No upward trend" as a falsifiable statement: fit a least-squares slope
		// over the ten post-warm-up samples and require it to be small relative to
		// the working set. A real leak of a frame document per cycle is megabytes
		// per batch, which this catches; GC jitter is not.
		const points = mb.slice(1);
		const n = points.length;
		const meanX = (n - 1) / 2;
		const meanY = points.reduce((a, b) => a + b, 0) / n;
		let num = 0;
		let den = 0;
		for (let i = 0; i < n; i++) {
			num += (i - meanX) * (points[i]! - meanY);
			den += (i - meanX) ** 2;
		}
		const slope = num / den; // MB per 10 cycles
		// eslint-disable-next-line no-console
		console.log(`[budget] heap trend: ${slope.toFixed(3)} MB per 10 mount/unmount cycles`);

		expect(slope).toBeLessThan(1.0);
		// And the total must not have doubled, which catches a trend that is real
		// but too jagged for the fit.
		expect(mb[mb.length - 1]!).toBeLessThan(mb[0]! * 2 + 8);
	});
});
