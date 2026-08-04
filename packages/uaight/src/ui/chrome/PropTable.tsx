/**
 * PropTable — the prop documentation for the selected component (§15.2).
 * Ejectable (§11.3); `PropTableProps` is published surface (§19.5).
 *
 * **D18.** This is display metadata and nothing else. It renders what docgen
 * saw; it never turns a prop into a control, and it is not wired to the control
 * panel. Controls come from the call site (§7.6).
 */

import type { ReactElement } from "react";
import type { PropTableProps } from "../../shared/types.ts";
import { SECTION_LABEL, cx } from "../cx.ts";
import { limitationNotes, sortProps } from "../docs.ts";

export type { PropTableProps };

const CELL = "px-2 py-1 align-top";

export function PropTable({ doc }: PropTableProps): ReactElement | null {
	if (!doc) return null;

	const props = sortProps(doc.props);
	const notes = limitationNotes(doc.limitations);
	const headingId = `uaight-props-${doc.globPath}-${doc.exportName}`;

	return (
		<section
			aria-labelledby={headingId}
			className="min-w-0 border-t border-[var(--u-line)]"
		>
			<h2 id={headingId} className={cx(SECTION_LABEL, "px-2 pt-3 pb-1")}>
				Props — {doc.name}
			</h2>

			{doc.description ? (
				<p className="px-2 pb-2 text-xs text-[var(--u-fg-muted)]">{doc.description}</p>
			) : null}

			{props.length ? (
				<div className="overflow-x-auto">
					{/*
					 * A real <table>: this is tabular data, and a screen reader reading
					 * "Prop, column 1" is the entire reason not to build it from divs.
					 * `tabIndex` on the scroll container keeps the horizontal overflow
					 * reachable from the keyboard (a scrollable region that only a mouse
					 * can pan is a keyboard trap for the content inside it).
					 */}
					<table className="w-full border-collapse text-left text-xs">
						<caption className="sr-only">
							Documented props for {doc.name}, from {doc.globPath}. Display only — these are not
							editable controls.
						</caption>
						<thead>
							<tr className="text-[var(--u-fg-subtle)]">
								<th scope="col" className={CELL}>
									Prop
								</th>
								<th scope="col" className={CELL}>
									Type
								</th>
								<th scope="col" className={CELL}>
									Default
								</th>
							</tr>
						</thead>
						<tbody>
							{props.map((prop) => (
								<tr key={prop.name} className="border-t border-[var(--u-line)]">
									<th scope="row" className={cx(CELL, "font-medium text-[var(--u-fg)]")}>
										<span className="font-mono">{prop.name}</span>
										{prop.required ? (
											<>
												{" "}
												<span aria-hidden="true" className="text-[var(--u-accent)]" title="Required">
													*
												</span>
												<span className="sr-only">(required)</span>
											</>
										) : null}
										{prop.description ? (
											<span className="mt-0.5 block font-normal text-[var(--u-fg-muted)]">
												{prop.description}
											</span>
										) : null}
									</th>
									<td className={cx(CELL, "font-mono text-[var(--u-fg-muted)]")}>
										{prop.type ?? "—"}
									</td>
									<td className={cx(CELL, "font-mono text-[var(--u-fg-subtle)]")}>
										{prop.defaultValue ?? "—"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p className="px-2 pb-2 text-xs text-[var(--u-fg-muted)]">
					No props were documented for this component.
				</p>
			)}

			{/*
			 * Never conditional on there being rows: every doc carries
			 * `inherited-props`, and the caveat is what stops a partial table from
			 * reading as a complete one (§15.2).
			 */}
			{notes.length ? (
				<div className="px-2 py-2 text-xs text-[var(--u-fg-subtle)]">
					<p className="font-medium">Incomplete</p>
					<ul className="list-disc pl-4">
						{notes.map((note) => (
							<li key={note}>{note}</li>
						))}
					</ul>
				</div>
			) : null}
		</section>
	);
}
