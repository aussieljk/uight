/**
 * The published surface — SPEC.md §11.3, §11.4, §15, §19.5, §20.1.
 *
 * These assertions are mostly the type check: every declaration below fails to
 * compile if the contract regresses, and `bun x tsc` runs in CI. The runtime
 * expectations exist so the suite reports something rather than an empty file.
 *
 * This is the set the v1.2 freeze commits to, so a change here is a deliberate
 * change to the package's semver contract.
 */

import { describe, expect, it } from "vitest";

import type { UaightChromeApiV1 } from "../src/ui/chrome-context.ts";
import type {
	ComponentDoc,
	DocgenResolver,
	IndexProblem,
	UaightComponents,
} from "../src/shared/types.ts";
import type { ControlPanelInputsProps } from "../src/ui/chrome/ControlPanelInputs.tsx";

describe("IndexProblem", () => {
	it("has a kind for an out-of-root fixturesDir, which is a refusal not a read failure", () => {
		const problem: IndexProblem = {
			kind: "confinement",
			message: "fixturesDir resolves outside the Vite root",
			files: ["../elsewhere"],
		};
		expect(problem.kind).toBe("confinement");
	});
});

describe("UaightComponents", () => {
	it("names ControlPanelInputs, which §11.3 lists as ejectable in its own right", () => {
		// Its props are re-exported from the component file, so an ejected
		// component's existing import keeps resolving to the published type.
		const Inputs: UaightComponents["ControlPanelInputs"] = (_props: ControlPanelInputsProps) =>
			null;
		expect(typeof Inputs).toBe("function");
	});
});

describe("UaightChromeApiV1", () => {
	it("can express a component selection, which no FixtureId can carry", () => {
		type Select = UaightChromeApiV1["component"]["select"];
		const select: Select = (component, callSite) => {
			void component;
			void callSite;
		};
		// `null` clears without selecting a fixture — the case local state had
		// no way to express through `onSelect: (id: FixtureId | null) => void`.
		select(null);
		expect(typeof select).toBe("function");
	});

	it("gives the palette its catalogue, rather than the layout passing it as props", () => {
		type Palette = UaightChromeApiV1["palette"];
		const keys: Array<keyof Palette> = ["open", "setOpen", "query", "setQuery", "items", "select"];
		expect(keys).toHaveLength(6);
	});

	it("names the inputs that lost patches, and keeps the total (§7.3)", () => {
		const status: UaightChromeApiV1["status"] = {
			loading: false,
			error: null,
			isolation: "frame",
			droppedPatches: 3,
			droppedInputs: [{ input: "variant", revision: 2, paths: [["a"], ["b"], ["c"]] }],
		};
		expect(status.droppedInputs[0]?.paths).toHaveLength(status.droppedPatches);
	});
});

describe("DocgenResolver", () => {
	it("is a seam a TypeScript 7.1 resolver could replace without a consumer noticing", () => {
		// §15.2 — the Babel implementation ships behind this with its limitation
		// declared rather than hidden. Nothing here infers a control (D18).
		const babel: DocgenResolver = {
			name: "babel",
			limitations: ["inherited-props"],
			resolve: ({ globPath }): ComponentDoc[] => [
				{ name: "Button", exportName: "Button", globPath, props: [] },
			],
		};
		const docs = babel.resolve({ code: "", filename: "/p/Button.tsx", globPath: "/Button.tsx" });
		expect(Array.isArray(docs) ? docs[0]?.name : null).toBe("Button");
		expect(babel.limitations).toContain("inherited-props");
	});
});
