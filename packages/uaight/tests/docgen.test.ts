/**
 * The Babel docgen resolver. SPEC.md §15.2.
 *
 * The point of these tests is not that `react-docgen` works — that is its own
 * project's business. It is that the seam §15.2 describes is honoured: the
 * limitation is *declared* rather than discovered, an absent optional
 * dependency degrades to nothing rather than to a crash, and no prop name ever
 * turns into control metadata (D18).
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveUaightConfig } from "../src/vite/config.ts";
import {
	BABEL_LIMITATIONS,
	createBabelDocgenResolver,
	resetDocgenCache,
} from "../src/vite/docgen.ts";
import { scanFixtures } from "../src/vite/scan.ts";

const BUTTON = `import type { ReactNode } from "react";

export interface ButtonProps {
	/** Which of the two looks to use. */
	variant?: "primary" | "secondary";
	/** Cannot be pressed. */
	disabled?: boolean;
	label: string;
	children?: ReactNode;
}

/** A button. */
export function Button({ variant = "primary", disabled, label }: ButtonProps) {
	return <button data-variant={variant} disabled={disabled}>{label}</button>;
}
`;

describe("createBabelDocgenResolver", () => {
	beforeEach(() => {
		resetDocgenCache();
	});

	it("identifies itself and declares its limitations up front", () => {
		const resolver = createBabelDocgenResolver();
		expect(resolver.name).toBe("babel");
		// §15.2's documented cost of not waiting for TypeScript 7.1 (Q12).
		expect(resolver.limitations).toContain("inherited-props");
	});

	it("reads props, their types as written, and their descriptions", async () => {
		const docs = await createBabelDocgenResolver().resolve({
			code: BUTTON,
			filename: "/src/Button.tsx",
			globPath: "/src/Button.tsx",
		});

		const button = docs.find((doc) => doc.name === "Button");
		expect(button?.globPath).toBe("/src/Button.tsx");

		const byName = Object.fromEntries((button?.props ?? []).map((p) => [p.name, p]));
		expect(byName.label?.required).toBe(true);
		expect(byName.variant?.required).toBe(false);
		// "As written, not normalized": the union is the source's text.
		expect(byName.variant?.type).toContain("primary");
		expect(byName.disabled?.description).toContain("Cannot be pressed");
	});

	it("carries the limitation on every doc, so a prop table cannot omit the caveat", async () => {
		const docs = await createBabelDocgenResolver().resolve({
			code: BUTTON,
			filename: "/src/Button.tsx",
			globPath: "/src/Button.tsx",
		});

		for (const doc of docs) {
			expect(doc.limitations).toEqual([...BABEL_LIMITATIONS]);
		}
	});

	it("never invents control metadata from a prop name (D18)", async () => {
		const docs = await createBabelDocgenResolver().resolve({
			code: BUTTON,
			filename: "/src/Button.tsx",
			globPath: "/src/Button.tsx",
		});

		for (const prop of docs[0]?.props ?? []) {
			// `PropDoc` has no `control`, `options`, `min`, `max` or `step`, and
			// nothing here may start adding them: controls are declared at the
			// call site (§7.6), never derived from a name like `color` or `size`.
			expect(Object.keys(prop).sort()).toEqual(
				Object.keys(prop)
					.filter((k) => !["control", "options", "min", "max", "step"].includes(k))
					.sort(),
			);
		}
	});

	it("returns nothing for a module it cannot read, rather than throwing", async () => {
		const docs = await createBabelDocgenResolver().resolve({
			code: "export const = ;;;",
			filename: "/src/Broken.tsx",
			globPath: "/src/Broken.tsx",
		});
		expect(docs).toEqual([]);
	});

	it("degrades to nothing, and says so once, when the dependency is missing", async () => {
		const messages: string[] = [];
		const resolver = createBabelDocgenResolver({
			load: () => Promise.resolve(null),
			onUnavailable: (message) => messages.push(message),
		});

		const input = {
			code: BUTTON,
			filename: "/src/Button.tsx",
			globPath: "/src/Button.tsx",
		};
		expect(await resolver.resolve(input)).toEqual([]);
		expect(await resolver.resolve(input)).toEqual([]);

		// Once, not once per module: a 500-file corpus must not print 500 lines.
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("react-docgen");
		expect(messages[0]).toContain("docgen: false");
	});
});

/* ------------------------------------------------------------------ *
 * Through the scan
 * ------------------------------------------------------------------ */

describe("docgen through the index", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(path.join(tmpdir(), "uaight-docgen-"));
		mkdirSync(path.join(root, "src"), { recursive: true });
		writeFileSync(path.join(root, "src", "Button.tsx"), BUTTON);
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("is absent by default, so `no docs` is the normal case (§15.1)", async () => {
		const index = await scanFixtures(
			resolveUaightConfig({ root, options: {}, command: "serve" }),
		);
		expect(index.docs).toBeUndefined();
	});

	it("is keyed by glob path when docgen is on", async () => {
		const index = await scanFixtures(
			resolveUaightConfig({ root, options: { docgen: true }, command: "serve" }),
		);

		expect(index.docs).toBeDefined();
		expect(index.docs?.["/src/Button.tsx"]?.[0]?.name).toBe("Button");
	});
});
