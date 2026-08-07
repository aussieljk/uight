/**
 * Another inventory-only component (SPEC §12). Unlike `StatCard` this one has
 * no required props, so selecting it in the inventory renders it successfully
 * — which is the case worth seeing next to a failure, because it shows the
 * inventory is a real preview and not a static listing.
 */

import { Button, Empty } from "ljkui";

export function EmptyInbox({ onCompose }: { onCompose?: () => void } = {}) {
	return (
		<Empty.Root>
			<Empty.Header>
				<Empty.Title>Nothing here yet</Empty.Title>
				<Empty.Description>Messages you receive will show up in this list.</Empty.Description>
			</Empty.Header>
			<Empty.Actions>
				<Button variant="soft" onClick={onCompose}>
					Compose
				</Button>
			</Empty.Actions>
		</Empty.Root>
	);
}
