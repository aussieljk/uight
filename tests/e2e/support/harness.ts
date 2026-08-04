/**
 * The shared harness: an extended `test` plus the few selectors and waits every
 * spec needs.
 *
 * **Selector policy.** The explorer UI is being reworked continuously — the
 * tree is virtualizing, the help popover is becoming a dialog, panes are
 * becoming resizable, the type scale is moving to stock Tailwind utilities.
 * So nothing here selects on a class name or on DOM shape. Only:
 *
 *   - ARIA roles and accessible names (`role="tree"`, `aria-label="Fixtures"`, …)
 *   - the documented stable data attributes (`data-uaight-frame`,
 *     `data-uaight-search`, `data-uaight-isolation`, `data-uaight-theme`)
 *   - ids the package itself treats as contract (`#uaight-root` in the frame)
 *   - `data-e2e-*` attributes on OUR OWN fixtures, which nobody else owns
 *
 * If a spec below cannot express something under that policy it is marked
 * `test.fixme` with the hook it would need, rather than reaching for a class.
 */

import { expect, test as base } from "@playwright/test";
import type { FrameLocator, Page } from "@playwright/test";
import { INSTRUMENT_SOURCE } from "./instrument.ts";
import type { Marks } from "./instrument.ts";

/** §3.2's canonical encoding, duplicated deliberately: a test that imports the
 *  implementation of the thing it is checking cannot catch the implementation
 *  changing. */
export function fixtureId(path: string, name: string | null): string {
	return name === null
		? `uaight:1|${encodeURIComponent(path)}`
		: `uaight:1|${encodeURIComponent(path)}|${encodeURIComponent(name)}`;
}

export interface OpenOptions {
	/** `main.tsx`'s mode switch: two, two-router, inline, ejected, cycles. */
	mode?: string;
	/** Deep-link straight to a fixture (§3.2, §5.3). */
	fixture?: { path: string; name: string | null };
	/** A `?state=` token — the shared-link scenario. */
	state?: string;
	/** StrictMode is on unless this is false. */
	strict?: boolean;
	/** Extra query parameters. */
	query?: Record<string, string>;
	/** Skip the wait for the frame to paint (inline mode, cycles mode). */
	waitForFrame?: boolean;
}

export const test = base.extend<{ explorer: Explorer }>({
	explorer: async ({ page, baseURL }, use) => {
		await page.addInitScript(INSTRUMENT_SOURCE);
		await use(new Explorer(page, baseURL ?? "/"));
	},
});

export { expect };

export class Explorer {
	constructor(
		readonly page: Page,
		readonly baseURL: string,
	) {}

	/** The host app's URL for a given mode/selection. Respects the project base. */
	url(options: OpenOptions = {}): string {
		const params = new URLSearchParams();
		if (options.mode) params.set("mode", options.mode);
		if (options.strict === false) params.set("strict", "0");
		if (options.fixture) params.set("fixture", fixtureId(options.fixture.path, options.fixture.name));
		if (options.state) params.set("state", options.state);
		for (const [k, v] of Object.entries(options.query ?? {})) params.set(k, v);
		const query = params.toString();
		return query ? `./?${query}` : "./";
	}

	async open(options: OpenOptions = {}): Promise<void> {
		await this.page.goto(this.url(options));
		if (options.waitForFrame !== false) await this.waitForFrame();
	}

	/** The preview iframe. `data-uaight-frame` is set by `FrameHost` (§6.2). */
	frame(index = 0): FrameLocator {
		return this.page.locator("iframe[data-uaight-frame]").nth(index).contentFrame();
	}

	/**
	 * Waits until the renderer has actually put something in `#uaight-root`
	 * inside the frame document — not merely until the iframe exists. The
	 * distinction is the whole of Q1: an attached iframe whose document was
	 * blanked by the in-flight about:blank load looks identical from outside.
	 */
	async waitForFrame(index = 0, timeout = 20_000): Promise<void> {
		await this.page.locator("iframe[data-uaight-frame]").nth(index).waitFor({ timeout });
		await expect
			.poll(
				async () =>
					this.page.evaluate(
						({ i }) => {
							const frames = document.querySelectorAll<HTMLIFrameElement>("iframe[data-uaight-frame]");
							const doc = frames[i]?.contentDocument;
							const root = doc?.getElementById("uaight-root");
							return root ? root.childElementCount : -1;
						},
						{ i: index },
					),
				{ timeout, message: "the frame document never rendered into #uaight-root" },
			)
			.toBeGreaterThan(0);
	}

	async marks(): Promise<Marks> {
		return this.page.evaluate(() => (window as unknown as { __uaightMarks: Marks }).__uaightMarks);
	}

	async protocol(): Promise<Array<{ type: string; at: number }>> {
		return this.page.evaluate(
			() => (window as unknown as { __uaightProtocol: Array<{ type: string; at: number }> }).__uaightProtocol,
		);
	}

	/** The mount's search box — `data-uaight-search` is a documented hook. */
	search(index = 0) {
		return this.page.locator("[data-uaight-search]").nth(index);
	}

	tree(index = 0) {
		return this.page.getByRole("tree", { name: "Fixtures" }).nth(index);
	}

	treeItem(label: string, index = 0) {
		return this.tree(index).getByRole("treeitem").filter({ hasText: label });
	}

	palette() {
		return this.page.getByRole("dialog", { name: "Find a fixture or component" });
	}

	/** Selection lives in the URL (§5.4), which is the only routed source of truth. */
	async selectedId(param = "fixture"): Promise<string | null> {
		return this.page.evaluate((p) => new URL(location.href).searchParams.get(p), param);
	}

	/**
	 * Selects through the URL rather than the UI. Used wherever the spec under
	 * test is not the tree, so a tree rewrite cannot fail an unrelated test.
	 */
	async select(path: string, name: string | null): Promise<void> {
		await this.page.evaluate((id) => {
			const url = new URL(location.href);
			url.searchParams.set("fixture", id);
			history.pushState(null, "", url);
			dispatchEvent(new PopStateEvent("popstate"));
		}, fixtureId(path, name));
	}
}

/** Console errors, collected for the "no console errors" assertions §20.2 implies. */
export function collectConsoleErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	page.on("pageerror", (error) => errors.push(String(error)));
	return errors;
}

/** Errors that are noise from the environment rather than from the package. */
export function isIgnorableError(text: string): boolean {
	return (
		/Failed to load resource.*favicon/i.test(text) ||
		/ResizeObserver loop/i.test(text) ||
		/Download the React DevTools/i.test(text)
	);
}
