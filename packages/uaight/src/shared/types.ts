/**
 * Shared type contracts. SPEC.md §3, §5, §7, §12, §19.
 *
 * Everything in this file is part of the published surface (§19.5) unless
 * explicitly marked internal. Changing a type here changes the package's
 * semver contract.
 */

import type * as React from "react";

/* ------------------------------------------------------------------ *
 * Fixture identity — §3.2
 * ------------------------------------------------------------------ */

export interface FixtureId {
	/** Display path: fixtures dir, fixture suffix and extension stripped. */
	path: string;
	/** Key in the default-exported object, or `null` for a single-fixture file. */
	name: string | null;
}

/** Key used for per-fixture metadata of a single-fixture file. §3.1 */
export const DEFAULT_FIXTURE = "\0default";

/**
 * Selects **every fixture in the file**, rendered as one stacked page.
 *
 * Like `DEFAULT_FIXTURE` this uses a `\0` prefix so it can never collide with a
 * real key, and because it is an ordinary `FixtureId.name` it serializes,
 * round-trips and deep-links through §3.2's encoding with no special case.
 */
export const ALL_FIXTURES = "\0all";

/* ------------------------------------------------------------------ *
 * Fixture metadata — §3.1
 * ------------------------------------------------------------------ */

export interface Viewport {
	width: number;
	height: number;
}

export interface FixtureFileMeta {
	group?: string;
	tags?: string[];
	viewport?: Viewport;
	/** Sort weight within its directory. Lower sorts first. */
	order?: number;
}

export interface FixtureMeta {
	title?: string;
	description?: string;
	viewport?: Viewport;
	tags?: string[];
	order?: number;
	/**
	 * How the fixture sits in the preview area. `padded` is the default.
	 * Adapted from CSF's `parameters.layout` when the declared support level
	 * includes it (§13).
	 */
	layout?: "centered" | "fullscreen" | "padded";
}

/* ------------------------------------------------------------------ *
 * Index — §3.4
 * ------------------------------------------------------------------ */

export interface FixtureFileIndex {
	/** Display path (see FixtureId.path). */
	path: string;
	/** Path relative to the Vite root, with a leading slash. Glob-key shaped. */
	globPath: string;
	/**
	 * One entry per fixture in the file. An entry of `null` means "the module's
	 * default export is the fixture" — a single-fixture file is `[null]`, exactly
	 * as §3.4's table says, and mirrors `FixtureId.name`.
	 *
	 * The whole field being `null` means undecidable: the parser could not
	 * enumerate names at all (§3.4). `[]` is not a legal value — an empty array
	 * would be indistinguishable from a file with no fixtures.
	 */
	names: Array<string | null> | null;
	/** Content hash, used to cache warm-pass results. */
	hash: string;
	/** True when the file is a Storybook CSF module rather than a fixture module. §13 */
	csf?: boolean;
}

export interface DecoratorFileIndex {
	/** Directory the decorator applies to, relative to the fixtures dir. */
	dir: string;
	globPath: string;
	/** Directory depth, used for outermost-first composition. §3.3 */
	depth: number;
}

export interface FixtureIndex {
	files: FixtureFileIndex[];
	decorators: DecoratorFileIndex[];
	/** Components detected without fixtures. §12 */
	inventory: InventoryItem[];
	/** Collision and confinement problems found during the scan. §4.4 */
	problems: IndexProblem[];
}

export interface IndexProblem {
	kind: "collision" | "unreadable" | "unparseable";
	message: string;
	files: string[];
}

export interface InventoryItem {
	/** Display path of the module the component was found in. */
	path: string;
	globPath: string;
	/** Exported name. `default` is recorded as its inferred name. */
	name: string;
	exportName: string;
	kind: "function" | "memo" | "forwardRef" | "class";
}

/* ------------------------------------------------------------------ *
 * Tree — §19.3
 * ------------------------------------------------------------------ */

export interface TreeNode {
	/** Stable key: a directory path, a file path, or a serialized fixture id. */
	key: string;
	label: string;
	kind: "dir" | "file" | "fixture" | "component";
	/** Present on `fixture` nodes and on `file` nodes that render directly. */
	fixture?: FixtureId;
	/** Present on `component` nodes. */
	component?: InventoryItem;
	/** True when the file's names could not be statically determined. §3.5 */
	undecidable?: boolean;
	children?: TreeNode[];
	meta?: FixtureMeta;
}

/* ------------------------------------------------------------------ *
 * Wire format — §7.4
 * ------------------------------------------------------------------ */

