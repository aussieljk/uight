/**
 * The frame-realm preview entry (§6.4). It exists here for two reasons:
 *
 *  1. it proves the consumer's providers and CSS reach the FRAME realm and not
 *     the host — the suite reads `data-e2e-preview` inside the frame document;
 *  2. it reads `data-uaight-theme` off the frame's `documentElement`, which is
 *     the contract the contract-pass section of NOTES.md settled on, so a
 *     regression in the theme stamp is visible from a browser.
 */

import type { ReactNode } from "react";
import { useUaightTheme } from "uaight/runtime";

export function Preview({ children }: { children: ReactNode }) {
	const theme = useUaightTheme();
	return (
		<div data-e2e-preview="" data-e2e-preview-theme={theme}>
			{children}
		</div>
	);
}
