/**
 * "Copy link", and the call-site chips that open an editor.
 *
 * Both actions share one property worth stating: they can fail for reasons the
 * user cannot see, so neither is allowed to be fire-and-forget. `execCommand`
 * exists as a clipboard fallback because a dev server on a LAN address is not a
 * secure context and `navigator.clipboard` refuses there; `/__open-in-editor`
 * exists only under the Vite dev server. A button that does nothing visible is
 * indistinguishable from a button that worked, so both outcomes are stated —
 * the label flips for a moment on success, and a failure names the reason.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { callSiteLabel } from "../shared/callsites.ts";
import type { CallSite } from "../shared/types.ts";
import { openInEditor } from "./open-in-editor.ts";

/**
 * `navigator.clipboard` needs a secure context, which a dev server on a LAN
 * address is not. The textarea fallback is the only thing that works there.
 *
 * Returns whether it worked, because "copy" silently doing nothing is a bad way
 * to learn about origins — the caller turns the answer into something visible.
 * `execCommand` reports failure by returning `false` as well as by throwing, and
 * both were being ignored.
 */
async function copyText(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		/* fall through to the legacy path */
	}
	try {
		const area = document.createElement("textarea");
		area.value = text;
		area.setAttribute("readonly", "");
		area.style.position = "fixed";
		area.style.opacity = "0";
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(area);
		return ok;
	} catch (error) {
		console.error("[uight] could not copy to the clipboard.", error);
		return false;
	}
}

interface Toast {
	tone: "danger";
	message: string;
}

export interface Clipboard {
	/** The key of the most recent successful copy, for ~1.5s. */
	copied: string | null;
	copy: (key: string, text: string, what: string) => Promise<void>;
	openSite: (site: CallSite) => Promise<void>;
}

export function useClipboard(showToast: (toast: Toast) => void): Clipboard {
	const [copied, setCopied] = useState<string | null>(null);
	const copiedTimer = useRef(0);
	useEffect(
		() => () => {
			window.clearTimeout(copiedTimer.current);
		},
		[],
	);

	const copy = useCallback(
		async (key: string, text: string, what: string) => {
			if (await copyText(text)) {
				setCopied(key);
				window.clearTimeout(copiedTimer.current);
				copiedTimer.current = window.setTimeout(() => setCopied(null), 1500);
				return;
			}
			showToast({
				tone: "danger",
				message: `Could not copy ${what}. The clipboard needs a secure context — this page is ${window.location.protocol}//${window.location.host}.`,
			});
		},
		[showToast],
	);

	/**
	 * A call-site chip names a file, a line and a column, and until now that was
	 * where it stopped. Vite's dev server already mounts `/__open-in-editor`, so
	 * the chip can finish the sentence. The static build has no such endpoint and
	 * says so rather than failing quietly (`ui/open-in-editor.ts`).
	 */
	const openSite = useCallback(
		async (site: CallSite) => {
			const result = await openInEditor(site);
			if (result === "opened") return;
			showToast({
				tone: "danger",
				message:
					result === "unavailable"
						? `${callSiteLabel(site)} — opening in an editor needs the Vite dev server; this build does not have one.`
						: `${callSiteLabel(site)} — the dev server could not launch an editor. Set $EDITOR, or open the file yourself.`,
			});
		},
		[showToast],
	);

	return { copied, copy, openSite };
}
