/**
 * `uight` — the package entry. SPEC.md §16.1, §19.
 *
 * Browser environment. Nothing here imports a virtual module, so a consumer
 * who only embeds `<Uight />` still type-checks and builds without the
 * plugin; the virtual modules are reached only from the lazy explorer chunk.
 */

/* ---- Components — §19.1 ---- */
export { Uight, UightProvider, Fixture, UightErrorBoundary } from "./ui/entry.tsx";
export type {
	UightProviderProps,
	FixtureProps,
	UightErrorBoundaryProps,
} from "./ui/entry.tsx";

/* ---- Fixture hooks — §19.2. Implemented in the renderer, exported here. ---- */
export {
	useFixtureInput,
	useFixtureSelect,
	useFixtureViewport,
	useFixtureId,
	useSelectFixture,
	useFixtureIsolation,
	defineCodec,
} from "./runtime/index.ts";

/* ---- Theme, for a preview entry that has to match the chrome — §10.1 ---- */
export { readUightTheme, subscribeUightTheme, useUightTheme } from "./runtime/index.ts";

/* ---- Shared — §19.5 ---- */
export { parseFixtureId, serializeFixtureId } from "./shared/fixture-id.ts";
export { matchesFilter } from "./shared/filter.ts";
export { DEFAULT_FIXTURE, THEME_ATTRIBUTE } from "./shared/types.ts";
export { fixtureMetaFor, viewportFor } from "./shared/meta.ts";
export { UIGHT_VERSION } from "./shared/version.ts";

export type { UightChromeApiV1 } from "./ui/chrome-context.ts";

export type {
	CallSite,
	CallSiteGroup,
	ChromeOptions,
	CodecEditorProps,
	CommandPaletteItem,
	CommandPaletteProps,
	ComponentDoc,
	ComponentSelection,
	ControlPanelInputsProps,
	ControlKind,
	ControlPanelProps,
	DecoratorFileIndex,
	DocgenLimitation,
	DocgenResolver,
	DroppedPatchReport,
	EditableWire,
	EmptyStateProps,
	ErrorStateProps,
	Filter,
	FixtureCodec,
	FixtureFileIndex,
	FixtureFileMeta,
	FixtureId,
	FixtureIndex,
	FixtureMeta,
	FixtureTreeProps,
	IndexProblem,
	InputOptions,
	InputOptionsWire,
	InputOverlay,
	InventoryItem,
	InventoryListProps,
	Patch,
	PathSegment,
	PropDoc,
	ResolvedUightTheme,
	PreviewShellProps,
	RegisteredInput,
	RendererError,
	RouterAdapter,
	RuntimeConfig,
	StorybookSupport,
	ToolbarProps,
	TreeNode,
	UightComponents,
	UightPluginOptions,
	UightProps,
	Viewport,
	ViewportPreset,
	ViewportToolbarProps,
	Wire,
} from "./shared/types.ts";
