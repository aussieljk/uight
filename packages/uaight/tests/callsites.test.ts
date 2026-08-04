/**
 * Call-site harvesting — fixtures nobody wrote.
 *
 * The contract is narrow on purpose: a value that is written down is recorded,
 * a value that is computed is *named as dynamic and left out*. The tests that
 * matter here are the negative ones — a harvester that guesses would put props
 * into a fixture that the source never had.
 */

import { describe, expect, it } from "vitest";

import {
	callSitesFor,
	formatElement,
	formatFixtureModule,
} from "../src/shared/callsites.ts";
import { groupCallSites, parseCallSites } from "../src/vite/callsites.ts";
import type { CallSite } from "../src/shared/types.ts";

function harvest(source: string, filename = "/src/pages/Home.tsx"): CallSite[] {
	return parseCallSites(source, filename, { path: "pages/Home", globPath: filename });
}

describe("reading props", () => {
	it("records string, number, boolean and bare attributes", () => {
		const [site] = harvest(
			`export const A = () => <Button variant="primary" count={3} wide={false} disabled />;`,
		);

		expect(site?.component).toBe("Button");
		expect(site?.props).toEqual({
			variant: "primary",
			count: 3,
			wide: false,
			disabled: true,
		});
		expect(site?.dynamic).toEqual([]);
	});

	it("records static arrays and objects", () => {
		const [site] = harvest(
			`export const A = () => <Chart series={[1, 2]} axis={{ x: "time", y: null }} />;`,
		);

		expect(site?.props).toEqual({ series: [1, 2], axis: { x: "time", y: null } });
	});

	it("reads a template literal with no expressions, and refuses one with", () => {
		const [plain] = harvest("export const A = () => <Badge label={`new`} />;");
		expect(plain?.props).toEqual({ label: "new" });

		const [interpolated] = harvest(
			"export const A = () => <Badge label={`new ${count}`} />;",
		);
		expect(interpolated?.props).toEqual({});
		expect(interpolated?.dynamic).toEqual(["label"]);
	});

	it("names a computed prop as dynamic instead of guessing it", () => {
		const [site] = harvest(
			`export const A = () => <Button onClick={handle} label={title} variant="primary" />;`,
		);

		// The one value written down survives; the two that are not are named.
		expect(site?.props).toEqual({ variant: "primary" });
		expect(site?.dynamic).toEqual(["onClick", "label"]);
	});

	it("marks a spread, because the rendered shape is not what the source shows", () => {
		const [site] = harvest(`export const A = () => <Button {...rest} size="sm" />;`);

		expect(site?.props).toEqual({ size: "sm" });
		expect(site?.dynamic).toContain("...");
	});

	it("refuses a regex and a bigint, which have no JSON form", () => {
		const [site] = harvest(
			`export const A = () => <Input pattern={/a+/} big={1n} ok="yes" />;`,
		);

		expect(site?.props).toEqual({ ok: "yes" });
		expect(site?.dynamic).toEqual(["pattern", "big"]);
	});
});

describe("children", () => {
	it("captures text children", () => {
		const [site] = harvest(`export const A = () => <Button>Pay now</Button>;`);
		expect(site?.children).toBe("Pay now");
	});

	it("treats a mixed child list as dynamic rather than capturing half a sentence", () => {
		const [site] = harvest(`export const A = () => <Button>Pay {amount}</Button>;`);

		expect(site?.children).toBeUndefined();
		expect(site?.dynamic).toContain("children");
	});

	it("does not treat an element child as text", () => {
		const [site] = harvest(`export const A = () => <Button><Icon /></Button>;`);

		expect(site?.children).toBeUndefined();
		expect(site?.dynamic).toContain("children");
	});
});

