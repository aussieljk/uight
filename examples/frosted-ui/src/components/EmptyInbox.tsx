/**
 * Another inventory-only component (SPEC §12). Unlike `StatCard` this one has
 * no required props, so selecting it in the inventory renders it successfully
 * — which is the case worth seeing next to a failure, because it shows the
 * inventory is a real preview and not a static listing.
 */

import { Button, EmptyState } from "frosted-ui";

export function EmptyInbox({ onCompose }: { onCompose?: () => void } = {}) {
	return (
		<EmptyState.Root>
			<EmptyState.Header>
				<EmptyState.Title>Nothing here yet</EmptyState.Title>
				<EmptyState.Description>
					Messages you receive will show up in this list.
				</EmptyState.Description>
			</EmptyState.Header>
			<EmptyState.Actions>
				<Button variant="soft" onClick={onCompose}>
					Compose
				</Button>
			</EmptyState.Actions>
		</EmptyState.Root>
	);
}
