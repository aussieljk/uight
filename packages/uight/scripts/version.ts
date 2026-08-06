/**
 * Release versioning — plain semver, `X.Y.Z`.
 *
 * Two files carry the version and they must never disagree: `package.json` is
 * what npm publishes, and `src/shared/version.ts` is what the runtime compares
 * against the plugin at §16.2. A drifted constant surfaces to users as
 * "one of them is a stale build artefact", which is a confusing way to learn
 * that a release script forgot a file.
 *
 * There is no prerelease series any more. Everything published goes to the
 * `latest` dist-tag under a real version, so a plain `npm i @aussieljk/uight`
 * resolves to the newest release rather than to whatever the last non-canary
 * publish happened to be.
 *
 *   bun run scripts/version.ts              # print the current version
 *   bun run scripts/version.ts --bump       # 0.0.1 → 0.0.2
 *   bun run scripts/version.ts --bump minor # 0.1.4 → 0.2.0
 *   bun run scripts/version.ts --bump major # 0.2.0 → 1.0.0
 *   bun run scripts/version.ts --set X      # set an explicit version
 *   bun run scripts/version.ts --check      # exit 1 if the two disagree
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(here, "..", "package.json");
const versionPath = path.join(here, "..", "src", "shared", "version.ts");

/**
 * A release version, and nothing else. A prerelease suffix is rejected rather
 * than carried: it needs its own dist-tag to publish at all, and publishing it
 * under `latest` is what left `npm i @aussieljk/uight` resolving to a canary.
 */
const RELEASE = /^(\d+)\.(\d+)\.(\d+)$/;

export type Level = "patch" | "minor" | "major";

function readPackageVersion(): string {
	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version: string };
	return pkg.version;
}

function readConstant(): string {
	const source = fs.readFileSync(versionPath, "utf8");
	const match = /UIGHT_VERSION = "([^"]+)"/.exec(source);
	if (!match?.[1]) {
		throw new Error(`could not find UIGHT_VERSION in ${versionPath}`);
	}
	return match[1];
}

function write(version: string): void {
	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
	pkg.version = version;
	fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);

	const source = fs.readFileSync(versionPath, "utf8");
	fs.writeFileSync(
		versionPath,
		source.replace(/UIGHT_VERSION = "[^"]+"/, `UIGHT_VERSION = "${version}"`),
	);
}

/** `0.0.1` → `0.0.2`, `0.1.4` --bump minor → `0.2.0`, and so on. */
function bump(current: string, level: Level): string {
	const match = RELEASE.exec(current);
	if (!match) {
		throw new Error(
			`${current} is not a plain X.Y.Z version, so there is no next one to compute. ` +
				`Use --set to say what it should be.`,
		);
	}
	const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
	if (level === "major") return `${major + 1}.0.0`;
	if (level === "minor") return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
}

function readLevel(args: string[]): Level {
	const next = args[args.indexOf("--bump") + 1];
	if (next === "minor" || next === "major" || next === "patch") return next;
	if (next && !next.startsWith("--")) {
		throw new Error(`unknown bump level "${next}" — use patch, minor or major`);
	}
	return "patch";
}

const args = process.argv.slice(2);
const setIndex = args.indexOf("--set");

if (args.includes("--check")) {
	const pkg = readPackageVersion();
	const constant = readConstant();
	if (pkg !== constant) {
		console.error(
			`[uight] version drift: package.json is ${pkg}, ` +
				`src/shared/version.ts is ${constant}. Run: bun run version:sync`,
		);
		process.exit(1);
	}
	console.log(`uight ${pkg} — package.json and version.ts agree`);
} else if (setIndex !== -1) {
	const next = args[setIndex + 1];
	if (!next) throw new Error("--set needs a version");
	write(next);
	console.log(`uight ${next}`);
} else if (args.includes("--bump")) {
	const next = bump(readPackageVersion(), readLevel(args));
	write(next);
	console.log(`uight ${next}`);
} else if (args.includes("--sync")) {
	// package.json is the authority; the constant follows it.
	write(readPackageVersion());
	console.log(`uight ${readPackageVersion()}`);
} else {
	console.log(readPackageVersion());
}
