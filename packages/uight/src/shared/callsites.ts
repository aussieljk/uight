/**
 * Call-site helpers shared by both realms.
 *
 * Parsing lives in `vite/callsites.ts` (Node, oxc). Everything here is pure
 * string and array work, so the chrome can label a site and offer its source
 * without importing a parser.
 */

import type { CallSite, CallSiteGroup, InventoryItem } from "./types.ts";

/** `checkout/PayNow:42` — where the usage was written. */
export function callSiteLabel(site: CallSite): string {
	const leaf = site.path.split("/").pop() ?? site.path;
	return `${leaf}:${site.line}`;
}

/** A one-line summary of what makes this site distinct, for a chip. */
export function callSiteSummary(site: CallSite): string {
	const keys = Object.keys(site.props);
	if (keys.length === 0 && site.children) return `"${truncate(site.children, 24)}"`;
	if (keys.length === 0) return "no props";
	const shown = keys.slice(0, 3).join(", ");
	return keys.length > 3 ? `${shown} +${keys.length - 3}` : shown;
}

function truncate(value: string, max: number): string {
	return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * The sites that belong to a detected component.
 *
 * Names are matched as written, because that is all the syntax pass knows. When
 * an import told us where a name came from, a site whose `resolvedFrom` matches
 * the item's own module is preferred — that is what keeps two same-named
 * components in different directories from borrowing each other's examples.
 * Sites with no import information are kept as a fallback rather than dropped,
 * since a component used in the file that defines it has no import at all.
 */
export function callSitesFor(
	groups: readonly CallSiteGroup[],
	item: InventoryItem,
): CallSite[] {
	const group = groups.find((g) => g.component === item.name);
	if (!group) return [];

	const exact = group.sites.filter((site) => site.resolvedFrom === item.path);
	if (exact.length) return exact;

	// No import resolved to this module. Anything that resolved somewhere *else*
	// is positively known to be a different component; drop only those.
	return group.sites.filter(
		(site) => site.resolvedFrom === undefined || site.resolvedFrom === item.path,
	);
}

/* ------------------------------------------------------------------ *
 * "Copy as fixture"
 * ------------------------------------------------------------------ */

/** A JSX attribute value: `"text"` for strings, `{…}` for everything else. */
function attributeValue(value: unknown): string | null {
	if (value === true) return null; // `<Button disabled />`
	if (typeof value === "string") {
		return value.includes('"') ? `{${JSON.stringify(value)}}` : `"${value}"`;
	}
	return `{${JSON.stringify(value)}}`;
}

function attributes(props: Record<string, unknown>, indent: string): string {
	const entries = Object.entries(props);
	if (entries.length === 0) return "";

	const parts = entries.map(([name, value]) => {
		const rendered = attributeValue(value);
		return rendered === null ? name : `${name}=${rendered}`;
	});

	const inline = ` ${parts.join(" ")}`;
	// One long line of props is worse to read than a block, and this text is
	// going straight into somebody's editor.
	if (inline.length <= 72) return inline;
	return `\n${parts.map((part) => `${indent}\t${part}`).join("\n")}\n${indent}`;
}

/** The element as source: `<Button variant="primary">Pay now</Button>`. */
export function formatElement(site: CallSite, indent = ""): string {
	const props = attributes(site.props, indent);
	if (!site.children) return `<${site.component}${props}/>`.replace(/\s*\/>$/, " />");
	return `<${site.component}${props}>${site.children}</${site.component}>`;
}

/**
 * A complete fixture module for a set of call sites.
 *
 * Offered as text to copy, never written to disk: §1.4 cuts the file-writing
 * endpoint from v1 entirely, and "we generate the file, you decide where it
 * goes" keeps that line intact.
 */
export function formatFixtureModule(
	component: string,
	sites: readonly CallSite[],
	options: { importFrom?: string } = {},
): string {
	const source = options.importFrom ?? "./";
	const root = component.split(".")[0] ?? component;
	const header = `import { ${root} } from ${JSON.stringify(source)};\n\n`;

	if (sites.length === 1 && sites[0]) {
		return `${header}export default ${formatElement(sites[0])};\n`;
	}

	const used = new Set<string>();
	const entries = sites.map((site) => {
		let name = callSiteLabel(site).replace(/[^\w]/g, "_");
		while (used.has(name)) name = `${name}_`;
		used.add(name);
		return `\t${JSON.stringify(name)}: ${formatElement(site, "\t")},`;
	});

	return `${header}export default {\n${entries.join("\n")}\n};\n`;
}
