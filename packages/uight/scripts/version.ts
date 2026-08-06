/**
 * Release versioning — `0.0.1-canary.N`.
 *
 * Two files carry the version and they must never disagree: `package.json` is
 * what npm publishes, and `src/shared/version.ts` is what the runtime compares
 * against the plugin at §16.2. A drifted constant surfaces to users as
 * "one of them is a stale build artefact", which is a confusing way to learn
 * that a release script forgot a file.
 *
 * The counter is the only part that moves. `--bump` refuses anything that is
 * not in the series, so no automated path can walk the version off it; leaving
 * it takes a deliberate `--set` by hand. Every release still goes out under the
 * `latest` tag, so a plain `npm i @aussieljk/uight` gets the newest canary
 * rather than whichever one happened to be published first.
 *
 *   bun run scripts/version.ts            # print the current version
 *   bun run scripts/version.ts --bump     # 0.0.1-canary.3 → 0.0.1-canary.4
 *   bun run scripts/version.ts --set X    # set an explicit version
 *   bun run scripts/version.ts --check    # exit 1 if the two disagree
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(here, "..", "package.json");
const versionPath = path.join(here, "..", "src", "shared", "version.ts");

export const CANARY = /^(\d+\.\d+\.\d+)-canary\.(\d+)$/;

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

/** `0.0.1-canary.3` → `0.0.1-canary.4`. A non-canary version is an error. */
function bump(current: string): string {
	const match = CANARY.exec(current);
	if (!match) {
		throw new Error(
			`${current} is not a canary version. --bump only moves the canary counter; ` +
				`use --set to leave the 0.0.1-canary.N series.`,
		);
	}
	return `${match[1]}-canary.${Number(match[2]) + 1}`;
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
	const next = bump(readPackageVersion());
	write(next);
	console.log(`uight ${next}`);
} else if (args.includes("--sync")) {
	// package.json is the authority; the constant follows it.
	write(readPackageVersion());
	console.log(`uight ${readPackageVersion()}`);
} else {
	console.log(readPackageVersion());
}
