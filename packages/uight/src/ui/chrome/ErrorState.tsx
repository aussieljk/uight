/**
 * ErrorState — a fixture, decorator, module, bootstrap or protocol failure.
 * Ejectable (§11.3).
 *
 * §3.3: a throwing decorator is reported as a decorator error naming the file,
 * not as a fixture error. §12: when a detected component fails, name the props
 * it looks like it needed — a bare stack trace is not an answer to "why".
 */

import type { ReactElement } from "react";
import type { ErrorStateProps, RendererError } from "../../shared/types.ts";
import { FOCUS_RING, MOTION, cx } from "../cx.ts";

const KIND_LABEL: Record<RendererError["kind"], string> = {
	fixture: "This fixture threw while rendering",
	decorator: "A decorator threw while rendering",
	bootstrap: "The preview could not start",
	module: "The module could not be loaded",
	protocol: "The preview and the explorer could not agree",
};

/**
 * §12 — required-prop names, without docgen. We do not guess types; we report
 * the property names the failure actually mentions, which for a component
 * rendered with no props is almost always the answer.
 */
export function guessRequiredProps(error: RendererError): string[] {
	const text = `${error.message}\n${error.stack ?? ""}`;
	const names = new Set<string>();
	const patterns = [
		/reading ['"`]([A-Za-z_$][\w$]*)['"`]/g,
		/undefined \(reading ['"`]([A-Za-z_$][\w$]*)['"`]\)/g,
		/['"`]([A-Za-z_$][\w$]*)['"`] is (?:not defined|undefined|required)/g,
		/(?:prop|property) ['"`]([A-Za-z_$][\w$]*)['"`]/gi,
	];
	for (const pattern of patterns) {
		for (const match of text.matchAll(pattern)) {
			if (match[1]) names.add(match[1]);
		}
	}
	return [...names].slice(0, 8);
}

export function ErrorState({ error, onRetry }: ErrorStateProps): ReactElement {
	const props =
		error.kind === "fixture" || error.kind === "module" ? guessRequiredProps(error) : [];

	return (
		<div className="h-full w-full overflow-auto p-6" role="alert">
			<div className="mx-auto max-w-160">
				<p className="text-base font-medium text-[var(--u-danger)]">
					{KIND_LABEL[error.kind]}
				</p>
				{error.file ? (
					<p className="mt-1 text-xs text-[var(--u-fg-subtle)]">{error.file}</p>
				) : null}
				<p className="mt-3 text-sm leading-5 whitespace-pre-wrap text-[var(--u-fg)]">
					{error.message}
				</p>

				{props.length ? (
					<div className="mt-4 rounded-sm border border-[var(--u-line)] bg-[var(--u-bg-sunken)] p-3">
						<p className="text-xs font-medium text-[var(--u-fg)]">
							Props this render seems to need
						</p>
						<p className="mt-1 text-xs leading-5 text-[var(--u-fg-muted)]">
							{props.join(", ")}
						</p>
						<p className="mt-2 text-xs leading-5 text-[var(--u-fg-subtle)]">
							Detected components are rendered with no props. Write a fixture file to give it the
							props it needs.
						</p>
					</div>
				) : null}

				{error.componentStack ? (
					<details className="mt-4">
						<summary
							className={cx(
								"cursor-pointer text-xs text-[var(--u-fg-muted)] select-none hover:text-[var(--u-fg)]",
								FOCUS_RING,
							)}
						>
							Component stack
						</summary>
						<pre className="mt-2 overflow-auto text-xs leading-5 text-[var(--u-fg-subtle)]">
							{error.componentStack}
						</pre>
					</details>
				) : null}

				{error.stack ? (
					<details className="mt-2">
						<summary
							className={cx(
								"cursor-pointer text-xs text-[var(--u-fg-muted)] select-none hover:text-[var(--u-fg)]",
								FOCUS_RING,
							)}
						>
							Stack
						</summary>
						<pre className="mt-2 overflow-auto text-xs leading-5 text-[var(--u-fg-subtle)]">
							{error.stack}
						</pre>
					</details>
				) : null}

				{onRetry ? (
					<button
						type="button"
						onClick={onRetry}
						className={cx(
							"mt-5 h-7 rounded-sm border border-[var(--u-line-strong)] px-2.5 text-sm text-[var(--u-fg)]",
							"hover:bg-[var(--u-bg-hover)]",
							FOCUS_RING,
							MOTION,
						)}
					>
						Reload the preview
					</button>
				) : null}
			</div>
		</div>
	);
}