export type Wire =
	| { t: "prim"; v: string | number | boolean | null }
	| { t: "undef" }
	| { t: "bigint"; v: string }
	| { t: "array"; v: Wire[] }
	| { t: "object"; v: Array<[string, Wire]> }
	| { t: "codec"; codec: string; v: unknown }
	| { t: "opaque"; id: number; label: string };

export type EditableWire = Exclude<Wire, { t: "opaque" }>;

export type PathSegment = string | number;

export interface Patch {
	path: PathSegment[];
	value: EditableWire;
}

/** §7.2 */
export interface InputOverlay {
	input: string;
	revision: number;
	patches: Patch[];
}

/* ------------------------------------------------------------------ *
 * Controls — §7.6
 * ------------------------------------------------------------------ */

export type ControlKind =
	| "auto"
	| "text"
	| "textarea"
	| "number"
	| "range"
	| "checkbox"
	| "select"
	| "radio"
	| "date"
	| "color"
	| "json";

export interface InputOptions<T> {
	label?: string;
	description?: string;
	control?: ControlKind;
	options?: readonly T[];
	min?: number;
	max?: number;
	step?: number;
	/** Opt in to docgen metadata for a named prop of a named component. §15 */
	from?: { component: string; prop: string };
}

/** Serializable projection of InputOptions, sent with a registration. */
export interface InputOptionsWire {
	label?: string;
	description?: string;
	control?: ControlKind;
	options?: Wire[];
	min?: number;
	max?: number;
	step?: number;
}

export interface RegisteredInput {
	name: string;
	revision: number;
	wire: Wire;
	options?: InputOptionsWire;
	/** False when the input was not registered during the latest render. §7.3 */
	active: boolean;
}

/* ------------------------------------------------------------------ *
 * Codecs — §7.7
 * ------------------------------------------------------------------ */

export interface CodecEditorProps<S = unknown> {
	value: S;
	onChange: (next: S) => void;
	label: string;
	disabled?: boolean;
}

export interface FixtureCodec<T = unknown, S = unknown> {
	name: string;
	test(value: unknown): value is T;
	serialize(value: T): S;
	deserialize(data: S): T;
	editor?: React.ComponentType<CodecEditorProps<S>>;
	label?(value: T): string;
}

/* ------------------------------------------------------------------ *
 * Viewport presets — §19.3
 * ------------------------------------------------------------------ */

export interface ViewportPreset {
	name: string;
	width: number;
	height: number;
}

/* ------------------------------------------------------------------ *
 * Errors — §19.3
 * ------------------------------------------------------------------ */

export interface RendererError {
	kind: "fixture" | "decorator" | "bootstrap" | "module" | "protocol";
	message: string;
	stack?: string;
	/** File named by a decorator error, or the module that failed to load. */
	file?: string;
	componentStack?: string;
}

/* ------------------------------------------------------------------ *
 * Router — §5.4
 * ------------------------------------------------------------------ */

export interface RouterAdapter {
	read(): string | null;
	write(value: string | null, opts: { replace: boolean }): void;
	subscribe(cb: () => void): () => void;
}

/* ------------------------------------------------------------------ *
 * Chrome — §5.1, §11
 * ------------------------------------------------------------------ */

export interface ChromeOptions {
	tree?: boolean;
	toolbar?: boolean;
	controls?: boolean;
	viewport?: boolean;
	search?: boolean;
}

export interface UaightComponents {
	PreviewShell: React.ComponentType<PreviewShellProps>;
	FixtureTree: React.ComponentType<FixtureTreeProps>;
	ControlPanel: React.ComponentType<ControlPanelProps>;
	ControlPanelInputs: React.ComponentType<ControlPanelInputsProps>;
	Toolbar: React.ComponentType<ToolbarProps>;
	ViewportToolbar: React.ComponentType<ViewportToolbarProps>;
	EmptyState: React.ComponentType<EmptyStateProps>;
	ErrorState: React.ComponentType<ErrorStateProps>;
	InventoryList: React.ComponentType<InventoryListProps>;
}

