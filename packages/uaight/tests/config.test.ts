/**
 * Config resolution. SPEC.md §4.1, §4.2, §20.1.
 *
 * The rule that has to hold is §4.2's: a filesystem path and a glob path are
 * different things and must never be interchanged, because a glob beginning
 * with `/` resolves against the Vite root rather than the disk. Everything else
 * here is "every option has a working default" (D4) — the zero-config claim is
 * only true if resolution produces a usable config from `{}`.
 *
 * `src/vite/**` belongs to another agent. Absent means skipped, not passed.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";

import type { UaightPluginOptions } from "../src/shared/types.ts";
import { optional, present } from "./helpers/optional.ts";

interface ResolvedUaightConfig {
	root: string;
	command: "serve" | "build";
	route: string | false;
	fixturesDirFsPath: string;
	fixturesDirGlobPath: string;
	fixtureFileSuffix: string;
	decoratorFileSuffixes: string[];
	include: string[];
	exclude: string[];
	caseSensitive: boolean;
	inventory: false | { include: string[]; exclude: string[] };
	index: "static" | "warm" | "lazy";
	production: "exclude" | "include" | "error";
	storybook: false | { fileSuffix: string; play: boolean; loaders: boolean };
	docgen: boolean;
}

interface ConfigModule {
	resolveUaightConfig(opts: {
		root: string;
		options: UaightPluginOptions;
		command: "serve" | "build";
	}): ResolvedUaightConfig;
	defineUaightConfig?(config: UaightPluginOptions): UaightPluginOptions;
	toGlobPath?(root: string, fsPath: string): string;
}

const mod = await optional<ConfigModule>(
	"../../src/vite/index.ts",
	"../../src/vite/config.ts",
);

const describeIf = present(mod) ? describe : describe.skip;

const ROOT = path.resolve("/tmp/uaight-project");

function resolve(
	options: UaightPluginOptions = {},
	command: "serve" | "build" = "serve",
): ResolvedUaightConfig {
	return mod!.resolveUaightConfig({ root: ROOT, options, command });
}

describeIf("zero config (D4)", () => {
	it("produces a working config from nothing at all", () => {
		const cfg = resolve();
		expect(cfg.route).toBe("/uaight");
		expect(cfg.fixtureFileSuffix).toBe("fixture");
		expect(cfg.index).toBe("warm");
		expect(cfg.production).toBe("exclude");
		expect(cfg.caseSensitive).toBe(true);
		expect(cfg.docgen).toBe(false);
	});

	it("turns the component inventory on, which is the zero-config experience (§12)", () => {
		expect(resolve().inventory).not.toBe(false);
	});

	it("leaves Storybook off until asked (§13)", () => {
		expect(resolve().storybook).toBe(false);
		const on = resolve({ storybook: true }).storybook;
		expect(on).not.toBe(false);
		// The subset is declared, not inferred: play and loaders stay off.
		expect((on as { play: boolean; loaders: boolean }).play).toBe(false);
		expect((on as { play: boolean; loaders: boolean }).loaders).toBe(false);
		expect((on as { fileSuffix: string }).fileSuffix).toBe("stories");
	});

	it("recognizes both decorator file names (§3.3)", () => {
		const suffixes = resolve().decoratorFileSuffixes;
		expect(suffixes).toContain("cosmos.decorator");
		expect(suffixes).toContain("uaight.decorator");
	});
});

describeIf("the two path representations (§4.2)", () => {
	it("keeps the filesystem path absolute and the glob path root-relative", () => {
		const cfg = resolve();
		expect(cfg.fixturesDirFsPath).toBe(path.join(ROOT, "src"));
		expect(cfg.fixturesDirGlobPath).toBe("/src");
	});

	it("follows a custom fixturesDir in both representations", () => {
		const cfg = resolve({ fixturesDir: "app/components" });
		expect(cfg.fixturesDirFsPath).toBe(path.join(ROOT, "app", "components"));
		expect(cfg.fixturesDirGlobPath).toBe("/app/components");
	});

	it("uses forward slashes in the glob path, whatever the platform separator is", () => {
		expect(resolve({ fixturesDir: "app/components" }).fixturesDirGlobPath).not.toContain(
			"\\",
		);
	});

	it("maps the root itself to `/`", () => {
		const cfg = resolve({ fixturesDir: "." });
		expect(cfg.fixturesDirFsPath).toBe(ROOT);
		expect(["/", ""]).toContain(cfg.fixturesDirGlobPath);
	});
});

describeIf("explicit options", () => {
	it("disables the dev route entirely when route is false", () => {
		expect(resolve({ route: false }).route).toBe(false);
	});

	it("normalizes a route to a leading slash", () => {
		expect(resolve({ route: "explorer" }).route).toBe("/explorer");
		expect(resolve({ route: "/explorer" }).route).toBe("/explorer");
	});

	it("carries include, exclude and caseSensitive through", () => {
		const cfg = resolve({
			include: ["**/*.demo.tsx"],
			exclude: ["**/legacy/**"],
			caseSensitive: false,
		});
		expect(cfg.include).toEqual(["**/*.demo.tsx"]);
		expect(cfg.exclude).toEqual(["**/legacy/**"]);
		expect(cfg.caseSensitive).toBe(false);
	});

	it("accepts inventory: false", () => {
		expect(resolve({ inventory: false }).inventory).toBe(false);
	});

	it("records the command it was resolved for, since §4.5 resolves in config()", () => {
		expect(resolve({}, "build").command).toBe("build");
		expect(resolve({}, "serve").command).toBe("serve");
	});

	it("does not mutate the options object it was handed", () => {
		const options: UaightPluginOptions = { fixturesDir: "app" };
		const before = { ...options };
		resolve(options);
		expect(options).toEqual(before);
	});
});

describeIf("defineUaightConfig", () => {
	it("is an identity helper that exists only for types (§19.4)", () => {
		if (!mod!.defineUaightConfig) return;
		const config: UaightPluginOptions = { fixturesDir: "app" };
		expect(mod!.defineUaightConfig(config)).toEqual(config);
	});
});
