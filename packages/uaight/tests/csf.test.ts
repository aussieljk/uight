/**
 * Storybook's declared subset, and decorator composition order.
 * SPEC.md §13, §3.3, §20.1 ("decorator composition order").
 *
 * The order rule is the one that silently produces wrong output if it is
 * reversed: Storybook applies decorators innermost-first from the array, while
 * we nest outermost-first by directory depth. A root decorator wraps a nested
 * one; an adapted CSF decorator sits inside both.
 *
 * `src/vite/**` and `src/runtime/**` belong to other agents. Absent means
 * skipped, not passed.
 */

import { describe, expect, it } from "vitest";

import type { DecoratorFileIndex } from "../src/shared/types.ts";
import { optional, present } from "./helpers/optional.ts";

/* ------------------------------------------------------------------ *
 * §13 — CSF named exports become fixture names
 * ------------------------------------------------------------------ */

interface ParseModule {
	parseFixtureFile(
		source: string,
		filename: string,
		options?: { csf?: boolean },
	): { names: string[] | null; csf: boolean; errors: string[] };
}

const parseMod = await optional<ParseModule>(
	"../../src/vite/index.ts",
	"../../src/vite/parse.ts",
);

const describeParse = present(parseMod) ? describe : describe.skip;

function csf(source: string): { names: string[] | null; csf: boolean } {
	return parseMod!.parseFixtureFile(source, "Button.stories.tsx", { csf: true });
}

describeParse("CSF story names", () => {
	it("takes every exported const that is not default or bookkeeping", () => {
		const result = csf(`
			export default { title: "Button", component: Button };
			export const Primary = { args: { variant: "primary" } };
			export const Secondary = { args: { variant: "secondary" } };
			export const __namedExportsOrder = ["Primary", "Secondary"];
		`);
		expect(result.names).toEqual(["Primary", "Secondary"]);
		expect(result.csf).toBe(true);
	});

	it("honours a static `name:` property, as Storybook does", () => {
		const result = csf(`
			export default { title: "Button" };
			export const Primary = { name: "The Primary One" };
		`);
		expect(result.names).toEqual(["The Primary One"]);
	});

	it("keeps helper exports out of the tree via excludeStories", () => {
		const result = csf(`
			export default { title: "Button" };
			export const excludeStories = ["helper"];
			export const helper = () => null;
			export const Primary = {};
		`);
		expect(result.names).toEqual(["Primary"]);
	});

	it("is undecidable when the module does not parse", () => {
		expect(csf("export const Primary = {").names).toBeNull();
	});
});

/* ------------------------------------------------------------------ *
 * §3.3 — decorator scope and composition
 * ------------------------------------------------------------------ */

interface DecoratorModule {
	selectDecorators(
		decorators: readonly DecoratorFileIndex[],
		fixturePath: string,
	): DecoratorFileIndex[];
}

const decoratorMod = await optional<DecoratorModule>(
	"../../src/runtime/index.ts",
	"../../src/runtime/decorators.ts",
);

const describeDecorators = present(decoratorMod) ? describe : describe.skip;

function decorator(dir: string): DecoratorFileIndex {
	const depth = dir === "" ? 0 : dir.split("/").length;
	return { dir, globPath: `/src/${dir ? `${dir}/` : ""}uaight.decorator.tsx`, depth };
}

describeDecorators("selectDecorators", () => {
	const all = [
		decorator(""),
		decorator("components"),
		decorator("components/forms"),
		decorator("other"),
	];

	it("applies to every fixture at or below its directory", () => {
		const chosen = decoratorMod!.selectDecorators(all, "components/forms/Input");
		expect(chosen.map((d) => d.dir)).toEqual(["", "components", "components/forms"]);
	});

	it("excludes a sibling directory", () => {
		const chosen = decoratorMod!.selectDecorators(all, "other/Thing");
		expect(chosen.map((d) => d.dir)).toEqual(["", "other"]);
	});

	it("orders outermost-first by depth, so a root decorator wraps a nested one", () => {
		const shuffled = [
			decorator("components/forms"),
			decorator(""),
			decorator("components"),
		];
		const chosen = decoratorMod!.selectDecorators(shuffled, "components/forms/Input");
		expect(chosen.map((d) => d.dir)).toEqual(["", "components", "components/forms"]);
	});

	it("does not match a directory that merely shares a prefix", () => {
		const chosen = decoratorMod!.selectDecorators(
			[decorator("components/forms")],
			"components/formsy/Legacy",
		);
		expect(chosen).toEqual([]);
	});

	it("is stable when two decorators sit at the same depth", () => {
		const a = decorator("a");
		const b = decorator("b");
		const forA = decoratorMod!.selectDecorators([b, a], "a/X");
		expect(forA.map((d) => d.dir)).toEqual(["a"]);
	});
});

/* ------------------------------------------------------------------ *
 * §13 / §3.1 — module normalization
 * ------------------------------------------------------------------ */

interface NormalizedFixture {
	name: string | null;
	unsupported?: string[];
}

interface NormalizeModule {
	normalizeModule(
		mod: unknown,
		file: unknown,
		cfg: unknown,
	): { fixtures: NormalizedFixture[]; fileMeta?: unknown };
}

const normalizeMod = await optional<NormalizeModule>(
	"../../src/runtime/index.ts",
	"../../src/runtime/normalize.ts",
);

const describeNormalize =
	present(normalizeMod) && typeof normalizeMod?.normalizeModule === "function"
		? describe
		: describe.skip;

const fileIndex = {
	path: "Button",
	globPath: "/src/Button.fixture.tsx",
	names: null,
	hash: "h",
};

const runtimeConfig = {
	version: "1.0.0",
	protocolVersion: 1,
	index: "warm",
	command: "serve",
	fixturesDir: "src",
	fixtureFileSuffix: "fixture",
	inventoryEnabled: true,
	storybook: null,
	storybookFileSuffix: "stories",
	hasPreviewEntry: false,
	hasCodecs: false,
	route: "/uaight",
	files: [],
	decorators: [],
	inventory: [],
	problems: [],
};

describeNormalize("normalizeModule", () => {
	it("treats a component default export as a single unnamed fixture (§3.1)", () => {
		const Component = (): null => null;
		const result = normalizeMod!.normalizeModule(
			{ default: Component },
			fileIndex,
			runtimeConfig,
		);
		expect(result.fixtures).toHaveLength(1);
		expect(result.fixtures[0]!.name).toBeNull();
	});

	it("treats an object default export as several named fixtures", () => {
		const result = normalizeMod!.normalizeModule(
			{ default: { Primary: () => null, "": () => null } },
			fileIndex,
			runtimeConfig,
		);
		expect(result.fixtures.map((f) => f.name)).toEqual(["Primary", ""]);
	});

	it("never treats a named export as a fixture outside CSF (§3.1)", () => {
		const result = normalizeMod!.normalizeModule(
			{ default: () => null, Helper: () => null },
			fileIndex,
			runtimeConfig,
		);
		expect(result.fixtures.map((f) => f.name)).toEqual([null]);
	});
});
