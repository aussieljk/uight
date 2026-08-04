/**
 * `uaight init` — the one command between a Storybook repository and `/uaight`.
 *
 * The thing worth testing is not that it writes files: it is that the file it
 * writes still runs. So every case here asserts on the *edited config*, and the
 * shapes are the ones real repositories are written in — a one-line plugins
 * array, a multi-line one, an empty one, a config that is already wired up, and
 * one this command must refuse to touch.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	addUaightToViteConfig,
	formatMigration,
	migrateFromStorybook,
} from "../src/vite/init.ts";

let root: string;

beforeEach(() => {
	root = mkdtempSync(path.join(tmpdir(), "uaight-init-"));
	mkdirSync(path.join(root, "src"), { recursive: true });
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

function storybookProject(): void {
	write(
		"package.json",
		JSON.stringify({ name: "demo", devDependencies: { storybook: "^8.0.0" } }, null, "\t"),
	);
	write(".storybook/preview.ts", "export const decorators = [];\n");
	write(
		"src/Button.stories.tsx",
		[
			'export default { title: "Button", parameters: { layout: "centered", docs: {} } };',
			'export const Primary = { args: { kind: "primary" } };',
			"export const WithPlay = { play: async () => {} };",
		].join("\n"),
	);
}

describe("the Vite config edit", () => {
	it("prepends to a one-line plugins array without breaking the line", () => {
		const source =
			'import react from "@vitejs/plugin-react";\nexport default { plugins: [react()] };\n';
		const result = addUaightToViteConfig(source, "vite.config.ts");
		expect(result.changed).toBe(true);
		expect(result.source).toContain('import { uaight } from "uaight/vite";');
		expect(result.source).toContain("plugins: [uaight({ storybook: true }), react()] };");
	});

	it("keeps a multi-line array's own indent", () => {
		const source = [
			'import react from "@vitejs/plugin-react";',
			'import { defineConfig } from "vite";',
			"",
			"export default defineConfig({",
			"\tplugins: [",
			"\t\treact(),",
			"\t],",
			"});",
			"",
		].join("\n");
		const result = addUaightToViteConfig(source, "vite.config.ts");
		expect(result.source).toContain(
			"\tplugins: [\n\t\tuaight({ storybook: true }),\n\t\treact(),\n\t],",
		);
	});

	it("fills an empty array", () => {
		const result = addUaightToViteConfig(
			"export default { plugins: [] };\n",
			"vite.config.ts",
		);
		expect(result.source).toContain("plugins: [uaight({ storybook: true })]");
	});

	it("is idempotent — a config that already imports uaight is left alone", () => {
		const source =
			'import { uaight } from "uaight/vite";\nexport default { plugins: [uaight()] };\n';
		const result = addUaightToViteConfig(source, "vite.config.ts");
		expect(result.changed).toBe(false);
		expect(result.source).toBe(source);
	});

	it("declines a config with no plugins array rather than guessing", () => {
		const result = addUaightToViteConfig(
			'export default { root: "src" };\n',
			"vite.config.ts",
		);
		expect(result.changed).toBe(false);
		expect(result.problem).toMatch(/plugins/);
	});

	it("declines a config that does not parse", () => {
		const result = addUaightToViteConfig("export default { plugins: [ ;", "vite.config.ts");
		expect(result.changed).toBe(false);
		expect(result.problem).toMatch(/parse/);
	});
});

describe("migrateFromStorybook", () => {
	it("wires a Storybook project up and reports what will not survive", async () => {
		storybookProject();
		write(
			"vite.config.ts",
			'import react from "@vitejs/plugin-react";\nexport default { plugins: [react()] };\n',
		);

		const result = await migrateFromStorybook({ root });

		expect(result.evidence.join(" ")).toContain(".storybook/");
		expect(read("vite.config.ts")).toContain("uaight({ storybook: true })");
		expect(JSON.parse(read("package.json")).devDependencies.uaight).toBe("latest");

		// The report is the honest half: `play` and an unhonoured parameter are
		// what a team evaluating the move needs to see before it commits.
		expect(result.report?.stories).toBe(2);
		expect(result.report?.unsupported.play).toBe(1);
		expect(result.report?.unsupported["parameters.docs"]).toBe(1);
	});

	it("writes nothing on a dry run, and computes the same changes", async () => {
		storybookProject();
		const before =
			'import react from "@vitejs/plugin-react";\nexport default { plugins: [react()] };\n';
		write("vite.config.ts", before);

		const result = await migrateFromStorybook({ root, dryRun: true });

		expect(read("vite.config.ts")).toBe(before);
		expect(JSON.parse(read("package.json")).devDependencies.uaight).toBeUndefined();
		expect(result.changes.filter((c) => c.action !== "skip")).toHaveLength(2);
		expect(formatMigration(result)).toContain("Nothing was written");
	});

	it("scaffolds a Vite config when the project was never on Vite", async () => {
		storybookProject();
		const result = await migrateFromStorybook({ root });
		expect(read("vite.config.ts")).toContain("uaight({ storybook: true })");
		expect(result.changes.some((c) => c.action === "create")).toBe(true);
	});

	it("says what it could not do rather than half-editing a config", async () => {
		storybookProject();
		write("vite.config.ts", 'export default { root: "src" };\n');

		const result = await migrateFromStorybook({ root });

		expect(read("vite.config.ts")).toBe('export default { root: "src" };\n');
		expect(result.nextSteps.join("\n")).toContain("uaight({ storybook: true })");
	});

	it("re-runs cleanly", async () => {
		storybookProject();
		write(
			"vite.config.ts",
			'import react from "@vitejs/plugin-react";\nexport default { plugins: [react()] };\n',
		);
		await migrateFromStorybook({ root });
		const after = read("vite.config.ts");

		const second = await migrateFromStorybook({ root });

		expect(read("vite.config.ts")).toBe(after);
		expect(second.changes.every((c) => c.action === "skip")).toBe(true);
	});

	it("works in a project with no Storybook at all, and says so", async () => {
		write("package.json", JSON.stringify({ name: "demo" }, null, "\t"));
		write("vite.config.ts", "export default { plugins: [] };\n");

		const result = await migrateFromStorybook({ root });

		expect(result.evidence).toHaveLength(0);
		expect(formatMigration(result)).toContain("No Storybook or react-cosmos found");
		expect(read("vite.config.ts")).toContain("uaight({ storybook: true })");
	});
});
