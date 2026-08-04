/**
 * Resolving the registry the way `shadcn add` resolves it. SPEC.md §11.1, Q8.
 *
 * §11.1 asks for proof rather than plausibility, and `tests/registry.test.ts`
 * only proves the *shape*: that dependencies are namespaced, that files have
 * targets, that headers are present. Every one of those could hold in a
 * registry no client can consume.
 *
 * So this test is a client. It serves `registry/` over a real HTTP server on a
 * loopback port and walks it the way shadcn does: resolve a `{name}` URL
 * template from a `components.json`-shaped registry entry, fetch the item, read
 * its `registryDependencies`, resolve each of those the same way, then write
 * every `files[]` entry to the place its `target` (or its type) says. What comes
 * out is the file tree a `shadcn add` would leave behind.
 *
 * **What this does not prove**, and no local test can: that the items are
 * reachable at `https://uaight.dev/r/…`, which is what the versioned copies
 * point at and what nobody has ever hosted; and that shadcn's own resolver —
 * its schema validation, its `components.json` path aliasing, its dependency
 * installer — accepts them. Q8 stays open on both counts. This closes the part
 * that is a property of the files.
 */

import { createServer } from "node:http";
import type { Server } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = path.join(PKG, "registry");

/* ------------------------------------------------------------------ *
 * A static server over registry/
 * ------------------------------------------------------------------ */

let server: Server;
let base: string;

beforeAll(async () => {
	server = createServer((req, res) => {
		const name = (req.url ?? "/").split("?")[0] ?? "/";
		const file = path.join(REGISTRY, path.normalize(name).replace(/^(\.\.[/\\])+/, ""));
		if (!file.startsWith(REGISTRY) || !existsSync(file)) {
			res.statusCode = 404;
			res.end("not found");
			return;
		}
		res.statusCode = 200;
		res.setHeader("Content-Type", "application/json");
		res.end(readFileSync(file));
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(async () => {
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

/* ------------------------------------------------------------------ *
 * The client — what `shadcn add` does
 * ------------------------------------------------------------------ */

interface RegistryFile {
	path: string;
	type: string;
	target?: string;
	content?: string;
}

interface Item {
	$schema?: string;
	name: string;
	type: string;
	dependencies?: string[];
	registryDependencies?: string[];
	files: RegistryFile[];
}

/**
 * The `registries` entry a consumer writes in `components.json`:
 *
 *     { "registries": { "@uaight": "<base>/{name}.json" } }
 */
const template = (): string => `${base}/{name}.json`;

async function fetchItem(name: string): Promise<Item> {
	const url = name.startsWith("http")
		? name
		: template().replace("{name}", name.replace(/^@uaight\//, ""));
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${url} → ${response.status}`);
	return (await response.json()) as Item;
}

/** Follow `registryDependencies` transitively, as shadcn does, without cycling. */
async function resolveTree(name: string): Promise<Item[]> {
	const seen = new Set<string>();
	const out: Item[] = [];

	const visit = async (id: string): Promise<void> => {
		if (seen.has(id)) return;
		seen.add(id);
		const item = await fetchItem(id);
		for (const dep of item.registryDependencies ?? []) await visit(dep);
		out.push(item);
	};

	await visit(name);
	return out;
}

/**
 * Where a file lands. shadcn honours an explicit `target`, expanding a leading
 * `~/` to the project root; without one it derives the path from the type.
 */
function targetPath(project: string, file: RegistryFile): string {
	if (file.target) {
		return path.join(project, file.target.replace(/^~[/\\]/, ""));
	}
	return path.join(project, "components", file.path);
}

function install(project: string, items: Item[]): string[] {
	const written: string[] = [];
	for (const item of items) {
		for (const file of item.files) {
			const destination = targetPath(project, file);
			mkdirSync(path.dirname(destination), { recursive: true });
			writeFileSync(destination, file.content ?? "");
			written.push(path.relative(project, destination));
		}
	}
	return written;
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

const built = existsSync(path.join(REGISTRY, "registry.json"));

describe.skipIf(!built)("resolving the registry as a client", () => {
	it("serves the index, which names every item", async () => {
		const index = (await (await fetch(`${base}/registry.json`)).json()) as {
			$schema: string;
			name: string;
			items: Item[];
		};

		// The index carries the *index* schema. Its items carry the item schema,
		// which is the divergence §11.2 used to specify wrongly.
		expect(index.$schema).toBe("https://ui.shadcn.com/schema/registry.json");
		expect(index.name).toBe("uaight");
		expect(index.items.length).toBeGreaterThan(0);
	});

	it("resolves every published item by its {name} URL", async () => {
		const index = (await (await fetch(`${base}/registry.json`)).json()) as {
			items: Array<{ name: string }>;
		};

		for (const entry of index.items) {
			const item = await fetchItem(entry.name);
			expect(item.name).toBe(entry.name);
			// An item carrying the index schema does not validate against shadcn's.
			expect(item.$schema).toBe("https://ui.shadcn.com/schema/registry-item.json");
			expect(item.type).toMatch(/^registry:/);
		}
	});

	it("resolves a namespaced registryDependency the way a consumer's registries map would", async () => {
		// `control-panel` is the one item with a real dependency. A bare
		// `control-panel-inputs` would have resolved against shadcn's registry.
		const tree = await resolveTree("control-panel");
		const names = tree.map((item) => item.name);

		expect(names).toContain("control-panel-inputs");
		expect(names).toContain("control-panel");
		// Dependencies before dependents, which is the order an installer needs.
		expect(names.indexOf("control-panel-inputs")).toBeLessThan(
			names.indexOf("control-panel"),
		);
	});

	it("installs into a scratch project, producing the tree shadcn add would leave", async () => {
		const project = mkdtempSync(path.join(tmpdir(), "uaight-shadcn-"));
		try {
			const written = install(project, await resolveTree("control-panel"));

			// The component lands under the components directory…
			expect(written).toContain(path.join("components", "ui/control-panel/ControlPanel.tsx"));
			// …and the token stylesheet lands where its `target` says, which is what
			// makes the ejected Tailwind compile at all (§10.3).
			expect(written).toContain(path.join("styles", "uaight-chrome.css"));

			const source = readFileSync(
				path.join(project, "components", "ui/control-panel/ControlPanel.tsx"),
				"utf8",
			);
			// §11.4: repository-level licensing does not travel; the file says so.
			expect(source).toContain("MIT licence");
			expect(source).toContain("useUaightChrome()");
			expect(source.length).toBeGreaterThan(200);

			const tokens = readFileSync(path.join(project, "styles", "uaight-chrome.css"), "utf8");
			expect(tokens).toContain("--uaight-fg");
		} finally {
			rmSync(project, { recursive: true, force: true });
		}
	});

	it("has no item whose files would land outside the project", async () => {
		const project = "/scratch";
		const index = (await (await fetch(`${base}/registry.json`)).json()) as {
			items: Array<{ name: string }>;
		};

		for (const entry of index.items) {
			for (const file of (await fetchItem(entry.name)).files) {
				expect(targetPath(project, file).startsWith(project)).toBe(true);
			}
		}
	});

	it("pins the versioned copies to absolute URLs, which a namespace cannot express", async () => {
		const versioned = JSON.parse(
			readFileSync(path.join(REGISTRY, "v0.0", "control-panel.json"), "utf8"),
		) as Item;

		for (const dep of versioned.registryDependencies ?? []) {
			expect(dep).toMatch(/^https:\/\//);
			// §11.1: items may only be combined within one minor.
			expect(dep).toContain("/v0.0/");
		}
	});
});
