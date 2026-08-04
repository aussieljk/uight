/**
 * Fixture module normalization — SPEC.md §3.1, §3.4, §3.5.
 *
 * An element default export, a component default export, and an object of
 * either are all fixtures. **Named exports are never fixtures** — that is what
 * leaves room for `fileMeta`, `fixtureMeta` and `fixtureNames` — except in a
 * CSF module, where §13 takes over.
 */

import type * as React from "react";
import { isValidElement } from "react";
import { DEFAULT_FIXTURE } from "../shared/types.ts";
import type {
	FixtureFileIndex,
	FixtureFileMeta,
	FixtureMeta,
	RuntimeConfig,
} from "../shared/types.ts";
import type { CsfSupport, StorybookPreview } from "./csf.ts";
import { DEFAULT_CSF_SUPPORT, normalizeCsfModule } from "./csf.ts";

export interface NormalizedFixture {
	/** `null` means the module's default export is the fixture (§3.2). */
	name: string | null;
	render: React.ComponentType | (() => React.ReactNode) | React.ReactElement;
	meta?: FixtureMeta;
	/** CSF features we declined to run (§13) — the UI badges these. */
	unsupported?: string[];
}

export interface NormalizedModule {
	fixtures: NormalizedFixture[];
	fileMeta?: FixtureFileMeta;
}

/* ------------------------------------------------------------------ *
 * Shape tests
 * ------------------------------------------------------------------ */

/** `memo` and `forwardRef` are objects, not functions — but still components. */
function isComponentLike(value: unknown): value is React.ComponentType {
	if (typeof value === "function") return true;
	if (typeof value !== "object" || value === null) return false;
	if (isValidElement(value)) return false;
	return "$$typeof" in (value as Record<string, unknown>);
}

function isRenderable(value: unknown): boolean {
	return isValidElement(value) || isComponentLike(value);
}

function isFixtureMap(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null) return false;
	if (isValidElement(value) || isComponentLike(value)) return false;
	if (Array.isArray(value)) return false;
	const proto = Object.getPrototypeOf(value) as object | null;
	return proto === Object.prototype || proto === null;
}

function asRenderable(value: unknown): NormalizedFixture["render"] | null {
	if (isValidElement(value)) return value as React.ReactElement;
	if (isComponentLike(value)) return value as React.ComponentType;
	return null;
}

/* ------------------------------------------------------------------ *
 * Normalization
 * ------------------------------------------------------------------ */

function isCsfFile(file: FixtureFileIndex, config: RuntimeConfig): boolean {
	if (file.csf) return true;
	const suffix = config.storybookFileSuffix;
	return Boolean(config.storybook && suffix && file.path.endsWith(`.${suffix}`));
}

export function normalizeModule(
	module: unknown,
	file: FixtureFileIndex,
	config: RuntimeConfig,
	preview: StorybookPreview | null = null,
): NormalizedModule {
	const dev = config.command === "serve";

	if (isCsfFile(file, config)) {
		if (!config.storybook) {
			warn(
				dev,
				`[uaight] ${file.path} looks like a CSF module but Storybook support is off`,
			);
			return { fixtures: [] };
		}
		const support: CsfSupport = { ...DEFAULT_CSF_SUPPORT, ...config.storybook };
		const csf = normalizeCsfModule(module, file, support, preview);
		const result: NormalizedModule = { fixtures: csf.fixtures };
		if (csf.fileMeta) result.fileMeta = csf.fileMeta;
		reconcile(file, result.fixtures, dev);
		return result;
	}

	const namespace = (module ?? {}) as Record<string, unknown>;
	const fileMeta = namespace.fileMeta as FixtureFileMeta | undefined;
	const fixtureMeta = (namespace.fixtureMeta ?? {}) as Record<string, FixtureMeta>;
	const defaultExport = namespace.default;

	const fixtures: NormalizedFixture[] = [];

	if (defaultExport === undefined || defaultExport === null) {
		warn(dev, `[uaight] ${file.path} has no default export, so it contributes no fixtures`);
	} else if (isFixtureMap(defaultExport)) {
		// Multi-fixture: property names are fixture names and may contain spaces.
		for (const [name, value] of Object.entries(defaultExport)) {
			const render = asRenderable(value);
			if (!render) {
				warn(
					dev,
					`[uaight] ${file.path}: fixture "${name}" is not an element or a component and was skipped`,
				);
				continue;
			}
			const fixture: NormalizedFixture = { name, render };
			const meta = fixtureMeta[name];
			if (meta) fixture.meta = meta;
			fixtures.push(fixture);
		}
	} else if (isRenderable(defaultExport)) {
		const fixture: NormalizedFixture = {
			name: null,
			render: asRenderable(defaultExport)!,
		};
		const meta = fixtureMeta[DEFAULT_FIXTURE];
		if (meta) fixture.meta = meta;
		fixtures.push(fixture);
	} else {
		warn(
			dev,
			`[uaight] ${file.path}: the default export is neither an element, a component, nor an object of them`,
		);
	}

	reconcile(file, fixtures, dev);

	const result: NormalizedModule = { fixtures };
	if (fileMeta) result.fileMeta = fileMeta;
	return result;
}

/**
 * §3.4: after a module loads, compare real keys against the index; on mismatch,
 * warn in development naming the file and both lists.
 */
function reconcile(
	file: FixtureFileIndex,
	fixtures: NormalizedFixture[],
	dev: boolean,
): void {
	if (!dev || file.names === null) return;
	const actual = fixtures.map((fixture) => fixture.name);
	const indexed = file.names as Array<string | null>;

	// A single fixture is `[null]` (§3.4's table), which is now what the plugin
	// emits. `[]` is no longer a legal encoding, but an index serialized by an
	// older plugin build can still carry it, and reporting that as drift would
	// fire on every single-fixture file in the project — training users to
	// ignore the warning that exists to catch real drift.
	const single = (names: Array<string | null>): boolean =>
		names.length === 0 || (names.length === 1 && names[0] === null);
	if (single(actual) && single(indexed)) return;

	const same =
		actual.length === indexed.length &&
		actual.every((name, index) => name === indexed[index]);
	if (same) return;
	warn(
		true,
		`[uaight] ${file.path}: fixture names changed since the index was built.\n` +
			`  indexed: ${JSON.stringify(indexed)}\n` +
			`  actual:  ${JSON.stringify(actual)}`,
	);
}

function warn(dev: boolean, message: string): void {
	if (!dev) return;
	// eslint-disable-next-line no-console
	console.warn(message);
}

/* ------------------------------------------------------------------ *
 * Selection — §3.5
 * ------------------------------------------------------------------ */

export interface FixtureSelection {
	fixture: NormalizedFixture | null;
	/**
	 * Set when a file node was selected and we are showing its first fixture
	 * rather than auto-selecting one: §3.5 wants that named, not silent.
	 */
	standingInFor?: string | null;
}

export function selectFixture(
	fixtures: readonly NormalizedFixture[],
	name: string | null,
): FixtureSelection {
	if (name === null) {
		const single = fixtures.find((fixture) => fixture.name === null);
		if (single) return { fixture: single };
		const first = fixtures[0];
		// An undecidable file resolved to named fixtures: render the first and
		// say which one, rather than rewriting the user's selection.
		return first ? { fixture: first, standingInFor: first.name } : { fixture: null };
	}
	const match = fixtures.find((fixture) => fixture.name === name);
	return { fixture: match ?? null };
}
