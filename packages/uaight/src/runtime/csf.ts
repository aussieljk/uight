/**
 * The declared Storybook CSF subset — SPEC.md §13.
 *
 * We support a subset, **declare** it, and badge anything we decline during
 * normalization. A story that appears to work while silently skipping its
 * interaction logic is worse than one that says it cannot run here.
 *
 * Supported:   metaArgs, storyArgs, argTypes, render, metaDecorators,
 *              storyDecorators, parameters: 'viewport-only',
 *              includeStories/excludeStories, __namedExportsOrder, story `name`,
 *              tags.
 * Declined:    globalDecorators, globals, loaders, play — badged, never skipped
 *              in silence.
 *
 * Two ordering facts drive the adapter:
 *
 *  - **Decorators.** Storybook applies its array innermost-first, and composes
 *    story decorators inside meta decorators inside global ones. We nest
 *    outermost-first (§3.3), so the array is reversed when adapting.
 *  - **Names.** A story's identity is its export name, or its literal `name`
 *    when it has one, because that is what the plugin's static index can see
 *    without executing the module (§3.4). The prettier Storybook display name
 *    (`startCase` of the export) goes to `meta.title`, where it cannot break a
 *    deep link.
 *
 * `globalDecorators` were originally declined by construction: `.storybook/preview`
 * was never loaded, so a global decorator had no way to reach a fixture. The
 * plugin can now find and load that module, and when it does they are honoured
 * — that is the whole difference between reading a repository's stories and
 * *running* them, because nearly every real Storybook install puts its
 * providers, theme and global styles there. With no preview in play the
 * original position stands, and app-wide providers belong in the preview entry
 * (§6.4).
 */

import * as React from "react";
import type {
	FixtureFileIndex,
	FixtureFileMeta,
	FixtureMeta,
	InputOptions,
	StorybookSupport,
	Viewport,
} from "../shared/types.ts";
import { useFixtureId, useFixtureInput } from "./fixture-context.tsx";

export type CsfSupport = Required<NonNullable<StorybookSupport["support"]>>;

export const DEFAULT_CSF_SUPPORT: CsfSupport = {
	metaArgs: true,
	storyArgs: true,
	argTypes: true,
	render: true,
	metaDecorators: true,
	storyDecorators: true,
	globalDecorators: false,
	parameters: "viewport-only",
	globals: false,
	loaders: false,
	play: false,
};

/* ------------------------------------------------------------------ *
 * CSF shapes — structural, so a consumer never has to import our types
 * ------------------------------------------------------------------ */

export type CsfArgs = Record<string, unknown>;

export interface CsfArgType {
	name?: string;
	description?: string;
	control?: string | { type?: string; min?: number; max?: number; step?: number } | false;
	options?: readonly unknown[];
	type?: unknown;
	action?: unknown;
	table?: { disable?: boolean; [key: string]: unknown };
	if?: unknown;
	[key: string]: unknown;
}

export type CsfArgTypes = Record<string, CsfArgType>;

export interface CsfStoryContext {
	id: string;
	name: string;
	story: string;
	title: string;
	kind: string;
	componentId: string;
	component?: unknown;
	args: CsfArgs;
	initialArgs: CsfArgs;
	argTypes: CsfArgTypes;
	parameters: Record<string, unknown>;
	globals: Record<string, unknown>;
	tags: string[];
	viewMode: "story";
	loaded: Record<string, unknown>;
	abortSignal: AbortSignal;
	canvasElement: unknown;
}

export type CsfRender = (args: CsfArgs, context: CsfStoryContext) => unknown;
export type CsfDecorator = (
	Story: React.ComponentType<Record<string, unknown>>,
	context: CsfStoryContext,
) => unknown;

