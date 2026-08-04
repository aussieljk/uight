/**
 * A third inventory-only component (SPEC §12), written as
 * `memo(forwardRef(...))` because that is the shape the detection pass has to
 * recognise beyond a plain function declaration. If this one is missing from
 * the inventory list, the syntax filter in §12 step 2 has a gap.
 */

import { Avatar, Badge, Text } from "frosted-ui";
import * as React from "react";

export interface UserChipProps {
	name: string;
	role?: string;
	src?: string;
}

export const UserChip = React.memo(
	React.forwardRef<HTMLDivElement, UserChipProps>(function UserChip(
		{ name, role, src },
		ref,
	) {
		const initials = name
			.split(" ")
			.map((part) => part[0])
			.join("")
			.slice(0, 2);

		return (
			<div
				ref={ref}
				style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
			>
				<Avatar size="1" src={src} fallback={initials} />
				<Text size="2">{name}</Text>
				{role ? <Badge color="gray">{role}</Badge> : null}
			</div>
		);
	}),
);
