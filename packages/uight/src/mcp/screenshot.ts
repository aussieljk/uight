/**
 * `render_fixture` — the explorer, seen rather than linked. SPEC §3.2, §10.1.
 *
 * Every other MCP tool answers a question about the index; this one answers
 * "what does it *look* like", which is the question a URL cannot answer to an
 * agent. It drives a headless browser to the explorer's deep link for one
 * fixture (§3.2's encoding), waits for the renderer to actually paint, and
 * returns a PNG as an MCP image block.
 *
 * Two things are load-bearing here and both were learned in `tests/e2e`:
 *
 * 1. **Waiting for a real render.** An iframe that exists proves nothing: the
 *    frame document is blanked by the in-flight `about:blank` load, and from
 *    outside that is indistinguishable from a rendered frame. The condition
 *    that *is* evidence is `#uight-root` inside the frame document having
 *    children — the same condition `tests/e2e/support/harness.ts`'s
 *    `waitForFrame` polls.
 *
 * 2. **Playwright is optional.** The package ships two runtime dependencies and
 *    three browser engines are not going to become the third. It is imported
 *    dynamically and, when absent, this reports that plainly — exactly as
 *    `src/vite/docgen.ts` does for `react-docgen`.
 */

import { serializeFixtureId } from "../shared/fixture-id.ts";

/** The npm package this tool needs, installed by the host. */
export const PLAYWRIGHT_PACKAGE = "playwright";

/** What to say when it is not there. Names the package and the fix, once. */
export const PLAYWRIGHT_MISSING_MESSAGE =
	`render_fixture needs "${PLAYWRIGHT_PACKAGE}", which is not installed. It is an ` +
	`optional dependency so that an install of uight does not pay for three browser ` +
	`engines. Install it with "bun add -d ${PLAYWRIGHT_PACKAGE} && bunx playwright ` +
	`install chromium", or use fixture_url and open the URL with your own browser tool.`;

/**
 * Viewport presets, mirroring `src/ui/constants.ts`'s `VIEWPORT_PRESETS`.
 *
 * Duplicated rather than imported: `src/ui` is browser code that pulls React in
 * its module graph, and the MCP entry is a Node binary that must not. The
 * numbers are the contract; keep them in step.
 */
export const SCREENSHOT_VIEWPORTS: Record<string, { width: number; height: number }> = {
	small: { width: 320, height: 568 },
	mobile: { width: 375, height: 667 },
	tablet: { width: 768, height: 1024 },
	laptop: { width: 1280, height: 800 },
	desktop: { width: 1536, height: 960 },
};

export const DEFAULT_VIEWPORT = "laptop";

export interface RenderOptions {
	/** Explorer base URL, already discovered (`/@uight/health`). No port here. */
	base: string;
	/** The explorer route from `/@uight/config.json`, e.g. `/uight`. */
	route: string;
	/** Fixture display path, as `list_fixtures` reports it. */
	path: string;
	/** Fixture name; `null` for a single-fixture file. */
	name?: string | null;
	/** A key of `SCREENSHOT_VIEWPORTS`, or an explicit `{ width, height }`. */
	viewport?: string | { width: number; height: number };
	/** Resolved theme (`data-uight-theme`). Omit to take the browser default. */
	theme?: "light" | "dark";
	/** Capture the whole explorer chrome instead of just the fixture frame. */
	fullPage?: boolean;
	/** How long to wait for `#uight-root` to have children. */
	timeout?: number;
	/** Test seam. Defaults to a dynamic import of `playwright`. */
	load?: () => Promise<PlaywrightModule | null>;
}

/**
 * The slice of Playwright's surface we use, declared locally: the package is
 * optional, so its types must not be a build-time requirement of this module.
 */
export interface PlaywrightModule {
	chromium: {
		launch(options?: { headless?: boolean }): Promise<{
			newPage(options?: Record<string, unknown>): Promise<PlaywrightPage>;
			close(): Promise<void>;
		}>;
	};
}

interface PlaywrightPage {
	goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
	waitForSelector(selector: string, options?: Record<string, unknown>): Promise<unknown>;
	waitForFunction(
		fn: string,
		arg?: unknown,
		options?: Record<string, unknown>,
	): Promise<unknown>;
	screenshot(options?: Record<string, unknown>): Promise<Uint8Array>;
	locator(selector: string): {
		screenshot(options?: Record<string, unknown>): Promise<Uint8Array>;
	};
}

