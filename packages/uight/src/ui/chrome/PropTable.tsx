/**
 * PropTable — the prop documentation for the selected component (§15.2).
 * Ejectable (§11.3); `PropTableProps` is published surface (§19.5).
 *
 * **D18.** This is display metadata and nothing else. It renders what docgen
 * saw; it never turns a prop into a control, and it is not wired to the control
 * panel. Controls come from the call site (§7.6).
 */

import { Table, Typography } from "ljkui";
import type { ReactElement } from "react";
import type { PropTableProps } from "../../shared/types.ts";
import { SECTION_LABEL, cx } from "../cx.ts";
import { limitationNotes, sortProps } from "../docs.ts";

export type { PropTableProps };

export function PropTable({ doc }: PropTableProps): ReactElement | null {
	if (!doc) return null;

	const props = sortProps(doc.props);
	const notes = limitationNotes(doc.limitations);
	const headingId = `uight-props-${doc.globPath}-${doc.exportName}`;

	return (
		<section
			aria-labelledby={headingId}
			className="min-w-0 border-t border-[var(--u-line)]"
		>
			<h2 id={headingId} className={cx(SECTION_LABEL, "px-2 pt-3 pb-1")}>
				Props — {doc.name}
			</h2>

			{doc.description ? (
				<Typography.Text render={<p />} size="1" color="gray" className="px-2 pb-2">
					{doc.description}
				</Typography.Text>
			) : null}

			{props.length ? (
				// A real <table>, which is what ljkui's `Table` renders: this is
				// tabular data, and a screen reader reading "Prop, column 1" is the
				// entire reason not to build it from divs. `Table.Root` owns the
				// horizontal scroll container, so the overflow stays reachable
				// without a scrollable region only a mouse can pan.
				<Table.Root size="1" variant="ghost">
					<Table.Header>
						<Table.Row>
							<Table.ColumnHeaderCell>Prop</Table.ColumnHeaderCell>
							<Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
							<Table.ColumnHeaderCell>Default</Table.ColumnHeaderCell>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{props.map((prop) => (
							<Table.Row key={prop.name}>
								<Table.RowHeaderCell>
									<Typography.Code size="1">{prop.name}</Typography.Code>
									{prop.required ? (
										<>
											{" "}
											<span aria-hidden="true" className="text-[var(--u-accent)]" title="Required">
												*
											</span>
											<span className="uight-sr-only">(required)</span>
										</>
									) : null}
									{prop.description ? (
										<Typography.Text
											size="1"
											color="gray"
											weight="regular"
											className="mt-0.5 block"
										>
											{prop.description}
										</Typography.Text>
									) : null}
								</Table.RowHeaderCell>
								<Table.Cell>
									<Typography.Code size="1" color="gray">
										{prop.type ?? "—"}
									</Typography.Code>
								</Table.Cell>
								<Table.Cell>
									<Typography.Code size="1" color="gray">
										{prop.defaultValue ?? "—"}
									</Typography.Code>
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table.Root>
			) : (
				<Typography.Text render={<p />} size="1" color="gray" className="px-2 pb-2">
					No props were documented for this component.
				</Typography.Text>
			)}

			{/*
			 * Never conditional on there being rows: every doc carries
			 * `inherited-props`, and the caveat is what stops a partial table from
			 * reading as a complete one (§15.2).
			 */}
			{notes.length ? (
				<div className="px-2 py-2">
					<Typography.Text render={<p />} size="1" color="gray" weight="medium">
						Incomplete
					</Typography.Text>
					<Typography.Text render={<ul />} size="1" color="gray" className="list-disc pl-4">
						{notes.map((note) => (
							<li key={note}>{note}</li>
						))}
					</Typography.Text>
				</div>
			) : null}
		</section>
	);
}