export interface CsfMeta {
	title?: string;
	id?: string;
	component?: unknown;
	args?: CsfArgs;
	argTypes?: CsfArgTypes;
	decorators?: CsfDecorator | CsfDecorator[];
	parameters?: Record<string, unknown>;
	tags?: string[];
	includeStories?: string[] | RegExp;
	excludeStories?: string[] | RegExp;
	render?: CsfRender;
	globals?: Record<string, unknown>;
	loaders?: unknown;
	play?: unknown;
}

export interface CsfStory {
	name?: string;
	storyName?: string;
	args?: CsfArgs;
	argTypes?: CsfArgTypes;
	decorators?: CsfDecorator | CsfDecorator[];
	parameters?: Record<string, unknown>;
	tags?: string[];
	render?: CsfRender;
	play?: unknown;
	loaders?: unknown;
	globals?: Record<string, unknown>;
}

/**
 * A `.storybook/preview` module, normalized by the plugin's virtual module.
 *
 * Storybook accepts both spellings — named exports and a default `Preview`
 * object — so the virtual module flattens them into this shape before the
 * runtime ever sees it, and the runtime never has to guess which it got.
 */
export interface StorybookPreview {
	decorators: CsfDecorator | CsfDecorator[];
	parameters: Record<string, unknown>;
	globalTypes: Record<string, unknown>;
	initialGlobals: Record<string, unknown>;
	args: CsfArgs;
	argTypes: CsfArgTypes;
}

const EMPTY_PREVIEW: StorybookPreview = {
	decorators: [],
	parameters: {},
	globalTypes: {},
	initialGlobals: {},
	args: {},
	argTypes: {},
};

/* ------------------------------------------------------------------ *
 * Names
 * ------------------------------------------------------------------ */

const WORDS = /[A-Z]{2,}(?=[A-Z][a-z]+\d*|\b)|[A-Z]?[a-z]+\d*|[A-Z]+|\d+/g;

