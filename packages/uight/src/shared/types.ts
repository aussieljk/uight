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
	/**
	 * What the tree calls this file, instead of its filename. A per-fixture
	 * `title` still wins where there is one to win; this is for the files that
	 * are a single fixture, where the file and the fixture are the same thing.
	 */
	title?: string;
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
	/** True when the file is an MDX documentation page rather than a fixture. §14 */
	docsPage?: boolean;
	/**
	 * The `fileMeta` and `fixtureMeta` named exports (§3.1), when the parser
	 * could read them as static object literals.
	 *
	 * They live on the index rather than arriving over the protocol because the
	 * only consumer that needs them — the viewport the preview opens at — has to
	 * know before the first paint, and under `index: "static"` no module is ever
	 * executed to send a message from. A meta the parser could not read stays
	 * absent; the renderer still normalizes the real exports and its answer wins
	 * once the module is loaded.
	 */
	fileMeta?: FixtureFileMeta;
	fixtureMeta?: Record<string, FixtureMeta>;
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
	/** Usages of those components found in the project's own source. */
	callSites: CallSiteGroup[];
	/**
	 * Raw per-file call sites, keyed by glob path, before ranking and capping.
	 *
	 * Internal and Node-side only: both `serializeIndex` and the runtime config
	 * drop it, so it never crosses to the browser. It exists so a one-file
	 * rescan can re-rank against the whole corpus without re-reading it.
	 */
	callSiteSources?: Record<string, CallSite[]>;
	/** Collision and confinement problems found during the scan. §4.4 */
	problems: IndexProblem[];
	/**
	 * Prop metadata, keyed by glob path. Absent unless `docgen` is on (§15.1),
	 * so a consumer must treat "no docs" as the normal case.
	 */
	docs?: Record<string, ComponentDoc[]>;
}

