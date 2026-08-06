/**
 * A local stand-in for the handful of types the copied frosted-ui stories
 * import from `@storybook/react`.
 *
 * The point of this demo is that uight reads Component Story Format directly
 * (SPEC §13), so Storybook itself is deliberately **not** a dependency here.
 * CSF is a file format, not a runtime: a `.stories.tsx` file is a default
 * export of metadata plus named exports of stories, and nothing about that
 * requires the Storybook packages to be installed.
 *
 * These types are intentionally permissive. They exist to let the story files
 * type-check, not to police them — uight validates and badges the CSF subset
 * it supports at normalization time (§13), which is where the real contract
 * lives. Anything outside the supported subset (`play`, `loaders`, `globals`)
 * is typed here so upstream files still compile, and is marked below with the
 * support status uight declares for it.
 */

import type * as React from "react";

/** Loose args bag. CSF args are arbitrary props for the story's component. */
export type Args = Record<string, any>;

/** Supported (§13: `argTypes: true`). Only the shape is modelled. */
export interface ArgType {
	name?: string;
	description?: string;
	defaultValue?: unknown;
	control?: unknown;
	options?: readonly unknown[];
	table?: Record<string, unknown>;
	type?: unknown;
	if?: unknown;
	[key: string]: unknown;
}

export type ArgTypes<TArgs = Args> = Partial<Record<keyof TArgs | string, ArgType>>;

/** The context a decorator or `render` receives. */
export interface StoryContext<TArgs = Args> {
	args: TArgs;
	argTypes: ArgTypes<TArgs>;
	parameters: Record<string, unknown>;
	globals: Record<string, unknown>;
	id: string;
	name: string;
	title: string;
	componentId?: string;
	viewMode?: "story" | "docs" | string;
	loaded: Record<string, unknown>;
	[key: string]: unknown;
}

/**
 * Supported at meta and story level (§13: `metaDecorators`, `storyDecorators`).
 * Storybook applies an array innermost-first; uight nests outermost-first and
 * reverses when adapting.
 */
export type Decorator<TArgs = Args> = (
	Story: React.ComponentType<Partial<TArgs>>,
	context: StoryContext<TArgs>,
) => React.ReactElement | null;

/** Alias kept because upstream code and docs use both spellings. */
export type DecoratorFunction<TArgs = Args> = Decorator<TArgs>;

/**
 * Recovers a story's args type the way Storybook's own types do: from a
 * component, from a meta object's `component`, or from an explicit args type.
 * Without this, `args: { label: (value, percent) => … }` loses its contextual
 * type and every callback in a story's args becomes an implicit `any`.
 */
export type ArgsOf<T> = T extends React.ComponentType<infer P>
	? P
	: T extends { component?: infer C }
		? C extends React.ComponentType<infer P>
			? P
			: Args
		: Args;

/** Shared between `Meta` and `StoryObj`; CSF inherits these downwards. */
interface Annotations<TArgs = Args> {
	args?: Partial<TArgs>;
	argTypes?: ArgTypes<TArgs>;
	/** §13: `parameters: 'viewport-only'` — everything else is read and badged. */
	parameters?: Record<string, unknown>;
	decorators?: Decorator<TArgs> | Array<Decorator<TArgs>>;
	render?: (args: TArgs, context: StoryContext<TArgs>) => React.ReactNode;
	tags?: string[];
	/** §13: `globals: false` — accepted by the type, not applied by the runtime. */
	globals?: Record<string, unknown>;
	/** §13: `loaders: false` — not run. Badged as unsupported. */
	loaders?: any;
	/** §13: `play: false` — not run. Badged as unsupported. */
	play?: any;
	/** Extra keys are tolerated so upstream files compile unchanged. */
	[key: string]: unknown;
}

/** The default export of a CSF module. */
export interface Meta<TCmpOrArgs = Args> extends Annotations<ArgsOf<TCmpOrArgs>> {
	title?: string;
	id?: string;
	component?: React.ComponentType<any> | keyof React.JSX.IntrinsicElements;
	subcomponents?: Record<string, React.ComponentType<any>>;
	includeStories?: string[] | RegExp;
	excludeStories?: string[] | RegExp;
}

/** Alias Storybook also publishes. */
export type ComponentMeta<T = Args> = Meta<T>;

/**
 * A named export in CSF 3: an object of annotations. `T` is normally
 * `typeof meta`, so args flow down from the meta's `component`.
 */
export interface StoryObj<TMetaOrCmpOrArgs = Args>
	extends Annotations<ArgsOf<TMetaOrCmpOrArgs>> {
	name?: string;
	storyName?: string;
}

/** Alias Storybook also publishes. */
export type Story<T = Args> = StoryObj<T>;

/** A named export in CSF 2: a function, optionally carrying annotations. */
export type StoryFn<TMetaOrCmpOrArgs = Args> = {
	(
		args: ArgsOf<TMetaOrCmpOrArgs>,
		context: StoryContext<ArgsOf<TMetaOrCmpOrArgs>>,
	): React.ReactElement | null;
	storyName?: string;
	args?: Partial<ArgsOf<TMetaOrCmpOrArgs>>;
	argTypes?: ArgTypes<ArgsOf<TMetaOrCmpOrArgs>>;
	parameters?: Record<string, unknown>;
	decorators?:
		| Decorator<ArgsOf<TMetaOrCmpOrArgs>>
		| Array<Decorator<ArgsOf<TMetaOrCmpOrArgs>>>;
};

/** Alias Storybook also publishes. */
export type ComponentStory<T = Args> = StoryFn<T>;

/**
 * The default export of a `.storybook/preview.tsx`. uight does not read one
 * (§13: `globalDecorators: false`) — global providers belong in the preview
 * entry (§6.4), which is `src/uight.preview.tsx` in this demo. The type is
 * here so a copied preview file would still compile.
 */
export interface Preview {
	decorators?: Decorator | Decorator[];
	parameters?: Record<string, unknown>;
	args?: Args;
	argTypes?: ArgTypes;
	globalTypes?: Record<string, unknown>;
	tags?: string[];
	loaders?: any;
	[key: string]: unknown;
}
