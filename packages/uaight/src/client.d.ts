/**
 * Virtual module declarations. `uaight/client`.
 *
 * Add to your tsconfig:  "types": ["uaight/client"]
 */

declare module "virtual:uaight/runtime" {
	import type { RuntimeConfig } from "uaight";
	export const config: RuntimeConfig;
	export const fixtureModules: Record<string, () => Promise<unknown>>;
	export const decoratorModules: Record<string, () => Promise<unknown>>;
	export const inventoryModules: Record<string, () => Promise<unknown>>;
}

declare module "virtual:uaight/renderer-url" {
	export const rendererEntryUrl: string;
}

declare module "virtual:uaight/preview-entry" {
	import type * as React from "react";
	export const Preview:
		| React.ComponentType<{ children: React.ReactNode }>
		| undefined;
}

declare module "virtual:uaight/codecs" {
	import type { FixtureCodec } from "uaight";
	export const codecs: FixtureCodec[];
}

declare module "virtual:uaight/inventory" {
	import type { InventoryItem } from "uaight";
	export const inventoryItems: InventoryItem[];
}

declare const __UAIGHT_ENABLED__: boolean;