export interface IndexProblem {
	/**
	 * `confinement` is a `fixturesDir` that resolves outside the Vite root — a
	 * refusal, not a failure. It was reported as `unreadable`, which was true of
	 * the outcome and wrong about the cause: the directory usually reads fine.
	 */
	kind: "collision" | "unreadable" | "unparseable" | "confinement";
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
 * Call sites — fixtures harvested from real usage
 * ------------------------------------------------------------------ */

/**
 * One `<Component …>` usage found in the project's own source, with the props
 * that are written down there.
 *
 * Syntax only, exactly like the inventory (§12 step 2): nothing is executed and
 * no import is resolved to a module. A prop whose value is not statically
 * readable is named in `dynamic` and left out of `props` — never guessed.
 */
export interface CallSite {
	/** The component as written: `Button`, `Accordion.Item`. */
	component: string;
	/** Statically readable props. JSON-safe by construction. */
	props: Record<string, unknown>;
	/** Text children, when every child was static text. */
	children?: string;
	/** Display path of the file the usage was found in. */
	path: string;
	globPath: string;
	line: number;
	column: number;
	/** Props that were present but not statically readable. `...` means a spread. */
	dynamic: string[];
	/** Import specifier the component name was bound from, as written. */
	importedFrom?: string;
	/** `importedFrom` resolved to a display path, when it was relative. */
	resolvedFrom?: string;
}

export interface CallSiteGroup {
	/** Component name the sites instantiate. */
	component: string;
	/** Most distinct first, deduplicated by prop signature. */
	sites: CallSite[];
	/** How many usages were found before ranking and capping. */
	total: number;
}

/**
 * A detected component being rendered, and the harvested usage chosen for it.
 *
 * A pair rather than a `FixtureId`: §12's components have no fixture file, so
 * there is no path and name to serialize, and the call site is a second axis of
 * the same selection — the same component with different props.
 */
export interface ComponentSelection {
	component: InventoryItem;
	callSite: CallSite | null;
}

/* ------------------------------------------------------------------ *
 * Prop metadata — §15
 * ------------------------------------------------------------------ */

/**
 * One documented prop. Display metadata only: D18 stands, and nothing here is
 * ever read to infer a control — controls are declared at the call site (§7.6).
 */
export interface PropDoc {
	name: string;
	/** The type as written, not normalized. `"'sm' | 'lg'"`, `"() => void"`. */
	type?: string;
	required: boolean;
	/** The default as written in the source. */
	defaultValue?: string;
	description?: string;
}

export interface ComponentDoc {
	/** Matches `InventoryItem.name`, so a doc joins to a detected component. */
	name: string;
	exportName: string;
	globPath: string;
	description?: string;
	props: PropDoc[];
	/** What this doc is known to be missing, carried per entry (see below). */
	limitations?: DocgenLimitation[];
}

/**
 * What a resolver could not see. Reported rather than hidden: a prop table that
 * silently omits everything a component inherited is worse than one that says
 * so, and §15.2 makes the Babel resolver's blind spot a documented limitation
 * rather than a defect to fix later.
 */
export type DocgenLimitation = "inherited-props" | "generics" | "unions";

/**
 * The resolver interface §15.2 asks for: the seam the Babel implementation sits
 * behind now and a TypeScript 7.1 implementation would sit behind later,
 * without either being visible to a prop table.
 *
 * Node-side, one module at a time, never throwing — a file it cannot read
 * returns `[]`, exactly as the inventory and call-site passes do.
 */
export interface DocgenResolver {
	/** Identifies the implementation in diagnostics. `"babel"` today. */
	name: string;
	/** Applies to every doc this resolver produces. */
	limitations: readonly DocgenLimitation[];
	resolve(input: {
		code: string;
		/** Absolute path, for resolvers that follow imports. */
		filename: string;
		/** Root-relative, leading slash — the index's key (§4.2). */
		globPath: string;
	}): ComponentDoc[] | Promise<ComponentDoc[]>;
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
	/** True for an MDX documentation page rather than a fixture. §14 */
	docsPage?: boolean;
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

/**
 * Patches that no longer apply to an input's current shape — §7.3, "reported
 * once per input per revision".
 *
 * The paths are carried, not just a tally, because the panel's job is to name
 * what the user lost: "`variant`, `size` and 2 more no longer apply" is
 * actionable and "6 settings no longer apply" is not. A count is still exact
 * — it is `paths.length` — so nothing that only wants a number has to change.
 */
export interface DroppedPatchReport {
	/** The input the patches belonged to. */
	input: string;
	/** The registration revision they were dropped against. */
	revision: number;
	/** Where each dropped patch pointed, relative to the input's value. */
	paths: PathSegment[][];
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
	/**
	 * §7.6's explicit docgen reference, carried across the realm boundary so the
	 * host can resolve it.
	 *
	 * It is resolved on the HOST rather than in the renderer because the docs are
	 * host data — they ride on the index (§15.1), which the renderer has no need
	 * of — and because the panel that displays the result is host UI. The
	 * renderer's job is to say which prop was named, not to go looking for it.
	 */
	from?: { component: string; prop: string };
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
 * Theme, across the realm boundary — §10.1
 * ------------------------------------------------------------------ */

/**
 * The host stamps the resolved theme on the renderer document's
 * `documentElement`, in both isolations, and keeps it in step:
 *
 * ```html
 * <html data-uight-theme="dark">
 * ```
 *
 * An attribute rather than a message or a context, because the reader is the
 * *preview entry* — the host application's own provider tree, which is not a
 * fixture, does not use our hooks and in frame isolation does not share our
 * realm. A DOM attribute is the one channel every provider can already read,
 * it is observable with `MutationObserver`, and it adds nothing to the frozen
 * facade. `@aussieljk/uight/runtime` exports `readUightTheme` / `useUightTheme` so a
 * preview entry does not have to hand-roll either half.
 *
 * Absent means light: a host that never stamps still renders, and `system` is
 * resolved by the host before it is stamped — the frame never re-resolves it.
 */
export const THEME_ATTRIBUTE = "data-uight-theme";

export type ResolvedUightTheme = "light" | "dark";

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

export interface UightComponents {
	PreviewShell: React.ComponentType<PreviewShellProps>;
	FixtureTree: React.ComponentType<FixtureTreeProps>;
	ControlPanel: React.ComponentType<ControlPanelProps>;
	ControlPanelInputs: React.ComponentType<ControlPanelInputsProps>;
	Toolbar: React.ComponentType<ToolbarProps>;
	ViewportToolbar: React.ComponentType<ViewportToolbarProps>;
	EmptyState: React.ComponentType<EmptyStateProps>;
	ErrorState: React.ComponentType<ErrorStateProps>;
	InventoryList: React.ComponentType<InventoryListProps>;
	CommandPalette: React.ComponentType<CommandPaletteProps>;
	PropTable: React.ComponentType<PropTableProps>;
}

/**
 * §15.2's prop documentation, and §11.3 ejectable like the rest of the chrome.
 *
 * D18: this is display metadata. A replacement may render `doc` however it
 * likes, but docgen never becomes a source of controls — those come from the
 * fixture and the call site (§7.6). A component with no doc is `null` rather
 * than an empty table, so an ejected implementation can decide whether to
 * occupy space at all.
 */
export interface PropTableProps {
	doc: ComponentDoc | null;
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
	/**
	 * "The pointer is over this row" — an invitation to warm the file's chunk
	 * before the click that needs it (§9.1).
	 *
	 * Optional, and optional in both directions: a packaged explorer passes it,
	 * an ejected tree may ignore it, and nothing about the selection depends on
	 * it having been called. It is a hint about a *file*, because a lazy chunk
	 * is per file and every fixture in one arrives together.
	 */
	onPrefetch?: (path: string) => void;
}
export interface ControlPanelProps {
	inputs: RegisteredInput[];
	overlay: InputOverlay[];
	onSet: (name: string, path: PathSegment[], value: EditableWire) => void;
	onReset: (name?: string) => void;
	droppedPatches: number;
	/** The same loss, named per input (§7.3). `droppedPatches` is its total. */
	droppedInputs: DroppedPatchReport[];
}
/**
 * §11.3 lists this as ejectable in its own right, separately from `ControlPanel`.
 *
 * It lives here rather than beside the component because `UightComponents`
 * names it: an ejectable component's props are part of the published surface,
 * and `src/ui/chrome/ControlPanelInputs.tsx` re-exports this declaration.
 */
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
/**
 * The same components are reachable two ways: here as props, and from
 * `useUightChrome().inventory` on the frozen facade (§11.4). That duplication
 * is deliberate and it is permanent at the v1.2 freeze — see NOTES.md,
 * "Two ways to the same data".
 *
 * **Which to use.** An ejected copy should prefer the *props*. Props are how
 * §11.3's ejection works at all: you copy the file, pass it what the explorer
 * passed it, and it renders — including outside an explorer, where the context
 * is `null` and `useUightChrome()` throws. The facade is for a replacement
 * that wants more than its own props carry (to filter against the current
 * selection, say), and reaching for it trades away standalone use.
 */
export interface InventoryListProps {
	components: InventoryItem[];
	onSelect: (item: InventoryItem) => void;
}

/**
 * One row in the command palette. `kind` says which of the three optional
 * payloads is set, so a replacement palette never has to guess.
 */
export interface CommandPaletteItem {
	key: string;
	label: string;
	/** Secondary text: the path, or where a call site was found. */
	hint?: string;
	kind: "fixture" | "component" | "call-site";
	fixture?: FixtureId;
	component?: InventoryItem;
	callSite?: CallSite;
}

/**
 * Duplicated capability, kept on purpose: `useUightChrome().palette` exposes
 * the same items, query and open state (§11.4). See NOTES.md, "Two ways to the
 * same data" — and prefer these props in an ejected copy, for the reason given
 * on `InventoryListProps`. The facade's items are already ranked by the
 * explorer; so are these. Neither is the "real" one.
 */
export interface CommandPaletteProps {
	open: boolean;
	/** Already filtered and ranked against `query`. */
	items: CommandPaletteItem[];
	query: string;
	onQueryChange: (query: string) => void;
	onSelect: (item: CommandPaletteItem) => void;
	onClose: () => void;
}

/* ------------------------------------------------------------------ *
 * Component props — §5.1
 * ------------------------------------------------------------------ */

export type Filter = string | string[] | ((path: string) => boolean);

export interface UightProps {
	filter?: Filter;
	fixture?: FixtureId | string;
	isolation?: "frame" | "inline";
	chrome?: boolean | ChromeOptions;

