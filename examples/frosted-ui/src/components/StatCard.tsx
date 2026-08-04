/**
 * A component with **no fixture and no story**, here to populate the component
 * inventory (SPEC §12).
 *
 * Job 1 in §1.3 is "see what exists": point uaight at a codebase with no
 * fixtures at all and get something immediately useful. The detection pass is
 * syntax only — an exported PascalCase name with a function, `memo` or
 * `forwardRef` shape — so it stays fast and needs no docgen (§15.1).
 *
 * This one takes required props on purpose. Selecting it in the inventory
 * renders it with none, which is the case §12 calls out: the error boundary
 * catches the failure and the missing prop names are shown. It is also the
 * honest demonstration of the safety wording — rendering runs this component's
 * real code, and frame isolation contains DOM, CSS and global listeners, not
 * network requests or backend effects.
 */

import { Badge, Card, Heading, Text } from "frosted-ui";

export interface StatCardProps {
	label: string;
	value: string;
	delta: number;
}

export function StatCard({ label, value, delta }: StatCardProps) {
	const direction = delta >= 0 ? "up" : "down";

	return (
		<Card size="2" style={{ width: 220 }}>
			<Text size="1" color="gray">
				{label.toUpperCase()}
			</Text>
			<Heading size="6" style={{ marginTop: 4 }}>
				{value}
			</Heading>
			<Badge
				color={delta >= 0 ? "green" : "red"}
				style={{ marginTop: 8 }}
			>
				{direction === "up" ? "▲" : "▼"} {Math.abs(delta)}%
			</Badge>
		</Card>
	);
}
