/**
 * Opening a harvested call site in the user's own editor.
 *
 * A call-site chip says "this component is used here, with these props" and
 * then stops: the one thing anybody wants next is the line it names, and until
 * now the chip could not offer it. It does not need a new endpoint — Vite's dev
 * server already mounts `launch-editor-middleware` at `/__open-in-editor`, and
 * a `CallSite` already carries `globPath`, `line` and `column`, which is
 * exactly its argument.
 *
 * Three things make this safe to wire into chrome:
 *
 *   - It is dev-server-only. The static build (§9.3) has no such endpoint, so
 *     the call 404s and the affordance says so instead of failing silently.
 *   - It is a GET with no body, so it cannot be confused with a write API.
 *     §1.4's "no file-writing endpoint" is about *us* writing files; handing a
 *     path to the editor the user is already running is not that.
 *   - The path is the project-relative `globPath` the index produced, never
 *     anything the user typed.
 */

import type { CallSite } from "../shared/types.ts";

/** Mounted at the server root by Vite, independent of `base`. */
export const OPEN_IN_EDITOR_PATH = "/__open-in-editor";

/**
 * `launch-editor` takes `file:line:column` as one parameter and resolves it
 * against the server's working directory, so the leading slash a `globPath`
 * carries (§4.2 — it is root-relative, not filesystem-absolute) has to go.
 */
export function editorTarget(
	site: Pick<CallSite, "globPath" | "line" | "column">,
): string {
	const file = site.globPath.replace(/^\/+/, "");
	return `${file}:${site.line}:${site.column}`;
}

export function editorUrl(site: Pick<CallSite, "globPath" | "line" | "column">): string {
	return `${OPEN_IN_EDITOR_PATH}?file=${encodeURIComponent(editorTarget(site))}`;
}

export type OpenInEditorResult = "opened" | "unavailable" | "failed";

/**
 * `unavailable` and `failed` are kept apart because they need different words:
 * the first means "this is a static build, there is no dev server here", and
 * the second means "the dev server tried and your editor did not open".
 */
export async function openInEditor(
	site: Pick<CallSite, "globPath" | "line" | "column">,
	fetchImpl: typeof fetch | undefined = typeof fetch === "function" ? fetch : undefined,
): Promise<OpenInEditorResult> {
	if (!fetchImpl) return "unavailable";
	try {
		const response = await fetchImpl(editorUrl(site), { method: "GET" });
		if (response.ok) return "opened";
		// A dev server without the middleware, and the static build, both answer
		// with the index HTML or a 404 — neither is an editor that opened.
		return response.status === 404 ? "unavailable" : "failed";
	} catch {
		return "unavailable";
	}
}
