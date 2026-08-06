/**
 * Performance budgets. SPEC.md §20.3, ROADMAP item 2.
 *
 *   bun run bench                    # measure, print, fail on any breach
 *   bun run bench --json             # the same numbers as JSON, for a CI annotation
 *   bun run bench --update-baseline  # accept the current numbers as the baseline
 *
 * **The delta, not the number.** A budget only fires at the cliff edge. The
 * chrome bundle went 41.2 → 54.3 → 57.8 KB across three passes and every one of
 * them printed a green tick against the 90 KB limit, because nothing compared a
 * run to the run before it. `bench-baseline.json` is committed, so a PR's bench
 * output shows the movement it caused ("+3.5 KB since baseline") next to the
 * budget it has not yet breached.
 *
 * **Does a large jump fail?** Yes, for the bundle: `driftLimit` below is a
 * second, tighter budget on the *change*, and 8 KB in one pass fails the bench
 * even at 60 KB against a 90 KB limit. The reasoning is that the three steps
 * above are exactly the shape of a regression that a plain budget cannot catch
 * — no single one of them is alarming, and the sum is 40% of the budget spent
 * without a decision — and a single PR that adds 8 KB of gzipped chrome should
 * have to say so in its description rather than in six months' archaeology.
 * Growth is not forbidden; it is made deliberate, by requiring
 * `--update-baseline` in the same commit.
 *
 * The timing rows carry a baseline and print their drift, but do **not** fail
 * on it: they are wall-clock measurements of whatever machine CI landed on, and
 * a drift gate over them would fire on a noisy neighbour rather than on a
 * change to this repository. Their gate stays the absolute budget.
 *
 * §20.3 says "measured in CI, failing on regression beyond a threshold". CI
 * measured nothing, which meant every budget in that table was a target nobody
 * could regress against.
 *
 * **What is measurable here, and what is not.** Four of §20.3's eight rows are
 * Node-side and are measured below. The other four — first paint, frame
 * handshake, memory across mount/unmount cycles, HMR latency — need a browser
 * driving a real dev server, so they belong to the Playwright matrix (ROADMAP
 * item 1) and are deliberately absent rather than approximated. A fabricated
 * "handshake: 12 ms" from a Node stub would be worse than a blank cell: it
 * would read as proof.
 *
 * The corpus is synthetic and generated per run into a temp directory, so the
 * plugin-startup numbers do not drift with whatever the demo happens to
 * contain. It is written to look like real work: a mix of decidable object
 * fixtures, single-fixture files, an undecidable one, decorators, and component
 * modules with call sites for the inventory and call-site passes to chew on.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import { gzipSync } from "node:zlib";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = path.join(ROOT, "packages/uight");
const DIST = path.join(PKG, "dist");

const json = process.argv.includes("--json");
const updateBaseline = process.argv.includes("--update-baseline");
const BASELINE_FILE = path.join(ROOT, "scripts/bench-baseline.json");

/* ------------------------------------------------------------------ *
 * The budgets — §20.3's table, Node-side rows only
 * ------------------------------------------------------------------ */

interface Budget {
	metric: string;
	/** Upper bound. Exceeding it fails the run. */
	limit: number;
	unit: "ms" | "KB";
	/**
	 * Upper bound on the *increase* since the committed baseline. Exceeding it
	 * fails the run even when the absolute number is under `limit`. Omitted for
	 * the timing rows — see the header for why.
	 */
	driftLimit?: number;
}

const BUDGETS: Record<string, Budget> = {
	startup100: { metric: "Plugin startup, 100 fixture modules", limit: 300, unit: "ms" },
	startup500: { metric: "Plugin startup, 500 fixture modules", limit: 1200, unit: "ms" },
	incremental: { metric: "Incremental index on one file change", limit: 30, unit: "ms" },
	// 8 KB gzipped is roughly a whole new panel. Anything that large is a
	// decision, and this makes it one.
	chrome: { metric: "Chrome bundle, gzipped", limit: 90, unit: "KB", driftLimit: 8 },
};

/* ------------------------------------------------------------------ *
 * The baseline
 * ------------------------------------------------------------------ */

interface Baseline {
	/** ISO date the baseline was taken, for reading a stale one at a glance. */
	recorded: string;
	values: Record<string, number>;
}