	selected?: FixtureId | null;
	onSelect?: (id: FixtureId | null) => void;

	router?: RouterAdapter | "history" | "hash" | "none";
	urlParam?: string;
	routerId?: string;

	/**
	 * Put control state in the URL, so a link reproduces what the sender saw
	 * rather than just which fixture they were on. Requires a router; defaults to
	 * on when one is active. Overlays are `EditableWire` by type, so a patch is
	 * JSON by construction and nothing opaque can reach a link.
	 */
	shareState?: boolean;
	/** Query parameter carrying the encoded overlay. Default `state`. */
	stateParam?: string;

	enabled?: boolean;
	fallback?: React.ReactNode;
	loading?: React.ReactNode;

	components?: Partial<UightComponents>;
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
	/**
	 * Path to a Storybook `preview` module, relative to the Vite root.
	 *
	 * `true` (the default when Storybook support is on) discovers
	 * `.storybook/preview.{ts,tsx,js,jsx}`. Loading it is what turns "a declared
	 * subset" into "point uight at the setup you already have": nearly every
	 * real Storybook install puts its providers, theme and global styles there,
	 * and without them the stories render stripped of their context.
	 *
	 * `false` keeps §13's original position — no preview is loaded and
	 * `globalDecorators` stays declined.
	 */
	preview?: string | boolean;
}

export interface UightPluginOptions {
	/** Dev route. Default '/uight'. Set false to disable the route entirely. */
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

