/**
 * Wire serializer (SPEC.md §7.4) and codec registry (§7.7).
 *
 * The serializer runs in the renderer realm only. It never mutates the value it
 * is given, never invokes a getter, and never lets a value that cannot cross a
 * realm boundary become editable: those become `opaque`, and `EditableWire`
 * excludes `opaque` by type, which is what makes §7.2's overlay model correct
 * across HMR by construction.
 *
 * Limits (§7.3): depth 8, payload 256 KB, cycles → `opaque` labelled
 * `[Circular]`. Consumer codecs are tested before built-ins. Opaque ids are
 * valid only for the revision they were minted at.
 */

import * as React from "react";
import type { EditableWire, FixtureCodec, Wire } from "../shared/types.ts";
import { builtinCodecs } from "./codecs.ts";

/* ------------------------------------------------------------------ *
 * Limits — §7.3
 * ------------------------------------------------------------------ */

export const DEPTH_LIMIT = 8;
export const PAYLOAD_LIMIT = 256 * 1024;

/** Rough per-node overhead, so the budget tracks message size not value count. */
const NODE_COST = 16;

/* ------------------------------------------------------------------ *
 * Public shape
 * ------------------------------------------------------------------ */

export interface SerializeOptions {
	/** Input name. Used for the development warning and for opaque lifetime. */
	name?: string;
	onWarn?: (message: string) => void;
}

export interface DeserializeResult {
	ok: boolean;
	value: unknown;
}

export interface Serializer {
	serialize(value: unknown, revision: number, opts?: SerializeOptions): Wire;
	deserialize(wire: Wire): unknown;
	/** Same as `deserialize`, but reports whether anything was unrepresentable. */
	tryDeserialize(wire: Wire): DeserializeResult;
	/** The value behind an `opaque` id, or `undefined` once the revision moved on. */
	resolveOpaque(id: number): unknown;
	readonly codecs: readonly FixtureCodec[];
}

