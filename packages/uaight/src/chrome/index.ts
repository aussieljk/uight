/**
 * `uaight/chrome` — the frozen surface. SPEC.md §11.4, §19.3.
 *
 * Component props stay free to change; THIS is the commitment. Designed in
 * v1, frozen at v1.2, which is why nothing here describes how the explorer
 * works — only what a chrome component may ask it for.
 *
 * The hook reads a context published by `UaightUI` and throws a clear error
 * outside one. Ejected components import from here and nowhere else.
 */

export { useUaightChrome } from "../ui/chrome-context.ts";
export type { UaightChromeApiV1 } from "../ui/chrome-context.ts";

export type { ControlPanelInputsProps } from "../ui/chrome/ControlPanelInputs.tsx";

export type {
	ChromeOptions,
	ControlPanelProps,
	EditableWire,
	EmptyStateProps,
	ErrorStateProps,
	FixtureId,
	FixtureTreeProps,
	InputOverlay,
	InventoryItem,
	InventoryListProps,
	PathSegment,
	PreviewShellProps,
	RegisteredInput,
	RendererError,
	ToolbarProps,
	TreeNode,
	UaightComponents,
	ViewportPreset,
	ViewportToolbarProps,
	Wire,
} from "../shared/types.ts";
