/** Class-name join. Small enough that an ejected file can inline it. */
export function cx(...parts: Array<string | false | null | undefined>): string {
	return parts.filter(Boolean).join(" ");
}

/**
 * Shared interaction classes. SPEC.md §10.1: one accent, used only for
 * selection and focus; visible focus rings; motion under 150ms honouring
 * `prefers-reduced-motion`.
 */
export const FOCUS_RING =
	"outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--u-accent)]";

export const MOTION = "motion-safe:transition-colors motion-safe:duration-100";

/** A quiet, borderless control. Borders only where whitespace cannot do the job. */
export const QUIET_BUTTON = cx(
	"inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] text-[var(--u-fg-muted)]",
	"hover:bg-[var(--u-bg-hover)] hover:text-[var(--u-fg)] disabled:opacity-40 disabled:hover:bg-transparent",
	FOCUS_RING,
	MOTION,
);