/**
 * Resolved once and remembered, including the failure — a session that asks for
 * ten screenshots must not attempt ten dynamic imports of a missing package.
 */
let cached: { mod: PlaywrightModule | null } | undefined;

async function loadPlaywright(): Promise<PlaywrightModule | null> {
	if (cached) return cached.mod;
	try {
		const mod = (await import(PLAYWRIGHT_PACKAGE)) as Partial<PlaywrightModule>;
		cached = { mod: mod.chromium ? (mod as PlaywrightModule) : null };
	} catch {
		cached = { mod: null };
	}
	return cached.mod;
}

/** Test seam: forget the cached import so a test can exercise both branches. */
export function resetPlaywrightCache(): void {
	cached = undefined;
}

/** Resolve the viewport argument, rejecting an unknown preset by name. */
export function resolveViewport(viewport: RenderOptions["viewport"]): {
	width: number;
	height: number;
} {
	if (viewport === undefined)
		return SCREENSHOT_VIEWPORTS[DEFAULT_VIEWPORT] as {
			width: number;
			height: number;
		};
	if (typeof viewport === "object") {
		const { width, height } = viewport;
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
			throw new Error("viewport width and height must be positive numbers");
		}
		return { width: Math.round(width), height: Math.round(height) };
	}
	const preset = SCREENSHOT_VIEWPORTS[viewport.toLowerCase()];
	if (!preset) {
		throw new Error(
			`unknown viewport "${viewport}". Known presets: ` +
				`${Object.keys(SCREENSHOT_VIEWPORTS).join(", ")} — or pass ` +
				`{ width, height }.`,
		);
	}
	return preset;
}

/**
 * The explorer deep link for one fixture (§3.2's canonical encoding, produced
 * by the same serializer the UI uses so the two cannot drift).
 */
export function fixtureRenderUrl(options: {
	base: string;
	route: string;
	path: string;
	name?: string | null;
}): string {
	const base = options.base.replace(/\/+$/, "");
	const id = serializeFixtureId({ path: options.path, name: options.name ?? null });
	return `${base}${options.route}?fixture=${encodeURIComponent(id)}`;
}

/** The polled condition: the frame document rendered something into its root. */
const FRAME_RENDERED = `() => {
	const frame = document.querySelector('iframe[data-uight-frame]');
	const root = frame && frame.contentDocument
		? frame.contentDocument.getElementById('uight-root')
		: null;
	return !!root && root.childElementCount > 0;
}`;

export interface RenderResult {
	/** PNG bytes, base64 — the form an MCP image block carries. */
	base64: string;
	url: string;
	viewport: { width: number; height: number };
	theme: "light" | "dark" | null;
	fullPage: boolean;
}

/** Drive a browser to one fixture and return a PNG. */
export async function renderFixture(options: RenderOptions): Promise<RenderResult> {
	if (!options.path) throw new Error("path is required");
	const viewport = resolveViewport(options.viewport);
	if (
		options.theme !== undefined &&
		options.theme !== "light" &&
		options.theme !== "dark"
	) {
		throw new Error(`theme must be "light" or "dark"`);
	}

	const playwright = await (options.load ?? loadPlaywright)();
	if (!playwright) throw new Error(PLAYWRIGHT_MISSING_MESSAGE);

	const url = fixtureRenderUrl(options);
	const timeout = options.timeout ?? 20_000;
	const fullPage = options.fullPage === true;

	const browser = await playwright.chromium.launch({ headless: true });
	try {
		const page = await browser.newPage({
			viewport,
			// `theme: "system"` is the default setting and resolves from
			// `prefers-color-scheme` (§10.1, `ui/theme.ts`), so emulating the media
			// query is what actually moves the explorer *and* the frame document.
			...(options.theme ? { colorScheme: options.theme } : {}),
		});
		await page.goto(url, { waitUntil: "domcontentloaded", timeout });
		// Attachment first so a missing frame fails with "no iframe" rather than
		// timing out inside the polled predicate.
		await page.waitForSelector("iframe[data-uight-frame]", { timeout });
		await page.waitForFunction(FRAME_RENDERED, undefined, { timeout, polling: 100 });

		const bytes = fullPage
			? await page.screenshot({ type: "png", fullPage: true })
			: await page.locator("iframe[data-uight-frame]").screenshot({ type: "png" });

		return {
			base64: Buffer.from(bytes).toString("base64"),
			url,
			viewport,
			theme: options.theme ?? null,
			fullPage,
		};
	} finally {
		await browser.close();
	}
}