function readBaseline(): Baseline | null {
	if (!fs.existsSync(BASELINE_FILE)) return null;
	try {
		return JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")) as Baseline;
	} catch {
		return null;
	}
}

function writeBaseline(results: Measurement[]): void {
	const values: Record<string, number> = {};
	// Two decimals: a baseline is compared against, never displayed raw, and
	// rounding it to the display precision would bake a 0.05 KB error into every
	// future delta.
	for (const result of results) values[result.key] = Number(result.value.toFixed(2));
	const baseline: Baseline = {
		recorded: new Date().toISOString().slice(0, 10),
		values,
	};
	fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(baseline, null, "\t")}\n`);
	console.log(`\n  baseline updated → ${path.relative(ROOT, BASELINE_FILE)}\n`);
}

interface Measurement {
	key: string;
	value: number;
	note?: string;
}

/* ------------------------------------------------------------------ *
 * The synthetic corpus
 * ------------------------------------------------------------------ */

const COMPONENT_NAMES = [
	"Button",
	"Card",
	"Dialog",
	"Input",
	"Select",
	"Badge",
	"Avatar",
	"Tabs",
	"Tooltip",
	"Popover",
	"Table",
	"Toast",
	"Switch",
	"Slider",
	"Menu",
	"Sheet",
];

/**
 * `count` fixture files, plus one component module each so the inventory and
 * call-site passes have something to do. Roughly one in twelve is undecidable
 * and one in twenty is a single-fixture file, which is close to what the
 * frosted-ui corpus looks like.
 */
async function writeCorpus(dir: string, count: number): Promise<void> {
	const src = path.join(dir, "src");
	await fsp.mkdir(src, { recursive: true });

	for (let i = 0; i < count; i++) {
		const name = `${COMPONENT_NAMES[i % COMPONENT_NAMES.length]}${Math.floor(i / COMPONENT_NAMES.length)}`;
		const group = `group${i % 8}`;
		const groupDir = path.join(src, group);
		await fsp.mkdir(groupDir, { recursive: true });

		await fsp.writeFile(path.join(groupDir, `${name}.tsx`), componentModule(name));
		await fsp.writeFile(
			path.join(groupDir, `${name}.fixture.tsx`),
			fixtureModule(name, group, i),
		);
	}

	// Two decorators, at two depths, so the composition sort has real input.
	await fsp.writeFile(path.join(src, "uight.decorator.tsx"), decoratorModule());
	await fsp.writeFile(path.join(src, "group0", "uight.decorator.tsx"), decoratorModule());
}

function componentModule(name: string): string {
	return `import type { ReactNode } from "react";

export interface ${name}Props {
	variant?: "primary" | "secondary";
	disabled?: boolean;
	size?: "sm" | "md" | "lg";
	children?: ReactNode;
}

export function ${name}({ variant = "primary", disabled, size = "md", children }: ${name}Props) {
	return <button data-variant={variant} data-size={size} disabled={disabled}>{children}</button>;
}

export function ${name}Row() {
	return (
		<div>
			<${name} variant="primary" size="lg">Confirm</${name}>
			<${name} variant="secondary" disabled>Cancel</${name}>
		</div>
	);
}
`;
}

function fixtureModule(name: string, group: string, i: number): string {
	// One in twenty: a single default-exported element.
	if (i % 20 === 3) {
		return `import { ${name} } from "./${name}.tsx";\nexport default <${name}>Only</${name}>;\n`;
	}
	// One in twelve: undecidable, because the object is built rather than written.
	if (i % 12 === 5) {
		return `import { ${name} } from "./${name}.tsx";
const build = () => ({ Primary: <${name}>Primary</${name}> });
export default build();
`;
	}
	return `import { ${name} } from "./${name}.tsx";

export const fileMeta = { group: "${group}", viewport: { width: 1024, height: 768 } };