/** lodash `startCase`, which is what Storybook uses for a display name. */
export function startCase(value: string): string {
	const words = value.replace(/['’]/g, "").match(WORDS);
	if (!words) return value;
	return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function sanitize(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/* ------------------------------------------------------------------ *
 * argTypes → InputOptions — §7.6
 * ------------------------------------------------------------------ */

const CONTROL_KINDS: Record<string, InputOptions<unknown>["control"]> = {
	boolean: "checkbox",
	text: "text",
	number: "number",
	range: "range",
	select: "select",
	"multi-select": "select",
	radio: "radio",
	"inline-radio": "radio",
	check: "select",
	"inline-check": "select",
	color: "color",
	date: "date",
	object: "json",
};

interface ArgControl {
	include: boolean;
	options?: InputOptions<unknown>;
}

function argControl(key: string, argType: CsfArgType | undefined): ArgControl {
	if (!argType) return { include: true };
	if (argType.control === false || argType.table?.disable === true) return { include: false };
	// An `action` argType is an addon handler, not a value to edit.
	if (argType.action !== undefined && argType.control === undefined) return { include: false };

	const options: InputOptions<unknown> = {};
	const control = argType.control;

	if (typeof control === "string") {
		options.control = CONTROL_KINDS[control] ?? "auto";
	} else if (control && typeof control === "object") {
		options.control = (control.type && CONTROL_KINDS[control.type]) || "auto";
		if (typeof control.min === "number") options.min = control.min;
		if (typeof control.max === "number") options.max = control.max;
		if (typeof control.step === "number") options.step = control.step;
	}

	if (Array.isArray(argType.options)) {
		options.options = argType.options;
		if (!options.control) options.control = "select";
	}
	if (typeof argType.name === "string" && argType.name !== key) options.label = argType.name;
	if (typeof argType.description === "string") options.description = argType.description;

	return { include: true, options: Object.keys(options).length ? options : undefined };
}

/* ------------------------------------------------------------------ *
 * parameters — 'viewport-only' (§13)
 * ------------------------------------------------------------------ */

/** Storybook's stock viewports, so `defaultViewport: 'mobile1'` means something. */
const STOCK_VIEWPORTS: Record<string, Viewport> = {
	mobile1: { width: 320, height: 568 },
	mobile2: { width: 414, height: 896 },
	tablet: { width: 834, height: 1112 },
};

function toPixels(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const match = /^(\d+(?:\.\d+)?)px$/.exec(value.trim());
		if (match) return Number.parseFloat(match[1]!);
		const bare = Number.parseFloat(value);
		if (Number.isFinite(bare)) return bare;
	}
	return undefined;
}

/**
 * `parameters.layout` — honoured only at the `'viewport-and-layout'` support
 * level or above. Most design systems set it on nearly every story, and it
 * changes how the fixture reads, so declining it silently would misrepresent
 * the component.
 */
export function layoutFromParameters(
	parameters: Record<string, unknown>,
	support: CsfSupport,
): "centered" | "fullscreen" | "padded" | undefined {
	if (support.parameters !== "viewport-and-layout" && support.parameters !== true) {
		return undefined;
	}
	const layout = parameters.layout;
	return layout === "centered" || layout === "fullscreen" || layout === "padded"
		? layout
		: undefined;
}

export function viewportFromParameters(
	parameters: Record<string, unknown>,
	support: CsfSupport,
): Viewport | undefined {
	if (support.parameters === false) return undefined;
	const viewport = parameters.viewport as Record<string, unknown> | undefined;
	if (!viewport || typeof viewport !== "object") return undefined;

	const width = toPixels(viewport.width);
	const height = toPixels(viewport.height);
	if (width !== undefined && height !== undefined) return { width, height };

	const name = viewport.defaultViewport;
	if (typeof name !== "string" || name === "reset") return undefined;

	const table = viewport.viewports as Record<string, { styles?: Record<string, unknown> }> | undefined;
	const entry = table?.[name];
	if (entry?.styles) {
		const w = toPixels(entry.styles.width);
		const h = toPixels(entry.styles.height);
		if (w !== undefined && h !== undefined) return { width: w, height: h };
	}
	return STOCK_VIEWPORTS[name];
}

/* ------------------------------------------------------------------ *
 * Preparation
 * ------------------------------------------------------------------ */

export interface PreparedStory {
	exportName: string;
	/** Identity — what the static index (§3.4) can see without executing. */
	name: string;
	/** Storybook's display name. Never an identity. */
	displayName: string;
	title: string;
	id: string;
	componentId: string;
	args: CsfArgs;
	argTypes: CsfArgTypes;
	/** Arg keys registered as fixture inputs, in a stable order. */
	inputs: Array<{ key: string; options?: InputOptions<unknown> }>;
	render?: CsfRender;
	component?: unknown;
	parameters: Record<string, unknown>;
	/** Outermost first, as §3.3 nests them: preview, then meta, then story. */
	decorators: CsfDecorator[];
	/** `initialGlobals` from the preview, plus anything the story sets. */
	globals: Record<string, unknown>;
	tags: string[];
	viewport?: Viewport;
	layout?: "centered" | "fullscreen" | "padded";
	unsupported: string[];
	order: number;
}

function asArray<T>(value: T | T[] | undefined): T[] {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
}

function matchesList(name: string, list: string[] | RegExp | undefined): boolean | undefined {
	if (list === undefined) return undefined;
	if (Array.isArray(list)) return list.includes(name);
	if (list instanceof RegExp) return list.test(name);
	return undefined;
}

/** Named exports that are stories, honouring include/exclude and export order. */
export function storyExportNames(
	module: Record<string, unknown>,
	meta: CsfMeta,
): string[] {
	const declared = module.__namedExportsOrder;
	const keys = Array.isArray(declared)
		? (declared as unknown[]).filter((key): key is string => typeof key === "string")
		: Object.keys(module);

	const seen = new Set<string>();
	const out: string[] = [];
	for (const key of keys) {
		if (key === "default" || key === "__namedExportsOrder") continue;
		if (seen.has(key)) continue;
		if (!Object.prototype.hasOwnProperty.call(module, key)) continue;
		const value = module[key];
		if (value === null || (typeof value !== "object" && typeof value !== "function")) continue;

		const included = matchesList(key, meta.includeStories);
		if (included === false) continue;
		const excluded = matchesList(key, meta.excludeStories);
		if (excluded === true) continue;

		seen.add(key);
		out.push(key);
	}
	return out;
}

export function prepareStory(
	exportName: string,
	exported: unknown,
	meta: CsfMeta,
	support: CsfSupport,
	order: number,
	preview: StorybookPreview = EMPTY_PREVIEW,
): PreparedStory {
	const story: CsfStory =
		typeof exported === "function"
			? // CSF2: the export is the render function, with properties hung off it.
				{ ...(exported as unknown as CsfStory), render: exported as CsfRender }
			: ((exported ?? {}) as CsfStory);

	const unsupported: string[] = [];
	const decline = (feature: string): void => {
		if (!unsupported.includes(feature)) unsupported.push(feature);
	};

	if (story.play !== undefined && !support.play) decline("play");
	if ((story.loaders ?? meta.loaders) !== undefined && !support.loaders) decline("loaders");
	if ((story.globals ?? meta.globals) !== undefined && !support.globals) decline("globals");
	if (meta.decorators !== undefined && !support.metaDecorators) decline("meta decorators");
	if (story.decorators !== undefined && !support.storyDecorators) decline("story decorators");
	if (story.render !== undefined && !support.render) decline("render");
	if (meta.args !== undefined && !support.metaArgs) decline("meta args");
	if (story.args !== undefined && !support.storyArgs) decline("story args");
	if ((meta.argTypes ?? story.argTypes) !== undefined && !support.argTypes) decline("argTypes");
	if (
		support.parameters === false &&
		(meta.parameters !== undefined || story.parameters !== undefined)
	) {
		decline("parameters");
	}

	// Preview-level values are the base layer Storybook applies beneath the
	// meta's, which is beneath the story's.
	const args: CsfArgs = {
		...(support.metaArgs ? preview.args : undefined),
		...(support.metaArgs ? meta.args : undefined),
		...(support.storyArgs ? story.args : undefined),
	};

	const argTypes: CsfArgTypes = {};
	if (support.argTypes) {
		for (const [key, value] of Object.entries(preview.argTypes ?? {})) argTypes[key] = value;
		for (const [key, value] of Object.entries(meta.argTypes ?? {})) {
			argTypes[key] = { ...argTypes[key], ...value };
		}
		for (const [key, value] of Object.entries(story.argTypes ?? {})) {
			argTypes[key] = { ...argTypes[key], ...value };
		}
	}

	// Storybook applies its array innermost-first and nests story decorators
	// inside meta decorators inside global ones; we nest outermost-first, so
	// each list is reversed and the three are concatenated outermost first.
	const decorators: CsfDecorator[] = [
		...(support.globalDecorators ? asArray(preview.decorators).slice().reverse() : []),
		...(support.metaDecorators ? asArray(meta.decorators).slice().reverse() : []),
		...(support.storyDecorators ? asArray(story.decorators).slice().reverse() : []),
	];

	const parameters: Record<string, unknown> =
		support.parameters === false
			? {}
			: { ...preview.parameters, ...meta.parameters, ...story.parameters };

	const globals: Record<string, unknown> = {
		...preview.initialGlobals,
		...(support.globals ? { ...meta.globals, ...story.globals } : undefined),
	};

	const inputKeys: string[] = [...Object.keys(args)];
	for (const key of Object.keys(argTypes)) if (!inputKeys.includes(key)) inputKeys.push(key);

	const inputs: PreparedStory["inputs"] = [];
	for (const key of inputKeys) {
		const control = argControl(key, argTypes[key]);
		if (!control.include) continue;
		inputs.push(control.options ? { key, options: control.options } : { key });
	}

	const explicitName = story.name ?? story.storyName;
	const title = meta.title ?? "";
	const componentId = meta.id ?? sanitize(title || "story");
	const name = typeof explicitName === "string" ? explicitName : exportName;

	const render = support.render ? (story.render ?? meta.render) : meta.render;

	const prepared: PreparedStory = {
		exportName,
		name,
		displayName: typeof explicitName === "string" ? explicitName : startCase(exportName),
		title,
		id: `${componentId}--${sanitize(exportName)}`,
		componentId,
		args,
		argTypes,
		inputs,
		component: meta.component,
		parameters,
		decorators,
		globals,
		tags: [...(meta.tags ?? []), ...(story.tags ?? [])],
		unsupported,
		order,
	};
	if (render) prepared.render = render;
	const viewport = viewportFromParameters(parameters, support);
	if (viewport) prepared.viewport = viewport;
	const layout = layoutFromParameters(parameters, support);
	if (layout) prepared.layout = layout;
	else if (parameters.layout !== undefined) decline("parameters.layout");
	return prepared;
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

/**
 * A decorator receives a `Story` it may render as an element *or* call as a
 * plain function. Both read the same context, so the provider must sit above
 * the decorator body rather than around its output.
 */
const StoryOutletContext = React.createContext<React.ReactNode>(null);

function StoryOutlet(): React.ReactNode {
	return React.useContext(StoryOutletContext);
}

function CsfDecoratorBody(props: {
	decorator: CsfDecorator;
	context: CsfStoryContext;
}): React.ReactNode {
	return props.decorator(
		StoryOutlet as React.ComponentType<Record<string, unknown>>,
		props.context,
	) as React.ReactNode;
}

function CsfDecoratorNode(props: {
	decorator: CsfDecorator;
	context: CsfStoryContext;
	children: React.ReactNode;
}): React.ReactElement {
	return React.createElement(
		StoryOutletContext.Provider,
		{ value: props.children },
		React.createElement(CsfDecoratorBody, {
			decorator: props.decorator,
			context: props.context,
		}),
	);
}

/**
 * The story body is its own component so that hooks inside a `render` function
 * belong to a stable fiber — Storybook renders the story function as a
 * component for exactly this reason, and the frosted-ui corpus relies on it
 * (`render: function Render(args) { const [x] = React.useState() }`).
 */
function CsfStoryBody(props: {
	story: PreparedStory;
	args: CsfArgs;
	context: CsfStoryContext;
}): React.ReactNode {
	const { story, args, context } = props;
	if (story.render) return story.render(args, context) as React.ReactNode;
	if (story.component) {
		return React.createElement(story.component as React.ComponentType<CsfArgs>, args);
	}
	throw new Error(
		`CSF story "${story.name}" has no render function and its meta has no component, so there is nothing to render`,
	);
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
	const keys = Object.keys(a);
	if (keys.length !== Object.keys(b).length) return false;
	return keys.every(
		(key) => Object.prototype.hasOwnProperty.call(b, key) && Object.is(a[key], b[key]),
	);
}

/**
 * Story args are fixture inputs — that is what makes `argTypes` mean something
 * here (§7.6: metadata is declared at the call site, and an argType *is* a call
 * site declaration). The key list is fixed when the story is prepared, so the
 * hook order is stable across renders.
 */
function useCsfArgs(story: PreparedStory): CsfArgs {
	const next: CsfArgs = { ...story.args };
	for (const input of story.inputs) {
		// eslint-disable-next-line react-hooks/rules-of-hooks -- fixed-length list
		const [value] = useFixtureInput(input.key, story.args[input.key], input.options);
		next[input.key] = value;
	}
	const cache = React.useRef(next);
	if (!shallowEqual(cache.current, next)) cache.current = next;
	return cache.current;
}

export function createStoryComponent(story: PreparedStory): React.ComponentType {
	function CsfStoryFixture(): React.ReactNode {
		const fixtureId = useFixtureId();
		const args = useCsfArgs(story);

		const context = React.useMemo<CsfStoryContext>(
			() => ({
				id: story.id,
				name: story.displayName,
				story: story.displayName,
				title: story.title,
				kind: story.title,
				componentId: story.componentId,
				component: story.component,
				args,
				initialArgs: story.args,
				argTypes: story.argTypes,
				parameters: story.parameters,
				globals: story.globals,
				tags: story.tags,
				viewMode: "story",
				loaded: {},
				abortSignal: new AbortController().signal,
				canvasElement: typeof document === "undefined" ? undefined : document.body,
			}),
			[args, fixtureId],
		);

		let node: React.ReactNode = React.createElement(CsfStoryBody, { story, args, context });
		for (let index = story.decorators.length - 1; index >= 0; index--) {
			node = React.createElement(CsfDecoratorNode, {
				key: index,
				decorator: story.decorators[index]!,
				context,
				children: node,
			});
		}
		return node;
	}

	CsfStoryFixture.displayName = `CsfStory(${story.exportName})`;
	return CsfStoryFixture;
}

/* ------------------------------------------------------------------ *
 * Module normalization
 * ------------------------------------------------------------------ */

export interface NormalizedCsfFixture {
	name: string;
	render: React.ComponentType;
	meta: FixtureMeta;
	unsupported?: string[];
}

export interface NormalizedCsfModule {
	fixtures: NormalizedCsfFixture[];
	fileMeta?: FixtureFileMeta;
}

export function normalizeCsfModule(
	module: unknown,
	_file: FixtureFileIndex,
	support: CsfSupport = DEFAULT_CSF_SUPPORT,
	preview: StorybookPreview | null = null,
): NormalizedCsfModule {
	if (!module || typeof module !== "object") return { fixtures: [] };
	const namespace = module as Record<string, unknown>;
	const meta = (namespace.default ?? {}) as CsfMeta;
	if (typeof meta !== "object") return { fixtures: [] };

	// A stories module cannot declare global decorators, but a preview-shaped
	// module can; badge it rather than pretend it ran. With a real preview
	// loaded there is nothing to badge — the decorators actually run.
	const hasPreviewDecorators =
		!support.globalDecorators &&
		(Array.isArray(namespace.decorators) || namespace.globalTypes !== undefined);

	const names = storyExportNames(namespace, meta);
	const fixtures: NormalizedCsfFixture[] = [];

	names.forEach((exportName, index) => {
		const story = prepareStory(
			exportName,
			namespace[exportName],
			meta,
			support,
			index,
			preview ?? EMPTY_PREVIEW,
		);
		if (hasPreviewDecorators) story.unsupported.push("global decorators");

		const fixtureMeta: FixtureMeta = { order: story.order };
		if (story.displayName !== story.name) fixtureMeta.title = story.displayName;
		if (story.viewport) fixtureMeta.viewport = story.viewport;
		if (story.layout) fixtureMeta.layout = story.layout;
		if (story.tags.length) fixtureMeta.tags = story.tags;

		const fixture: NormalizedCsfFixture = {
			name: story.name,
			render: createStoryComponent(story),
			meta: fixtureMeta,
		};
		if (story.unsupported.length) fixture.unsupported = story.unsupported;
		fixtures.push(fixture);
	});

	const fileMeta: FixtureFileMeta = {};
	if (meta.title) fileMeta.group = meta.title;
	if (meta.tags?.length) fileMeta.tags = meta.tags;
	const metaViewport = viewportFromParameters(
		support.parameters === false ? {} : (meta.parameters ?? {}),
		support,
	);
	if (metaViewport) fileMeta.viewport = metaViewport;

	return { fixtures, fileMeta: Object.keys(fileMeta).length ? fileMeta : undefined };
}
