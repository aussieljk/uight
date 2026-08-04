/**
 * Selector scoping for the packaged stylesheet. SPEC.md §10.3.
 *
 * Our build compiles our classes and then rewrites every rule so it only
 * matches inside `.uaight-root`. That is what makes the packaged CSS immune to
 * the host's `@theme` and unable to leak outward, and it is why we do not use
 * Tailwind's `prefix()` — a prefix lives in the *source*, so ejected components
 * would break in any host that had not configured the same prefix.
 *
 * The transform is deliberately structural rather than regex-driven: it walks
 * balanced blocks, so `@media`/`@supports`/`@layer` wrappers recurse, `@property`
 * and `@keyframes` are left alone, and a `}` inside a string or an escaped class
 * name (`.w-\[calc\(100\%\)\]`) cannot desynchronise it.
 */

export const SCOPE_SELECTOR = ".uaight-root";

export interface ScopeOptions {
	/** The ancestor selector every rule is confined to. */
	scope?: string;
	/**
	 * Also match the scope element itself, not only its descendants.
	 *
	 * ARCHITECTURE §3 promises that every element the chrome renders lives
	 * *under* a `.uaight-root` ancestor, so a plain descendant combinator would
	 * be sufficient. But the natural thing for a caller to write is
	 * `<div className="uaight-root flex flex-col">`, and under a strict
	 * descendant rewrite those utilities would silently do nothing. Defaults to
	 * true; pass false for the strict-ancestor reading.
	 */
	includeSelf?: boolean;
}

/* At-rules whose body is a nested stylesheet: recurse into it. */
const AT_RECURSE = new Set([
	"media",
	"supports",
	"layer",
	"container",
	"scope",
	"starting-style",
	"document",
]);

/*
 * At-rules whose body is NOT a stylesheet. `@keyframes` bodies are keyframe
 * selectors (`from`, `50%`) and scoping them would produce nonsense; `@property`
 * registrations are global by definition and cannot be scoped at all.
 */
const AT_VERBATIM = new Set([
	"keyframes",
	"-webkit-keyframes",
	"-moz-keyframes",
	"-o-keyframes",
	"property",
	"font-face",
	"font-feature-values",
	"font-palette-values",
	"counter-style",
	"page",
	"position-try",
	"view-transition",
	"custom-selector",
]);

const CLOSERS: Record<string, string> = { "{": "}", "(": ")", "[": "]" };

function skipString(input: string, start: number): number {
	const quote = input[start]!;
	let i = start + 1;
	while (i < input.length) {
		const c = input[i]!;
		if (c === "\\") {
			i += 2;
			continue;
		}
		if (c === quote) return i + 1;
		i++;
	}
	return i;
}

/** `input[start]` is one of `{`, `(`, `[`. Returns the index just past its match. */
function skipBlock(input: string, start: number): number {
	const close = CLOSERS[input[start]!]!;
	let i = start + 1;
	while (i < input.length) {
		const c = input[i]!;
		if (c === "\\") {
			i += 2;
			continue;
		}
		if (c === "/" && input[i + 1] === "*") {
			const end = input.indexOf("*/", i + 2);
			i = end === -1 ? input.length : end + 2;
			continue;
		}
		if (c === '"' || c === "'") {
			i = skipString(input, i);
			continue;
		}
		if (c === close) return i + 1;
		if (c === "{" || c === "(" || c === "[") {
			i = skipBlock(input, i);
			continue;
		}
		i++;
	}
	return i;
}