export default {
	Primary: <${name} variant="primary">Primary</${name}>,
	Secondary: <${name} variant="secondary">Secondary</${name}>,
	Disabled: <${name} disabled>Disabled</${name}>,
	Small: <${name} size="sm">Small</${name}>,
};
`;
}

function decoratorModule(): string {
	return `export default ({ children }: { children: React.ReactNode }) => <div>{children}</div>;\n`;
}

/* ------------------------------------------------------------------ *
 * Measurement
 * ------------------------------------------------------------------ */

/**
 * Best of `runs`, not the mean.
 *
 * A budget asks whether the code *can* meet a bound; the mean answers a
 * different question, about the machine it ran on. On a shared CI runner the
 * mean is dominated by whatever else the host is doing, and a budget that fails
 * on a noisy neighbour is a budget that gets disabled.
 */
async function best(runs: number, fn: () => Promise<unknown>): Promise<number> {
	let lowest = Number.POSITIVE_INFINITY;
	for (let i = 0; i < runs; i++) {
		const started = performance.now();
		await fn();
		lowest = Math.min(lowest, performance.now() - started);
	}
	return lowest;
}

async function measureStartup(
	scanFixtures: (cfg: unknown) => Promise<unknown>,
	resolveUightConfig: (opts: unknown) => unknown,
	dir: string,
): Promise<number> {
	const cfg = resolveUightConfig({ root: dir, options: {}, command: "serve" });
	// One untimed pass first: the first scan pays for oxc's module init and the
	// OS's directory cache, neither of which is what the budget is about.
	await scanFixtures(cfg);
	return best(3, () => scanFixtures(cfg));
}

/* ------------------------------------------------------------------ *
 * The chrome bundle
 * ------------------------------------------------------------------ */

/**
 * The explorer chrome, gzipped.
 *
 * The `UightUI-*` chunk specifically, because that is the thing the budget is
 * about: §9.2 makes it a lazy import behind `__UIGHT_ENABLED__`, so it is
 * exactly the code a host downloads *because* uight is there, and exactly the
 * code the production gate removes. The renderer, the serializer and the Node
 * entries are all separate chunks and are not what grows when a panel is added.
 *
 * Its hash changes every build, so it is matched by prefix rather than named.
 */
function measureChrome(): { value: number; note: string } {
	if (!fs.existsSync(DIST)) {
		throw new Error("dist/ is missing — run `bun run build` before the bench");
	}
	const chunk = fs
		.readdirSync(DIST)
		.find((file) => file.startsWith("UightUI-") && file.endsWith(".js"));
	if (!chunk) {
		throw new Error(
			"dist/ has no UightUI-*.js chunk — the chrome was inlined into another " +
				"chunk, which would defeat §9.2's production gate. Check the build.",
		);
	}
	const bytes = gzipSync(fs.readFileSync(path.join(DIST, chunk))).byteLength;
	return { value: bytes / 1024, note: chunk };
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

async function main(): Promise<void> {
	// The scan is imported from source. It is plain Node TypeScript that tsdown
	// bundles without transforming its behaviour, and reaching for `dist` here
	// would only mean the bench could not run before a build — while the one
	// thing that genuinely has to be measured on the built artefact, the chrome
	// bundle, is read from `dist` below.
	const { buildFixtureIndex, applyParse } = await import(
		path.join(PKG, "src/vite/scan.ts")
	);
	const { resolveUightConfig } = await import(path.join(PKG, "src/vite/config.ts"));
	const { parseFixtureFile } = await import(path.join(PKG, "src/vite/parse.ts"));

	const results: Measurement[] = [];
	const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "uight-bench-"));

	try {
		for (const [key, count] of [
			["startup100", 100],
			["startup500", 500],
		] as const) {
			const dir = path.join(tmp, `corpus-${count}`);
			await writeCorpus(dir, count);
			results.push({
				key,
				value: await measureStartup(buildFixtureIndex, resolveUightConfig, dir),
				note: `${count} fixture files, ${count} component modules`,
			});
		}

		// Incremental: one content edit taken through the path the watcher takes
		// — reparse the file, rewrite the index — against the 500-file corpus,
		// which is the expensive case because collision detection re-runs over
		// the whole file list.
		const big = path.join(tmp, "corpus-500");
		const cfg = resolveUightConfig({ root: big, options: {}, command: "serve" });
		const index = await buildFixtureIndex(cfg);
		const target = path.join(big, "src", "group0", "Button0.fixture.tsx");
		const source = await fsp.readFile(target, "utf8");

		results.push({
			key: "incremental",
			value: await best(20, async () => {
				const edited = `${source}\n// touched\n`;
				const parsed = parseFixtureFile(edited, target);
				applyParse(index, target, parsed, cfg, edited);
			}),
			note: "reparse one file and rewrite the index, 500-file corpus",
		});
	} finally {
		await fsp.rm(tmp, { recursive: true, force: true });
	}

	const chrome = measureChrome();
	results.push({ key: "chrome", value: chrome.value, note: chrome.note });

	report(results);
}

