/**
 * `<UaightProvider>`'s context. SPEC.md §19.1.
 *
 * Separate from `entry.tsx` so the provider — which ships in the eager entry —
 * never reaches the lazy explorer chunk, and so the explorer can read it
 * without importing the entry back.
 */

import { createContext, useContext } from "react";
import type { FixtureCodec, UaightComponents } from "../shared/types.ts";
import type { ThemeSetting } from "./theme.ts";

export interface UaightProviderValue {
	components?: Partial<UaightComponents> | undefined;
	theme?: ThemeSetting | undefined;
	codecs?: FixtureCodec[] | undefined;
}

export const UaightProviderContext = createContext<UaightProviderValue | null>(null);

export function useUaightDefaults(): UaightProviderValue {
	return useContext(UaightProviderContext) ?? {};
}
