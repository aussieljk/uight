/**
 * Frame isolation. SPEC.md §6.2, §6.5, §6.6, §6.7.
 *
 * Not ejectable (§11.3): this file owns the realm and the initial-load race.
 *
 * ── The race (Q1) ───────────────────────────────────────────────────────────
 * An `<iframe>` with no `src` is handed an `about:blank` document as soon as it
 * is attached, but the browser ALSO runs that document's load in its own time.
 * Two failure modes follow, and they differ by engine:
 *
 *   a. `contentDocument` is not yet usable when our effect runs.
 *   b. It is usable, we write into it, and the about:blank load that was
 *      already in flight then replaces the document — blanking our work.
 *
 * Neither "write immediately" nor "write on load" survives both. So we do all
 * three of the following, which between them cover every ordering:
 *
 *   1. Try to write immediately, and if `contentDocument` is not there yet,
 *      retry on animation frames within a short budget.
 *   2. Keep a `load` listener attached for the frame's whole life. On every
 *      load we check whether OUR marker element survived; if it did not, we
 *      write again. This is what handles (b), and it also handles a later
 *      navigation blanking the frame.
 *   3. Guard with a written-flag so a load event that did NOT blank us is a
 *      no-op rather than a second document and a second renderer.
 *
 * A rewrite re-runs the renderer entry, which sends a second `READY`. §8.2
 * already defines that as a frame reload: same `mountId`, overlays replayed.
 * So the recovery path is the protocol's normal path, not a special case.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { ReactElement } from "react";
import { createFrameHostTransport } from "../runtime/index.ts";
import type { HostTransport } from "../runtime/index.ts";
import { THEME_ATTRIBUTE } from "../shared/types.ts";
import type {
	FixtureId,
	InputOverlay,
	RendererError,
	ResolvedUightTheme,
} from "../shared/types.ts";
import { FRAME_CHROME_ID, FRAME_ROOT_ID, ROOT_CLASS } from "./constants.ts";
import { ensureStyles, escapeAttribute, readNonce, styleTag } from "./styles.ts";

export interface FrameHostProps {
	mountId: string;
	rendererEntryUrl: string;
	/**
	 * Stylesheets the renderer entry needs, which in practice means whatever the
	 * host's `previewEntry` imported. Empty in development, where Vite serves
	 * CSS as JavaScript that injects itself into the realm it runs in; non-empty
	 * in a build, where that CSS is extracted to files and the frame document —
	 * never passed through `transformIndexHtml` — has nothing linking them.
	 */
	rendererStyleUrls?: readonly string[] | undefined;
	/** True in `serve` mode; adds the Vite client so Fast Refresh reaches the frame. */
	dev: boolean;
	initialFixture: FixtureId | null;
	initialOverlays: InputOverlay[];
	/** §6.6 — a runtime URL for a custom preview document. */
	previewDocumentUrl?: string | undefined;
	title: string;
	/**
	 * The host's resolved theme, stamped on the frame document's
	 * `documentElement` as `data-uight-theme` (§10.1, `THEME_ATTRIBUTE`).
	 *
	 * `system` is resolved by the host before it arrives here and the frame never
	 * re-resolves it, so the two realms cannot disagree — a `matchMedia` inside
	 * the frame answers the OS, which is not the question when the mount pins a
	 * theme.
	 */
	theme: ResolvedUightTheme;
	className?: string | undefined;
	onTransport: (transport: HostTransport | null) => void;
	/** §6.5 — only wired when `height="auto"`. */
	onContentHeight?: ((height: number) => void) | undefined;
	onBootstrapError: (error: RendererError | null) => void;
}

const WRITE_RETRY_FRAMES = 60;

/** A stable empty default, so the injection callback is not rebuilt per render. */
const EMPTY_STYLES: readonly string[] = [];

/**
 * The opening of §6.7 step 5's message, and the marker the host uses to keep it.
 *
 * Three things notice a blocked renderer — the violation event, the script's
 * `error` event and the handshake timeout — and only the first knows WHICH
 * directive did it. `UightUI` treats a message starting with this as the
 * specific explanation and refuses to replace it with a vaguer one.
 */
