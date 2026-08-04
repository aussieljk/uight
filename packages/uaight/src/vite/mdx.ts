/**
 * MDX fixtures. SPEC.md §14.
 *
 * §14 is deliberate about the division: "upstream implements this purely as
 * bundler configuration — `@mdx-js/rollup` plus the extension — so it is a glob
 * pattern and a transform, not a server feature", and "we do not compile
 * arbitrary docs pages". The plugin's half is the glob pattern (`.mdx` is in
 * `FIXTURE_EXTENSIONS`) and the rule that an `.mdx` module is exactly one
 * fixture. Compiling it is the host's plugin.
 *
 * What §14 does *not* say is that we should stay silent when the host has not
 * set that up. "We do not try to detect whether the host already has an MDX
 * plugin" was written about *inferring configuration* — about reordering or
 * injecting plugins behind the user's back, which remains out of the question.
 * Reading the resolved plugin list and saying what is missing is the opposite
 * of inferring: it turns an unreadable `Unexpected token` from inside Rollup
 * into one sentence naming the plugin and the install command.
 *
 * So: nothing is injected, nothing is reordered, and the check runs only when
 * the project actually has `.mdx` fixtures for it to be about.
 *
 * **Ordering is deliberately not checked, and that is a finding.** The obvious
 * check — "is the MDX plugin before the React plugin, since MDX emits JSX" —
 * produces a false positive on every correctly configured project. Vite sorts
 * by `enforce` before array order, and `@vitejs/plugin-react`'s `vite:react-babel`
 * is a `pre` plugin, so a plain `mdx()` **always** lands after it no matter what
 * the user wrote. Verified against the demo: with `plugins: [mdx(), react(),
 * uaight()]` the resolved order is `vite:react-babel … @mdx-js/rollup … uaight`,
 * and `.mdx` transforms correctly anyway — the JSX that MDX produces is handled
 * by Vite's own JSX pipeline downstream, not by the `pre` plugin that ran before
 * it. There is therefore no ordering mistake for a user to make here, and a
 * check for one would only ever be wrong.
 */

import type { FixtureIndex } from "../shared/types.ts";

/** Plugin names that compile `.mdx`. `@mdx-js/rollup` names itself. */
const MDX_PLUGIN_NAMES = ["@mdx-js/rollup", "vite-plugin-mdx", "mdx"];

export interface MdxAdvice {
	/** Only one kind today: no MDX plugin is installed. See the ordering note above. */
	kind: "missing";
	message: string;
}

/**
 * Look at the resolved plugin list and say what is missing, or nothing.
 *
 * `pluginNames` is `ResolvedConfig["plugins"]` reduced to names — the whole of
 * what is needed, and a shape a test can supply without constructing Vite.
 */
export function checkMdxSupport(
	pluginNames: readonly string[],
	index: FixtureIndex,
): MdxAdvice | null {
	const mdxFiles = index.files.filter((file) => file.globPath.endsWith(".mdx"));
	if (mdxFiles.length === 0) return null;

	const hasMdx = pluginNames.some((name) =>
		MDX_PLUGIN_NAMES.some((candidate) => name === candidate || name.includes(candidate)),
	);
	if (hasMdx) return null;

	const count = mdxFiles.length;
	const pages = mdxFiles.filter((file) => file.docsPage).length;
	// A project with docs pages and no MDX plugin has a broken docs site, not a
	// broken fixture — naming the wrong one sends them looking in the wrong place.
	const what =
		pages === count
			? `MDX documentation page${count === 1 ? "" : "s"}`
			: pages > 0
				? `MDX files (${count - pages} fixture${count - pages === 1 ? "" : "s"}, ${pages} docs page${pages === 1 ? "" : "s"})`
				: `MDX fixture${count === 1 ? "" : "s"}`;
	return {
		kind: "missing",
		message:
			`[uaight] found ${count} ${what} ` +
			`(e.g. ${mdxFiles[0]?.globPath ?? ""}) but no MDX plugin is installed, so Vite ` +
			`cannot compile them. §14: MDX is bundler configuration, not a uaight feature — ` +
			`so uaight indexes the file and the host compiles it. Add one:\n` +
			`    bun add -D @mdx-js/rollup\n` +
			`    import mdx from "@mdx-js/rollup";\n` +
			`    plugins: [mdx(), react(), uaight()]`,
	};
}
