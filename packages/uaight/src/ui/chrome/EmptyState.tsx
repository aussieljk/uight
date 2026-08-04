/**
 * EmptyState — nothing selected, nothing found, or a well-formed id that does
 * not resolve. Ejectable (§11.3).
 *
 * §5.4: a well-formed but unknown id keeps its URL parameter and shows this,
 * because it may become valid after HMR or a deploy.
 */

import type { ReactElement } from "react";
import type { EmptyStateProps } from "../../shared/types.ts";

export function EmptyState({ title, description }: EmptyStateProps): ReactElement {
	return (
		<div className="flex h-full min-h-40 w-full items-center justify-center p-8">
			<div className="max-w-80 text-center">
				<p className="text-base font-medium text-[var(--u-fg)]">{title}</p>
				{description ? (
					<div className="mt-2 text-sm leading-5 text-[var(--u-fg-muted)]">{description}</div>
				) : null}
			</div>
		</div>
	);
}
