/**
 * The e2e host application's Vite config.
 *
 * Everything the §20.2 matrix varies that is not a browser is varied HERE, by
 * environment variable, so one directory serves every cell:
 *
 *   UAIGHT_E2E_CSP        off | nonce | no-meta   (§6.7)
 *   UAIGHT_E2E_PRODUCTION exclude | include       (§9.2 — the production gate)
 *
 * The base-path axis is a CLI flag (`vite build --base=/explorer/`), not a
 * variable, because that is how a consumer sets it and because `preview` has to
 * be given the same one.
 */

import { fileURLToPath } from "node:url";
import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { uaight } from "uaight/vite";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

/** Fixed rather than per-request: `html.cspNonce` is a build-time string. */
const NONCE = "uaightE2ENonce123";

const csp = process.env.UAIGHT_E2E_CSP ?? "off";
const production = (process.env.UAIGHT_E2E_PRODUCTION ?? "exclude") as "exclude" | "include";

/**
 * Serves the policy and (except in `no-meta`) publishes the nonce where §6.7
 * step 1 says to look for it.
 *
 * `no-meta` is the negative control: the policy is identical, but the page does
 * not tell us its nonce, so the script `FrameHost` injects into the frame is
 * unsigned and the browser refuses it. §6.7 step 5 requires that to surface as
 * a message naming the directive rather than as a blank frame — and a test that
 * has never seen the block happen proves nothing about the message.
 */
function cspPlugin(): Plugin {
	const policy = [
		`default-src 'self'`,
		// 'strict-dynamic' is what lets a nonced module script's own imports load.
		// Without it every transformed module in dev is blocked and the test
		// measures Vite rather than uaight.
		`script-src 'nonce-${NONCE}' 'strict-dynamic' 'unsafe-eval'`,
		`style-src 'nonce-${NONCE}'`,
		`img-src 'self' data:`,
		`connect-src 'self' ws: wss:`,
		`frame-src 'self'`,
	].join("; ");

	return {
		name: "uaight-e2e-csp",
		apply: () => csp !== "off",
		configureServer(server) {
			server.middlewares.use((_req, res, next) => {
				res.setHeader("Content-Security-Policy", policy);
				next();
			});
		},
		configurePreviewServer(server) {
			server.middlewares.use((_req, res, next) => {
				res.setHeader("Content-Security-Policy", policy);
				next();
			});
		},
		transformIndexHtml() {
			if (csp === "no-meta") return [];
			// uaight reads `meta[name="csp-nonce"]` (§6.7 step 1). Vite's own
			// cspNonce meta uses `property`, so this is not redundant.
			return [
				{
					tag: "meta",
					attrs: { name: "csp-nonce", content: NONCE, nonce: NONCE },
					injectTo: "head-prepend" as const,
				},
			];
		},
	};
}

export default defineConfig({
	// A stable port per config would collide across parallel workers; Playwright
	// assigns one through `--port` on the command line instead.
	plugins: [
		react(),
		tailwind(),
		cspPlugin(),
		uaight({
			// `UAIGHT_E2E_PREVIEW=off` drops the preview entry. It exists because
			// the inline path loads it with a dynamic import and only renders
			// `RendererApp` once it resolves (`InlineHost.tsx`), so "does inline
			// work at all" and "does inline work when the renderer mounts a tick
			// late" are different questions and a bug report has to say which.
			...(process.env.UAIGHT_E2E_PREVIEW === "off"
				? {}
				: { previewEntry: "src/uaight.preview.tsx" }),
			inventory: true,
			production,
		}),
	],
	html: csp === "off" ? {} : { cspNonce: NONCE },
	build: {
		// Named chunks make the §9.2 production-gate assertion readable: the test
		// greps the manifest for a chunk whose name contains "UaightUI".
		sourcemap: false,
	},
	/**
	 * `uaight` is a linked workspace package, so Vite realpaths its files and
	 * would otherwise resolve React from `packages/uaight/node_modules` for the
	 * explorer chunk and from this app for everything else. In dev the optimizer
	 * hides it; in a BUILD the bundle ends up with two Reacts and the explorer
	 * dies on `Cannot read properties of null (reading 'useContext')`. Any
	 * consumer linking the package locally hits this, which is why it is fixed
	 * here rather than worked around in the tests.
	 */
	resolve: { dedupe: ["react", "react-dom"] },
	server: { fs: { allow: [fileURLToPath(new URL("../../..", import.meta.url))] } },
	// The explorer chunk is reached lazily from a virtual module, so the
	// dependency scanner never crawls it from the HTML entry.
	optimizeDeps: { include: ["react", "react-dom", "react-dom/client"] },
});
