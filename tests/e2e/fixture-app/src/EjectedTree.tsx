/**
 * "An ejected component under host Tailwind" (§20.2, §11.3).
 *
 * Ejection means the source leaves our package and is compiled by the HOST's
 * Tailwind, inheriting the host's theme (§10.3). That has two failure modes a
 * browser can see and a unit test cannot:
 *
 *  1. the host's Tailwind does not scan our classes, so the component renders
 *     unstyled — asserted by reading a computed value the utilities produce;
 *  2. the host's preflight, or our scoped sheet, reaches the other's elements —
 *     asserted by checking the host page's serif `font-family` does NOT apply
 *     inside the packaged chrome and DOES apply nowhere it shouldn't.
 *
 * This is deliberately NOT a copy of `FixtureTree.tsx`: it uses only the token
 * names `src/styles/chrome-tokens.css` publishes plus stock Tailwind, which is
 * exactly what a real ejected item compiles down to.
 */

import type { FixtureTreeProps, TreeNode } from "uaight";
import { serializeFixtureId } from "uaight";

function rows(
	nodes: readonly TreeNode[],
	depth = 0,
	out: Array<{ node: TreeNode; depth: number }> = [],
) {
	for (const node of nodes) {
		if (node.kind === "component") continue;
		out.push({ node, depth });
		if (node.children?.length) rows(node.children, depth + 1, out);
	}
	return out;
}

export function EjectedTree({ nodes, selected, onSelect }: FixtureTreeProps) {
	const selectedKey = selected ? serializeFixtureId(selected) : null;
	return (
		<div
			role="tree"
			aria-label="Fixtures"
			data-e2e="ejected-tree"
			className="h-full overflow-auto bg-neutral-50 p-2 font-sans text-sm text-neutral-900"
		>
			{rows(nodes).map(({ node, depth }) => {
				const key = node.fixture ? serializeFixtureId(node.fixture) : node.key;
				return (
					<div
						key={node.key}
						role="treeitem"
						tabIndex={0}
						aria-selected={key === selectedKey}
						data-e2e-row={node.key}
						style={{ paddingLeft: `${depth * 12}px` }}
						className="cursor-pointer rounded-sm px-2 py-1 hover:bg-neutral-200 aria-selected:bg-neutral-300"
						onClick={() => node.fixture && onSelect(node.fixture)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && node.fixture) onSelect(node.fixture);
						}}
					>
						{node.label}
					</div>
				);
			})}
		</div>
	);
}
