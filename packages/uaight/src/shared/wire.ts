/**
 * Wire helpers shared by both realms. SPEC.md §7.3, §7.4.
 *
 * The serializer itself lives in the renderer realm (uaight/runtime); what is
 * here is the part the UI realm also needs: path safety, patch application and
 * a plain-JS view of a Wire value for the control editors.
 */

import type { EditableWire, PathSegment, Patch, Wire } from "./types.ts";

/** Rejected outright at the transport boundary, before application. §7.3 */
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

export function isSafePath(path: readonly PathSegment[]): boolean {
	return path.every(
		(seg) =>
			(typeof seg === "number" && Number.isInteger(seg) && seg >= 0) ||
			(typeof seg === "string" && !FORBIDDEN.has(seg)),
	);
}

export function isEditableWire(w: Wire): w is EditableWire {
	return w.t !== "opaque";
}

export function pathKey(path: readonly PathSegment[]): string {
	return path.map((s) => (typeof s === "number" ? `[${s}]` : `.${s}`)).join("");
}

/** Read the Wire node at `path`, or `undefined` when the path is not present. */
export function wireAt(root: Wire, path: readonly PathSegment[]): Wire | undefined {
	let cur: Wire | undefined = root;
	for (const seg of path) {
		if (!cur) return undefined;
		if (cur.t === "array") {
			if (typeof seg !== "number" || seg < 0 || seg >= cur.v.length) return undefined;
			cur = cur.v[seg];
		} else if (cur.t === "object") {
			if (typeof seg !== "string") return undefined;
			const hit = cur.v.find(([k]) => k === seg);
			if (!hit) return undefined;
			cur = hit[1];
		} else {
			return undefined;
		}
	}
	return cur;
}

/**
 * Immutably set `value` at `path` inside a Wire tree, with structural sharing:
 * new nodes along the changed path only. Returns `null` when the path is not
 * present in the current shape — the caller drops the patch (§7.3).
 */
export function wireSet(
	root: Wire,
	path: readonly PathSegment[],
	value: EditableWire,
): Wire | null {
	if (path.length === 0) return value;
	const [head, ...rest] = path as [PathSegment, ...PathSegment[]];

	if (root.t === "array") {
		if (typeof head !== "number" || head < 0 || head >= root.v.length) return null;
		const child = root.v[head]!;
		const next = wireSet(child, rest, value);
		if (next === null) return null;
		const arr = root.v.slice();
		arr[head] = next;
		return { t: "array", v: arr };
	}

	if (root.t === "object") {
		if (typeof head !== "string") return null;
		const idx = root.v.findIndex(([k]) => k === head);
		if (idx === -1) return null;
		const next = wireSet(root.v[idx]![1], rest, value);
		if (next === null) return null;
		const entries = root.v.slice();
		entries[idx] = [head, next];
		return { t: "object", v: entries };
	}

	return null;
}

export interface ApplyResult {
	wire: Wire;
	dropped: number;
}

/** Apply an overlay's patches to a freshly serialized default. §7.2 step 4. */
export function applyPatches(base: Wire, patches: readonly Patch[]): ApplyResult {
	let wire = base;
	let dropped = 0;
	for (const patch of patches) {
		if (!isSafePath(patch.path)) {
			dropped++;
			continue;
		}
		const next = wireSet(wire, patch.path, patch.value);
		if (next === null) dropped++;
		else wire = next;
	}
	return { wire, dropped };
}

/**
 * Merge a new patch into an existing patch list: a patch at a path replaces any
 * previous patch at that path or beneath it, since the deeper values are now
 * part of the newly written subtree.
 */
export function mergePatch(patches: readonly Patch[], patch: Patch): Patch[] {
	const key = pathKey(patch.path);
	const kept = patches.filter((p) => {
		const k = pathKey(p.path);
		return !(k === key || k.startsWith(key === "" ? "" : key + ".") || (key !== "" && k.startsWith(key + "[")));
	});
	// A root patch supersedes everything.
	if (patch.path.length === 0) return [patch];
	return [...kept, patch];
}

/** Structural equality for wire values; used to detect revision changes. */
export function wireEqual(a: Wire, b: Wire): boolean {
	if (a.t !== b.t) return false;
	switch (a.t) {
		case "prim":
			return a.v === (b as typeof a).v;
		case "undef":
			return true;
		case "bigint":
			return a.v === (b as typeof a).v;
		case "array": {
			const bb = b as typeof a;
			return a.v.length === bb.v.length && a.v.every((x, i) => wireEqual(x, bb.v[i]!));
		}
		case "object": {
			const bb = b as typeof a;
			return (
				a.v.length === bb.v.length &&
				a.v.every(([k, x], i) => bb.v[i]![0] === k && wireEqual(x, bb.v[i]![1]))
			);
		}
		case "codec": {
			const bb = b as typeof a;
			return a.codec === bb.codec && JSON.stringify(a.v) === JSON.stringify(bb.v);
		}
		case "opaque":
			return a.label === (b as typeof a).label;
	}
}