export interface SerializerOptions {
	/** Enables structured-clone validation of codec output (§7.7). */
	dev?: boolean;
	onWarn?: (message: string) => void;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function defaultWarn(message: string): void {
	// eslint-disable-next-line no-console
	console.warn(message);
}

function isDevEnvironment(): boolean {
	try {
		return typeof process === "undefined" || process.env?.NODE_ENV !== "production";
	} catch {
		return true;
	}
}

function isPlainObject(value: object): boolean {
	const proto = Object.getPrototypeOf(value) as object | null;
	return proto === Object.prototype || proto === null;
}

function componentName(type: unknown): string {
	if (typeof type === "string") return type;
	if (typeof type === "function") {
		const fn = type as { displayName?: string; name?: string };
		return fn.displayName || fn.name || "Anonymous";
	}
	if (type && typeof type === "object") {
		const obj = type as { displayName?: string; type?: unknown; render?: unknown };
		if (typeof obj.displayName === "string") return obj.displayName;
		if (obj.type) return componentName(obj.type);
		if (obj.render) return componentName(obj.render);
	}
	return "Component";
}

/** A short, human-facing description of a value that cannot be edited. */
export function opaqueLabel(value: unknown): string {
	if (typeof value === "function") {
		const name = (value as { name?: string }).name;
		return name ? `ƒ ${name}()` : "ƒ ()";
	}
	if (typeof value === "symbol") return value.toString();
	if (React.isValidElement(value)) {
		return `<${componentName((value as React.ReactElement).type)} />`;
	}
	if (value && typeof value === "object") {
		const ctor = (value as { constructor?: { name?: string } }).constructor;
		const name = ctor?.name;
		return name && name !== "Object" ? `[${name}]` : "[object]";
	}
	return String(value);
}

/** True when no branch of the tree is `opaque` — i.e. the whole value is patchable. */
export function isFullyEditable(wire: Wire): wire is EditableWire {
	switch (wire.t) {
		case "opaque":
			return false;
		case "array":
			return wire.v.every(isFullyEditable);
		case "object":
			return wire.v.every(([, child]) => isFullyEditable(child));
		default:
			return true;
	}
}

/** Approximate serialized size of a codec payload, for the §7.3 budget. */
function codecCost(data: unknown): number {
	try {
		return JSON.stringify(data)?.length ?? NODE_COST;
	} catch {
		return NODE_COST;
	}
}

/* ------------------------------------------------------------------ *
 * The serializer
 * ------------------------------------------------------------------ */

interface OpaqueEntry {
	value: unknown;
	name: string;
	revision: number;
}

interface Walk {
	revision: number;
	name: string;
	/** Ancestors on the current path — a true cycle, not DAG sharing. §7.3 */
	path: Set<object>;
	used: number;
	truncatedDepth: boolean;
	truncatedSize: boolean;
	warn: (message: string) => void;
}

export function createSerializer(
	codecs: FixtureCodec[] = [],
	options: SerializerOptions = {},
): Serializer {
	const dev = options.dev ?? isDevEnvironment();
	const warn = options.onWarn ?? defaultWarn;

	// Consumer codecs are tested before built-ins, so `date` can be overridden
	// outright rather than shadowed (§7.7).
	const seenNames = new Set<string>();
	const registry: FixtureCodec[] = [];
	for (const codec of [...codecs, ...builtinCodecs]) {
		if (!codec || typeof codec.name !== "string" || seenNames.has(codec.name)) continue;
		seenNames.add(codec.name);
		registry.push(codec);
	}
	const byName = new Map(registry.map((c) => [c.name, c]));

	const opaques = new Map<number, OpaqueEntry>();
	/** The revision each named input was last serialized at. */
	const live = new Map<string, number>();
	let nextOpaqueId = 1;

	function mintOpaque(value: unknown, label: string, walk: Walk): Wire {
		const id = nextOpaqueId++;
		opaques.set(id, { value, name: walk.name, revision: walk.revision });
		walk.used += NODE_COST + label.length;
		return { t: "opaque", id, label };
	}

	function tryCodec(value: object, walk: Walk): Wire | null {
		for (const codec of registry) {
			let matched = false;
			try {
				matched = codec.test(value);
			} catch (error) {
				warn(`[uaight] codec "${codec.name}" threw from test(): ${String(error)}`);
				continue;
			}
			if (!matched) continue;

			let data: unknown;
			try {
				data = codec.serialize(value as never);
			} catch (error) {
				warn(`[uaight] codec "${codec.name}" threw from serialize(): ${String(error)}`);
				return mintOpaque(value, opaqueLabel(value), walk);
			}

			// §7.7: serialize output is validated as structured-cloneable in
			// development and fails loudly with the codec name.
			if (dev && typeof structuredClone === "function") {
				try {
					structuredClone(data);
				} catch {
					warn(
						`[uaight] codec "${codec.name}" produced a value that is not structured-cloneable; falling back to an opaque chip`,
					);
					return mintOpaque(value, opaqueLabel(value), walk);
				}
			}

			walk.used += NODE_COST + codec.name.length + codecCost(data);
			return { t: "codec", codec: codec.name, v: data };
		}
		return null;
	}

	function walkValue(value: unknown, walk: Walk, depth: number): Wire {
		if (walk.used > PAYLOAD_LIMIT) {
			walk.truncatedSize = true;
			return mintOpaque(value, "[size limit]", walk);
		}

		if (value === undefined) {
			walk.used += NODE_COST;
			return { t: "undef" };
		}
		if (value === null) {
			walk.used += NODE_COST;
			return { t: "prim", v: null };
		}

		switch (typeof value) {
			case "string":
				walk.used += NODE_COST + value.length;
				return { t: "prim", v: value };
			case "number":
			case "boolean":
				walk.used += NODE_COST + 8;
				return { t: "prim", v: value };
			case "bigint":
				walk.used += NODE_COST + 24;
				return { t: "bigint", v: value.toString() };
			case "symbol":
			case "function":
				return mintOpaque(value, opaqueLabel(value), walk);
		}

		const object = value as object;

		if (walk.path.has(object)) return mintOpaque(object, "[Circular]", walk);
		if (depth > DEPTH_LIMIT) {
			walk.truncatedDepth = true;
			return mintOpaque(object, "[depth limit]", walk);
		}

		// Codecs first, so a consumer can claim any object shape it likes —
		// including one we would otherwise treat as plain (§7.7).
		const encoded = tryCodec(object, walk);
		if (encoded) return encoded;

		// A React element is a plain object by prototype, so this must precede
		// the plain-object branch or we would walk `props` and `_owner`.
		if (React.isValidElement(object)) return mintOpaque(object, opaqueLabel(object), walk);

		walk.path.add(object);
		try {
			if (Array.isArray(object)) {
				walk.used += NODE_COST;
				const items: Wire[] = [];
				for (const item of object) items.push(walkValue(item, walk, depth + 1));
				return { t: "array", v: items };
			}

			// §7.3: getters, proxies and non-plain objects are opaque unless a
			// codec matched. A proxy is indistinguishable from its target here,
			// which is documented rather than pretended away.
			if (!isPlainObject(object)) return mintOpaque(object, opaqueLabel(object), walk);

			walk.used += NODE_COST;
			const entries: Array<[string, Wire]> = [];
			for (const key of Object.keys(object)) {
				if (FORBIDDEN_KEYS.has(key)) continue;
				const descriptor = Object.getOwnPropertyDescriptor(object, key);
				if (!descriptor) continue;
				walk.used += key.length;
				if (descriptor.get) {
					// Never invoked during serialization (§7.3).
					entries.push([key, mintOpaque(undefined, "[getter]", walk)]);
					continue;
				}
				entries.push([key, walkValue(descriptor.value, walk, depth + 1)]);
			}
			return { t: "object", v: entries };
		} finally {
			walk.path.delete(object);
		}
	}

	function serialize(value: unknown, revision: number, opts: SerializeOptions = {}): Wire {
		const name = opts.name ?? "";
		const walk: Walk = {
			revision,
			name,
			path: new Set<object>(),
			used: 0,
			truncatedDepth: false,
			truncatedSize: false,
			warn: opts.onWarn ?? warn,
		};

		// Ids minted for an older revision of this input stop resolving now.
		const previous = live.get(name);
		if (previous !== undefined && previous !== revision) {
			for (const [id, entry] of opaques) {
				if (entry.name === name && entry.revision !== revision) opaques.delete(id);
			}
		}
		live.set(name, revision);

		const wire = walkValue(value, walk, 0);

		if (dev && (walk.truncatedDepth || walk.truncatedSize)) {
			const what = walk.truncatedDepth
				? walk.truncatedSize
					? "depth and size"
					: `depth (limit ${DEPTH_LIMIT})`
				: `size (limit ${PAYLOAD_LIMIT} bytes)`;
			walk.warn(
				`[uaight] input ${name ? `"${name}"` : "(unnamed)"} was truncated by the ${what} limit; the truncated branches show as opaque chips`,
			);
		}

		return wire;
	}

	function tryDeserialize(wire: Wire): DeserializeResult {
		switch (wire.t) {
			case "prim":
				return { ok: true, value: wire.v };
			case "undef":
				return { ok: true, value: undefined };
			case "bigint":
				try {
					return { ok: true, value: BigInt(wire.v) };
				} catch {
					return { ok: false, value: undefined };
				}
			case "array": {
				const out: unknown[] = [];
				let ok = true;
				for (const item of wire.v) {
					const result = tryDeserialize(item);
					ok &&= result.ok;
					out.push(result.value);
				}
				return { ok, value: out };
			}
			case "object": {
				const out: Record<string, unknown> = {};
				let ok = true;
				for (const [key, child] of wire.v) {
					if (FORBIDDEN_KEYS.has(key)) {
						ok = false;
						continue;
					}
					const result = tryDeserialize(child);
					ok &&= result.ok;
					// defineProperty, so a `__proto__`-shaped key can never reach
					// the prototype setter even if the guard above changes.
					Object.defineProperty(out, key, {
						value: result.value,
						enumerable: true,
						writable: true,
						configurable: true,
					});
				}
				return { ok, value: out };
			}
			case "codec": {
				const codec = byName.get(wire.codec);
				if (!codec) {
					// §7.7: an unknown codec name on the wire degrades with a warning.
					warn(`[uaight] unknown codec "${wire.codec}" on the wire; value dropped`);
					return { ok: false, value: undefined };
				}
				try {
					return { ok: true, value: codec.deserialize(wire.v as never) };
				} catch (error) {
					warn(`[uaight] codec "${wire.codec}" threw from deserialize(): ${String(error)}`);
					return { ok: false, value: undefined };
				}
			}
			case "opaque": {
				const value = resolveOpaque(wire.id);
				return { ok: value !== undefined, value };
			}
		}
	}

	function resolveOpaque(id: number): unknown {
		const entry = opaques.get(id);
		if (!entry) return undefined;
		// Valid only for the revision it was minted at (§7.2) — restoring an id
		// from a previous revision is exactly the §7.1 staleness bug.
		if (live.get(entry.name) !== entry.revision) return undefined;
		return entry.value;
	}

	return {
		serialize,
		deserialize: (wire) => tryDeserialize(wire).value,
		tryDeserialize,
		resolveOpaque,
		codecs: registry,
	};
}
