/**
 * Production build summary and manifest. SPEC.md §9.1, §9.3.
 *
 * §9.1: **each fixture module is a lazy dynamic-import boundary, and the final
 * chunk structure is bundler-controlled.** Several fixtures share a module,
 * shared dependencies hoist, and a module can emit accompanying CSS and asset
 * chunks. "One chunk per fixture" is wrong, so this report never attributes
 * bytes to a fixture: entry chunks, shared chunks and assets are counted
 * separately, plus total *unique* emitted bytes.
 */

import type { Rollup } from "vite";
import type { FixtureIndex } from "../shared/types.ts";
import type { ResolvedUaightConfig } from "./config.ts";
import { indexStats } from "./scan.ts";
import { RENDERER_URL_PLACEHOLDER } from "./virtual.ts";

export interface BundleStats {
	entryBytes: number;
	sharedBytes: number;
	assetBytes: number;
	uniqueBytes: number;
	entryChunks: number;
	sharedChunks: number;
	assets: number;
	sourcemaps: boolean;
}

/**
 * Rewrite the renderer URL placeholder with the hashed file name.
 *
 * Q7 answered: `import.meta.ROLLDOWN_FILE_URL_<ref>` does not exist in this
 * toolchain — the token is absent from rolldown@1 and vite@8.1 alike — so
 * SPEC §4.5's `load()` body cannot work as written. `emitFile` and
 * `getFileName` do exist, so the emitted module carries a placeholder and the
 * real name is patched in here, once the chunk name is known.
 */
export function replaceRendererUrl(
	bundle: Rollup.OutputBundle,
	fileName: string,
	base: string,
): void {
	const url = `${base.endsWith("/") ? base : `${base}/`}${fileName}`;
	for (const output of Object.values(bundle)) {
		if (output.type !== "chunk") continue;
		if (!output.code.includes(RENDERER_URL_PLACEHOLDER)) continue;
		output.code = output.code.split(RENDERER_URL_PLACEHOLDER).join(url);
	}
}

/* ------------------------------------------------------------------ *
 * §9.3 — modes and manifest
 * ------------------------------------------------------------------ */

export function collectBundleStats(bundle: Rollup.OutputBundle): BundleStats {
	const stats: BundleStats = {
		entryBytes: 0,
		sharedBytes: 0,
		assetBytes: 0,
		uniqueBytes: 0,
		entryChunks: 0,
		sharedChunks: 0,
		assets: 0,
		sourcemaps: false,
	};

	for (const [fileName, output] of Object.entries(bundle)) {
		if (fileName.endsWith(".map")) {
			stats.sourcemaps = true;
			continue;
		}
		if (output.type === "chunk") {
			const bytes = Buffer.byteLength(output.code);
			stats.uniqueBytes += bytes;
			if (output.isEntry) {
				stats.entryBytes += bytes;
				stats.entryChunks++;
			} else {
				stats.sharedBytes += bytes;
				stats.sharedChunks++;
			}
			if (output.map) stats.sourcemaps = true;
		} else {
			const source = output.source;
			const bytes =
				typeof source === "string" ? Buffer.byteLength(source) : source.byteLength;
			stats.uniqueBytes += bytes;
			stats.assetBytes += bytes;
			stats.assets++;
		}
	}

	return stats;
}

/**
 * The §9.3 summary. Returns `null` when fixtures were excluded, because a
 * report about a build that contains none of our code would be noise.
 */
export function emitManifest(
	bundle: Rollup.OutputBundle,
	index: FixtureIndex,
	cfg: ResolvedUaightConfig,
): string | null {
	if (cfg.command !== "build" || cfg.production !== "include") return null;
	return formatBuildSummary(indexStats(index), collectBundleStats(bundle));
}

export function formatBuildSummary(
	counts: ReturnType<typeof indexStats>,
	bundle: BundleStats,
): string {
	const left = [
		`${counts.files} fixture modules → ${counts.fixtures} fixtures`,
		`${counts.decorators} decorators`,
		counts.undecidable > 0 ? `${counts.undecidable} undecidable (§3.5)` : "",
		"",
	];
	const right = [
		["entry chunks", bundle.entryBytes],
		["shared chunks", bundle.sharedBytes],
		["CSS + assets", bundle.assetBytes],
		["unique total", bundle.uniqueBytes],
	] as const;

	const gutter = Math.max(...left.map((l) => l.length)) + 4;
	const rows: string[] = [];
	for (let i = 0; i < right.length; i++) {
		const label = left[i] ?? "";
		const entry = right[i];
		if (!entry) continue;
		rows.push(`  ${label.padEnd(gutter)}${entry[0].padEnd(15)}${formatBytes(entry[1])}`);
	}

	return [
		"[uaight] production build with fixtures INCLUDED",
		...rows,
		`  source maps: ${bundle.sourcemaps ? "enabled" : "disabled"}`,
		"",
		"  Fixtures and their imports are part of your production bundle.",
		"  Authentication controls who sees the explorer UI; it does not control",
		"  who can read the JavaScript.",
	].join("\n");
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} kB`;
	return `${(kb / 1024).toFixed(1)} MB`;
}