export const CSP_BLOCKED_PREFIX = "Content Security Policy blocked the renderer:";

function frameDocument(frame: HTMLIFrameElement): Document | null {
	try {
		return frame.contentDocument;
	} catch {
		// Cross-origin only happens if someone pointed previewDocumentUrl off-origin.
		return null;
	}
}

function buildDocument(opts: {
	baseHref: string;
	nonce: string | undefined;
	dev: boolean;
}): string {
	const { baseHref, nonce, dev } = opts;
	const nonceAttr = nonce ? ` nonce="${escapeAttribute(nonce)}"` : "";
	return [
		"<!doctype html>",
		'<html><head><meta charset="utf-8">',
		// Without this the frame lays itself out at a mobile browser's 980px
		// fallback viewport and every fixture is rendered for a desktop and then
		// scaled down. The frame is a viewport of its own; say how wide it is.
		'<meta name="viewport" content="width=device-width, initial-scale=1">',
		`<base href="${escapeAttribute(baseHref)}">`,
		// §6.7 step 2 — a runtime-constructed document inherits the parent's nonce,
		// and republishes it so anything the renderer injects can find it.
		nonce ? `<meta name="csp-nonce" content="${escapeAttribute(nonce)}">` : "",
		styleTag(nonce),
		`<style${nonceAttr}>html,body{margin:0;padding:0;min-height:100%}` +
			`#${FRAME_ROOT_ID}{min-height:100vh}</style>`,
		dev ? `<script type="module" src="/@vite/client"${nonceAttr}></script>` : "",
		"</head><body>",
		`<div id="${FRAME_ROOT_ID}"></div>`,
		`<div id="${FRAME_CHROME_ID}" class="${ROOT_CLASS}"></div>`,
		"</body></html>",
	].join("");
}

