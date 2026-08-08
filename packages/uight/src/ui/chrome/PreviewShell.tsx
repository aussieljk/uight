/**
 * PreviewShell — borders, background, toolbar and loading presentation.
 * Ejectable (§11.3).
 *
 * The shell owns the viewport box (§6.5): the host inside it always fills
 * 100%, so switching between frame and inline changes nothing here.
 */

import type { CSSProperties, ReactElement } from "react";
import type { PreviewShellProps } from "../../shared/types.ts";

export function PreviewShell({
	children,
	loading,
	viewport,
	toolbar,
	subToolbar,
}: PreviewShellProps): ReactElement {
	const box: CSSProperties | undefined = viewport
		? { width: viewport.width, height: viewport.height, maxWidth: "100%" }
		: undefined;

	return (
		<div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[var(--uight-canvas)]">
			{toolbar}
			{subToolbar ? (
				<div className="shrink-0 border-b border-[var(--uight-line)] bg-[var(--uight-sunken)]">
					{subToolbar}
				</div>
			) : null}
			<div className="relative flex min-h-0 flex-1 flex-col">
				{/*
				 * Recessive progress: one hairline, never a spinner over the fixture.
				 *
				 * It used to pulse, and a blinking accent-coloured line across the top
				 * of the preview is the loudest thing on the screen — the opposite of
				 * what §10.2 asks of the chrome, and it reads as an error rather than
				 * as progress. It fades in and holds still.
				 */}
				<div
					aria-hidden={!loading}
					className={
						"pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-[var(--uight-line-strong)] " +
						"motion-safe:transition-opacity motion-safe:duration-100 " +
						(loading ? "opacity-100" : "opacity-0")
					}
				/>
				<span aria-live="polite" className="sr-only">
					{loading ? "Loading the preview" : ""}
				</span>
				<div
					className={
						"flex min-h-0 flex-1 justify-center overflow-auto " +
						(viewport ? "items-start p-4" : "items-stretch")
					}
				>
					<div
						style={box}
						className={
							viewport
								? "shrink-0 overflow-hidden border border-[var(--uight-line)] bg-[var(--uight-surface)]"
								: "min-h-0 w-full bg-[var(--uight-surface)]"
						}
					>
						{children}
					</div>
				</div>
			</div>
		</div>
	);
}
