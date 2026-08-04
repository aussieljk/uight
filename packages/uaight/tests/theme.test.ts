/**
 * The theme stamp — SPEC.md §10.1, §20.1.
 *
 * The host stamps `data-uaight-theme` on the renderer document's
 * `documentElement`; the renderer reads it. This asserts the half a preview
 * entry depends on: the attribute name, the two values, and that an unstamped
 * document renders light rather than throwing. Whether the host actually
 * stamps it in a real frame is Playwright's (§20.2).
 */

import { describe, expect, it } from "vitest";

import { THEME_ATTRIBUTE } from "../src/shared/types.ts";
import { readUaightTheme, subscribeUaightTheme } from "../src/runtime/theme.ts";

function fakeDocument(value?: string): Document {
	return {
		documentElement: { getAttribute: (name: string) => (name === THEME_ATTRIBUTE ? (value ?? null) : null) },
	} as unknown as Document;
}

describe("readUaightTheme", () => {
	it("reads the attribute the frame host stamps", () => {
		expect(THEME_ATTRIBUTE).toBe("data-uaight-theme");
		expect(readUaightTheme(fakeDocument("dark"))).toBe("dark");
		expect(readUaightTheme(fakeDocument("light"))).toBe("light");
	});

	it("is light when unstamped, so a host that never stamps still renders", () => {
		expect(readUaightTheme(fakeDocument())).toBe("light");
		expect(readUaightTheme(fakeDocument("system"))).toBe("light");
	});
});

describe("subscribeUaightTheme", () => {
	it("is a no-op unsubscribe where there is no DOM to observe", () => {
		expect(() => subscribeUaightTheme(() => {}, fakeDocument())()).not.toThrow();
	});
});
