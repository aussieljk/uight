/**
 * `uaight init` against a react-cosmos repository.
 *
 * The fixture format is compatible by construction, so nothing here re-tests
 * that. What is tested is the three things that are *not* free: the config keys
 * that mean something different in each tool, the `__fixtures__/` convention
 * uaight does not recognize, and the imports of a package that is about to be
 * uninstalled — including the ones this must refuse to rewrite.
 */

import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	cosmosReport,
	detectCosmos,
	planFixtureRenames,
	rewriteCosmosImports,
	translateCosmosConfig,
} from "../src/vite/cosmos.ts";
import { migrateProject } from "../src/vite/init.ts";

let root: string;

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), "uaight-cosmos-"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

function write(relative: string, source: string): void {
	const file = path.join(root, relative);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, source);
}

function read(relative: string): string {
	return readFileSync(path.join(root, relative), "utf8");
}

function cosmosProject(config: Record<string, unknown> = {}): void {
	write(
		"package.json",
		JSON.stringify(
			{ name: "demo", devDependencies: { "react-cosmos": "^7.0.0" } },
			null,
			"\t",
		),
	);
	write("cosmos.config.json", JSON.stringify(config, null, 2));
	write(
		"vite.config.ts",
		'import react from "@vitejs/plugin-react";\nexport default { plugins: [react()] };\n',
	);
}

describe("detection", () => {
	it("names both the config file and the dependency", () => {
		cosmosProject();
		const pkg = JSON.parse(read("package.json")) as Record<string, unknown>;
		expect(detectCosmos(root, pkg)).toEqual([
			"cosmos.config.json",
			"react-cosmos in package.json",
		]);
	});

	it("finds nothing in an unrelated project", () => {
		expect(detectCosmos(root, null)).toEqual([]);
	});
});

describe("the config translation", () => {
	it("maps rootDir to fixturesDir, not fixturesDir", () => {
		const { options } = translateCosmosConfig({
			rootDir: "src",
			fixturesDir: "__fixtures__",
		});
		expect(options.fixturesDir).toBe("src");
	});

	it("carries the suffix, the ignore list and lazy mode", () => {
		const { options } = translateCosmosConfig({
			fixtureFileSuffix: "story",
			ignore: ["**/legacy/**"],
			lazy: true,
		});
		expect(options).toEqual({
			fixtureFileSuffix: "story",
			exclude: ["**/legacy/**"],
			index: "lazy",
		});
	});

	it("writes nothing for keys that are already the defaults", () => {
		const { options } = translateCosmosConfig({
			rootDir: ".",
			fixtureFileSuffix: "fixture",
		});
		expect(options).toEqual({});
	});

	it("names dropped server keys rather than ignoring them", () => {
		const { dropped } = translateCosmosConfig({ port: 5000, staticPath: "public" });
		expect(Object.keys(dropped).sort()).toEqual(["port", "staticPath"]);
	});
});

describe("the import rewrite", () => {
	// The old name stays as the local binding: the call sites in the fixture body
	// are not rewritten, so aliasing is what keeps the file compiling.
	it("moves cosmos's older hook names to uaight's", () => {
		const out = rewriteCosmosImports(
			'import { useValue, useSelect } from "react-cosmos/client";\n',
			"a.tsx",
		);
		expect(out.source).toBe(
			'import { useFixtureInput as useValue, useFixtureSelect as useSelect } from "uaight";\n',
		);
		expect(out.renamed).toEqual({
			useValue: "useFixtureInput",
			useSelect: "useFixtureSelect",
		});
	});

	it("keeps a local alias", () => {
		const out = rewriteCosmosImports(
			'import { useValue as useInput } from "react-cosmos/client";\n',
			"a.tsx",
		);
		expect(out.source).toContain('import { useFixtureInput as useInput } from "uaight";');
	});

	it("leaves an unsupported specifier on its original module", () => {
		const out = rewriteCosmosImports(
			'import { useValue, useFixtureState } from "react-cosmos/client";\n',
			"a.tsx",
		);
		expect(out.source).toContain('import { useFixtureState } from "react-cosmos/client";');
		expect(out.source).toContain('import { useFixtureInput as useValue } from "uaight";');
		expect(out.declined.useFixtureState).toMatch(/fixture-state/);
	});

	it("touches nothing when there is no cosmos import", () => {
		const source = 'import { useState } from "react";\n';
		expect(rewriteCosmosImports(source, "a.tsx")).toMatchObject({
			source,
			changed: false,
		});
	});

	it("declines to edit a file it cannot parse", () => {
		const out = rewriteCosmosImports("import { from 'react-cosmos/client'", "a.tsx");
		expect(out.changed).toBe(false);
		expect(out.problem).toBe("does not parse");
	});
});

