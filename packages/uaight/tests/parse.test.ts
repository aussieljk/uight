/**
 * Static name indexing. SPEC.md §3.4, §20.1 ("parsing and classification").
 *
 * Names live inside a module's default export, and loading every module to
 * enumerate them would defeat lazy loading. So the parser reads them as data.
 * The table in §3.4 is the contract, and the interesting half of it is the
 * *undecidable* half: a spread, a computed key or an identifier assigned
 * elsewhere must produce `null`, not a plausible guess.
 *
 * `src/vite/**` belongs to another agent. Absent means skipped, not passed.
 */

import { describe, expect, it } from "vitest";

import { buildTree, flattenSelectable } from "../src/shared/tree.ts";
import { optional, present } from "./helpers/optional.ts";

interface ParsedFixtureFile {
	names: string[] | null;
	source: string;
	csf: boolean;
	errors: string[];
}

interface ParseModule {
	parseFixtureFile(
		source: string,
		filename: string,
		options?: { csf?: boolean },
	): ParsedFixtureFile;
	/** The module's own encoding of "the default export is the fixture". */
	SINGLE_FIXTURE?: string[];
}

const mod = await optional<ParseModule>(
	"../../src/vite/index.ts",
	"../../src/vite/parse.ts",
);

const describeIf = present(mod) ? describe : describe.skip;

function parse(source: string, filename = "Thing.fixture.tsx"): ParsedFixtureFile {
	return mod!.parseFixtureFile(source, filename);
}

/**
 * "The default export is the fixture."
 *
 * §3.4's table writes this as `[null]`, which `FixtureFileIndex.names`
 * (`string[] | null`) cannot hold, so the parser encodes it as `[]` instead.
 * Both encodings are in the repository right now — see NOTES.md and the
 * cross-module test at the end of this file — so the table tests assert the
 * meaning rather than one spelling of it.
 */
function expectSingleFixture(names: string[] | null): void {
	expect(names).not.toBeNull();
	expect(names!.filter((n) => n !== null && n !== undefined)).toEqual([]);
	expect(names!.length).toBeLessThanOrEqual(1);
}

