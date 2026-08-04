/**
 * Fixture hot-update registry — SPEC.md §4.5, Q9, and §20.3's HMR budget.
 *
 * **The problem this exists to solve.** A fixture module is reached through
 * `import.meta.glob(..., { eager: false })`, so the module that imports it is
 * `virtual:uaight/runtime` — which both realms import, and which accepts
 * nothing. A fixture module is also frequently not a React Fast Refresh
 * boundary: §3.1 makes `export default { Alpha: <p /> }` a perfectly good
 * fixture file, and a module whose exports are elements rather than components
 * has no boundary for `plugin-react` to install. So an edit propagated all the
 * way to the host entry and Vite took the only option left to it: a full
 * reload of the host document. Every keystroke in a fixture cost a navigation,
 * a fresh explorer chunk, a fresh frame document and a fresh handshake — which
 * is the whole of §20.3's 880 ms HMR measurement, and which threw away control
 * values (Q14 — they are session state) on every save.
 *
 * **The fix.** The plugin appends an `import.meta.hot.accept` callback to every
 * fixture module it serves, which hands the new module namespace here. That
 * makes the fixture module its own boundary, so propagation stops at the file
 * that changed, and it gives the renderer the new exports — which is the half
 * Fast Refresh cannot supply for an element-valued module.
 *
 * The registry is per REALM, published on `globalThis`, because the frame
 * document and the host document each evaluate their own copy of the fixture
 * module against their own HMR client. It is a plain object rather than an
 * import so the injected code can find it without the plugin having to resolve
 * a specifier from inside a user file.
 *
 * A module recorded here always wins over the glob's loader: the loader would
 * return the browser's cached copy of the old URL.
 */

import type { RuntimeConfig } from "../shared/types.ts";
import type { ModuleMap } from "./RendererApp.tsx";

export const HOT_REGISTRY_KEY = "__UAIGHT_HOT__";

export interface RuntimeModuleMaps {
	fixtureModules?: ModuleMap;
	decoratorModules?: ModuleMap;
	inventoryModules?: ModuleMap;
	/**
	 * The regenerated `RuntimeConfig`. The renderer resolves a fixture id
	 * against `config.files`, and a frame booted before the file existed would
	 * otherwise report "no fixture file indexed" for a file the tree is already
	 * offering — the host learns the new index from `uaight:index`, and the
	 * renderer, which never sees that event, learns it here.
	 */
	config?: RuntimeConfig;
}

export interface FixtureHotRegistry {
	/** Bumped on every update, so a React effect can depend on it. */
	version: number;
	/** Called by the code the plugin appends to each fixture module. */
	update(globPath: string, module: unknown): void;
	get(globPath: string): unknown | undefined;
	/**
	 * The re-evaluated `virtual:uaight/runtime` namespace, after a file was
	 * added, unlinked or renamed.
	 *
	 * `import.meta.glob` matched a set of paths at transform time, so a new file
	 * means a new module. Vite invalidates the virtual module, and with nobody
	 * accepting it that propagated to the host entry — a full page reload for
	 * every file added to the project, discarding every tuned control (Q14). The
	 * generated module accepts itself now and posts its fresh maps here; the
	 * index itself keeps arriving over the `uaight:index` event as before, so
	 * this carries only what an event cannot: the loaders.
	 */
	updateMaps(next: RuntimeModuleMaps): void;
	maps(): RuntimeModuleMaps | null;
	subscribe(listener: () => void): () => void;
}

interface HotGlobal {
	[HOT_REGISTRY_KEY]?: FixtureHotRegistry;
}

function createRegistry(): FixtureHotRegistry {
	const modules = new Map<string, unknown>();
	const listeners = new Set<() => void>();
	let maps: RuntimeModuleMaps | null = null;

	return {
		version: 0,
		update(globPath, module) {
			if (typeof globPath !== "string" || !module) return;
			modules.set(globPath, module);
			this.version += 1;
			for (const listener of [...listeners]) listener();
		},
		get: (globPath) => modules.get(globPath),
		updateMaps(next) {
			if (!next) return;
			maps = {
				fixtureModules: next.fixtureModules,
				decoratorModules: next.decoratorModules,
				inventoryModules: next.inventoryModules,
				config: next.config,
			};
			// A file that moved is a file whose old module must stop winning over
			// the glob: after a rename the recorded copy is the departed path's.
			modules.clear();
			this.version += 1;
			for (const listener of [...listeners]) listener();
		},
		maps: () => maps,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

/**
 * This realm's registry, created on first use.
 *
 * Idempotent because both the renderer and the injected fixture code reach for
 * it, in either order — the fixture module may well be evaluated before the
 * renderer that asked for it has finished mounting.
 */
export function fixtureHotRegistry(): FixtureHotRegistry {
	const scope = globalThis as unknown as HotGlobal;
	const existing = scope[HOT_REGISTRY_KEY];
	if (existing) return existing;
	const registry = createRegistry();
	scope[HOT_REGISTRY_KEY] = registry;
	return registry;
}

/**
 * The glob's loader for `globPath`, with any hot-updated module preferred.
 *
 * Returning the module directly rather than re-importing keeps the update on
 * the same task the accept callback ran on, which is what makes the edit-to-
 * render number a re-render rather than a round trip.
 */
export function loadFixtureModule(
	modules: ModuleMap,
	globPath: string,
): Promise<unknown> | undefined {
	const registry = fixtureHotRegistry();
	const updated = registry.get(globPath);
	if (updated !== undefined) return Promise.resolve(updated);
	const load = (registry.maps()?.fixtureModules ?? modules)[globPath];
	return load ? load() : undefined;
}

/** The live map for a kind, which is the hot one once a file has moved. */
export function liveModuleMap(
	kind: "fixtureModules" | "decoratorModules" | "inventoryModules",
	fallback: ModuleMap,
): ModuleMap {
	return fixtureHotRegistry().maps()?.[kind] ?? fallback;
}

/** The regenerated config once a file has been added, unlinked or renamed. */
export function liveRuntimeConfig(fallback: RuntimeConfig): RuntimeConfig {
	return fixtureHotRegistry().maps()?.config ?? fallback;
}
