/**
 * `@aussieljk/uight/runtime` — the renderer. ARCHITECTURE.md §2.
 *
 * Browser entry. Everything the frame realm needs and nothing the chrome owns.
 *
 * Deliberately **not** exported here: `./codec-editors.tsx`. Codec editors
 * render in the UI realm (§7.7) and re-exporting them would pull every editor
 * component into the renderer chunk (Q6). The UI imports that module directly.
 */

/* ---------------- mount and the app ---------------- */

export { mountRenderer } from "./mount.tsx";
export { RendererApp } from "./RendererApp.tsx";
export type {
	ComponentRef,
	ModuleMap,
	MountRendererOptions,
	RendererAppProps,
} from "./RendererApp.tsx";

/* ---------------- transport — §8 ---------------- */

export {
	createDirectTransportPair,
	createFrameHostTransport,
	createRendererChildTransport,
} from "./transport.ts";
export type {
	ChildTransport,
	ChildTransportOptions,
	FrameHostTransport,
	FrameHostTransportOptions,
	HostTransport,
	RendererTransport,
} from "./transport.ts";

/* ---------------- serializer and codecs — §7.4, §7.7 ---------------- */

export {
	DEPTH_LIMIT,
	PAYLOAD_LIMIT,
	createSerializer,
	isFullyEditable,
	opaqueLabel,
} from "./serialize.ts";
export type {
	DeserializeResult,
	SerializeOptions,
	Serializer,
	SerializerOptions,
} from "./serialize.ts";

export {
	builtinCodecs,
	dateCodec,
	defineCodec,
	fileCodec,
	mapCodec,
	regexpCodec,
	setCodec,
	urlCodec,
} from "./codecs.ts";
export type { FileData, RegExpData } from "./codecs.ts";

/* ---------------- overlay store — §7.2, §7.3 ---------------- */

export { OverlayStore, applyOverlayToValue } from "./overlay.ts";
export type {
	ApplyOverlayResult,
	InputRegistration,
	OverlayEntry,
	Send,
} from "./overlay.ts";

/* ---------------- fixture hooks — §19.2 ---------------- */

export {
	FixtureRuntimeProvider,
	createViewportSource,
	useFixtureId,
	useFixtureInput,
	useFixtureIsolation,
	useFixtureSelect,
	useFixtureViewport,
	useSelectFixture,
} from "./fixture-context.tsx";
export type { FixtureRuntime, ViewportSource } from "./fixture-context.tsx";

/* ---------------- theme, read from the host's stamp — §10.1 ---------------- */

export { readUightTheme, subscribeUightTheme, useUightTheme } from "./theme.ts";

/* ---------------- normalization — §3.1, §13 ---------------- */

export { normalizeModule, selectFixture } from "./normalize.ts";
export type {
	FixtureSelection,
	NormalizedFixture,
	NormalizedModule,
} from "./normalize.ts";

export {
	DEFAULT_CSF_SUPPORT,
	normalizeCsfModule,
	prepareStory,
	startCase,
	storyExportNames,
	viewportFromParameters,
} from "./csf.ts";
export type {
	CsfArgType,
	CsfArgTypes,
	CsfArgs,
	CsfDecorator,
	CsfMeta,
	CsfRender,
	CsfStory,
	CsfStoryContext,
	CsfSupport,
	PreparedStory,
	StorybookPreview,
} from "./csf.ts";

/* ---------------- decorators and errors — §3.3 ---------------- */

export {
	composeDecorators,
	loadDecorator,
	loadDecorators,
	selectDecorators,
} from "./decorators.ts";
export type { DecoratorComponent, LoadedDecorator } from "./decorators.ts";

export { ErrorPanel, RendererErrorBoundary, toRendererError } from "./error-boundary.tsx";
export type { RendererErrorBoundaryProps } from "./error-boundary.tsx";
