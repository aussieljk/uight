/**
 * Compile and scope the packaged stylesheet. SPEC.md §10.2, §10.3.
 *
 *   bun run scripts/build-css.ts [--minify] [--check]
 *
 * Two artefacts come out of one compile:
 *
 *   dist/styles.css        — the published `uaight/styles.css` subpath export.
 *   src/styles/generated.ts — `export const UAIGHT_CSS`, the same stylesheet as
 *                             a string. The UI injects it into the host document
 *                             and again into the frame document, carrying any CSP
 *                             nonce (ARCHITECTURE §3, SPEC §6.7). A string is the
 *                             only form that can cross a realm boundary without a
 *                             second network request.
 *
 * `--check` compiles and compares without writing, for CI.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scopeCss } from "./scope-css.ts";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = path.join(PKG_ROOT, "src", "styles", "uaight.css");
const DIST_CSS = path.join(PKG_ROOT, "dist", "styles.css");
const GENERATED_TS = path.join(PKG_ROOT, "src", "styles", "generated.ts");

const require_ = createRequire(import.meta.url);

/* ------------------------------------------------------------------ *
 * Tailwind
 * ------------------------------------------------------------------ */

function tailwindCliEntry(): string {
	// `@tailwindcss/cli` exports only its package.json, so it cannot be imported
	// as a library. Resolve the manifest and run the bin it declares.
	const manifestPath = require_.resolve("@tailwindcss/cli/package.json");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
		bin?: Record<string, string> | string;
	};
	const bin =
		typeof manifest.bin === "string"
			? manifest.bin
			: (manifest.bin?.tailwindcss ?? "./dist/index.mjs");
	return path.resolve(path.dirname(manifestPath), bin);
}

function compile(minify: boolean): string {
	const dir = mkdtempSync(path.join(tmpdir(), "uaight-css-"));
	const out = path.join(dir, "styles.css");
	try {
		const args = [tailwindCliEntry(), "--input", INPUT, "--output", out];
		if (minify) args.push("--minify");
		const result = spawnSync(process.execPath, args, {
			cwd: PKG_ROOT,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		if (result.status !== 0) {
			throw new Error(
				`[uaight] tailwindcss failed (exit ${String(result.status)}).\n${result.stderr || result.stdout}`,
			);
		}
		return readFileSync(out, "utf8");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/* ------------------------------------------------------------------ *
 * Emit
 * ------------------------------------------------------------------ */

function generatedModule(css: string): string {
	return `/**
 * GENERATED — do not edit. Run \`bun run build:css\`.
 *
 * The compiled, scoped chrome stylesheet (SPEC.md §10.3). Every selector in it
 * requires a \`.uaight-root\` ancestor, so it is immune to the host's \`@theme\`
 * and cannot leak outward. Injected once per document by the UI.
 */

export const UAIGHT_CSS = ${JSON.stringify(css)};
`;
}

function kb(bytes: number): string {
	return `${(bytes / 1024).toFixed(1)} KB`;
}

/** A stylesheet with no utilities means nothing has been written that uses them. */
function utilityCount(css: string): number {
	const layer = /@layer utilities\s*\{/.exec(css);
	if (!layer) return 0;
	return (css.slice(layer.index).match(/\{/g) ?? []).length - 1;
}

function main(): void {
	const argv = process.argv.slice(2);
	const minify = argv.includes("--minify");
	const check = argv.includes("--check");

	if (!existsSync(INPUT)) {
		throw new Error(`[uaight] missing stylesheet source: ${INPUT}`);
	}

	const raw = compile(minify);
	const scoped = scopeCss(raw);

	if (check) {
		// `src/styles/generated.ts` is the one that can actually go stale in a way
		// anybody would notice: it is COMMITTED, it carries the compiled sheet, and
		// `tsdown` on its own will happily bundle an old copy. `dist/styles.css` is
		// gitignored, so comparing only against it made this check vacuous — after
		// a build it is trivially equal, and before one it does not exist.
		const expected = generatedModule(scoped);
		const actual = existsSync(GENERATED_TS) ? readFileSync(GENERATED_TS, "utf8") : "";
		if (actual !== expected) {
			throw new Error(
				"[uaight] src/styles/generated.ts is stale — run `bun run build:css`",
			);
		}
		if (existsSync(DIST_CSS) && readFileSync(DIST_CSS, "utf8") !== scoped) {
			throw new Error("[uaight] dist/styles.css is stale — run `bun run build:css`");
		}
		process.stdout.write("[uaight] styles up to date\n");
		return;
	}

	mkdirSync(path.dirname(DIST_CSS), { recursive: true });
	writeFileSync(DIST_CSS, scoped);
	writeFileSync(GENERATED_TS, generatedModule(scoped));

	const gz = gzipSync(Buffer.from(scoped)).byteLength;
	process.stdout.write(
		`[uaight] styles.css ${kb(scoped.length)} (${kb(gz)} gzipped), ` +
			`${String(utilityCount(scoped))} utility rules\n`,
	);

	// The chrome bundle budget is 90 KB gzipped (§20.3) and this stylesheet ships
	// inside it twice over — once as a file, once as a string.
	if (gz > 40 * 1024) {
		process.stdout.write(
			`[uaight] warning: scoped stylesheet is ${kb(gz)} gzipped, which is a large\n` +
				"          share of the 90 KB chrome budget (§20.3).\n",
		);
	}

	if (utilityCount(scoped) < 40) {
		process.stdout.write(
			"[uaight] warning: almost no utilities were generated. Tailwind scans\n" +
				"          src/**/*.{ts,tsx} for class names (§10.2), so this is expected\n" +
				"          only while the chrome components are unwritten. Re-run\n" +
				"          `bun run build:css` once src/ui exists.\n",
		);
	}
}

main();