describeIf("parseFixtureFile — the §3.4 table", () => {
	it("treats a node default export as one fixture", () => {
		expectSingleFixture(parse("export default <Button disabled>Click me</Button>;").names);
	});

	it("treats a component default export as one fixture", () => {
		expectSingleFixture(parse("export default () => <Counter />;").names);
		expectSingleFixture(parse("export default function Fix() { return null; }").names);
		expectSingleFixture(parse("export default class Fix extends Component {}").names);
	});

	it("reads static keys off an object literal, in source order", () => {
		const result = parse(`export default {
			Primary: <B />,
			"Primary Disabled": <B disabled />,
			'quoted': <B />,
		};`);
		expect(result.names).toEqual(["Primary", "Primary Disabled", "quoted"]);
	});

	it("keeps a key that is the empty string, which is legal (§3.2)", () => {
		expect(parse('export default { "": <B /> };').names).toEqual([""]);
	});

	it("is undecidable for a spread", () => {
		expect(parse("export default { ...base, Primary: <B /> };").names).toBeNull();
	});

	it("is undecidable for a computed key", () => {
		expect(parse("export default { [name]: <B /> };").names).toBeNull();
	});

	it("is undecidable for a getter", () => {
		expect(parse("export default { get Primary() { return <B />; } };").names).toBeNull();
	});

	/*
	 * §3.4's identifier row, as it now reads. `const fixtures = {…}; export
	 * default fixtures` used to be undecidable — which was a decision about
	 * effort, not about knowability: the initializer is right there in the
	 * module. It is resolved now, and everything whose value the initializer is
	 * *not* — `let`, `var`, an import, a destructuring pattern, a redeclaration
	 * — stays undecidable, because in each of those the binding can hold
	 * something other than what it was written with.
	 */
	describe("an identifier default export", () => {
		it("resolves through a module-scope const", () => {
			expect(parse("const fixtures = { A: 1, B: 2 };\nexport default fixtures;").names).toEqual([
				"A",
				"B",
			]);
		});

		it("resolves through a chain of consts", () => {
			expect(
				parse("const a = { A: 1 };\nconst b = a;\nexport default b;").names,
			).toEqual(["A"]);
		});

		it("resolves an exported const, which is still module scope", () => {
			expect(
				parse("export const fixtures = { A: 1 };\nexport default fixtures;").names,
			).toEqual(["A"]);
		});

		it("carries the table through: a resolved non-object is a single fixture", () => {
			expect(parse("const only = <B />;\nexport default only;").names).toEqual([null]);
		});

		it("carries the table through: a resolved object with a spread is undecidable", () => {
			expect(
				parse("const fixtures = { ...base, A: 1 };\nexport default fixtures;").names,
			).toBeNull();
		});

		it("stays undecidable for let, which a later assignment can replace", () => {
			expect(parse("let fixtures = { A: 1 };\nexport default fixtures;").names).toBeNull();
		});

		it("stays undecidable for var", () => {
			expect(parse("var fixtures = { A: 1 };\nexport default fixtures;").names).toBeNull();
		});

		it("stays undecidable for an import, whose value is in another module", () => {
			expect(
				parse('import fixtures from "./elsewhere";\nexport default fixtures;').names,
			).toBeNull();
		});

		it("stays undecidable for a destructuring pattern", () => {
			expect(
				parse("const { fixtures } = bundle;\nexport default fixtures;").names,
			).toBeNull();
		});

		it("stays undecidable for a name declared twice", () => {
			expect(
				parse("const a = { A: 1 };\nconst a = { B: 2 };\nexport default a;").names,
			).toBeNull();
		});

		it("stays undecidable for a const with no initializer", () => {
			// Not valid runtime code, but a half-typed file must not hang or throw.
			expect(parse("const fixtures;\nexport default fixtures;").names).toBeNull();
		});

		it("does not hang on a cycle", () => {
			expect(parse("const a = b;\nconst b = a;\nexport default a;").names).toBeNull();
		});

		it("stays undecidable for a binding this module never declares", () => {
			expect(parse("export default fixtures;").names).toBeNull();
		});
	});

	it("lets `export const fixtureNames` win outright", () => {
		const result = parse(`
			export const fixtureNames = ["red", "green", "blue"];
			export default buildFixtures();
		`);
		expect(result.names).toEqual(["red", "green", "blue"]);
	});

	it("lets fixtureNames win even over a decidable object literal", () => {
		const result = parse(`
			export const fixtureNames = ["only"];
			export default { A: <B />, C: <B /> };
		`);
		expect(result.names).toEqual(["only"]);
	});

	it("never throws on a syntax error, and reports it as undecidable", () => {
		const result = parse("export default {");
		expect(result.names).toBeNull();
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it("never treats a named export as a fixture (§3.1)", () => {
		const result = parse(`
			export const fileMeta = { group: "Forms" };
			export const fixtureMeta = { Primary: { title: "x" } };
			export default { Primary: <B /> };
		`);
		expect(result.names).toEqual(["Primary"]);
	});

	it("normalizes an .mdx file into exactly one fixture (§14)", () => {
		expectSingleFixture(parse("# Heading\n\nSome prose.", "Doc.fixture.mdx").names);
	});

	it("records that it is not reading CSF unless asked", () => {
		expect(parse("export default { A: <B /> };").csf).toBe(false);
	});
});

/* ------------------------------------------------------------------ *
 * Cross-module: the parser's output is the tree's input.
 * ------------------------------------------------------------------ */

describeIf("the single-fixture marker, end to end", () => {
	/**
	 * Regression guard for a defect that shipped briefly: `shared/tree.ts` and
	 * `ui/UaightUI.tsx` both read `[null]` as "the default export is the fixture"
	 * (SPEC §3.4's table) while `vite/parse.ts` wrote `[]`, so every single-fixture
	 * file became an empty `file` node with no `fixture` and could not be selected
	 * at all. `[null]` is now canonical and `[]` is not a legal value.
	 */
	it("a single-fixture file is selectable in the tree", () => {
		const { names } = parse("export default <Button />;");
		const nodes = buildTree({
			files: [{ path: "Button", globPath: "/src/Button.fixture.tsx", names, hash: "h" }],
		});
		expect(flattenSelectable(nodes)).toHaveLength(1);
	});
});
