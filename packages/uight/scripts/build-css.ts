/**
 * Compile and scope the packaged stylesheet. SPEC.md §10.2, §10.3.
 *
 *   bun run scripts/build-css.ts [--minify] [--check]
 *
 * Two artefacts come out of one compile:
 *
 *   dist/styles.css        — the published `uight/styles.css` subpath export.
 *   src/styles/generated.ts — `export const UIGHT_CSS`, the same stylesheet as
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
const INPUT = path.join(PKG_ROOT, "src", "styles", "uight.css");
const DIST_CSS = path.join(PKG_ROOT, "dist", "styles.css");
const GENERATED_TS = path.join(PKG_ROOT, "src", "styles", "generated.ts");

const require_ = createRequire(import.meta.url);

/* ------------------------------------------------------------------ *
 * ljkui
 *
 * The chrome is built from ljkui components, so ljkui's own stylesheet has to
 * travel with ours. It cannot ship as authored: it carries a preflight-style
 * reset (`img`, `p`, `ul`, `:root`) that would reach the host's elements, which
 * is exactly what §10.2 forbids. So it goes through the same §10.3 scoping pass
 * as our own output — `:root` becomes `.uight-root`, every other selector gains
 * a `.uight-root` ancestor, and `html`/`body` rules end up matching nothing.
 * ------------------------------------------------------------------ */

function ljkuiCss(): string {
	return readFileSync(require_.resolve("ljkui/styles.css"), "utf8");
}

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
	const dir = mkdtempSync(path.join(tmpdir(), "uight-css-"));
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
				`[uight] tailwindcss failed (exit ${String(result.status)}).\n${result.stderr || result.stdout}`,
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
 * requires a \`.uight-root\` ancestor, so it is immune to the host's \`@theme\`
 * and cannot leak outward. Injected once per document by the UI.
 */

export const UIGHT_CSS = ${JSON.stringify(css)};
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
	const argv = new Set(process.argv.slice(2));
	const minify = argv.has("--minify");
	const check = argv.has("--check");

	if (!existsSync(INPUT)) {
		throw new Error(`[uight] missing stylesheet source: ${INPUT}`);
	}

	const raw = compile(minify);
	// `ljkui` sits between `base` and `components`: the design system paints the
	// controls, our own component rules and utilities still override it. The
	// leading `@layer` statement is what establishes that order — the one inside
	// the compiled sheet names a subset in the same relative order, so the two
	// agree rather than fight.
	const scoped = [
		"@layer theme, base, ljkui, components, utilities;",
		`@layer ljkui{${scopeCss(ljkuiCss())}}`,
		scopeCss(raw),
	].join("\n");

	if (check) {
		// `src/styles/generated.ts` is the one that can actually go stale in a way
		// anybody would notice: it is COMMITTED, it carries the compiled sheet, and
		// `tsdown` on its own will happily bundle an old copy. `dist/styles.css` is
		// gitignored, so comparing only against it made this check vacuous — after
		// a build it is trivially equal, and before one it does not exist.
		const expected = generatedModule(scoped);
		const actual = existsSync(GENERATED_TS) ? readFileSync(GENERATED_TS, "utf8") : "";
		if (actual !== expected) {
			throw new Error("[uight] src/styles/generated.ts is stale — run `bun run build:css`");
		}
		if (existsSync(DIST_CSS) && readFileSync(DIST_CSS, "utf8") !== scoped) {
			throw new Error("[uight] dist/styles.css is stale — run `bun run build:css`");
		}
		process.stdout.write("[uight] styles up to date\n");
		return;
	}

	mkdirSync(path.dirname(DIST_CSS), { recursive: true });
	writeFileSync(DIST_CSS, scoped);
	writeFileSync(GENERATED_TS, generatedModule(scoped));

	const gz = gzipSync(Buffer.from(scoped)).byteLength;
	process.stdout.write(
		`[uight] styles.css ${kb(scoped.length)} (${kb(gz)} gzipped), ` +
			`${String(utilityCount(scoped))} utility rules\n`,
	);

	// The chrome bundle budget is 90 KB gzipped (§20.3) and this stylesheet ships
	// inside it twice over — once as a file, once as a string.
	if (gz > 40 * 1024) {
		process.stdout.write(
			`[uight] warning: scoped stylesheet is ${kb(gz)} gzipped, which is a large\n` +
				"          share of the 90 KB chrome budget (§20.3).\n",
		);
	}

	if (utilityCount(scoped) < 40) {
		process.stdout.write(
			"[uight] warning: almost no utilities were generated. Tailwind scans\n" +
				"          src/**/*.{ts,tsx} for class names (§10.2), so this is expected\n" +
				"          only while the chrome components are unwritten. Re-run\n" +
				"          `bun run build:css` once src/ui exists.\n",
		);
	}
}

main();
