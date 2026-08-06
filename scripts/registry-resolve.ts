/**
 * Q8 — does a real `shadcn add` resolve from our registry? SPEC.md §11.1.
 *
 *   bun run scripts/registry-resolve.ts              # local files over loopback
 *   bun run scripts/registry-resolve.ts --deployed   # https://uight.dev/r
 *   bun run scripts/registry-resolve.ts --json
 *
 * §11.1 says the registry example "is not considered correct until this
 * passes", and it means something specific: not that our own reader can read
 * our own files, but that **shadcn's resolver** can. Those are different
 * claims, and only the second one is what a user runs.
 *
 * So this drives the real CLI. It builds a scratch project with a
 * `components.json` whose `registries` entry points at a `{name}` URL template,
 * runs `shadcn add` for every published item, and then checks what landed on
 * disk. Everything it asserts is a thing that has actually been observed to
 * break:
 *
 *   - **Resolution.** The item is reachable and its schema validates. shadcn
 *     rejects an item carrying the index schema, which §11.2 got wrong once.
 *   - **Transitive `registryDependencies`.** `control-panel` must bring
 *     `control-panel-inputs` with it, dependencies-first.
 *   - **Companion files.** A component's non-registry helpers (`cx.ts`,
 *     `wire-view.ts`) must arrive too, or the install compiles to nothing.
 *   - **Targets.** `registry:file` entries carry an explicit `target`, and the
 *     token stylesheet has to land where it says.
 *   - **Specifiers.** Nothing may still point at this repository's layout. An
 *     unrewritten `../../shared/types.ts` resolves, installs, and then fails to
 *     compile — which is how that defect survived the first attempt at this.
 *   - **The licence header (§11.4).** shadcn's import rewrite discards a file's
 *     leading trivia, so a header on line 1 does not survive the trip. This is
 *     the check that found that, and `withHeader` is the fix.
 *
 * **Why a script rather than a test.** The repository has no test runner, by
 * decision (§20). This is a gate in the same shape as `scripts/bench.ts`: it
 * runs in CI, it exits non-zero, and it says which claim failed. What it needs
 * that a unit test could not have is a real network stack and a real CLI.
 *
 * **Offline.** The default mode serves `packages/uight/registry/` from a
 * loopback server, so the resolution path is exercised without depending on a
 * deploy. `--deployed` is the stronger claim and the one that goes stale — it
 * checks the files a user actually downloads — and is run deliberately rather
 * than on every commit.
 */

import { createServer } from "node:http";
import type { Server } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_DIR = path.join(ROOT, "packages/uight/registry");
const DEPLOYED = "https://uight.dev/r";

/**
 * The items installed, and what each one must drag along with it.
 *
 * Not every published item — the point is coverage of the *mechanisms*, and
 * three items cover all of them. `control-panel` is the transitive case,
 * `fixture-tree` the companion case, `prop-table` the plain case. Adding the
 * other six would multiply the runtime of a network-bound check without
 * testing anything new.
 */
const CASES = [
	{ item: "fixture-tree", expect: ["FixtureTree.tsx", "cx.ts"] },
	{
		item: "control-panel",
		expect: ["ControlPanel.tsx", "ControlPanelInputs.tsx", "wire-view.ts", "dropped.ts"],
	},
	{ item: "prop-table", expect: ["PropTable.tsx"] },
] as const;

/** Where §11.2's `registry:file` target says the tokens go. */
const TOKENS = "styles/uight-chrome.css";

interface Failure {
	claim: string;
	detail: string;
}

/* ------------------------------------------------------------------ *
 * A registry over loopback
 * ------------------------------------------------------------------ */

/**
 * Loopback only, and on an ephemeral port.
 *
 * `127.0.0.1` rather than `0.0.0.0` because this serves a directory of the
 * repository: a check that runs on a laptop on a café network should not put
 * the working tree on that network for the duration.
 */
