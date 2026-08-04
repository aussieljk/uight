/**
 * The chrome's non-visual logic — SPEC.md §20.1.
 *
 * Everything here is the part of a UX change that can be decided without a
 * browser: which rows a window contains, what a sentence about dropped patches
 * says, what an MRU list does to an ordering, what a session round-trips, and
 * what `undo` puts back. Focus, scrolling and the tab order are Playwright's
 * (§20.2) and are deliberately not attempted.
 */

import { describe, expect, it } from "vitest";

import { droppedLabel, droppedLabels, summarizeDropped } from "../src/ui/dropped.ts";
import { editorTarget, editorUrl, openInEditor } from "../src/ui/open-in-editor.ts";
import { rankPaletteItems } from "../src/ui/palette.ts";
import {
	EMPTY_SESSION,
	MAX_RECENTS,
	parseSession,
	pushRecent,
	readSession,
	sessionKey,
	writeSession,
} from "../src/ui/session.ts";
import type { SessionStorageLike } from "../src/ui/session.ts";
import { createOverlayStore } from "../src/ui/store.ts";
import { windowRange, VIRTUALIZE_ABOVE } from "../src/ui/chrome/FixtureTree.tsx";
import type {
	CommandPaletteItem,
	DroppedPatchReport,
	Wire,
} from "../src/shared/types.ts";

/* ------------------------------------------------------------------ *
 * Virtualization — the window, not the rendering
 * ------------------------------------------------------------------ */

describe("the fixture tree's row window", () => {
	it("renders everything below the threshold, so the common case is untouched", () => {
		expect(windowRange(40, 0, 480)).toEqual({ start: 0, end: 40 });
		expect(windowRange(VIRTUALIZE_ABOVE, 999, 100)).toEqual({
			start: 0,
			end: VIRTUALIZE_ABOVE,
		});
	});

	it("windows a searched corpus rather than rendering every expanded fixture", () => {
		// 591 fixtures across 82 files is the demo, and searching expands all of it.
		const range = windowRange(700, 0, 480);
		expect(range.start).toBe(0);
		expect(range.end).toBeLessThan(60);
	});

	it("moves the window with the scroll offset and keeps an overscan behind it", () => {
		const range = windowRange(700, 2400, 480);
		// 2400 / 24 = row 100, minus the overscan.
		expect(range.start).toBe(92);
		expect(range.end).toBeGreaterThan(120);
	});

	it("never runs off either end", () => {
		expect(windowRange(700, -50, 480).start).toBe(0);
		const last = windowRange(700, 700 * 24, 480);
		expect(last.end).toBe(700);
		expect(last.start).toBeLessThanOrEqual(last.end);
	});
});

/* ------------------------------------------------------------------ *
 * Dropped patches, named — §7.3
 * ------------------------------------------------------------------ */

function report(input: string, paths: Array<Array<string | number>>): DroppedPatchReport {
	return { input, revision: 1, paths };
}

describe("naming the settings a re-render dropped", () => {
	it("names the input at the root and the path below it", () => {
		expect(droppedLabel("variant", [])).toBe("variant");
		expect(droppedLabel("label", ["text"])).toBe("label.text");
		expect(droppedLabel("items", [0, "id"])).toBe("items.0.id");
	});

	it("keeps the store's newest-first order and deduplicates", () => {
		const labels = droppedLabels([report("size", [[]]), report("variant", [[], []])]);
		expect(labels).toEqual(["size", "variant"]);
	});

	it("says '`variant`, `size` and 2 more' rather than a tally", () => {
		const summary = summarizeDropped(
			[report("variant", [[]]), report("size", [[]]), report("a", [[]]), report("b", [[]])],
			4,
		);
		expect(summary.named).toEqual(["variant", "size"]);
		expect(summary.more).toBe(2);
		expect(summary.verb).toBe("no longer apply");
	});

	it("agrees with itself in the singular", () => {
		const summary = summarizeDropped([report("variant", [[]])], 1);
		expect(summary.named).toEqual(["variant"]);
		expect(summary.more).toBe(0);
		expect(summary.verb).toBe("no longer applies");
	});

	it("trusts the count over the reports, so a missing report cannot shrink it", () => {
		// A host that carries the total but not the paths still says how many.
		const summary = summarizeDropped([], 6);
		expect(summary.named).toEqual([]);
		expect(summary.more).toBe(6);
	});
});