/** `+3.5 KB since baseline`, or the empty string when there is nothing to say. */
function driftLabel(
	delta: number | null,
	unit: Budget["unit"],
	breached: boolean,
): string {
	if (delta === null) return "  (no baseline)";
	// Below the display precision in either direction: noise, and printing
	// "+0.0 KB since baseline" on every unrelated PR would train people to skip
	// the column that matters.
	if (Math.abs(delta) < 0.05) return "  (unchanged since baseline)";
	const sign = delta > 0 ? "+" : "−";
	const text = `  (${sign}${Math.abs(delta).toFixed(1)} ${unit} since baseline)`;
	if (breached) return `\x1b[31m${text}\x1b[0m`;
	return delta > 0 ? `\x1b[33m${text}\x1b[0m` : `\x1b[32m${text}\x1b[0m`;
}

function report(results: Measurement[]): void {
	const baseline = readBaseline();
	const rows = results.map((result) => {
		const budget = BUDGETS[result.key] as Budget;
		const before = baseline?.values[result.key];
		const delta = typeof before === "number" ? result.value - before : null;
		const drifted =
			budget.driftLimit !== undefined && delta !== null && delta > budget.driftLimit;
		return {
			...result,
			metric: budget.metric,
			limit: budget.limit,
			unit: budget.unit,
			baseline: before ?? null,
			delta,
			driftLimit: budget.driftLimit ?? null,
			// Two independent gates, and a row passes only when both do.
			overBudget: result.value > budget.limit,
			drifted,
			pass: result.value <= budget.limit && !drifted,
		};
	});

	if (json) {
		console.log(
			JSON.stringify({ baseline: baseline?.recorded ?? null, results: rows }, null, 2),
		);
	} else {
		console.log("\nuight budgets (SPEC §20.3)\n");
		for (const row of rows) {
			// One decimal below 10: an incremental index that takes 0.4 ms and one
			// that takes 4 ms are both "0 ms" rounded, and the difference between
			// them is the whole of whether a regression is visible.
			const value =
				row.unit === "KB" || row.value < 10 ? row.value.toFixed(1) : Math.round(row.value);
			const mark = row.pass ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
			console.log(
				`  ${mark} ${row.metric.padEnd(40)} ${String(value).padStart(6)} ${row.unit}` +
					`  (budget ${row.limit} ${row.unit})` +
					driftLabel(row.delta, row.unit, row.drifted),
			);
			if (row.note) console.log(`      ${row.note}`);
			if (row.drifted) {
				console.log(
					`      \x1b[31mover the ${row.driftLimit} ${row.unit} drift limit for one change.\x1b[0m ` +
						"Justify the growth, or\n      re-run with --update-baseline in the same commit to accept it.",
				);
			}
		}
		if (baseline) {
			console.log(`\n  baseline recorded ${baseline.recorded}`);
		} else {
			console.log("\n  no baseline — run with --update-baseline to record one");
		}
		console.log(
			"\n  Not measured here — they need a browser, and belong to the Playwright\n" +
				"  matrix: first paint, frame handshake, memory across mount/unmount\n" +
				"  cycles, HMR latency.\n",
		);
	}

	// The baseline is written from the measured numbers whatever the gates say:
	// `--update-baseline` is how growth is deliberately accepted, so it must
	// work on exactly the run that would otherwise fail on drift.
	if (updateBaseline) {
		writeBaseline(results);
		return;
	}

	const failed = rows.filter((row) => !row.pass);
	if (failed.length > 0) {
		const over = failed.filter((row) => row.overBudget);
		const drift = failed.filter((row) => row.drifted && !row.overBudget);
		if (over.length > 0) {
			console.error(
				`\x1b[31m✗ ${over.length} budget${over.length === 1 ? "" : "s"} breached:\x1b[0m ` +
					over.map((row) => row.metric).join("; "),
			);
		}
		if (drift.length > 0) {
			console.error(
				`\x1b[31m✗ ${drift.length} row${drift.length === 1 ? "" : "s"} grew too much in one change ` +
					`(still under budget):\x1b[0m ${drift.map((row) => row.metric).join("; ")}`,
			);
		}
		process.exitCode = 1;
	}
}
await main();