function serveRegistry(): Promise<{ origin: string; close: () => Promise<void> }> {
	const server: Server = createServer((req, res) => {
		const name = path.basename(new URL(req.url ?? "/", "http://x").pathname);
		const file = path.join(REGISTRY_DIR, name);
		if (!file.startsWith(REGISTRY_DIR) || !existsSync(file)) {
			res.writeHead(404).end("not found");
			return;
		}
		res.writeHead(200, { "content-type": "application/json" });
		res.end(readFileSync(file));
	});

	return new Promise((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : 0;
			resolve({
				origin: `http://127.0.0.1:${String(port)}`,
				close: () =>
					new Promise<void>((done) => {
						server.close(() => done());
					}),
			});
		});
	});
}

/* ------------------------------------------------------------------ *
 * The scratch project
 * ------------------------------------------------------------------ */

function scaffold(dir: string, registryTemplate: string): void {
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(path.join(dir, "src"), { recursive: true });

	const write = (file: string, body: unknown): void => {
		writeFileSync(
			path.join(dir, file),
			typeof body === "string" ? body : `${JSON.stringify(body, null, "\t")}\n`,
		);
	};

	write("package.json", {
		name: "uight-registry-check",
		private: true,
		type: "module",
	});

	// `paths` matters: shadcn resolves the `@/…` aliases in components.json
	// against it, and an item that installs to an unresolvable alias type-checks
	// as a missing module rather than as the defect it is.
	write("tsconfig.json", {
		compilerOptions: {
			target: "ES2022",
			lib: ["ES2022", "DOM", "DOM.Iterable"],
			module: "ESNext",
			moduleResolution: "bundler",
			jsx: "react-jsx",
			strict: true,
			noEmit: true,
			skipLibCheck: true,
			baseUrl: ".",
			paths: { "@/*": ["./src/*"] },
		},
		include: ["src"],
	});

	// §11.1's first installation path: a configured namespace. The second —
	// a bare URL to the item — is exercised below without this entry.
	write("components.json", {
		$schema: "https://ui.shadcn.com/schema.json",
		style: "new-york",
		rsc: false,
		tsx: true,
		tailwind: {
			config: "",
			css: "src/styles.css",
			baseColor: "neutral",
			cssVariables: true,
		},
		aliases: {
			components: "@/components",
			utils: "@/lib/utils",
			ui: "@/components/ui",
			lib: "@/lib",
			hooks: "@/hooks",
		},
		registries: { "@uight": `${registryTemplate}/{name}.json` },
	});

	write("src/styles.css", "");
}

