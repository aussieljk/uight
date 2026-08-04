/**
 * Ejection registry. SPEC.md §11.
 *
 * §11.1 is explicit that plausibility is not proof — the real check is a
 * `shadcn add` into a scratch project (Q8), which is a Playwright-era task.
 * What is provable here is the shape: namespaced dependencies, a `target` on
 * every `registry:file`, headers that name project, version and licence, and
 * versioned copies whose dependencies are pinned to one minor.
 */

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	EJECTABLE,
	buildRegistry,
	fileHeader,
	minorTag,
	type RegistryItem,
} from "../scripts/build-registry.ts";

let dir: string;
let sourceDir: string;
let tokensFile: string;
let outDir: string;

beforeEach(() => {
	dir = mkdtempSync(path.join(tmpdir(), "uaight-registry-"));
	sourceDir = path.join(dir, "chrome");
	outDir = path.join(dir, "registry");
	tokensFile = path.join(dir, "chrome-tokens.css");
	mkdirSync(sourceDir, { recursive: true });
	writeFileSync(tokensFile, ":root { --uaight-fg: #000; }\n");
	for (const item of EJECTABLE) {
		writeFileSync(
			path.join(sourceDir, `${item.component}.tsx`),
			`export function ${item.component}() { return null; }\n`,
		);
	}
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

function build(overrides: Partial<Parameters<typeof buildRegistry>[0]> = {}) {
	return buildRegistry({
		sourceDir,
		tokensFile,
		outDir,
		version: "1.0.0",
		...overrides,
	});
}

function read(file: string): RegistryItem {
	return JSON.parse(readFileSync(path.join(outDir, file), "utf8")) as RegistryItem;
}

describe("minorTag", () => {
	it("publishes per minor, not per patch (§11.1)", () => {
		expect(minorTag("1.0.0")).toBe("v1.0");
		expect(minorTag("1.2.7")).toBe("v1.2");
		expect(minorTag("2.10.0")).toBe("v2.10");
	});
});

describe("the ejectable set", () => {
	it("is §11.3's table, plus the palette", () => {
		// `CommandPalette` is an addition beyond §11.3's list, admitted under the
		// same rule the list is drawn by: "anything that renders chrome is
		// ejectable; anything that defines fixture semantics or owns the realm is
		// not." It renders chrome, it reads the facade, and it holds no fixture
		// state — the ranking it displays is computed before it is handed the list.
		expect(EJECTABLE.map((e) => e.component).sort()).toEqual([
			"CommandPalette",
			"ControlPanel",
			"ControlPanelInputs",
			"EmptyState",
			"ErrorState",
			"FixtureTree",
			"InventoryList",
			"PreviewShell",
			"Toolbar",
			"ViewportToolbar",
		]);
	});

	it("excludes everything that owns the realm or defines fixture semantics", () => {
		const names = EJECTABLE.map((e) => e.component);
		for (const excluded of ["FrameHost", "RendererBootstrap", "FrameTransport"]) {
			expect(names).not.toContain(excluded);
		}
	});
});

describe("buildRegistry", () => {
	it("emits one item per ejectable, plus the index and a versioned copy", () => {
		const result = build();
		expect(result.items).toHaveLength(EJECTABLE.length);
		expect(result.missing).toEqual([]);
		// Latest + versioned for each item, and two indexes.
		expect(result.written).toHaveLength(EJECTABLE.length * 2 + 2);
	});

	it("follows §11.2's shape", () => {
		build();
		const item = read("fixture-tree.json");
		expect(item.name).toBe("fixture-tree");
		expect(item.type).toBe("registry:component");
		expect(item.title).toBe("Fixture Tree");
		expect(item.description).toContain("useUaightChrome().fixtureTree");
		expect(item.dependencies).toEqual(["uaight"]);
		expect(item.files[0]!.path).toBe("ui/fixture-tree/FixtureTree.tsx");
		expect(item.files[0]!.type).toBe("registry:component");
	});

	it("namespaces every registry dependency", () => {
		// §11.2: a bare `tree-item` resolves against shadcn's own registry.
		build();
		const item = read("control-panel.json");
		expect(item.registryDependencies).toEqual(["@uaight/control-panel-inputs"]);
		for (const entry of EJECTABLE) {
			for (const dep of read(`${entry.name}.json`).registryDependencies) {
				expect(dep.startsWith("@uaight/")).toBe(true);
			}
		}
	});

	it("only depends on items it actually publishes", () => {
		build();
		const published = new Set(EJECTABLE.map((e) => e.name));
		for (const entry of EJECTABLE) {
			for (const dep of read(`${entry.name}.json`).registryDependencies) {
				expect(published.has(dep.replace("@uaight/", ""))).toBe(true);
			}
		}
	});

	it("gives every registry:file an explicit target", () => {
		build();
		for (const entry of EJECTABLE) {
			for (const f of read(`${entry.name}.json`).files) {
				if (f.type === "registry:file") {
					expect(typeof f.target).toBe("string");
					expect(f.target).toBeTruthy();
				}
			}
		}
	});

	it("ships the shared token stylesheet with every item, so ejection compiles", () => {
		build();
		const file = read("toolbar.json").files.find((f) => f.type === "registry:file");
		expect(file?.path).toBe("styles/uaight-chrome.css");
		expect(file?.content).toContain("--uaight-fg");
	});

	it("inlines source content, headed per §11.4", () => {
		build();
		const content = read("empty-state.json").files[0]!.content!;
		expect(content).toContain("uaight");
		expect(content).toContain("v1.0.0");
		expect(content).toContain("MIT licence");
		expect(content).toContain("export function EmptyState");
		// The header comes first — a consumer opening the file must see it.
		expect(content.indexOf("MIT licence")).toBeLessThan(
			content.indexOf("export function EmptyState"),
		);
	});

	it("pins the versioned copies to one minor (§11.1)", () => {
		build();
		const versioned = JSON.parse(
			readFileSync(path.join(outDir, "v1.0", "control-panel.json"), "utf8"),
		) as RegistryItem;
		expect(versioned.registryDependencies).toEqual([
			"https://uaight.dev/r/v1.0/control-panel-inputs.json",
		]);
	});

	it("writes an index that records paths but not sources", () => {
		build();
		const index = JSON.parse(readFileSync(path.join(outDir, "registry.json"), "utf8")) as {
			$schema: string;
			name: string;
			items: RegistryItem[];
		};
		expect(index.name).toBe("uaight");
		expect(index.$schema).toContain("registry.json");
		expect(index.items).toHaveLength(EJECTABLE.length);
		for (const item of index.items) {
			for (const f of item.files) expect(f.content).toBeUndefined();
		}
	});

	it("clears stale output, so a removed item cannot linger", () => {
		build();
		writeFileSync(path.join(outDir, "ghost.json"), "{}");
		build();
		expect(() => readFileSync(path.join(outDir, "ghost.json"), "utf8")).toThrow();
	});
});

describe("a missing source", () => {
	it("fails loudly and names every missing file at once", () => {
		rmSync(path.join(sourceDir, "Toolbar.tsx"));
		rmSync(path.join(sourceDir, "ErrorState.tsx"));
		expect(() => build()).toThrowError(/Toolbar\.tsx/);
		expect(() => build()).toThrowError(/ErrorState\.tsx/);
		expect(() => build()).toThrowError(/§11\.3|11\.3/);
	});

	it("emits only what exists under --skip-missing", () => {
		rmSync(path.join(sourceDir, "Toolbar.tsx"));
		const result = build({ skipMissing: true });
		expect(result.items).toHaveLength(EJECTABLE.length - 1);
		expect(result.missing).toHaveLength(1);
		expect(result.items.map((i) => i.name)).not.toContain("toolbar");
	});
});

describe("fileHeader", () => {
	it("names project, version and licence, because repository licensing does not travel", () => {
		const header = fileHeader({
			title: "FixtureTree",
			name: "fixture-tree",
			version: "1.2.3",
		});
		expect(header).toContain("uaight");
		expect(header).toContain("v1.2.3");
		expect(header).toContain("MIT");
		expect(header).toContain("@uaight/fixture-tree (v1.2)");
		// It also names the one surface that is frozen (§11.4).
		expect(header).toContain("useUaightChrome()");
		expect(header.startsWith("/**")).toBe(true);
	});
});
