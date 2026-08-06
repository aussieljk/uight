/**
 * Virtual module declarations. `@aussieljk/uight/client`.
 *
 * Add to your tsconfig:  "types": ["@aussieljk/uight/client"]
 */

declare module "virtual:uight/runtime" {
	import type { RuntimeConfig } from "@aussieljk/uight";
	export const config: RuntimeConfig;
	export const fixtureModules: Record<string, () => Promise<unknown>>;
	export const decoratorModules: Record<string, () => Promise<unknown>>;
	export const inventoryModules: Record<string, () => Promise<unknown>>;
}

declare module "virtual:uight/renderer-url" {
	export const rendererEntryUrl: string;
	/** Extracted stylesheets the renderer needs. Empty in development. */
	export const rendererStyleUrls: string[];
}

declare module "virtual:uight/preview-entry" {
	import type * as React from "react";
	export const Preview: React.ComponentType<{ children: React.ReactNode }> | undefined;
}

declare module "virtual:uight/storybook-preview" {
	import type { StorybookPreview } from "@aussieljk/uight/runtime";
	/** Null when no `.storybook/preview` module was found. */
	export const storybookPreview: StorybookPreview | null;
}

declare module "virtual:uight/codecs" {
	import type { FixtureCodec } from "@aussieljk/uight";
	export const codecs: FixtureCodec[];
}

declare module "virtual:uight/inventory" {
	import type { InventoryItem } from "@aussieljk/uight";
	export const inventoryItems: InventoryItem[];
}

declare const __UIGHT_ENABLED__: boolean;
