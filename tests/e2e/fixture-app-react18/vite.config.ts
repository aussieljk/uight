/**
 * The React 18 cell of the matrix (§20.2).
 *
 * It is the SAME application — `root` points at `../fixture-app` — with React
 * 18 aliased in. Copying the app would let the two drift, and a matrix whose
 * React 18 cell tests a different application than its React 19 cell is worse
 * than not having one.
 *
 * Aliases rather than symlinks-plus-`preserveSymlinks`: Vite realpaths module
 * ids by default, so a symlinked source tree would resolve React from the real
 * directory and silently test React 19 twice. An explicit alias cannot fail
 * quietly — if it is wrong, nothing resolves.
 */

import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { uaight } from "uaight/vite";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** Resolve from THIS directory's node_modules, which holds React 18. */
const reactDir = dirname(require.resolve("react/package.json"));
const reactDomDir = dirname(require.resolve("react-dom/package.json"));

export default defineConfig({
	root: resolve(here, "../fixture-app"),
	// A separate optimizer cache, or the two dev servers overwrite each other's
	// prebundles and one of them ends up running the other's React.
	cacheDir: resolve(here, ".vite"),
	plugins: [
		react(),
		tailwind(),
		uaight({ previewEntry: "src/uaight.preview.tsx", inventory: true }),
	],
	resolve: {
		alias: [
			{ find: /^react$/, replacement: resolve(reactDir, "index.js") },
			{ find: /^react\/(.*)$/, replacement: `${reactDir}/$1` },
			{ find: /^react-dom$/, replacement: resolve(reactDomDir, "index.js") },
			{ find: /^react-dom\/(.*)$/, replacement: `${reactDomDir}/$1` },
		],
	},
	optimizeDeps: { include: ["react", "react-dom", "react-dom/client"] },
});
