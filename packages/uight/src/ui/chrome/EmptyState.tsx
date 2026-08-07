/**
 * EmptyState — nothing selected, nothing found, or a well-formed id that does
 * not resolve. Ejectable (§11.3).
 *
 * §5.4: a well-formed but unknown id keeps its URL parameter and shows this,
 * because it may become valid after HMR or a deploy.
 */

import { Empty } from "ljkui";
import type { ReactElement } from "react";
import type { EmptyStateProps } from "../../shared/types.ts";

export function EmptyState({ title, description }: EmptyStateProps): ReactElement {
	return (
		<Empty.Root className="h-full min-h-40 w-full p-8">
			<Empty.Header>
				<Empty.Title>{title}</Empty.Title>
				{/* `description` is a node, not a string — §5.4's unresolved-id state
				    puts an id and a hint in it — so it goes in as children rather
				    than being read as text. */}
				{description ? <Empty.Description>{description}</Empty.Description> : null}
			</Empty.Header>
		</Empty.Root>
	);
}
