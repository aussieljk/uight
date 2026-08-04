import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		vite: "src/vite/index.ts",
		runtime: "src/runtime/index.ts",
		chrome: "src/chrome/index.ts",
	},
	format: "esm",
	platform: "neutral",
	dts: true,
	sourcemap: true,
	// The CSS build writes dist/styles.css before tsdown runs, so scope the
	// clean to what tsdown itself owns rather than emptying the directory.
	clean: ["dist/*.js", "dist/*.js.map", "dist/*.d.ts"],
	// `uaight/client` is hand-written ambient declarations, not compiler output.
	copy: [{ from: "src/client.d.ts", to: "dist/client.d.ts" }],
	external: [
		"react",
		"react-dom",
		"react/jsx-runtime",
		"react-dom/client",
		"vite",
		"oxc-parser",
		"tinyglobby",
		/^node:/,
		/^virtual:uaight\//,
	],
	outDir: "dist",
});
