/**
 * Release versioning — `0.0.1-canary.N`.
 *
 * `package.json` and `UAIGHT_VERSION` are compared by the runtime at §16.2, and
 * a mismatch is reported to users as "one of them is a stale build artefact".
 * That is a confusing way to discover that a release script skipped a file, so
 * the lockstep is asserted rather than remembered.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { UAIGHT_VERSION } from "../src/shared/version.ts";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf8")) as {
	version: string;
	exports: Record<string, unknown>;
	bin: Record<string, string>;
	files: string[];
};

describe("version", () => {
	it("agrees with package.json", () => {
		expect(UAIGHT_VERSION).toBe(pkg.version);
	});

	it("is a canary of the 0.0.1-canary.N series", () => {
		expect(pkg.version).toMatch(/^0\.0\.1-canary\.\d+$/);
	});
});

describe("what the package publishes", () => {
	it("exports every entry the docs name", () => {
		for (const entry of [
			".",
			"./vite",
			"./runtime",
			"./chrome",
			"./test",
			"./mcp",
			"./client",
		]) {
			expect(pkg.exports[entry], `missing export ${entry}`).toBeTruthy();
		}
	});

	it("ships the binaries it declares", () => {
		for (const [name, file] of Object.entries(pkg.bin)) {
			expect(
				fs.existsSync(path.join(PKG_ROOT, file)),
				`bin ${name} points at a missing file: ${file}`,
			).toBe(true);
		}
	});

	it("includes the bin directory in files, or the binaries would not ship", () => {
		expect(pkg.files).toContain("bin");
	});
});
