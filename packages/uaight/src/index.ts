/**
 * `uaight` — the package entry. SPEC.md §16.1, §19.
 *
 * Browser environment. Nothing here imports a virtual module, so a consumer
 * who only embeds `<Uaight />` still type-checks and builds without the
 * plugin; the virtual modules are reached only from the lazy explorer chunk.
 */

/* ---- Components — §19.1 ---- */
export { Uaight, UaightProvider, Fixture, UaightErrorBoundary } from "./ui/entry.tsx";
export type {
	UaightProviderProps,
	FixtureProps,
	UaightErrorBoundaryProps,
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

/* ---- Shared — §19.5 ---- */
export { parseFixtureId, serializeFixtureId } from "./shared/fixture-id.ts";
export { matchesFilter } from "./shared/filter.ts";
export { DEFAULT_FIXTURE } from "./shared/types.ts";
export { UAIGHT_VERSION } from "./shared/version.ts";

export type { UaightChromeApiV1 } from "./ui/chrome-context.ts";

export type {
	ChromeOptions,
	CodecEditorProps,
	ControlKind,
	ControlPanelProps,
	DecoratorFileIndex,
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
	PreviewShellProps,
	RegisteredInput,
	RendererError,
	RouterAdapter,
	RuntimeConfig,
	StorybookSupport,
	ToolbarProps,
	TreeNode,
	UaightComponents,
	UaightPluginOptions,
	UaightProps,
	Viewport,
	ViewportPreset,
	ViewportToolbarProps,
	Wire,
} from "./shared/types.ts";
