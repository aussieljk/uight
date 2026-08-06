/**
 * `@aussieljk/uight/chrome` — the frozen surface. SPEC.md §11.4, §19.3.
 *
 * Component props stay free to change; THIS is the commitment. Designed in
 * v1, frozen at v1.2, which is why nothing here describes how the explorer
 * works — only what a chrome component may ask it for.
 *
 * The hook reads a context published by `UightUI` and throws a clear error
 * outside one. Ejected components import from here and nowhere else.
 */

export { useUightChrome } from "../ui/chrome-context.ts";
export type { UightChromeApiV1 } from "../ui/chrome-context.ts";

/* ------------------------------------------------------------------ *
 * Helpers an ejected component needs — §11.3
 *
 * The registry rewrites an ejected component's imports to point here (see
 * `scripts/build-registry.ts`), so anything a chrome component calls has to be
 * reachable from this entry point or the ejected file does not compile. These
 * are pure, small and already frozen in behaviour; exporting them is cheaper
 * than copying them into every ejected tree, and it is a published-surface
 * addition that must land before the v1.2 freeze either way.
 * ------------------------------------------------------------------ */

/** Fixture identity — the tree compares and serialises ids. §5.4 */
export { fixtureIdsEqual, serializeFixtureId } from "../shared/fixture-id.ts";

/** Overlay arithmetic — the control panel applies and keys patches. §7.3 */
export { applyPatches, pathKey } from "../shared/wire.ts";
export type { ApplyResult } from "../shared/wire.ts";

/**
 * The built-in codec editors. §7.7
 *
 * Deliberately absent from `@aussieljk/uight/runtime` (Q6): codec editors render in the
 * UI realm, and re-exporting them from the renderer entry would pull every
 * editor component into the renderer chunk. `@aussieljk/uight/chrome` IS the UI realm, so
 * this is where an ejected control panel reaches for them.
 */
export { builtinCodecEditors, withBuiltinEditors } from "../runtime/codec-editors.tsx";

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
	ControlPanelProps,
	DocgenLimitation,
	DroppedPatchReport,
	EditableWire,
	EmptyStateProps,
	ErrorStateProps,
	FixtureCodec,
	FixtureId,
	FixtureTreeProps,
	InputOverlay,
	InventoryItem,
	InventoryListProps,
	PathSegment,
	PreviewShellProps,
	PropDoc,
	PropTableProps,
	RegisteredInput,
	RendererError,
	ToolbarProps,
	TreeNode,
	UightComponents,
	ViewportPreset,
	ViewportToolbarProps,
	Wire,
} from "../shared/types.ts";
