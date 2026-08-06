/**
 * `bun run check` — the whole local gate, in the order that makes it mean
 * something.
 *
 * Distinct from `bun run verify` on purpose. `verify` is the *release* gate: it
 * ends in `npm publish --dry-run` and is what CI runs, so it also asserts
 * version lockstep and that the registry builds. Running it to answer "is my
 * change alright" is asking npm about a publish nobody intends.
 *
 * This is the other question. Same ordering rules, which are not preferences:
 *
 *   1. The stylesheet check comes **before** the build, or it compares the
 *      build against itself and can never fail.
 *   2. The build comes **before** the type check, because `@aussieljk/uight/client`
 *      resolves `RuntimeConfig` through the package's own `dist`; checking
 *      against a stale one passes when it should not.
 *   3. Lint and format are cheap and independent, so they run after the two
 *      gates that can tell you your change does not compile.
 *
 * There is no test step: the unit suite and the §20.2 browser matrix were both
 * removed, so the type check is now the only thing standing between a change
 * and a release.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = path.join(ROOT, "packages/uight");

interface Step {
	title: string;
	args: string[];
	cwd?: string;
}

const steps: Step[] = [
	{ title: "Stylesheet is fresh", args: ["run", "build:css", "--check"], cwd: PKG },
	{ title: "Build", args: ["run", "build"] },
	{ title: "Typecheck the package", args: ["run", "typecheck:only"] },
	{
		title: "Typecheck the demo",
		args: ["run", "typecheck"],
		cwd: path.join(ROOT, "examples/frosted-ui"),
	},
	{ title: "Lint", args: ["run", "lint"] },
	{ title: "Format", args: ["run", "format:check"] },
];

const started = Date.now();

for (const step of steps) {
	process.stdout.write(`\n\x1b[2m→ ${step.title}\x1b[0m\n`);
	const result = spawnSync("bun", step.args, {
		cwd: step.cwd ?? ROOT,
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) {
		process.stdout.write(
			`\n\x1b[31m✗ ${step.title} failed\x1b[0m\n  bun ${step.args.join(" ")}\n`,
		);
		process.exit(result.status ?? 1);
	}
}

process.stdout.write(
	`\n\x1b[32m✓ every check passed\x1b[0m in ${Math.round((Date.now() - started) / 1000)}s\n` +
		`  Release gate (adds version lockstep, the registry and a publish dry run):\n` +
		`      bun run verify\n`,
);
