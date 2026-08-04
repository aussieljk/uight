/**
 * Tree construction. `TreeNode` is stable (§19.5); its production is not
 * (§19.7), so this module is internal.
 */

import { matchesFilter } from "./filter.ts";
import { serializeFixtureId } from "./fixture-id.ts";
import { ALL_FIXTURES } from "./types.ts";
import type {
	Filter,
	FixtureFileIndex,
	FixtureId,
	InventoryItem,
	TreeNode,
} from "./types.ts";

interface DirNode {
	dirs: Map<string, DirNode>;
	files: FixtureFileIndex[];
	components: InventoryItem[];
}

function emptyDir(): DirNode {
	return { dirs: new Map(), files: [], components: [] };
}

function insert(root: DirNode, segments: string[], apply: (d: DirNode) => void): void {
	let cur = root;
	for (const seg of segments) {
		let next = cur.dirs.get(seg);
		if (!next) {
			next = emptyDir();
			cur.dirs.set(seg, next);
		}
		cur = next;
	}
	apply(cur);
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * `dirName` is the directory the file sits in. `components/quote/quote.stories`
 * is the near-universal convention, and a file named after its own directory
 * must not contribute a second row saying the same word.
 */
function fileNodes(file: FixtureFileIndex, dirName: string): TreeNode {
	const label = file.path.split("/").pop() ?? file.path;
	const selfTitled = label === dirName;

	if (file.names === null) {
		// Undecidable: one node per file until the module is loaded. §3.5
		const fixture: FixtureId = { path: file.path, name: null };
		return {
			key: file.path,
			label,
			kind: "file",
			fixture,
			undecidable: true,
		};
	}

	if (file.names.length === 1 && file.names[0] === null) {
		const fixture: FixtureId = { path: file.path, name: null };
		return { key: serializeFixtureId(fixture), label, kind: "fixture", fixture };
	}

	const children: TreeNode[] = file.names.map((name) => {
		const fixture: FixtureId = { path: file.path, name };
		return {
			key: serializeFixtureId(fixture),
			// A `null` entry among named siblings is the file's own default export.
			label: name === null ? label : name === "" ? "(empty name)" : name,
			kind: "fixture" as const,
			fixture,
		};
	});

	if (children.length === 1) {
		// A single named fixture still deserves its own leaf, but nesting one
		// child under a file node is noise. When the file is self-titled the
		// directory row already says the name, so the leaf keeps it and collapses
		// into that row rather than repeating it.
		const only = children[0]!;
		return { ...only, label: selfTitled ? label : `${label} / ${only.label}` };
	}

	// The file itself is selectable and renders every fixture in it as one page.
	// Its children stay in the tree so search can reach an individual fixture and
	// so the toolbar can list them, but the sidebar draws the file as a leaf.
	return {
		key: file.path,
		label,
		kind: "file",
		fixture: { path: file.path, name: ALL_FIXTURES },
		children,
	};
}

function toNodes(dir: DirNode, prefix: string): TreeNode[] {
	const nodes: TreeNode[] = [];

	for (const [name, child] of [...dir.dirs].sort((a, b) => collator.compare(a[0], b[0]))) {
		const path = prefix ? `${prefix}/${name}` : name;
		const children = toNodes(child, path);
		if (!children.length) continue;

		// `components/accordion/accordion.stories.tsx` is the near-universal
		// convention, and it produced a directory and a file with the same label
		// nested one inside the other — two rows of chrome saying one thing.
		// Any single child already carrying the directory's name IS the directory
		// as far as a reader is concerned, whether it is a file of stories or a
		// lone fixture. Either way, one row.
		const only = children.length === 1 ? children[0]! : undefined;
		if (only && only.kind !== "dir" && only.label === name) {
			nodes.push(only);
			continue;
		}

		nodes.push({ key: `dir:${path}`, label: name, kind: "dir", children });
	}

	const dirName = prefix.split("/").pop() ?? "";
	for (const file of [...dir.files].sort((a, b) => collator.compare(a.path, b.path))) {
		nodes.push(fileNodes(file, dirName));
	}

	for (const item of [...dir.components].sort((a, b) => collator.compare(a.name, b.name))) {
		nodes.push({
			key: `component:${item.globPath}#${item.exportName}`,
			label: item.name,
			kind: "component",
			component: item,
		});
	}

	return nodes;
}

export interface BuildTreeOptions {
	files: FixtureFileIndex[];
	inventory?: InventoryItem[];
	filter?: Filter;
	caseSensitive?: boolean;
	/** Hide inventory entries whose module already contributes fixtures. */
	mergeInventory?: boolean;
}

export function buildTree(options: BuildTreeOptions): TreeNode[] {
	const { files, inventory = [], filter, caseSensitive = true } = options;
	const root = emptyDir();

	const covered = new Set<string>();
	for (const file of files) {
		if (!matchesFilter(file.path, filter, caseSensitive)) continue;
		const segments = file.path.split("/");
		const dir = segments.slice(0, -1);
		covered.add(dir.join("/"));
		insert(root, dir, (d) => d.files.push(file));
	}

	for (const item of inventory) {
		if (!matchesFilter(item.path, filter, caseSensitive)) continue;
		const segments = item.path.split("/");
		insert(root, segments.slice(0, -1), (d) => d.components.push(item));
	}

	return toNodes(root, "");
}

/** Depth-first flatten of the visible leaves, for next()/previous(). */
export function flattenSelectable(nodes: readonly TreeNode[]): TreeNode[] {
	const out: TreeNode[] = [];
	const walk = (list: readonly TreeNode[]) => {
		for (const node of list) {
			if (node.kind === "fixture" || node.kind === "component") out.push(node);
			else if (node.kind === "file" && node.fixture) out.push(node);
			if (node.children) walk(node.children);
		}
	};
	walk(nodes);
	return out;
}

/** Case-insensitive substring search over labels and full paths. */
export function searchTree(nodes: readonly TreeNode[], query: string): TreeNode[] {
	const q = query.trim().toLowerCase();
	if (!q) return nodes as TreeNode[];

	const filterNode = (node: TreeNode): TreeNode | null => {
		const haystack = `${node.label} ${node.fixture?.path ?? ""} ${node.component?.path ?? ""}`;
		const selfHit = haystack.toLowerCase().includes(q);
		if (!node.children) return selfHit ? node : null;
		const children = node.children.map(filterNode).filter((n): n is TreeNode => n !== null);
		if (children.length) return { ...node, children };
		return selfHit ? node : null;
	};

	return nodes.map(filterNode).filter((n): n is TreeNode => n !== null);
}
