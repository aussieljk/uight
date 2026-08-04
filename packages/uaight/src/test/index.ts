/**
 * `uaight/test` — fixtures as test fixtures.
 *
 * The standing objection to any component explorer is that writing fixtures is
 * work that only ever powers a UI. It does not have to be: a fixture is already
 * a named, addressable, decorator-wrapped render of a component, which is
 * exactly the setup half of a component test.
 *
 * This entry hands that setup to a test runner. It reuses the *same*
 * normalization the explorer uses (§3.1, §13), so a fixture that renders in the
 * explorer renders identically here — including CSF stories, meta and story
 * decorators, the file's `uaight.decorator`, and a `.storybook/preview` when one
 * is in play.
 *
 * ```ts
 * import { fixtureIds, mountFixture } from "uaight/test";
 *
 * test.each(await fixtureIds())("%s renders", async (id) => {
 *   const mounted = await mountFixture(id);
 *   expect(mounted.container).toBeTruthy();
 *   mounted.unmount();
 * });
 * ```
 *
 * It runs wherever the plugin does: the virtual modules below are the plugin's,
 * so this needs Vitest's browser mode (or any Vite-driven runner) with
 * `uaight()` in the config. There is no second index and no second parser —
 * if the explorer can find a fixture, so can a test.
 */

import { createElement } from "react";
import type { ComponentType, ReactElement, ReactNode } from "react";
import {
	config,
	decoratorModules,
	fixtureModules,
	inventoryModules,
} from "virtual:uaight/runtime";

import { parseFixtureId, serializeFixtureId } from "../shared/fixture-id.ts";
import { matchesFilter } from "../shared/filter.ts";
import { ALL_FIXTURES } from "../shared/types.ts";
import type { Filter, FixtureId, FixtureFileIndex } from "../shared/types.ts";
import type { StorybookPreview } from "../runtime/csf.ts";
import {
	composeDecorators,
	loadDecorators,
	selectDecorators,
} from "../runtime/decorators.ts";
import {
	FixtureRuntimeProvider,
	createViewportSource,
} from "../runtime/fixture-context.tsx";
import type { NormalizedFixture } from "../runtime/normalize.ts";
import { normalizeModule, selectFixture } from "../runtime/normalize.ts";
import { OverlayStore } from "../runtime/overlay.ts";
import { createSerializer } from "../runtime/serialize.ts";

export type { FixtureId, NormalizedFixture };

/* ------------------------------------------------------------------ *
 * Discovery
 * ------------------------------------------------------------------ */

export interface FixtureIdsOptions {
	/** Same semantics as `<Uaight filter>` (§3.6). */
	filter?: Filter;
	/**
	 * Load modules whose names the static index could not determine (§3.4).
	 * On by default: a test list that silently omits undecidable files would
	 * under-report coverage, which is the opposite of what a test list is for.
	 */
	resolveUndecidable?: boolean;
}

/** Names a module actually exports, read the way the warm pass reads them. */
async function namesOf(file: FixtureFileIndex): Promise<Array<string | null>> {
	if (file.names !== null && file.names.length > 0) return file.names;
	const load = fixtureModules[file.globPath];
	if (!load) return [null];
	const normalized = normalizeModule(await load(), file, config);
	return normalized.fixtures.map((fixture) => fixture.name);
}

/**
 * Every fixture in the project, as ids. Sorted by display path, then by the
 * order the file declares — the same order the tree and the toolbar show, so a
 * test report reads in the same sequence as the explorer.
 */
export async function fixtureIds(options: FixtureIdsOptions = {}): Promise<FixtureId[]> {
	const resolve = options.resolveUndecidable ?? true;
	const out: FixtureId[] = [];

	for (const file of config.files) {
		if (!matchesFilter(file.path, options.filter)) continue;

		if (file.names === null) {
			if (!resolve) continue;
			for (const name of await namesOf(file)) out.push({ path: file.path, name });
			continue;
		}
		for (const name of file.names) out.push({ path: file.path, name });
	}
	return out;
}