describe("what counts as a component", () => {
	it("skips host elements", () => {
		const sites = harvest(`export const A = () => <div className="x"><span /></div>;`);
		expect(sites).toEqual([]);
	});

	it("keeps a dotted component and roots it at the imported name", () => {
		const [site] = harvest(
			`import { Accordion } from "./ui";\nexport const A = () => <Accordion.Item value="one" />;`,
		);

		expect(site?.component).toBe("Accordion.Item");
		expect(site?.importedFrom).toBe("./ui");
	});

	it("finds usages nested inside other elements", () => {
		const sites = harvest(
			`export const A = () => (<div><Card><Button size="sm" /></Card></div>);`,
		);

		expect(sites.map((s) => s.component)).toEqual(["Card", "Button"]);
	});

	it("yields nothing for a file that does not parse", () => {
		expect(harvest("export default {")).toEqual([]);
	});
});

describe("ranking", () => {
	const site = (props: Record<string, unknown>, line: number): CallSite => ({
		component: "Button",
		props,
		path: "pages/Home",
		globPath: "/src/pages/Home.tsx",
		line,
		column: 1,
		dynamic: [],
	});

	it("deduplicates identical usages", () => {
		const groups = groupCallSites([
			site({ size: "sm" }, 1),
			site({ size: "sm" }, 9),
			site({ size: "lg" }, 12),
		]);

		expect(groups[0]?.sites).toHaveLength(2);
		// `total` still reports what was found, so the UI can say "of 3".
		expect(groups[0]?.total).toBe(3);
	});

	it("ranks a distinct usage above a plain one", () => {
		const groups = groupCallSites([site({}, 1), site({ size: "lg", tone: "danger" }, 2)]);

		expect(groups[0]?.sites[0]?.props).toEqual({ size: "lg", tone: "danger" });
	});

	it("caps each group", () => {
		const many = Array.from({ length: 30 }, (_, i) => site({ index: i }, i));
		const groups = groupCallSites(many, { max: 4 });

		expect(groups[0]?.sites).toHaveLength(4);
		expect(groups[0]?.total).toBe(30);
	});
});

describe("matching sites to a detected component", () => {
	const item = {
		path: "components/Button",
		globPath: "/src/components/Button.tsx",
		name: "Button",
		exportName: "Button",
		kind: "function" as const,
	};

	const base: CallSite = {
		component: "Button",
		props: {},
		path: "pages/Home",
		globPath: "/src/pages/Home.tsx",
		line: 1,
		column: 1,
		dynamic: [],
	};

	it("prefers sites whose import resolved to this module", () => {
		const groups = groupCallSites([
			{ ...base, resolvedFrom: "components/Button", props: { size: "sm" } },
			{ ...base, resolvedFrom: "other/Button", props: { size: "lg" } },
		]);

		const matched = callSitesFor(groups, item);
		expect(matched).toHaveLength(1);
		expect(matched[0]?.props).toEqual({ size: "sm" });
	});

	it("keeps sites with no import information, and drops ones known to be elsewhere", () => {
		const groups = groupCallSites([
			{ ...base, props: { a: 1 } },
			{ ...base, resolvedFrom: "other/Button", props: { b: 2 } },
		]);

		const matched = callSitesFor(groups, item);
		expect(matched.map((s) => s.props)).toEqual([{ a: 1 }]);
	});
});

describe("copy as fixture", () => {
	const site: CallSite = {
		component: "Button",
		props: { variant: "primary", disabled: true },
		children: "Pay now",
		path: "pages/Home",
		globPath: "/src/pages/Home.tsx",
		line: 42,
		column: 3,
		dynamic: [],
	};

	it("formats an element the way it was written", () => {
		expect(formatElement(site)).toBe(`<Button variant="primary" disabled>Pay now</Button>`);
	});

	it("formats a single site as a default export", () => {
		const source = formatFixtureModule("Button", [site], { importFrom: "./Button" });

		expect(source).toContain(`import { Button } from "./Button";`);
		expect(source).toContain("export default <Button");
	});

	it("formats several sites as a named map", () => {
		const source = formatFixtureModule("Button", [site, { ...site, line: 51, props: {} }]);

		expect(source).toContain("export default {");
		expect(source).toContain('"Home_42"');
		expect(source).toContain('"Home_51"');
	});
});
