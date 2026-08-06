/**
 * Bring the repository's own documents into the site, and the registry with it.
 *
 * The alternative — writing the spec twice — is the reason documentation sites
 * go stale. `SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md` and `CHANGELOG.md` are
 * maintained at the repository root because that is where the people changing
 * the code read them; this copies them in with a banner saying so.
 *
 * The registry copy is the other half of ROADMAP item 3: the emitted items
 * point at `https://uight.dev/r/…`. Serving them from the docs site's `public/`
 * is what makes that URL real, and puts the hosting on the same deploy as the
 * page that documents it.
 */

import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(here, "..");
const repoRoot = path.resolve(docsDir, "..");

interface Copied {
	from: string;
	to: string;
	title: string;
	note: string;
}

const DOCUMENTS: Copied[] = [
	{
		from: "SPEC.md",
		to: "src/reference/spec.md",
		title: "Spec",
		note: "The requirements document, and the source of truth for behaviour.",
	},
	{
		from: "ARCHITECTURE.md",
		to: "src/reference/architecture.md",
		title: "Architecture",
		note: "The integration contract: which module owns which symbol.",
	},
	{
		from: "ROADMAP.md",
		to: "src/reference/roadmap.md",
		title: "Roadmap",
		note: "What is left, and what each milestone after this canary holds.",
	},
	{
		from: "CHANGELOG.md",
		to: "src/reference/changelog.md",
		title: "Changelog",
		note: "What shipped in each release, with divergences and known limitations.",
	},
];

/** Copy a directory recursively. `fs.cp` is still experimental under Bun. */
async function copyDir(from: string, to: string): Promise<number> {
	let count = 0;
	await fsp.mkdir(to, { recursive: true });
	for (const entry of await fsp.readdir(from, { withFileTypes: true })) {
		const source = path.join(from, entry.name);
		const target = path.join(to, entry.name);
		if (entry.isDirectory()) count += await copyDir(source, target);
		else {
			await fsp.copyFile(source, target);
			count++;
		}
	}
	return count;
}

async function main(): Promise<void> {
	for (const doc of DOCUMENTS) {
		const source = await fsp.readFile(path.join(repoRoot, doc.from), "utf8");
		// A blockquote, not a VitePress `::: tip` container: these files are
		// rendered by `marked` now (see `src/site/markdown.ts`), which knows
		// CommonMark and GFM and nothing about a container syntax one generator
		// invented. Plain Markdown is also what makes the copy readable in the
		// checkout, which is where anyone editing it will be.
		const banner =
			`<!-- Copied from ${doc.from} by docs/scripts/sync.ts. Edit that file, not this one. -->\n\n` +
			`> **${doc.title}** — ${doc.note} Maintained at [\`${doc.from}\`]` +
			`(https://github.com/aussieljk/uight/blob/master/${doc.from}) in the repository.\n\n`;
		const target = path.join(docsDir, doc.to);
		await fsp.mkdir(path.dirname(target), { recursive: true });
		await fsp.writeFile(target, banner + source, "utf8");
		console.log(`  ${doc.from} → docs/${doc.to}`);
	}

	const registry = path.join(repoRoot, "packages/uight/registry");
	const publicRegistry = path.join(docsDir, "public/r");
	await fsp.rm(publicRegistry, { recursive: true, force: true });
	try {
		const files = await copyDir(registry, publicRegistry);
		console.log(`  registry → docs/public/r (${files} files)`);
	} catch {
		// A checkout that has not run `bun run --cwd packages/uight registry` yet.
		// The site still builds; only /r/ is missing, and the build says so.
		console.log("  registry → skipped (packages/uight/registry not built)");
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
