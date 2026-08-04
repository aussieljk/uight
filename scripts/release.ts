/**
 * Release, from the repository root.
 *
 *   bun run verify                  # every gate CI runs, and nothing else
 *   bun run release                 # verify, then publish
 *   bun run release --bump          # move the canary counter first
 *   bun run release --tag canary    # publish under a different dist-tag
 *
 * Three things this exists to get right, all of which are easy to get wrong by
 * hand and were got wrong at least once while writing it:
 *
 *  1. **Order.** `bun run build` MUST precede the type check. `uaight/client`
 *     declares the `virtual:uaight/*` modules and resolves `RuntimeConfig`
 *     through the package's own `dist`, so type-checking against a stale dist
 *     checks last release's contract and passes when it should not.
 *  2. **The tag is not optional.** npm refuses to publish a prerelease version
 *     without an explicit `--tag`, so `0.0.1-canary.N` cannot be published by
 *     accident — but it also means a plain `npm publish` fails outright.
 *  3. **Auth fails last, otherwise.** `npm whoami` costs one request; running
 *     it first turns a four-minute verify-then-fail into an immediate answer.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = path.join(ROOT, "packages/uaight");

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const bump = argv.includes("--bump");

/**
 * Default `latest`, so `npm i uaight` resolves. A prerelease published under
 * any other tag leaves the package with no `latest` at all, and a plain
 * `npm i uaight` then fails with "No matching version found" — which is the
 * right shape once a stable release exists to protect, and the wrong one now.
 */
const tagIndex = argv.indexOf("--tag");
const tag = tagIndex === -1 ? "latest" : (argv[tagIndex + 1] ?? "latest");

/* ------------------------------------------------------------------ *
 * Running things
 * ------------------------------------------------------------------ */

interface Step {
	title: string;
	command: string;
	args: string[];
	cwd?: string;
}

function run(step: Step): void {
	process.stdout.write(`\n\x1b[2m→ ${step.title}\x1b[0m\n`);
	const result = spawnSync(step.command, step.args, {
		cwd: step.cwd ?? ROOT,
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) {
		process.stdout.write(
			`\n\x1b[31m✗ ${step.title} failed\x1b[0m\n` +
				`  ${step.command} ${step.args.join(" ")}\n`,
		);
		process.exit(result.status ?? 1);
	}
}

function capture(command: string, args: string[], cwd = ROOT): string | null {
	const result = spawnSync(command, args, { cwd, encoding: "utf8", env: process.env });
	return result.status === 0 ? result.stdout.trim() : null;
}

/* ------------------------------------------------------------------ *
 * Preflight
 * ------------------------------------------------------------------ */

const who = capture("npm", ["whoami"]);
if (!who && !dryRun) {
	process.stdout.write(
		"\n\x1b[31m✗ not logged in to npm\x1b[0m\n\n" +
			"  Run this yourself — it needs a browser:\n\n" +
			"      npm login\n\n" +
			"  Then: bun run release\n",
	);
	process.exit(1);
}

if (bump) {
	run({
		title: "Bump the canary counter",
		command: "bun",
		args: ["run", "version:bump"],
		cwd: PKG,
	});
}

const version = capture("node", ["-p", "require('./package.json').version"], PKG);

process.stdout.write(
	`\n\x1b[1muaight ${version ?? "?"}\x1b[0m` +
		`${dryRun ? "  (dry run)" : `  → npm, tag "${tag}"`}` +
		`${who ? `  as ${who}` : ""}\n`,
);

/* ------------------------------------------------------------------ *
 * The gates — the same ones CI runs, in the same order
 * ------------------------------------------------------------------ */

const steps: Step[] = [
	// Cheapest first: package.json and UAIGHT_VERSION are compared by the
	// runtime at §16.2, so drift reaches users as a version-skew error.
	{ title: "Version lockstep", command: "bun", args: ["run", "version:check"], cwd: PKG },
	// Before the build, while `src/styles/generated.ts` still holds whatever was
	// committed — after it, the check compares the build against itself.
	{ title: "Stylesheet is fresh", command: "bun", args: ["run", "build:css", "--check"], cwd: PKG },
	{ title: "Build", command: "bun", args: ["run", "build"] },
	// `typecheck:only`, not `typecheck`: the exposed script builds first, because
	// running it by hand against a stale `dist` is the misleading case. Here the
	// build is the step above, and repeating it would only cost time.
	{ title: "Typecheck the package", command: "bun", args: ["run", "typecheck:only"] },
	{
		title: "Typecheck the demo",
		command: "bun",
		args: ["run", "typecheck"],
		cwd: path.join(ROOT, "examples/frosted-ui"),
	},
	{ title: "Lint", command: "bun", args: ["run", "lint"] },
	{ title: "Test", command: "bun", args: ["run", "test"], cwd: PKG },
	{ title: "Registry builds", command: "bun", args: ["run", "registry"], cwd: PKG },
];

for (const step of steps) run(step);

/* ------------------------------------------------------------------ *
 * Publish
 * ------------------------------------------------------------------ */

// From the package directory rather than `--workspace`: both behave the same,
// and this way the paths in the output are the ones a reader expects.
const publishArgs = ["publish", "--tag", tag];
if (dryRun) publishArgs.push("--dry-run");

run({
	title: dryRun ? "Pack (dry run — nothing is published)" : `Publish to npm (tag "${tag}")`,
	command: "npm",
	args: publishArgs,
	cwd: PKG,
});

if (dryRun) {
	process.stdout.write(
		`\n\x1b[32m✓ every gate passed\x1b[0m — nothing was published.\n` +
			`  Publish with: bun run release\n`,
	);
} else {
	process.stdout.write(
		`\n\x1b[32m✓ published uaight@${version}\x1b[0m under "${tag}"\n\n` +
			`  npm i -D uaight${tag === "latest" ? "" : `@${tag}`}\n` +
			`  Next canary: bun run release --bump\n`,
	);
}