export interface PreviewShellProps {
	children: React.ReactNode;
	loading: boolean;
	viewport: ViewportPreset | null;
	toolbar?: React.ReactNode;
	/** Second toolbar row: the fixtures of the selected file. */
	subToolbar?: React.ReactNode;
}
export interface FixtureTreeProps {
	nodes: TreeNode[];
	selected: FixtureId | null;
	onSelect: (id: FixtureId | null) => void;
	search?: boolean;
}
export interface ControlPanelProps {
	inputs: RegisteredInput[];
	overlay: InputOverlay[];
	onSet: (name: string, path: PathSegment[], value: EditableWire) => void;
	onReset: (name?: string) => void;
	droppedPatches: number;
}
/** §11.3 lists this as ejectable in its own right, separately from `ControlPanel`. */
export interface ControlPanelInputsProps {
	inputs: RegisteredInput[];
	overlay: InputOverlay[];
	onSet: (name: string, path: PathSegment[], value: EditableWire) => void;
	onReset: (name?: string) => void;
	codecs?: FixtureCodec[];
}
export interface ToolbarProps {
	children?: React.ReactNode;
}
export interface ViewportToolbarProps {
	current: ViewportPreset | null;
	presets: ViewportPreset[];
	onChange: (p: ViewportPreset | null) => void;
	supported: boolean;
}
export interface EmptyStateProps {
	title: string;
	description?: React.ReactNode;
}
export interface ErrorStateProps {
	error: RendererError;
	onRetry?: () => void;
}
export interface InventoryListProps {
	components: InventoryItem[];
	onSelect: (item: InventoryItem) => void;
}

/* ------------------------------------------------------------------ *
 * Component props — §5.1
 * ------------------------------------------------------------------ */

export type Filter = string | string[] | ((path: string) => boolean);

export interface UaightProps {
	filter?: Filter;
	fixture?: FixtureId | string;
	isolation?: "frame" | "inline";
	chrome?: boolean | ChromeOptions;

	selected?: FixtureId | null;
	onSelect?: (id: FixtureId | null) => void;

	router?: RouterAdapter | "history" | "hash" | "none";
	urlParam?: string;
	routerId?: string;

	enabled?: boolean;
	fallback?: React.ReactNode;
	loading?: React.ReactNode;

	components?: Partial<UaightComponents>;
	theme?: "light" | "dark" | "system";
	height?: number | string | "auto";
	previewDocumentUrl?: string;

	className?: string;
	style?: React.CSSProperties;
}

/* ------------------------------------------------------------------ *
 * Plugin options — §4.1
 * ------------------------------------------------------------------ */

export interface StorybookSupport {
	csfVersion?: 3;
	support?: {
		metaArgs?: boolean;
		storyArgs?: boolean;
		argTypes?: boolean;
		render?: boolean;
		metaDecorators?: boolean;
		storyDecorators?: boolean;
		globalDecorators?: boolean;
		/**
		 * Which of a story's `parameters` we honour. §13's sample declares
		 * `'viewport-only'`; `'viewport-and-layout'` additionally adapts
		 * `parameters.layout`, which most design systems set on nearly every
		 * story and which changes how the fixture reads. Anything outside the
		 * declared level is badged during normalization, never silently skipped.
		 */
		parameters?: false | "viewport-only" | "viewport-and-layout" | true;
		globals?: boolean;
		loaders?: boolean;
		play?: boolean;
	};
	/** File suffix that marks a CSF module. Default 'stories'. */
	fileSuffix?: string;
}

export interface UaightPluginOptions {
	/** Dev route. Default '/uaight'. Set false to disable the route entirely. */
	route?: string | false;

	configPath?: string | false;
	fixturesDir?: string;
	fixtureFileSuffix?: string;
	decoratorFileSuffix?: string;
	include?: string[];
	exclude?: string[];
	caseSensitive?: boolean;

	/** Component inventory. Default true — this is the zero-config experience. */
	inventory?: boolean | { include?: string[]; exclude?: string[] };

	previewEntry?: string;
	previewHtmlPath?: string;
	codecs?: string;

	index?: "static" | "warm" | "lazy";
	production?: "exclude" | "include" | "error";

	storybook?: boolean | StorybookSupport;
	docgen?: boolean;
}

/* ------------------------------------------------------------------ *
 * Runtime config — the serialized shape handed to both realms.
 * Internal (§19.7) but shared across realm boundaries, so it lives here.
 * ------------------------------------------------------------------ */

export interface RuntimeConfig {
	version: string;
	protocolVersion: number;
	index: "static" | "warm" | "lazy";
	command: "serve" | "build";
	fixturesDir: string;
	fixtureFileSuffix: string;
	inventoryEnabled: boolean;
	storybook: Required<NonNullable<StorybookSupport["support"]>> | null;
	storybookFileSuffix: string;
	hasPreviewEntry: boolean;
	hasCodecs: boolean;
	route: string | false;
	files: FixtureFileIndex[];
	decorators: DecoratorFileIndex[];
	inventory: InventoryItem[];
	problems: IndexProblem[];
}