	/**
	 * Harvest component usages from the project's own source, so a codebase with
	 * no fixtures still gets real states to look at. Default true, development
	 * only, and syntax-only like the inventory it rides along with.
	 *
	 * `max` caps the sites kept per component after ranking. Default 8.
	 */
	callSites?: boolean | { max?: number };

	previewEntry?: string;
	previewHtmlPath?: string;
	codecs?: string;

	index?: "static" | "warm" | "lazy";
	production?: "exclude" | "include" | "error";

	/**
	 * Who may reach the read-only JSON endpoints (§19.6). Default `'loopback'`.
	 *
	 * They are development-only and read nothing back, but `/@uight/config.json`
	 * echoes resolved paths and `/@uight/index.json` lists every fixture file in
	 * the project — a map of the source tree. On a default dev server that is
	 * unreachable anyway; run with `--host` on a shared network and it is not,
	 * and nothing about `vite --host` says "and publish an index of my
	 * repository".
	 *
	 * `'any'` restores the old behaviour, for a dev server behind a proxy or a
	 * container where the request genuinely arrives from another address.
	 * `false` removes the endpoints altogether — the explorer does not use them
	 * (it learns the index from the virtual module and the `uight:index` event),
	 * so this costs only `@aussieljk/uight/mcp` and any external tooling.
	 */
	devApi?: "loopback" | "any" | false;

	/**
	 * Bundle every fixture module into the entry chunk instead of code-splitting
	 * one lazy chunk per file. Default false, and false is right for almost
	 * everything: a corpus of any size would put every component in the
	 * explorer's first download.
	 *
	 * It earns its place when the fixtures are small, few, and switched between
	 * constantly — a prose documentation site is the case this exists for. There
	 * each selection is a network round trip for a chunk of a few kilobytes, and
	 * the round trip is most of the latency. Eager makes every switch after the
	 * first paint synchronous.
	 *
	 * Build only. A dev server serves modules unbundled either way, and eager
	 * there would only cost a slower cold start.
	 */
	eager?: boolean;

	storybook?: boolean | StorybookSupport;
	docgen?: boolean;
	/**
	 * MDX documentation pages: `**\/*.docs.mdx`, one page per file (§14).
	 *
	 * A page is a fixture in every mechanical sense — it is globbed, indexed,
	 * selected and rendered in the frame like any other — and differs only in
	 * what it is *for*, which is why it carries its own suffix and its own badge
	 * rather than a second pipeline. `false` turns the pattern off.
	 */
	docs?: boolean | { fileSuffix?: string };
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
	/** True when a `.storybook/preview` module is in play. §13 */
	hasStorybookPreview: boolean;
	hasPreviewEntry: boolean;
	hasCodecs: boolean;
	route: string | false;
	files: FixtureFileIndex[];
	decorators: DecoratorFileIndex[];
	inventory: InventoryItem[];
	callSites: CallSiteGroup[];
	problems: IndexProblem[];
	/** §15 — keyed by glob path, absent unless `docgen` is on. */
	docs?: Record<string, ComponentDoc[]>;
}
