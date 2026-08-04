/**
 * The dev route and the public module URLs. SPEC.md §6.1, §6.3, §19.6.
 *
 * §6.1: nothing is written to your repository. The dev route's document is
 * generated in memory by this middleware and passed through
 * `transformIndexHtml`, so `@vitejs/plugin-react` injects its Fast Refresh
 * preamble and any nonce handling applies (§6.7).
 *
 * Every handler here is registered only in `serve` mode and is read-only —
 * v1 writes no files, ever (§1.4, §19.6).
 */

import type { Connect, ViteDevServer } from "vite";
import { FRAME_CHROME_ID, FRAME_ROOT_ID, ROOT_CLASS } from "../ui/constants.ts";
import type { ResolvedUaightConfig } from "./config.ts";
import {
	DEV_ENTRY_URL,
	DEV_PREVIEW_URL,
	DEV_RENDERER_URL,
	VIRTUAL_IDS,
} from "./virtual.ts";

export { DEV_ENTRY_URL, DEV_PREVIEW_URL, DEV_RENDERER_URL };

const JS_CONTENT_TYPE = "application/javascript; charset=utf-8";
const HTML_CONTENT_TYPE = "text/html; charset=utf-8";

/* ------------------------------------------------------------------ *
 * `GET <route>` — the explorer document (§6.1)
 * ------------------------------------------------------------------ */

export function devRouteHandler(
	server: ViteDevServer,
	getConfig: () => ResolvedUaightConfig,
): Connect.NextHandleFunction {
	return (req, res, next) => {
		if (!isReadRequest(req.method)) return next();
		// The middleware is mounted at the route, so `url` is route-relative.
		// Anything below the mount point belongs to the app, not to us.
		const pathname = (req.url ?? "/").split("?")[0] ?? "/";
		if (pathname !== "/" && pathname !== "") return next();

		const cfg = getConfig();
		const url = cfg.route === false ? "/" : `${cfg.route}/`;

		void server
			.transformIndexHtml(url, generateDevHtml(), req.originalUrl)
			.then((html) => {
				res.statusCode = 200;
				res.setHeader("Content-Type", HTML_CONTENT_TYPE);
				res.setHeader("Cache-Control", "no-cache");
				send(res, req.method, html);
			})
			.catch((err: unknown) => next(err));
	};
}

/**
 * The minimal document. It mounts `<Uaight />` and nothing else: the dev route
 * *is* the embedded component, in a document the plugin generates and never
 * writes to disk (§1.2).
 */
export function generateDevHtml(): string {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>uaight</title>
		<style>
			html, body { height: 100%; margin: 0; }
			#uaight-app { height: 100%; }
		</style>
	</head>
	<body>
		<div id="uaight-app"></div>
		<script type="module" src="${escapeHtml(DEV_ENTRY_URL)}"></script>
	</body>
</html>
`;
}

/* ------------------------------------------------------------------ *
 * `GET /@uaight/preview` — the frame's document (§6.6)
 * ------------------------------------------------------------------ */

/**
 * The same document `FrameHost` used to write into `about:blank`, served from
 * a URL instead — see `DEV_PREVIEW_URL` for why that difference matters.
 *
 * Generated in memory and never written to the repository (§1.4), and passed
 * through `transformIndexHtml` so the React plugin's preamble and any nonce
 * handling apply *inside the frame realm* rather than only around it.
 */
export function previewDocumentHandler(
	server: ViteDevServer,
): Connect.NextHandleFunction {
	return (req, res, next) => {
		if (!isReadRequest(req.method)) return next();
		const pathname = (req.url ?? "/").split("?")[0] ?? "/";
		if (pathname !== "/" && pathname !== "") return next();

		void server
			.transformIndexHtml(DEV_PREVIEW_URL, generatePreviewHtml(server.config.base))
			.then((html) => {
				res.statusCode = 200;
				res.setHeader("Content-Type", HTML_CONTENT_TYPE);
				res.setHeader("Cache-Control", "no-cache");
				send(res, req.method, html);
			})
			.catch((err: unknown) => next(err));
	};
}

/**
 * Deliberately the same shape as `FrameHost`'s `buildDocument`: the two mount
 * points, the reset, and nothing else. `adoptCustomDocument` finds
 * `#uaight-root`, then injects the stylesheet and the renderer itself, so this
 * document carries no uaight script of its own.
 */
export function generatePreviewHtml(base: string): string {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<base href="${escapeHtml(base)}" />
		<title>uaight preview</title>
		<style>
			html, body { margin: 0; padding: 0; min-height: 100% }
			#${FRAME_ROOT_ID} { min-height: 100vh }
		</style>
	</head>
	<body>
		<div id="${FRAME_ROOT_ID}"></div>
		<div id="${FRAME_CHROME_ID}" class="${ROOT_CLASS}"></div>
	</body>
</html>
`;
}

/* ------------------------------------------------------------------ *
 * `GET /@uaight/renderer` and `/@uaight/dev-entry` (§6.3)
 * ------------------------------------------------------------------ */

/**
 * The dev URL is public and stable. Vite's `/@id/__x00__…` encoding is private
 * and must not be relied on — the frame document is built at runtime and needs
 * a URL it can hard-code (§6.2 step 4).
 */
export function rendererHandler(server: ViteDevServer): Connect.NextHandleFunction {
	return moduleHandler(server, VIRTUAL_IDS.renderer);
}

export function devEntryHandler(server: ViteDevServer): Connect.NextHandleFunction {
	return moduleHandler(server, VIRTUAL_IDS.devEntry);
}

function moduleHandler(server: ViteDevServer, id: string): Connect.NextHandleFunction {
	return (req, res, next) => {
		if (!isReadRequest(req.method)) return next();
		const pathname = (req.url ?? "/").split("?")[0] ?? "/";
		if (pathname !== "/" && pathname !== "") return next();

		void server
			.transformRequest(id)
			.then((result) => {
				if (!result) {
					res.statusCode = 404;
					res.setHeader("Content-Type", "text/plain; charset=utf-8");
					send(res, req.method, `[uaight] ${id} did not resolve`);
					return;
				}
				res.statusCode = 200;
				res.setHeader("Content-Type", JS_CONTENT_TYPE);
				// Vite invalidates through the module graph, not through HTTP
				// caching, and this URL's contents change with the index.
				res.setHeader("Cache-Control", "no-cache");
				send(res, req.method, result.code);
			})
			.catch((err: unknown) => {
				if (err instanceof Error) server.ssrFixStacktrace(err);
				next(err);
			});
	};
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Read-only means read-only: everything but GET and HEAD falls through. */
export function isReadRequest(method: string | undefined): boolean {
	return method === "GET" || method === "HEAD";
}

function send(
	res: { end: (chunk?: string) => void; setHeader: (k: string, v: string) => void },
	method: string | undefined,
	body: string,
): void {
	res.setHeader("Content-Length", String(Buffer.byteLength(body)));
	if (method === "HEAD") {
		res.end();
		return;
	}
	res.end(body);
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
