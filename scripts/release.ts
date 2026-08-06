/**
 * Release, from the repository root.
 *
 *   bun run verify                  # every gate CI runs, and nothing else
 *   bun run release                 # verify, then publish
 *   bun run release --bump          # 0.0.1 → 0.0.2 first
 *   bun run release --bump minor    # 0.1.4 → 0.2.0 first
 *   bun run release --tag next      # publish under a different dist-tag
 *
 * Three things this exists to get right, all of which are easy to get wrong by
 * hand and were got wrong at least once while writing it:
 *
 *  1. **Order.** `bun run build` MUST precede the type check. `@aussieljk/uight/client`
 *     declares the `virtual:uight/*` modules and resolves `RuntimeConfig`
 *     through the package's own `dist`, so type-checking against a stale dist
 *     checks last release's contract and passes when it should not.
 *  2. **`latest` is the default, and it means it.** Every release goes out as a
 *     real `X.Y.Z` under `latest`, so `npm i @aussieljk/uight` resolves to the
 *     newest one. `--tag` exists for the day something needs to ship beside it,
 *     not as a way to park a prerelease where nobody installs it.
 *  3. **Auth fails last, otherwise.** `npm whoami` costs one request; running
 *     it first turns a four-minute verify-then-fail into an immediate answer.
 *     Except under OIDC, where there is nobody to be: see `oidc` below.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = path.join(ROOT, "packages/uight");

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const bump = argv.includes("--bump");
/** `patch` unless the next argument names a level. `version.ts` validates it. */
const bumpLevel = bump ? (argv[argv.indexOf("--bump") + 1] ?? "") : "";

/** Default `latest`: the newest release is what a plain install should get. */
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

/**
 * Trusted publishing (OIDC), which is how `.github/workflows/release.yml`
 * authenticates. There is no token and no user, so `npm whoami` correctly says
 * nobody and the preflight below would refuse a release that is perfectly able
 * to publish. The npm CLI mints its credential from this endpoint at publish
 * time; Actions sets the variable only when the job was granted
 * `id-token: write`, which makes it exactly the right thing to ask.
 */
const oidc = !!process.env.ACTIONS_ID_TOKEN_REQUEST_URL;

const who = oidc ? null : capture("npm", ["whoami"]);
if (!who && !dryRun && !oidc) {
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
		title: `Bump the version${bumpLevel && !bumpLevel.startsWith("--") ? ` (${bumpLevel})` : ""}`,
		command: "bun",
		args: [
			"run",
			"version:bump",
			...(bumpLevel.startsWith("--") ? [] : [bumpLevel]),
		].filter(Boolean),
		cwd: PKG,
	});
}

const version = capture("node", ["-p", "require('./package.json').version"], PKG);

process.stdout.write(
	`\n\x1b[1muight ${version ?? "?"}\x1b[0m` +
		`${dryRun ? "  (dry run)" : `  → npm, tag "${tag}"`}` +
		`${who ? `  as ${who}` : oidc ? "  as a trusted publisher (OIDC)" : ""}\n`,
);

/* ------------------------------------------------------------------ *
 * The gates — the same ones CI runs, in the same order
 * ------------------------------------------------------------------ */

const steps: Step[] = [
	// Cheapest first: package.json and UIGHT_VERSION are compared by the
	// runtime at §16.2, so drift reaches users as a version-skew error.
	{ title: "Version lockstep", command: "bun", args: ["run", "version:check"], cwd: PKG },
	// Before the build, while `src/styles/generated.ts` still holds whatever was
	// committed — after it, the check compares the build against itself.
	{
		title: "Stylesheet is fresh",
		command: "bun",
		args: ["run", "build:css", "--check"],
		cwd: PKG,
	},
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
	title: dryRun
		? "Pack (dry run — nothing is published)"
		: `Publish to npm (tag "${tag}")`,
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
		`\n\x1b[32m✓ published uight@${version}\x1b[0m under "${tag}"\n\n` +
			`  npm i -D @aussieljk/uight${tag === "latest" ? "" : `@${tag}`}\n` +
			`  Next release: bun run release --bump\n`,
	);
}