describe("the __fixtures__ rename", () => {
	it("gives a directory-convention fixture the suffix, in place", async () => {
		write("src/__fixtures__/button.tsx", "export default <button />;\n");
		const renames = await planFixtureRenames({
			root,
			dirName: "__fixtures__",
			suffix: "fixture",
		});
		expect(renames).toEqual([
			{ from: "src/__fixtures__/button.tsx", to: "src/__fixtures__/button.fixture.tsx" },
		]);
	});

	it("leaves a file that already carries the suffix, and the barrel", async () => {
		write("src/__fixtures__/a.fixture.tsx", "export default null;\n");
		write("src/__fixtures__/index.ts", "export * from './a.fixture';\n");
		expect(
			await planFixtureRenames({ root, dirName: "__fixtures__", suffix: "fixture" }),
		).toEqual([]);
	});
});

describe("the whole command", () => {
	it("wires the plugin, translates the config, renames and rewrites", async () => {
		cosmosProject({ rootDir: "src", port: 5000 });
		write(
			"src/__fixtures__/button.tsx",
			'import { useValue } from "react-cosmos/client";\nexport default () => null;\n',
		);

		const result = await migrateProject({ root });

		expect(result.cosmosEvidence.length).toBeGreaterThan(0);
		expect(read("vite.config.ts")).toContain("uaight({ storybook: true })");
		expect(JSON.parse(read("uaight.config.json"))).toEqual({ fixturesDir: "src" });

		expect(existsSync(path.join(root, "src/__fixtures__/button.tsx"))).toBe(false);
		const moved = read("src/__fixtures__/button.fixture.tsx");
		expect(moved).toContain('import { useFixtureInput as useValue } from "uaight";');
		expect(moved).not.toContain("react-cosmos");

		expect(result.nextSteps.join("\n")).toContain("port");
	});

	it("writes nothing on a dry run", async () => {
		cosmosProject({ rootDir: "src" });
		write("src/__fixtures__/button.tsx", "export default null;\n");

		const result = await migrateProject({ root, dryRun: true });

		expect(result.dryRun).toBe(true);
		expect(existsSync(path.join(root, "uaight.config.json"))).toBe(false);
		expect(existsSync(path.join(root, "src/__fixtures__/button.tsx"))).toBe(true);
		expect(result.changes.some((c) => c.action === "rename")).toBe(true);
	});

	it("says what will not be found when renames are declined", async () => {
		cosmosProject();
		write("src/__fixtures__/button.tsx", "export default null;\n");

		const result = await migrateProject({ root, renameFixtures: false });

		expect(existsSync(path.join(root, "src/__fixtures__/button.tsx"))).toBe(true);
		expect(result.nextSteps.join("\n")).toContain("will not be found");
	});

	it("is a no-op the second time", async () => {
		cosmosProject({ rootDir: "src" });
		write(
			"src/__fixtures__/button.tsx",
			'import { useValue } from "react-cosmos/client";\nexport default () => null;\n',
		);
		await migrateProject({ root });
		const config = read("vite.config.ts");
		const fixture = read("src/__fixtures__/button.fixture.tsx");

		await migrateProject({ root });

		expect(read("vite.config.ts")).toBe(config);
		expect(read("src/__fixtures__/button.fixture.tsx")).toBe(fixture);
	});
});

describe("the report", () => {
	it("counts declined imports across the corpus", async () => {
		cosmosProject();
		write(
			"src/a.fixture.tsx",
			'import { useValue, useFixtureState } from "react-cosmos/client";\nexport default null;\n',
		);
		write(
			"src/b.fixture.tsx",
			'import { useFixtureState } from "react-cosmos/client";\nexport default null;\n',
		);

		const report = await cosmosReport({ root });

		expect(report.declined).toEqual({ useFixtureState: 2 });
		expect(report.configFile).toBe("cosmos.config.json");
		expect(report.details).toHaveLength(2);
	});
});
