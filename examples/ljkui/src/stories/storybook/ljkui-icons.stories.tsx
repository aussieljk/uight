/**
 * The icon set, browsable.
 *
 * This replaces two stories that came from frosted-ui — its icon gallery and
 * its pictogram gallery. Neither survived the move: frosted-ui ships hundreds
 * of hand-drawn glyphs named by size (`Bell16`, `Bell24`), and ljkui ships a
 * *registry* instead — ninety-odd canonical names (`Icons.Bell`) drawn by
 * whichever icon library the app registered as its adapter. The old galleries
 * were built entirely around parsing the size out of an export name, so there
 * was nothing left of them to port.
 *
 * What this shows instead is the thing worth knowing about the registry: every
 * canonical name, at whatever size the surrounding text sets, from the adapter
 * this example registers in `src/uight.preview.tsx`. Swap the adapter there and
 * this grid redraws in the new library without a line changing here.
 */

import type { Meta, StoryObj } from "../csf-types";

import { Card, Input, ScrollArea, Typography } from "ljkui";
import { CANONICAL_ICON_NAMES, Icons } from "ljkui/icons";
import * as React from "react";

const meta = {
	title: "Utilities/Icons",
	parameters: { layout: "fullscreen" },
} satisfies Meta<() => React.JSX.Element>;

export default meta;
type Story = StoryObj<typeof meta>;

function IconGrid({ size }: { size: number }): React.JSX.Element {
	const [query, setQuery] = React.useState("");
	const needle = query.trim().toLowerCase();
	const names = needle
		? CANONICAL_ICON_NAMES.filter((name) => name.toLowerCase().includes(needle))
		: CANONICAL_ICON_NAMES;

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
			<Input.Root size="2">
				<Input.Slot>
					<Icons.Search />
				</Input.Slot>
				<Input.Control
					value={query}
					placeholder={`Search ${String(CANONICAL_ICON_NAMES.length)} icons`}
					aria-label="Search icons"
					onChange={(event) => setQuery(event.target.value)}
				/>
			</Input.Root>

			<ScrollArea style={{ maxHeight: 520 }}>
				<div
					style={{
						display: "grid",
						gap: 8,
						gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
					}}
				>
					{names.map((name) => {
						const Icon = Icons[name];
						return (
							<Card key={name} size="1">
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										gap: 6,
									}}
								>
									<Icon width={size} height={size} />
									<Typography.Text size="1" color="gray" trim="both">
										{name}
									</Typography.Text>
								</div>
							</Card>
						);
					})}
				</div>
			</ScrollArea>

			{names.length === 0 ? (
				<Typography.Text size="2" color="gray">
					No icon is named like “{query}”.
				</Typography.Text>
			) : null}
		</div>
	);
}

export const AllIcons: Story = {
	render: () => <IconGrid size={20} />,
};

/** The registry has no size axis; an icon is whatever size it is asked to be. */
export const Large: Story = {
	render: () => <IconGrid size={32} />,
};
