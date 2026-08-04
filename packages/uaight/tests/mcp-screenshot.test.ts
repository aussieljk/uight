/**
 * `render_fixture` — everything testable without a browser.
 *
 * Deliberately no real browser here: this suite is node-env and must stay fast,
 * and the browser path is covered by the Playwright matrix under `tests/e2e`.
 * What is worth pinning here is argument validation, the URL built from §3.2's
 * encoding, and the missing-Playwright message — which is the branch that has
 * to keep working on a machine where Playwright *is* installed, so the loader
 * is injected rather than uninstalled.
 */

import { describe, expect, it } from "vitest";
import {
	DEFAULT_VIEWPORT,
	fixtureRenderUrl,
	PLAYWRIGHT_MISSING_MESSAGE,
	PLAYWRIGHT_PACKAGE,
	renderFixture,
	resolveViewport,
	SCREENSHOT_VIEWPORTS,
} from "../src/mcp/screenshot.ts";
import { TOOLS } from "../src/mcp/index.ts";

const absent = async () => null;

describe("render_fixture URL construction", () => {
	it("uses §3.2's canonical single-fixture encoding", () => {
		expect(
			fixtureRenderUrl({ base: "http://localhost:5174", route: "/uaight", path: "Button" }),
		).toBe("http://localhost:5174/uaight?fixture=uaight%3A1%7CButton");
	});

	it("appends the name segment for a multi-fixture file", () => {
		const url = fixtureRenderUrl({
			base: "http://localhost:5173",
			route: "/uaight",
			path: "ui/Button",
			name: "primary",
		});
		expect(decodeURIComponent(url.split("fixture=")[1] ?? "")).toBe(
			"uaight:1|ui%2FButton|primary",
		);
	});

	it("does not care how many trailing slashes the discovered base has", () => {
		expect(
			fixtureRenderUrl({ base: "http://localhost:5173//", route: "/x", path: "A" }),
		).toMatch(/^http:\/\/localhost:5173\/x\?/);
	});
});

describe("viewports", () => {
	it("defaults to the laptop preset", () => {
		expect(resolveViewport(undefined)).toEqual(SCREENSHOT_VIEWPORTS[DEFAULT_VIEWPORT]);
	});

	it("matches VIEWPORT_PRESETS' numbers", () => {
		expect(resolveViewport("mobile")).toEqual({ width: 375, height: 667 });
		expect(resolveViewport("Desktop")).toEqual({ width: 1536, height: 960 });
	});

	it("names the known presets when given an unknown one", () => {
		expect(() => resolveViewport("phablet")).toThrow(/unknown viewport "phablet"/);
		expect(() => resolveViewport("phablet")).toThrow(/tablet/);
	});

	it("accepts an explicit size and rejects a nonsensical one", () => {
		expect(resolveViewport({ width: 400.4, height: 300 })).toEqual({
			width: 400,
			height: 300,
		});
		expect(() => resolveViewport({ width: 0, height: 300 })).toThrow(/positive/);
	});
});

describe("argument validation", () => {
	it("requires a path", async () => {
		await expect(
			renderFixture({ base: "http://x", route: "/u", path: "", load: absent }),
		).rejects.toThrow(/path is required/);
	});

	it("rejects a theme that is not light or dark", async () => {
		await expect(
			renderFixture({
				base: "http://x",
				route: "/u",
				path: "A",
				theme: "sepia" as "light",
				load: absent,
			}),
		).rejects.toThrow(/must be "light" or "dark"/);
	});

	it("validates before it ever tries to launch a browser", async () => {
		// The viewport error, not the Playwright one: bad arguments must not be
		// reported as a missing dependency.
		await expect(
			renderFixture({
				base: "http://x",
				route: "/u",
				path: "A",
				viewport: "huge",
				load: absent,
			}),
		).rejects.toThrow(/unknown viewport/);
	});
});

describe("the optional dependency", () => {
	it("names the package and the fix when it is absent", async () => {
		await expect(
			renderFixture({ base: "http://x", route: "/u", path: "A", load: absent }),
		).rejects.toThrow(PLAYWRIGHT_MISSING_MESSAGE);
		expect(PLAYWRIGHT_MISSING_MESSAGE).toContain(PLAYWRIGHT_PACKAGE);
		expect(PLAYWRIGHT_MISSING_MESSAGE).toContain("fixture_url");
	});
});

describe("the tool registration", () => {
	const tool = TOOLS.find((candidate) => candidate.name === "render_fixture");

	it("is listed with path required", () => {
		expect(tool).toBeDefined();
		expect(tool?.inputSchema).toMatchObject({ required: ["path"] });
	});

	it("advertises every preset in its viewport description", () => {
		const properties = (
			tool?.inputSchema as { properties: Record<string, { description: string }> }
		).properties;
		for (const name of Object.keys(SCREENSHOT_VIEWPORTS)) {
			expect(properties.viewport?.description).toContain(name);
		}
	});
});