/** Ids as strings, for `test.each` tables that want a readable title. */
export async function fixtureIdStrings(
	options: FixtureIdsOptions = {},
): Promise<string[]> {
	return (await fixtureIds(options)).map(serializeFixtureId);
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

export interface LoadFixtureOptions {
	/**
	 * Wrap in the consumer's preview entry (§6.4) — the providers and CSS the
	 * fixture is written to expect. On by default, because a fixture rendered
	 * without its providers is not the thing the explorer shows.
	 */
	preview?: boolean;
	/** Apply the file's decorators (§3.3). On by default. */
	decorators?: boolean;
}

type PreviewComponent = ComponentType<{ children: ReactNode }> | undefined;

let previewCache: Promise<PreviewComponent> | null = null;
let storybookPreviewCache: Promise<StorybookPreview | null> | null = null;

async function loadPreviewEntry(): Promise<PreviewComponent> {
	if (!config.hasPreviewEntry) return undefined;
	previewCache ??= import("virtual:uaight/preview-entry").then((mod) => mod.Preview);
	return previewCache;
}

async function loadStorybookPreview(): Promise<StorybookPreview | null> {
	if (!config.hasStorybookPreview) return null;
	storybookPreviewCache ??= import("virtual:uaight/storybook-preview").then(
		(mod) => mod.storybookPreview,
	);
	return storybookPreviewCache;
}

export interface LoadedFixture {
	id: FixtureId;
	fixture: NormalizedFixture;
	/** Ready to hand to a testing library's `render`. */
	element: ReactElement;
	/** CSF features §13 declined for this fixture, if any. */
	unsupported: string[];
}

/**
 * Resolve one fixture to a React element, wrapped exactly as the explorer
 * wraps it: decorators outermost-first, then the runtime context the fixture
 * hooks need, then the preview entry's providers.
 *
 * `useFixtureInput` works here and returns its default — there is no control
 * panel to drive it, and the overlay store is a real one with no host attached,
 * so a fixture that calls its own setter behaves as it does on first paint.
 */
export async function loadFixture(
	id: FixtureId | string,
	options: LoadFixtureOptions = {},
): Promise<LoadedFixture> {
	const parsed = parseFixtureId(id);
	if (!parsed) throw new Error(`[uaight/test] "${String(id)}" is not a fixture id`);
	if (parsed.name === ALL_FIXTURES) {
		throw new Error(
			`[uaight/test] ${parsed.path} names every fixture in the file. Pass one id, ` +
				`or map over fixtureIds({ filter: "${parsed.path}" }).`,
		);
	}

	const file = config.files.find((candidate) => candidate.path === parsed.path);
	if (!file) throw new Error(`[uaight/test] no fixture file indexed at "${parsed.path}"`);

	const load = fixtureModules[file.globPath];
	if (!load) throw new Error(`[uaight/test] no module registered for ${file.globPath}`);

	const [module, decorators, storybookPreview, Preview] = await Promise.all([
		load(),
		options.decorators === false
			? Promise.resolve([])
			: loadDecorators(selectDecorators(config.decorators, parsed.path), decoratorModules),
		loadStorybookPreview(),
		options.preview === false ? Promise.resolve(undefined) : loadPreviewEntry(),
	]);

	const normalized = normalizeModule(module, file, config, storybookPreview);
	const picked = selectFixture(normalized.fixtures, parsed.name);
	if (!picked.fixture) {
		const available = normalized.fixtures.map((f) => JSON.stringify(f.name)).join(", ");
		throw new Error(
			`[uaight/test] ${parsed.path} has no fixture named ${JSON.stringify(parsed.name)}. ` +
				`It has: ${available || "none"}`,
		);
	}

	const fixture = picked.fixture;
	const render = fixture.render;
	const node: ReactElement = isElement(render)
		? render
		: createElement(render as ComponentType);

	const runtime = {
		fixtureId: parsed,
		isolation: "inline" as const,
		config,
		store: new OverlayStore(createSerializer([], { dev: false }), () => {}, false),
		serializer: createSerializer([], { dev: false }),
		viewport: createViewportSource(null),
		send: () => {},
		dev: false,
	};

	let element: ReactElement = createElement(FixtureRuntimeProvider, {
		runtime,
		children: composeDecorators(node, decorators, {}),
	});
	if (Preview) element = createElement(Preview, { children: element });

	return {
		id: parsed,
		fixture,
		element,
		unsupported: fixture.unsupported ?? [],
	};
}

function isElement(value: unknown): value is ReactElement {
	return (
		typeof value === "object" &&
		value !== null &&
		"$$typeof" in (value as Record<string, unknown>) &&
		"props" in (value as Record<string, unknown>)
	);
}

/* ------------------------------------------------------------------ *
 * Mounting
 * ------------------------------------------------------------------ */

export interface MountedFixture extends LoadedFixture {
	container: HTMLElement;
	unmount(): void;
}

export interface MountFixtureOptions extends LoadFixtureOptions {
	/** Mount point. A detached div appended to `document.body` by default. */
	container?: HTMLElement;
}

/**
 * Mount a fixture with React DOM, for runners that do not bring their own
 * renderer. Testing Library users want `loadFixture(...).element` instead —
 * this exists so the package has no opinion about which library you use.
 */
export async function mountFixture(
	id: FixtureId | string,
	options: MountFixtureOptions = {},
): Promise<MountedFixture> {
	const loaded = await loadFixture(id, options);

	const container = options.container ?? document.createElement("div");
	if (!options.container) document.body.appendChild(container);

	const { createRoot } = await import("react-dom/client");
	const root = createRoot(container);
	// Rendering is synchronous enough for a test only once the caller awaits a
	// tick; `act` belongs to the runner, so the caller owns flushing.
	root.render(loaded.element);

	return {
		...loaded,
		container,
		unmount() {
			root.unmount();
			if (!options.container) container.remove();
		},
	};
}

/* ------------------------------------------------------------------ *
 * Inventory
 * ------------------------------------------------------------------ */

/** Detected components (§12), for a smoke test over a codebase with no fixtures. */
export function inventory(): typeof config.inventory {
	return config.inventory;
}

/** Load a detected component by its inventory entry. */
export async function loadComponent(item: {
	globPath: string;
	exportName: string;
}): Promise<ComponentType> {
	const load = inventoryModules[item.globPath];
	if (!load) throw new Error(`[uaight/test] no module registered for ${item.globPath}`);
	const module = (await load()) as Record<string, unknown>;
	const exported = module[item.exportName];
	if (
		typeof exported !== "function" &&
		(typeof exported !== "object" || exported === null)
	) {
		throw new Error(
			`[uaight/test] ${item.globPath} has no component export named "${item.exportName}"`,
		);
	}
	return exported as ComponentType;
}
