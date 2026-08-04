/**
 * Performance budgets. SPEC.md §20.3, ROADMAP item 2.
 *
 *   bun run bench            # measure, print, fail on any breach
 *   bun run bench --json     # the same numbers as JSON, for a CI annotation
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
const PKG = path.join(ROOT, "packages/uaight");
const DIST = path.join(PKG, "dist");

const json = process.argv.includes("--json");

/* ------------------------------------------------------------------ *
 * The budgets — §20.3's table, Node-side rows only
 * ------------------------------------------------------------------ */

interface Budget {
	metric: string;
	/** Upper bound. Exceeding it fails the run. */
	limit: number;
	unit: "ms" | "KB";
}

const BUDGETS: Record<string, Budget> = {
	startup100: { metric: "Plugin startup, 100 fixture modules", limit: 300, unit: "ms" },
	startup500: { metric: "Plugin startup, 500 fixture modules", limit: 1200, unit: "ms" },
	incremental: { metric: "Incremental index on one file change", limit: 30, unit: "ms" },
	chrome: { metric: "Chrome bundle, gzipped", limit: 90, unit: "KB" },
};

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
	await fsp.writeFile(path.join(src, "uaight.decorator.tsx"), decoratorModule());
	await fsp.writeFile(path.join(src, "group0", "uaight.decorator.tsx"), decoratorModule());
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
	resolveUaightConfig: (opts: unknown) => unknown,
	dir: string,
): Promise<number> {
	const cfg = resolveUaightConfig({ root: dir, options: {}, command: "serve" });
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
 * The `UaightUI-*` chunk specifically, because that is the thing the budget is
 * about: §9.2 makes it a lazy import behind `__UAIGHT_ENABLED__`, so it is
 * exactly the code a host downloads *because* uaight is there, and exactly the
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
		.find((file) => file.startsWith("UaightUI-") && file.endsWith(".js"));
	if (!chunk) {
		throw new Error(
			"dist/ has no UaightUI-*.js chunk — the chrome was inlined into another " +
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
	const { resolveUaightConfig } = await import(path.join(PKG, "src/vite/config.ts"));
	const { parseFixtureFile } = await import(path.join(PKG, "src/vite/parse.ts"));

	const results: Measurement[] = [];
	const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "uaight-bench-"));

	try {
		for (const [key, count] of [
			["startup100", 100],
			["startup500", 500],
		] as const) {
			const dir = path.join(tmp, `corpus-${count}`);
			await writeCorpus(dir, count);
			results.push({
				key,
				value: await measureStartup(buildFixtureIndex, resolveUaightConfig, dir),
				note: `${count} fixture files, ${count} component modules`,
			});
		}

		// Incremental: one content edit taken through the path the watcher takes
		// — reparse the file, rewrite the index — against the 500-file corpus,
		// which is the expensive case because collision detection re-runs over
		// the whole file list.
		const big = path.join(tmp, "corpus-500");
		const cfg = resolveUaightConfig({ root: big, options: {}, command: "serve" });
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

function report(results: Measurement[]): void {
	const rows = results.map((result) => {
		const budget = BUDGETS[result.key] as Budget;
		return {
			...result,
			metric: budget.metric,
			limit: budget.limit,
			unit: budget.unit,
			pass: result.value <= budget.limit,
		};
	});

	if (json) {
		console.log(JSON.stringify({ results: rows }, null, 2));
	} else {
		console.log("\nuaight budgets (SPEC §20.3)\n");
		for (const row of rows) {
			// One decimal below 10: an incremental index that takes 0.4 ms and one
			// that takes 4 ms are both "0 ms" rounded, and the difference between
			// them is the whole of whether a regression is visible.
			const value =
				row.unit === "KB" || row.value < 10 ? row.value.toFixed(1) : Math.round(row.value);
			const mark = row.pass ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
			console.log(
				`  ${mark} ${row.metric.padEnd(40)} ${String(value).padStart(6)} ${row.unit}` +
					`  (budget ${row.limit} ${row.unit})`,
			);
			if (row.note) console.log(`      ${row.note}`);
		}
		console.log(
			"\n  Not measured here — they need a browser, and belong to the Playwright\n" +
				"  matrix: first paint, frame handshake, memory across mount/unmount\n" +
				"  cycles, HMR latency.\n",
		);
	}

	const failed = rows.filter((row) => !row.pass);
	if (failed.length > 0) {
		console.error(
			`\x1b[31m✗ ${failed.length} budget${failed.length === 1 ? "" : "s"} breached:\x1b[0m ` +
				failed.map((row) => row.metric).join("; "),
		);
		process.exitCode = 1;
	}
}
await main();
