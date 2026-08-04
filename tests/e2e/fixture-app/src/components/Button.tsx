/**
 * A component with no fixture file of its own, so §12 inventory detection and
 * §12.2 call-site harvesting have something to find. The call sites live in
 * `src/main.tsx`.
 */
import type { ReactNode } from "react";

export interface ButtonProps {
	label: string;
	variant?: "primary" | "secondary";
	disabled?: boolean;
	children?: ReactNode;
}

export function Button({ label, variant = "primary", disabled = false }: ButtonProps) {
	return (
		<button type="button" data-variant={variant} disabled={disabled}>
			{label}
		</button>
	);
}
