/**
 * Plain-JS views of a `Wire` value, for the control editors. SPEC.md §7.4, §7.5.
 *
 * The panel never sees a fixture value — only wires — so every editor is a
 * function of `Wire` and every edit produces an `EditableWire`. Opaque leaves
 * are display-only by type (§7.2), which is the whole reason they can never
 * end up in a patch.
 */

import type { EditableWire, PathSegment, Wire } from "../shared/types.ts";

export type ControlShape =
	| "text"
	| "textarea"
	| "number"
	| "range"
	| "checkbox"
	| "select"
	| "radio"
	| "date"
	| "color"
	| "json"
	| "bigint"
	| "undefined"
	| "codec"
	| "opaque"
	| "branch";

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** What kind of editor a wire node wants when `control` is 'auto' or absent. */
export function shapeOf(wire: Wire, hasOptions: boolean): ControlShape {
	if (hasOptions) return "select";
	switch (wire.t) {
		case "prim":
			if (typeof wire.v === "boolean") return "checkbox";
			if (typeof wire.v === "number") return "number";
			if (typeof wire.v === "string") {
				if (HEX_COLOR.test(wire.v)) return "color";
				if (wire.v.length > 60 || wire.v.includes("\n")) return "textarea";
				return "text";
			}
			return "text"; // null
		case "bigint":
			return "bigint";
		case "undef":
			return "undefined";
		case "codec":
			return "codec";
		case "opaque":
			return "opaque";
		case "array":
		case "object":
			return "branch";
	}
}

export function isBranch(wire: Wire): wire is Extract<Wire, { t: "array" | "object" }> {
	return wire.t === "array" || wire.t === "object";
}

/** Children of a branch, as `[segment, label, wire]`. */
export function childrenOf(wire: Wire): Array<[PathSegment, string, Wire]> {
	if (wire.t === "array") return wire.v.map((w, i) => [i, `${i}`, w]);
	if (wire.t === "object") return wire.v.map(([k, w]) => [k, k, w]);
	return [];
}

/** A short, non-authoritative label. Never used as an identity. */
export function wireLabel(wire: Wire): string {
	switch (wire.t) {
		case "prim":
			return wire.v === null ? "null" : typeof wire.v === "string" ? wire.v : String(wire.v);
		case "undef":
			return "undefined";
		case "bigint":
			return `${wire.v}n`;
		case "array":
			return `Array(${wire.v.length})`;
		case "object":
			return `{${wire.v.length}}`;
		case "codec":
			return wire.codec;
		case "opaque":
			return wire.label;
	}
}

export function typeLabel(wire: Wire): string {
	switch (wire.t) {
		case "prim":
			return wire.v === null ? "null" : typeof wire.v;
		case "undef":
			return "undefined";
		case "bigint":
			return "bigint";
		case "array":
			return "array";
		case "object":
			return "object";
		case "codec":
			return wire.codec;
		case "opaque":
			return "opaque";
	}
}

/** True when every leaf can round-trip through JSON — the json editor's guard. */
export function isJsonSafe(wire: Wire): boolean {
	switch (wire.t) {
		case "opaque":
		case "codec":
		case "bigint":
		case "undef":
			return false;
		case "array":
			return wire.v.every(isJsonSafe);
		case "object":
			return wire.v.every(([, w]) => isJsonSafe(w));
		default:
			return true;
	}
}

export function wireToJs(wire: Wire): unknown {
	switch (wire.t) {
		case "prim":
			return wire.v;
		case "undef":
			return undefined;
		case "bigint":
			return wire.v;
		case "array":
			return wire.v.map(wireToJs);
		case "object":
			return Object.fromEntries(wire.v.map(([k, w]) => [k, wireToJs(w)]));
		case "codec":
			return wire.v;
		case "opaque":
			return `[${wire.label}]`;
	}
}

/** `null` when the value cannot be represented — the caller rejects the edit. */
export function jsToWire(value: unknown): EditableWire | null {
	if (value === null) return { t: "prim", v: null };
	if (value === undefined) return { t: "undef" };
	const type = typeof value;
	if (type === "string" || type === "number" || type === "boolean") {
		return { t: "prim", v: value as string | number | boolean };
	}
	if (type === "bigint") return { t: "bigint", v: String(value) };
	if (Array.isArray(value)) {
		const items: EditableWire[] = [];
		for (const item of value) {
			const w = jsToWire(item);
			if (!w) return null;
			items.push(w);
		}
		return { t: "array", v: items };
	}
	if (type === "object") {
		const entries: Array<[string, EditableWire]> = [];
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			const w = jsToWire(v);
			if (!w) return null;
			entries.push([k, w]);
		}
		return { t: "object", v: entries };
	}
	return null;
}

export function formatJson(wire: Wire): string {
	return JSON.stringify(wireToJs(wire), null, 2) ?? "";
}
