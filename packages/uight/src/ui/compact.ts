/**
 * Is this mount too narrow for the three-pane layout? SPEC.md §10.1.
 *
 * Measured on the mount rather than on the window, deliberately. The explorer
 * is embeddable (§5.1) — a 400px-wide `<Uight>` in a wide page needs the same
 * layout a phone does, and a media query cannot see that. A `ResizeObserver`
 * on our own element answers for both cases with one rule.
 */

import { useEffect, useState } from "react";
import type { RefObject } from "react";

/**
 * Below this, the sidebar and the control panel together leave the preview
 * about 200px — which is not a preview. It is the two side panes plus a usable
 * middle, not a device size, so it is stated here rather than borrowed from a
 * breakpoint scale.
 */
export const COMPACT_WIDTH = 720;

export function useCompactLayout(ref: RefObject<HTMLElement | null>): boolean {
	const [compact, setCompact] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!element || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width;
			if (width !== undefined) setCompact(width < COMPACT_WIDTH);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);

	return compact;
}
