/**
 * `<UightProvider>`'s context. SPEC.md §19.1.
 *
 * Separate from `entry.tsx` so the provider — which ships in the eager entry —
 * never reaches the lazy explorer chunk, and so the explorer can read it
 * without importing the entry back.
 */

import { createContext, useContext } from "react";
import type { FixtureCodec, UightComponents } from "../shared/types.ts";
import type { ThemeSetting } from "./theme.ts";

export interface UightProviderValue {
	components?: Partial<UightComponents> | undefined;
	theme?: ThemeSetting | undefined;
	codecs?: FixtureCodec[] | undefined;
}

export const UightProviderContext = createContext<UightProviderValue | null>(null);

export function useUightDefaults(): UightProviderValue {
	return useContext(UightProviderContext) ?? {};
}