async function shadcnAdd(dir: string, spec: string): Promise<string> {
	const proc = Bun.spawn(
		["bunx", "--bun", "shadcn@latest", "add", spec, "--yes", "--overwrite"],
		{
			cwd: dir,
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [out, err] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const code = await proc.exited;
	if (code !== 0)
		throw new Error(`shadcn add ${spec} exited ${String(code)}\n${out}\n${err}`);
	return out + err;
}

/* ------------------------------------------------------------------ *
 * The claims
 * ------------------------------------------------------------------ */

function findInstalled(dir: string, base: string): string | null {
	for (const candidate of [
		path.join(dir, "src/components", base),
		path.join(dir, "src/components/ui", base),
		path.join(dir, "src/components/uight", base),
		path.join(dir, "src/lib", base),
	]) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

function checkInstalled(dir: string, failures: Failure[]): void {
	for (const { item, expect } of CASES) {
		for (const base of expect) {
			const file = findInstalled(dir, base);
			if (!file) {
				failures.push({
					claim: `${item} installs ${base}`,
					detail: "not found under any components.json alias",
				});
				continue;
			}

			const source = readFileSync(file, "utf8");

			// §11.4 — the header has to survive the CLI, not merely be published.
			if (!source.includes("ejected from uight")) {
				failures.push({
					claim: `${base} keeps its licence header (§11.4)`,
					detail: "installed file carries no header — shadcn strips leading trivia",
				});
			}

			// Nothing may still point at this repository's layout.
			const escaping = /from\s+["'](\.\.\/\.\.\/|\.\.\/[a-z-]+\/)/.exec(source);
			if (escaping) {
				failures.push({
					claim: `${base} has no unrewritten specifier`,
					detail: `still imports ${escaping[1] ?? ""}…`,
				});
			}

			// The only uight import an ejected file may carry is the frozen one.
			for (const match of source.matchAll(/from\s+["'](@aussieljk\/uight[^"']*)["']/g)) {
				const specifier = match[1] ?? "";
				if (specifier !== "@aussieljk/uight/chrome") {
					failures.push({
						claim: `${base} imports only the frozen surface (§11.4)`,
						detail: `imports ${specifier}`,
					});
				}
			}
		}
	}

	// §11.2 — a `registry:file` entry carries an explicit target.
	if (!existsSync(path.join(dir, TOKENS))) {
		failures.push({
			claim: "the token stylesheet lands on its target (§11.2)",
			detail: `expected ${TOKENS}`,
		});
	}
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const deployed = argv.includes("--deployed");
	const json = argv.includes("--json");
	const dir = path.join(ROOT, "node_modules/.uight-registry-check");

	if (!existsSync(REGISTRY_DIR)) {
		console.error(
			"[uight] no registry to resolve. Run `bun run --cwd packages/uight registry` first.",
		);
		process.exit(1);
	}

	const served = deployed ? null : await serveRegistry();
	const origin = served?.origin ?? DEPLOYED;
	const failures: Failure[] = [];

	try {
		scaffold(dir, origin);

		for (const { item } of CASES) {
			await shadcnAdd(dir, `@uight/${item}`);
		}

		// §11.1's second path: the bare URL, for a project with no namespace
		// configured. It must install the same item without `registries`.
		const bare = path.join(ROOT, "node_modules/.uight-registry-check-bare");
		scaffold(bare, origin);
		rmSync(path.join(bare, "components.json"));
		writeFileSync(
			path.join(bare, "components.json"),
			`${JSON.stringify(
				{
					$schema: "https://ui.shadcn.com/schema.json",
					style: "new-york",
					rsc: false,
					tsx: true,
					tailwind: {
						config: "",
						css: "src/styles.css",
						baseColor: "neutral",
						cssVariables: true,
					},
					aliases: { components: "@/components", utils: "@/lib/utils" },
				},
				null,
				"\t",
			)}\n`,
		);
		try {
			await shadcnAdd(bare, `${origin}/prop-table.json`);
			if (!findInstalled(bare, "PropTable.tsx")) {
				failures.push({
					claim: "a bare item URL installs without a namespace (§11.1)",
					detail: "PropTable.tsx not found",
				});
			}
		} catch (error) {
			failures.push({
				claim: "a bare item URL installs without a namespace (§11.1)",
				detail: error instanceof Error ? (error.message.split("\n")[0] ?? "") : String(error),
			});
		}

		checkInstalled(dir, failures);
	} catch (error) {
		failures.push({
			claim: "shadcn add resolves from the registry",
			detail: error instanceof Error ? error.message : String(error),
		});
	} finally {
		await served?.close();
	}

	const source = deployed ? DEPLOYED : "local files over loopback";
	if (json) {
		console.log(
			JSON.stringify({ source, ok: failures.length === 0, failures }, null, "\t"),
		);
	} else if (failures.length === 0) {
		console.log(`[uight] registry resolves via a real \`shadcn add\` — ${source}`);
		console.log(
			`  ${String(CASES.length)} items, transitive dependencies, companions, targets, ` +
				"headers and specifiers all check out.",
		);
	} else {
		console.error(`[uight] registry resolution FAILED — ${source}\n`);
		for (const failure of failures) {
			console.error(`  ✗ ${failure.claim}\n    ${failure.detail}`);
		}
	}

	process.exit(failures.length === 0 ? 0 : 1);
}

await main();