/* ------------------------------------------------------------------ *
 * Recents in the palette
 * ------------------------------------------------------------------ */

const items: CommandPaletteItem[] = [
	{ key: "fixture:a", label: "Accordion", kind: "fixture" },
	{ key: "fixture:b", label: "Badge", kind: "fixture" },
	{ key: "component:c", label: "Callout", kind: "component" },
];

describe("the palette's MRU list", () => {
	it("puts recents first on an empty query, newest first", () => {
		const ranked = rankPaletteItems(items, "", 50, ["component:c", "fixture:b"]);
		expect(ranked.map((i) => i.key)).toEqual(["component:c", "fixture:b", "fixture:a"]);
	});

	it("skips a recent naming something that no longer exists", () => {
		const ranked = rankPaletteItems(items, "", 50, ["fixture:deleted", "fixture:b"]);
		expect(ranked[0]?.key).toBe("fixture:b");
		expect(ranked).toHaveLength(3);
	});

	it("is unchanged from the old behaviour when nothing has been opened", () => {
		expect(rankPaletteItems(items, "", 50, []).map((i) => i.key)).toEqual(
			rankPaletteItems(items, "").map((i) => i.key),
		);
	});

	it("breaks a short-query tie toward the recent one", () => {
		const tied: CommandPaletteItem[] = [
			{ key: "x", label: "Alpha", kind: "fixture" },
			{ key: "y", label: "Alpha", kind: "fixture" },
		];
		expect(rankPaletteItems(tied, "al", 50, ["y"])[0]?.key).toBe("y");
	});

	it("stops blending recency once the query is discriminating on its own", () => {
		const both: CommandPaletteItem[] = [
			{ key: "x", label: "Accordion", kind: "fixture" },
			{ key: "y", label: "AccordionItem", kind: "fixture" },
		];
		// Four characters: the better match wins even though the other is recent.
		expect(rankPaletteItems(both, "acco", 50, ["y"])[0]?.key).toBe("x");
	});

	it("keeps the MRU list newest-first, deduplicated and capped", () => {
		let recents: string[] = [];
		for (let i = 0; i < MAX_RECENTS + 5; i += 1) recents = pushRecent(recents, `k${i}`);
		expect(recents).toHaveLength(MAX_RECENTS);
		expect(recents[0]).toBe(`k${MAX_RECENTS + 4}`);

		expect(pushRecent(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
	});
});

/* ------------------------------------------------------------------ *
 * Session — navigation survives a reload, values do not (Q14)
 * ------------------------------------------------------------------ */

function memoryStorage(initial: Record<string, string> = {}): SessionStorageLike & {
	map: Map<string, string>;
} {
	const map = new Map(Object.entries(initial));
	return {
		map,
		getItem: (key) => map.get(key) ?? null,
		setItem: (key, value) => {
			map.set(key, value);
		},
	};
}

describe("the explorer session", () => {
	it("keys by route and mount, so two mounts on a page are two places", () => {
		expect(sessionKey("/uaight", "a")).not.toBe(sessionKey("/uaight", "b"));
		expect(sessionKey("/uaight", "a")).not.toBe(sessionKey("/design", "a"));
	});

	it("round-trips what it stores", () => {
		const store = memoryStorage();
		writeSession("k", { collapsed: ["dir:forms"], selection: "uaight:1|a" }, store);
		writeSession("k", { sidebarWidth: 320 }, store);
		const session = readSession("k", store);
		expect(session.collapsed).toEqual(["dir:forms"]);
		expect(session.selection).toBe("uaight:1|a");
		expect(session.sidebarWidth).toBe(320);
	});

	it("degrades every field rather than trusting the stored shape", () => {
		// The value was written by a previous VERSION as much as a previous session.
		expect(parseSession("not json")).toEqual(EMPTY_SESSION);
		expect(parseSession("[1,2]")).toEqual(EMPTY_SESSION);
		const odd = parseSession(
			JSON.stringify({ collapsed: [1, "ok"], selection: 7, sidebarWidth: -4 }),
		);
		expect(odd.collapsed).toEqual(["ok"]);
		expect(odd.selection).toBeNull();
		expect(odd.sidebarWidth).toBeNull();
	});

	it("defaults the inventory disclosure open", () => {
		expect(parseSession("{}").inventoryOpen).toBe(true);
	});

	it("never throws when storage is absent", () => {
		expect(readSession("k", null)).toEqual(EMPTY_SESSION);
		expect(() => writeSession("k", { selection: "x" }, null)).not.toThrow();
	});
});

/* ------------------------------------------------------------------ *
 * Open in editor
 * ------------------------------------------------------------------ */

const site = { globPath: "/src/components/Button.tsx", line: 12, column: 4 };

describe("opening a call site in the editor", () => {
	it("strips the glob path's leading slash — §4.2, it is not a filesystem path", () => {
		expect(editorTarget(site)).toBe("src/components/Button.tsx:12:4");
		expect(editorUrl(site)).toBe(
			"/__open-in-editor?file=src%2Fcomponents%2FButton.tsx%3A12%3A4",
		);
	});

	it("reports 'opened' when the dev server took it", async () => {
		const fetchImpl = (async () => new Response("", { status: 200 })) as typeof fetch;
		await expect(openInEditor(site, fetchImpl)).resolves.toBe("opened");
	});

	it("degrades to 'unavailable' where there is no dev server — the static build", async () => {
		const missing = (async () => new Response("", { status: 404 })) as typeof fetch;
		await expect(openInEditor(site, missing)).resolves.toBe("unavailable");
		const offline = (async () => {
			throw new Error("network");
		}) as typeof fetch;
		await expect(openInEditor(site, offline)).resolves.toBe("unavailable");
		await expect(openInEditor(site, undefined)).resolves.toBe("unavailable");
	});

	it("separates 'no endpoint' from 'the editor would not launch'", async () => {
		const failed = (async () => new Response("", { status: 500 })) as typeof fetch;
		await expect(openInEditor(site, failed)).resolves.toBe("failed");
	});
});

/* ------------------------------------------------------------------ *
 * Undoing a reset — §7.3
 * ------------------------------------------------------------------ */

const wire = (value: string): Wire => ({ t: "prim", v: value });

describe("undoing a reset", () => {
	it("puts the patches back against the current registration", () => {
		const store = createOverlayStore();
		store.register({ name: "label", revision: 1, wire: wire("hi") });
		const edited = store.set("label", [], { t: "prim", v: "edited" });
		expect(edited?.patches).toHaveLength(1);

		const snapshot = store.getState().overlays.map((o) => ({ ...o }));
		store.reset();
		expect(store.getState().overlays).toHaveLength(0);

		const applied = store.restore(snapshot);
		expect(applied).toHaveLength(1);
		expect(store.getState().overlays[0]?.patches[0]?.value).toEqual({
			t: "prim",
			v: "edited",
		});
	});

	it("adopts the current revision rather than the one it was captured at", () => {
		const store = createOverlayStore();
		store.register({ name: "label", revision: 1, wire: wire("hi") });
		const snapshot = [store.set("label", [], { t: "prim", v: "x" })!];
		store.reset();
		store.register({ name: "label", revision: 9, wire: wire("hi") });
		expect(store.restore(snapshot)[0]?.revision).toBe(9);
	});

	it("drops what the shape no longer has, and does not report it as a new loss", () => {
		const store = createOverlayStore();
		store.register({
			name: "props",
			revision: 1,
			wire: { t: "object", v: [["size", wire("lg")]] },
		});
		const snapshot = [store.set("props", ["size"], { t: "prim", v: "sm" })!];
		store.reset();
		// The shape came back without `size`.
		store.register({ name: "props", revision: 2, wire: { t: "object", v: [] } });
		expect(store.restore(snapshot)).toHaveLength(0);
		expect(store.getState().dropped).toBe(0);
		expect(store.getState().droppedInputs).toEqual([]);
	});

	it("ignores an input that is no longer registered at all", () => {
		const store = createOverlayStore();
		store.register({ name: "label", revision: 1, wire: wire("hi") });
		const snapshot = [store.set("label", [], { t: "prim", v: "x" })!];
		store.clear();
		expect(store.restore(snapshot)).toEqual([]);
	});
});
