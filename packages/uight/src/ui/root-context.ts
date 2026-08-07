/**
 * The mount element, published to whatever needs to portal into it.
 *
 * ljkui's overlays are base-ui popups, and base-ui portals to `document.body`
 * by default. That is the right default for an application and the wrong one
 * here: §10.3's scoping means our stylesheet — and ljkui's, scoped with it —
 * only applies beneath `.uight-root`, so a popup rendered into the host's body
 * would come out unstyled. Every overlay the chrome opens passes this element
 * as its portal container instead.
 *
 * `null` before the mount ref settles, and in the frame document where nothing
 * opens an overlay; base-ui reads `undefined`/`null` as "use the default", so
 * the fallback is merely unscoped rather than broken.
 */

import { createContext, useContext } from "react";

export const UightRootContext = createContext<HTMLElement | null>(null);

export function useUightRoot(): HTMLElement | null {
	return useContext(UightRootContext);
}