/** Split a selector list on commas that are not inside `()`, `[]` or a string. */
export function splitSelectorList(list: string): string[] {
	const parts: string[] = [];
	let buf = "";
	let i = 0;
	while (i < list.length) {
		const c = list[i]!;
		if (c === "\\") {
			buf += list.slice(i, i + 2);
			i += 2;
			continue;
		}
		if (c === "/" && list[i + 1] === "*") {
			const end = list.indexOf("*/", i + 2);
			const stop = end === -1 ? list.length : end + 2;
			buf += list.slice(i, stop);
			i = stop;
			continue;
		}
		if (c === '"' || c === "'") {
			const end = skipString(list, i);
			buf += list.slice(i, end);
			i = end;
			continue;
		}
		if (c === "(" || c === "[") {
			const end = skipBlock(list, i);
			buf += list.slice(i, end);
			i = end;
			continue;
		}
		if (c === ",") {
			parts.push(buf);
			buf = "";
			i++;
			continue;
		}
		buf += c;
		i++;
	}
	parts.push(buf);
	return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Rewrite one complex selector. Returns a list because a leading `*` or a
 * leading pseudo-element expands into a self form and a descendant form when
 * `includeSelf` is off.
 */
export function scopeSelector(selector: string, options: ScopeOptions = {}): string[] {
	const scope = options.scope ?? SCOPE_SELECTOR;
	const includeSelf = options.includeSelf ?? true;
	/** Matches the scope element or anything beneath it. */
	const subject = includeSelf ? `:is(${scope}, ${scope} *)` : scope;

	const sel = selector.trim();
	if (sel === "") return [];

	// Already confined — hand-written rules in uaight.css spell the scope out
	// so that this pass leaves them exactly as authored.
	if (sel.includes(scope)) return [sel];

	// `:root` and `:host` are where Tailwind parks theme variables. They become
	// the scope element itself; inheritance does the rest.
	if (sel === ":root" || sel === ":host") return [scope];
	if (sel.startsWith(":root")) return [scope + sel.slice(":root".length)];
	// `:host(...)` only means anything in a shadow tree, which we never build.
	if (sel.startsWith(":host(")) return [];
	if (sel.startsWith(":host")) return [scope + sel.slice(":host".length)];

	// A leading universal selector is redundant once a subject is spelled out:
	// `*, ::before` becomes the subject itself and the subject's pseudo-element.
	if (sel.startsWith("*")) {
		const rest = sel.slice(1);
		return includeSelf ? [subject + rest] : [scope + rest, `${scope} ${sel}`];
	}

	// A leading pseudo-element (`::backdrop`) attaches to its subject.
	if (sel.startsWith("::")) {
		return includeSelf ? [subject + sel] : [scope + sel, `${scope} ${sel}`];
	}

	// A compound selector may only *begin* with a type selector, so `:is(…)html`
	// would be invalid CSS. Confine by descent instead. Such a rule then matches
	// nothing, which is the right outcome for a stylesheet that must never reach
	// `html` or `body` in the host's document.
	if (!/^[.#[:&]/.test(sel)) {
		return [`${includeSelf ? subject : scope} ${sel}`];
	}

	return includeSelf ? [subject + sel] : [`${scope} ${sel}`];
}

export function scopeSelectorList(list: string, options: ScopeOptions = {}): string {
	const out: string[] = [];
	for (const sel of splitSelectorList(list)) {
		for (const scoped of scopeSelector(sel, options)) {
			if (!out.includes(scoped)) out.push(scoped);
		}
	}
	return out.join(", ");
}

function atRuleName(prelude: string): string {
	return /^@([\w-]+)/.exec(prelude)?.[1]?.toLowerCase() ?? "";
}

/**
 * Split leading whitespace and comments off a prelude. A comment sitting before
 * a rule is part of the output, not part of the selector — prefixing the scope
 * to `/*! banner *​/ .a` would emit something that is not CSS at all.
 */
function splitLead(prelude: string): [lead: string, rest: string] {
	let i = 0;
	while (i < prelude.length) {
		const c = prelude[i]!;
		if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f") {
			i++;
			continue;
		}
		if (c === "/" && prelude[i + 1] === "*") {
			const end = prelude.indexOf("*/", i + 2);
			i = end === -1 ? prelude.length : end + 2;
			continue;
		}
		break;
	}
	return [prelude.slice(0, i), prelude.slice(i)];
}

function transformBlock(input: string, options: ScopeOptions): string {
	let out = "";
	let buf = "";
	let i = 0;

	const flushBlock = (prelude: string, body: string): void => {
		const [lead, rest] = splitLead(prelude);
		const trimmed = rest.trim();
		if (trimmed.startsWith("@")) {
			const name = atRuleName(trimmed);
			if (AT_RECURSE.has(name)) {
				out += `${prelude}{${transformBlock(body, options)}}`;
			} else {
				// Verbatim, and unknown at-rules too: guessing is worse than leaving
				// something unscoped that we did not author.
				out += `${prelude}{${body}}`;
			}
			return;
		}
		// The body stays verbatim: a nested rule is relative to its parent, which
		// this pass has already confined.
		out += `${lead}${scopeSelectorList(trimmed, options)} {${body}}`;
	};

	while (i < input.length) {
		const c = input[i]!;
		if (c === "\\") {
			buf += input.slice(i, i + 2);
			i += 2;
			continue;
		}
		if (c === "/" && input[i + 1] === "*") {
			const end = input.indexOf("*/", i + 2);
			const stop = end === -1 ? input.length : end + 2;
			buf += input.slice(i, stop);
			i = stop;
			continue;
		}
		if (c === '"' || c === "'") {
			const end = skipString(input, i);
			buf += input.slice(i, end);
			i = end;
			continue;
		}
		if (c === "(" || c === "[") {
			const end = skipBlock(input, i);
			buf += input.slice(i, end);
			i = end;
			continue;
		}
		if (c === ";") {
			out += `${buf};`;
			buf = "";
			i++;
			continue;
		}
		if (c === "{") {
			const end = skipBlock(input, i);
			flushBlock(buf, input.slice(i + 1, end - 1));
			buf = "";
			i = end;
			continue;
		}
		if (c === "}") {
			// Unbalanced input. Pass it through rather than dropping declarations.
			out += `${buf}}`;
			buf = "";
			i++;
			continue;
		}
		buf += c;
		i++;
	}

	return out + buf;
}

/** Rewrite every rule in a compiled stylesheet to require the scope. §10.3 */
export function scopeCss(css: string, options: ScopeOptions = {}): string {
	return transformBlock(css, options);
}