export function FrameHost(props: FrameHostProps): ReactElement {
	const {
		mountId,
		rendererEntryUrl,
		rendererStyleUrls,
		dev,
		previewDocumentUrl,
		title,
		theme,
		className,
		onTransport,
		onContentHeight,
		onBootstrapError,
	} = props;

	const ref = useRef<HTMLIFrameElement | null>(null);

	// Read through a ref inside the document writer, which must not be torn down
	// and re-run — rewriting the frame to change a colour would restart the
	// renderer and lose the fixture's own state.
	const themeRef = useRef(theme);
	themeRef.current = theme;

	// Read once: recreating the transport on every selection change would
	// restart the handshake. Later selections travel as messages.
	const initialRef = useRef({
		fixture: props.initialFixture,
		overlays: props.initialOverlays,
	});

	/** The script-src violation seen in the frame document, if any (§6.7 step 5). */
	const cspDirective = useRef<{ directive: string; blockedURI: string } | null>(null);

	const onTransportRef = useRef(onTransport);
	const onErrorRef = useRef(onBootstrapError);
	const onHeightRef = useRef(onContentHeight);
	onTransportRef.current = onTransport;
	onErrorRef.current = onBootstrapError;
	onHeightRef.current = onContentHeight;

	/**
	 * §10.1 — the preview entry's own providers read this to theme the host
	 * application's tree to match the chrome. An attribute rather than a message
	 * because the reader is not a fixture and does not use our hooks.
	 */
	const stampTheme = useCallback((doc: Document | null) => {
		doc?.documentElement?.setAttribute(THEME_ATTRIBUTE, themeRef.current);
	}, []);

	/**
	 * The renderer's extracted stylesheets, linked before the script that needs
	 * them so the first paint is not unstyled.
	 *
	 * `<link>` rather than fetch-and-inline: a stylesheet in the head blocks
	 * rendering until it loads, which is exactly the behaviour wanted, and it is
	 * the same request the browser would have made from a document.
	 */
	const styleUrls = rendererStyleUrls ?? EMPTY_STYLES;
	const injectRendererStyles = useCallback(
		(doc: Document, nonce: string | undefined) => {
			for (const href of styleUrls) {
				if (doc.querySelector(`link[data-uight-renderer-style="${escapeAttribute(href)}"]`)) {
					continue;
				}
				const link = doc.createElement("link");
				link.rel = "stylesheet";
				link.dataset.uightRendererStyle = href;
				if (nonce) link.setAttribute("nonce", nonce);
				link.href = href;
				(doc.head ?? doc.documentElement).appendChild(link);
			}
		},
		[styleUrls],
	);

	/** §6.2 step 4, and the injection half of the custom-document path (§6.6). */
	const injectRenderer = useCallback(
		(doc: Document, nonce: string | undefined) => {
			injectRendererStyles(doc, nonce);
			if (doc.querySelector("script[data-uight-renderer]")) return;
			const script = doc.createElement("script");
			script.type = "module";
			script.dataset.uightRenderer = "";
			// Dynamically inserted scripts default to async; ordering matters,
			// because the Vite client must install before a transformed module runs.
			script.async = false;
			if (nonce) {
				script.setAttribute("nonce", nonce);
				script.nonce = nonce;
			}
			script.src = rendererEntryUrl;
			script.addEventListener("error", () => {
				// A blocked script fires `error` too, and "could not be loaded" is
				// the answer to a question the violation already answered better.
				const blocked = cspDirective.current;
				onErrorRef.current({
					kind: "bootstrap",
					message: blocked
						? `${CSP_BLOCKED_PREFIX} ${blocked.directive}. ` +
							`uight injects a module script into the preview frame, so that ` +
							`directive has to allow it — add the page's nonce to a ` +
							`<meta name="csp-nonce"> tag, or allow ${blocked.blockedURI || rendererEntryUrl}.`
						: `The renderer entry could not be loaded from ${rendererEntryUrl}.`,
				});
			});
			(doc.head ?? doc.documentElement).appendChild(script);
		},
		[rendererEntryUrl, injectRendererStyles],
	);

	// The transport must exist before any document is written, or the child's
	// READY lands with nobody listening.
	useLayoutEffect(() => {
		const frame = ref.current;
		if (!frame) return;
		const transport = createFrameHostTransport({
			frame,
			mountId,
			initialFixture: initialRef.current.fixture,
			overlays: initialRef.current.overlays,
		});
		onTransportRef.current(transport);
		return () => {
			onTransportRef.current(null);
			transport.dispose();
		};
	}, [mountId]);

	useEffect(() => {
		const frame = ref.current;
		if (!frame) return;

		let disposed = false;
		let written = false;
		let frames = 0;
		let raf = 0;
		let observer: ResizeObserver | undefined;
		let cspListenerDoc: Document | null = null;

		/**
		 * §6.7 step 5 — name the directive rather than showing a blank frame.
		 *
		 * Kept, because two other things also notice the failure and both of them
		 * are vaguer: the injected script's own `error` event, and the handshake
		 * timeout. Whichever spoke last used to win, and in Chromium under a real
		 * nonce policy that was the `error` handler — so the half of step 5 that
		 * says "rather than an empty frame" was met while the half that names the
		 * directive, which is the only reason this listener exists, was not.
		 * `cspDirective` is what the generic paths defer to.
		 */
		const cspMessage = (directive: string, blockedURI: string): string =>
			`${CSP_BLOCKED_PREFIX} ${directive}. ` +
			`uight injects a module script into the preview frame, so that ` +
			`directive has to allow it — add the page's nonce to a ` +
			`<meta name="csp-nonce"> tag, or allow ${blockedURI || rendererEntryUrl}.`;

		const onCspViolation = (event: Event) => {
			const e = event as SecurityPolicyViolationEvent;
			if (!e.violatedDirective?.startsWith("script-src")) return;
			cspDirective.current = {
				directive: e.violatedDirective,
				blockedURI: e.blockedURI ?? "",
			};
			onErrorRef.current({
				kind: "bootstrap",
				message: cspMessage(e.violatedDirective, e.blockedURI ?? ""),
			});
		};

		const observeHeight = (doc: Document) => {
			if (!onHeightRef.current || typeof ResizeObserver === "undefined") return;
			observer?.disconnect();
			// §6.5 — the frame's documentElement is the thing that grows.
			observer = new ResizeObserver(() => {
				const el = doc.documentElement;
				if (!el) return;
				const height = Math.max(el.scrollHeight, el.getBoundingClientRect().height);
				if (height > 0) onHeightRef.current?.(height);
			});
			observer.observe(doc.documentElement);
		};

		const attachDocumentListeners = (doc: Document) => {
			if (cspListenerDoc === doc) return;
			cspListenerDoc?.removeEventListener("securitypolicyviolation", onCspViolation);
			doc.addEventListener("securitypolicyviolation", onCspViolation);
			cspListenerDoc = doc;
		};

		/** Returns true when the frame now holds a document we own. */
		const write = (): boolean => {
			if (disposed) return true;
			const doc = frameDocument(frame);
			if (!doc) return false;

			// Written, and still ours: nothing to do. This is guard (3).
			if (written && doc.getElementById(FRAME_ROOT_ID)) return true;

			const nonce = readNonce(document);
			doc.open();
			doc.write(buildDocument({ baseHref: document.baseURI, nonce, dev }));
			doc.close();
			written = true;
			attachDocumentListeners(doc);
			stampTheme(doc);
			injectRenderer(doc, nonce);
			observeHeight(doc);
			return true;
		};

		/** §6.6 — a custom document is served by Vite; we only inject into it. */
		const adoptCustomDocument = (): boolean => {
			const doc = frameDocument(frame);
			if (!doc || !doc.getElementById(FRAME_ROOT_ID)) return false;
			// Rule 4: a custom document's own nonce wins over the parent's.
			const nonce = readNonce(doc) ?? readNonce(document);
			attachDocumentListeners(doc);
			stampTheme(doc);
			// Our scoped stylesheet still has to reach the frame realm (§10.3).
			ensureStyles(doc, nonce);
			injectRenderer(doc, nonce);
			observeHeight(doc);
			written = true;
			return true;
		};

		const step = previewDocumentUrl ? adoptCustomDocument : write;

		const onLoad = () => {
			// (b): the about:blank load may have replaced what we wrote.
			written = written && !!frameDocument(frame)?.getElementById(FRAME_ROOT_ID);
			step();
		};

		frame.addEventListener("load", onLoad);

		if (previewDocumentUrl) {
			if (frame.getAttribute("src") !== previewDocumentUrl) {
				frame.setAttribute("src", previewDocumentUrl);
			} else {
				step();
			}
		} else {
			// (a): retry on frames until contentDocument exists.
			const attempt = () => {
				if (disposed || step()) return;
				if (++frames > WRITE_RETRY_FRAMES) {
					onErrorRef.current({
						kind: "bootstrap",
						message:
							"The preview frame never produced a usable document. This is " +
							"usually a sandbox attribute or an extension interfering with " +
							"about:blank in the host page.",
					});
					return;
				}
				raf = requestAnimationFrame(attempt);
			};
			attempt();
		}

		return () => {
			disposed = true;
			cancelAnimationFrame(raf);
			observer?.disconnect();
			cspListenerDoc?.removeEventListener("securitypolicyviolation", onCspViolation);
			frame.removeEventListener("load", onLoad);
		};
	}, [dev, previewDocumentUrl, injectRenderer, rendererEntryUrl, stampTheme]);

	// A theme change after the document exists is an attribute write and nothing
	// else. `subscribeUightTheme` in the renderer observes it.
	useEffect(() => {
		const frame = ref.current;
		if (!frame) return;
		stampTheme(frameDocument(frame));
	}, [theme, stampTheme]);

	return (
		<iframe
			ref={ref}
			title={title}
			// No `src` — about:blank inherits the parent origin (§6.2 step 1).
			// Note that same-origin means this is isolation, not a sandbox (§5.2).
			className={className ?? "block h-full w-full border-0 bg-[var(--u-bg)]"}
			data-uight-frame=""
		/>
	);
}
