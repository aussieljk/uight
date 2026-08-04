/**
 * Stylesheet injection and CSP nonce resolution.
 * SPEC.md §6.7 (CSP), §10.3 (scoped, compiled CSS).
 *
 * The compiled stylesheet is a string, not a `.css` import: a `.tsx` importing
 * a stylesheet would make the UI chunk unusable outside a bundler that handles
 * CSS, and would escape the `.uaight-root` scoping contract.
 */

import { UAIGHT_CSS } from "../styles/generated.ts";
import { UAIGHT_VERSION } from "../shared/version.ts";
import { STYLE_MARKER } from "./constants.ts";

/**
 * §6.7 steps 1–2 and 4. A document's own `csp-nonce` meta wins; a
 * runtime-constructed document inherits the parent's.
 */
export function readNonce(doc: Document | null | undefined): string | undefined {
	if (!doc) return undefined;
	const meta = doc.querySelector('meta[name="csp-nonce"]');
	if (!meta) return undefined;
	const content = meta.getAttribute("content");
	if (content) return content;
	// Browsers hide the attribute value but keep the IDL property populated.
	const nonce = (meta as HTMLMetaElement).nonce;
	return nonce ? nonce : undefined;
}

/** Injects the scoped stylesheet once per document. §6.7 step 3. */
export function ensureStyles(doc: Document, nonce?: string | undefined): void {
	if (doc.querySelector(`style[${STYLE_MARKER}]`)) return;
	const el = doc.createElement("style");
	el.setAttribute(STYLE_MARKER, UAIGHT_VERSION);
	if (nonce) {
		el.setAttribute("nonce", nonce);
		el.nonce = nonce;
	}
	el.textContent = UAIGHT_CSS;
	(doc.head ?? doc.documentElement).appendChild(el);
}

/** The stylesheet text, for documents we build by writing HTML (§6.2 step 3). */
export function styleTag(nonce?: string | undefined): string {
	const attr = nonce ? ` nonce="${escapeAttribute(nonce)}"` : "";
	// The compiled sheet cannot contain `</style>`; Tailwind output never does,
	// but escape defensively rather than trust it.
	const css = UAIGHT_CSS.replace(/<\/style/gi, "<\\/style");
	return `<style ${STYLE_MARKER}="${UAIGHT_VERSION}"${attr}>${css}</style>`;
}

export function escapeAttribute(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}
