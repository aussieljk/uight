/**
 * Storybook drop-in — `.storybook/preview`. SPEC.md §13.
 *
 * §13 declined global decorators "by construction: `.storybook/preview` is
 * never loaded". Once the plugin finds and loads that module the construction
 * no longer holds, and the tests here pin what changes: the decorator nesting
 * order, the three-layer merge of args and parameters, and — the one that keeps
 * the badge honest — that nothing is badged for a feature that now runs.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { DEFAULT_CSF_SUPPORT, prepareStory } from "../src/runtime/csf.ts";
import type { CsfDecorator, CsfMeta, StorybookPreview } from "../src/runtime/csf.ts";
import { resolveUaightConfig } from "../src/vite/config.ts";
import { storybookReport } from "../src/vite/storybook-report.ts";

const temporaries: string[] = [];
afterAll(() => {
	for (const dir of temporaries) fs.rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uaight-storybook-"));
	temporaries.push(dir);
	for (const [relative, source] of Object.entries(files)) {
		const file = path.join(dir, relative);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, source);
	}
	return dir;
}

/**
 * A decorator that is identifiable by name. It never renders here — these tests
 * are about composition order, which is decided before anything renders.
 */
const named = (label: string): CsfDecorator => {
	const decorator: CsfDecorator = () => null;
	Object.defineProperty(decorator, "name", { value: label });
	return decorator;
};

const preview = (overrides: Partial<StorybookPreview> = {}): StorybookPreview => ({
	decorators: [],
	parameters: {},
	globalTypes: {},
	initialGlobals: {},
	args: {},
	argTypes: {},
	...overrides,
});

describe("discovery", () => {
	it("finds .storybook/preview.tsx and turns global decorators on", () => {
		const root = project({
			".storybook/preview.tsx": "export const decorators = [];\n",
			"src/a.stories.tsx": "export default {};\nexport const A = {};\n",
		});

		const config = resolveUaightConfig({
			root,
			options: { storybook: true },
			command: "serve",
		});

		expect(config.storybookPreview).toBe("/.storybook/preview.tsx");
		expect(config.storybook && config.storybook.globalDecorators).toBe(true);
	});

	it("leaves global decorators off when there is no preview", () => {
		const root = project({ "src/a.stories.tsx": "export default {};\n" });
		const config = resolveUaightConfig({
			root,
			options: { storybook: true },
			command: "serve",
		});

		expect(config.storybookPreview).toBeUndefined();
		expect(config.storybook && config.storybook.globalDecorators).toBe(false);
	});

	it("honours an explicit false, and an explicit path", () => {
		const root = project({
			".storybook/preview.ts": "export const decorators = [];\n",
			"config/preview.tsx": "export const decorators = [];\n",
		});

		const off = resolveUaightConfig({
			root,
			options: { storybook: { preview: false } },
			command: "serve",
		});
		expect(off.storybookPreview).toBeUndefined();

		const explicit = resolveUaightConfig({
			root,
			options: { storybook: { preview: "config/preview.tsx" } },
			command: "serve",
		});
		expect(explicit.storybookPreview).toBe("/config/preview.tsx");
	});

	it("does not look for a preview when Storybook support is off", () => {
		const root = project({ ".storybook/preview.tsx": "export const decorators = [];\n" });
		const config = resolveUaightConfig({ root, options: {}, command: "serve" });

		expect(config.storybookPreview).toBeUndefined();
	});
});

describe("preparation", () => {
	const meta: CsfMeta = { title: "Button", decorators: [named("meta")] };

	it("nests preview decorators outside meta decorators outside story ones", () => {
		const story = { decorators: [named("story")] };
		const prepared = prepareStory(
			"Primary",
			story,
			meta,
			{ ...DEFAULT_CSF_SUPPORT, globalDecorators: true },
			0,
			preview({ decorators: [named("global")] }),
		);

		// Outermost first, which is how §3.3 composes them.
		expect(prepared.decorators.map((d) => d.name)).toEqual(["global", "meta", "story"]);
	});

	it("skips preview decorators when the level is not supported", () => {
		const prepared = prepareStory(
			"Primary",
			{},
			meta,
			DEFAULT_CSF_SUPPORT,
			0,
			preview({ decorators: [named("global")] }),
		);

		expect(prepared.decorators.map((d) => d.name)).toEqual(["meta"]);
	});

	it("layers args preview → meta → story", () => {
		const prepared = prepareStory(
			"Primary",
			{ args: { size: "lg" } },
			{ ...meta, args: { size: "md", tone: "brand" } },
			DEFAULT_CSF_SUPPORT,
			0,
			preview({ args: { size: "sm", locale: "en" } }),
		);

		expect(prepared.args).toEqual({ size: "lg", tone: "brand", locale: "en" });
	});

	it("layers parameters the same way", () => {
		const prepared = prepareStory(
			"Primary",
			{ parameters: { layout: "centered" } },
			{ ...meta, parameters: { backgrounds: "dark" } },
			DEFAULT_CSF_SUPPORT,
			0,
			preview({ parameters: { layout: "fullscreen", docs: {} } }),
		);

		expect(prepared.parameters.layout).toBe("centered");
		expect(prepared.parameters.backgrounds).toBe("dark");
		expect(prepared.parameters.docs).toEqual({});
	});

	it("carries initialGlobals into the story context", () => {
		const prepared = prepareStory(
			"Primary",
			{},
			meta,
			DEFAULT_CSF_SUPPORT,
			0,
			preview({ initialGlobals: { theme: "dark" } }),
		);

		expect(prepared.globals).toEqual({ theme: "dark" });
	});

	it("still works with no preview at all", () => {
		const prepared = prepareStory("Primary", {}, meta, DEFAULT_CSF_SUPPORT, 0);

		expect(prepared.decorators.map((d) => d.name)).toEqual(["meta"]);
		expect(prepared.globals).toEqual({});
	});
});

describe("the compatibility report", () => {
	it("counts stories and names what would not survive", async () => {
		const root = project({
			"src/a.stories.tsx": [
				"export default { title: 'A', parameters: { layout: 'centered' } };",
				"export const One = { play: async () => {} };",
				"export const Two = { parameters: { docs: { page: null } } };",
				"export const Three = {};",
			].join("\n"),
			"src/b.stories.tsx": "export default { title: 'B' };\nexport const Fine = {};\n",
		});

		const config = resolveUaightConfig({
			root,
			options: { storybook: true },
			command: "build",
		});
		const report = await storybookReport(config);

		expect(report.files).toBe(2);
		expect(report.stories).toBe(4);
		expect(report.unsupported.play).toBe(1);
		expect(report.unsupported["parameters.docs"]).toBe(1);
		// `layout` is honoured at the highest declared level, so it is not a loss.
		expect(report.unsupported["parameters.layout"]).toBeUndefined();
		expect(report.clean).toBe(1);
	});

	it("reports the preview it found", async () => {
		const root = project({
			".storybook/preview.ts": "export const decorators = [];\n",
			"src/a.stories.tsx": "export default {};\nexport const A = {};\n",
		});

		const config = resolveUaightConfig({
			root,
			options: { storybook: true },
			command: "build",
		});
		const report = await storybookReport(config);

		expect(report.preview).toBe("/.storybook/preview.ts");
	});
});
