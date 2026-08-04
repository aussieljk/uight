/**
 * Reading the options a project passes inline to `uaight()`. §4.1, §4.5.
 *
 * `resolveUaightConfig` answers "what did the user write in
 * `uaight.config.json`", which is the wrong question for most projects: the
 * documented way to configure the plugin is an argument to the `uaight()` call
 * in `vite.config.ts`, and that argument is not a file anyone can read — it is
 * an expression inside a module. `uaight doctor` therefore used to report the
 * defaults for every project that configures the plugin the normal way, which
 * is the majority (the demo: 6 files and "storybook off", against 83 files and
 * a full CSF corpus on the running dev server).
 *
 * The fix is to stop guessing and load the Vite config the way Vite does.
 * `loadConfigFromFile` is Vite's own loader — the same one the dev server uses
 * — so a TypeScript config, an ESM config, a config that computes its options
 * and a config in any of the names Vite accepts all work here for free.
 *
 * **How the options get out of the call.** The plugin object `uaight()` returns
 * carries the raw options on `plugin.api.options` (see `index.ts`). Vite's
 * `api` field is the documented channel for one plugin to expose something to
 * another, so nothing private is being reached into: the returned object is
 * what the config author handed to Vite, and we read a field of it.
 *
 * We deliberately do **not** call `resolveConfig`. That runs every plugin's
 * `config()` hook, which means running uaight's own scan (and every other
 * plugin's startup work) just to find out what was passed — the doctor would
 * scan twice and would fail whenever an unrelated plugin's hook threw.
 */

import path from "node:path";
import type { UaightPluginOptions } from "../shared/types.ts";

export interface ViteConfigOptions {
	/** Absolute path to the Vite config that was loaded, when one was found. */
	viteConfigFile: string | null;
	/** Options passed inline to `uaight()`, or null when none were found. */
	options: UaightPluginOptions | null;
	/** `resolve.alias` as written, for the call-site pass. */
	alias: unknown;
	/**
	 * Why there are no options, when there are none. A doctor that says
	 * "no Vite config found" is useful; one that silently reports defaults is
	 * the bug this module exists to fix.
	 */
	problem: string | null;
}

const EMPTY: ViteConfigOptions = {
	viteConfigFile: null,
	options: null,
	alias: undefined,
	problem: null,
};

/**
 * A `plugins` array is a tree: entries may be arrays, `false`, `null` or
 * promises (Vite awaits them). Flatten it to the plugin objects.
 */
async function flattenPlugins(value: unknown, out: unknown[] = []): Promise<unknown[]> {
	const resolved = await value;
	if (!resolved) return out;
	if (Array.isArray(resolved)) {
		for (const entry of resolved) await flattenPlugins(entry, out);
		return out;
	}
	out.push(resolved);
	return out;
}

/**
 * Load the project's Vite config and pull out what `uaight()` was given.
 *
 * Never throws. A project with a broken Vite config still deserves a doctor
 * report — the report just says the config could not be loaded, which is
 * frequently the actual answer to "why is my component missing".
 */
export async function loadViteUaightOptions(
	root: string,
	command: "serve" | "build" = "serve",
	configFile?: string,
): Promise<ViteConfigOptions> {
	let loadConfigFromFile: typeof import("vite").loadConfigFromFile;
	try {
		({ loadConfigFromFile } = await import("vite"));
	} catch {
		// The doctor is importable from a package that has Vite as a peer.
		return { ...EMPTY, problem: "vite is not resolvable from this project" };
	}

	let loaded: Awaited<ReturnType<typeof loadConfigFromFile>>;
	try {
		loaded = await loadConfigFromFile(
			{ command, mode: command === "serve" ? "development" : "production" },
			configFile ? path.resolve(root, configFile) : undefined,
			root,
		);
	} catch (error) {
		return {
			...EMPTY,
			problem: `vite config failed to load: ${(error as Error).message.split("\n")[0]}`,
		};
	}

	if (!loaded) return { ...EMPTY, problem: "no vite config file found" };

	const plugins = await flattenPlugins(loaded.config.plugins);
	const plugin = plugins.find(
		(entry): entry is { name: string; api?: { options?: UaightPluginOptions } } =>
			typeof entry === "object" &&
			entry !== null &&
			(entry as { name?: unknown }).name === "uaight",
	);

	if (!plugin) {
		return {
			...EMPTY,
			viteConfigFile: loaded.path,
			alias: loaded.config.resolve?.alias,
			problem: "the vite config loaded, but no uaight() plugin is in its plugins array",
		};
	}

	// An older installed build has no `api` on the plugin. Say so rather than
	// reporting defaults as if they were the project's options.
	const options = plugin.api?.options;
	return {
		viteConfigFile: loaded.path,
		alias: loaded.config.resolve?.alias,
		options: options ?? null,
		problem:
			options === undefined
				? "uaight() is present but exposes no options — the installed uaight predates plugin.api.options"
				: null,
	};
}
