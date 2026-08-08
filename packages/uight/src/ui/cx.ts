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
	"outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--uight-accent)]";

export const MOTION = "motion-safe:transition-colors motion-safe:duration-100";

/**
 * Selection, told apart from focus.
 *
 * §10.1 spends its single accent on both, and in a keyboard-first tool with
 * roving tabindex the two diverge constantly: you arrow focus down the tree
 * without selecting, and the selected row is still the thing on screen. When
 * both were a soft accent fill there was no reading which was which, so
 * selection now takes a solid **left bar** and focus keeps the ring. They are
 * different shapes rather than two intensities of one, which is what makes
 * them legible at the same time.
 *
 * The transparent bar is always present, so selecting a row never shifts its
 * text sideways by two pixels.
 */
export const SELECTABLE = "border-l-2 border-l-transparent";
export const SELECTED =
	"border-l-[var(--uight-accent)] bg-[var(--uight-accent-soft)] font-medium text-[var(--uight-accent)]";

/**
 * A quiet, borderless control. Borders only where whitespace cannot do the job.
 *
 * Sizes come from the theme's three-step scale (§10.1) rather than arbitrary
 * pixel values: `text-xs` is 11px, `text-sm` is 12px, `text-base` is 13px, and
 * there is deliberately no fourth. Hierarchy is weight, tracking and colour.
 */
export const QUIET_BUTTON = cx(
	"inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-xs text-[var(--uight-muted)]",
	"hover:bg-[var(--uight-hover)] hover:text-[var(--uight-fg)] disabled:opacity-40 disabled:hover:bg-transparent",
	FOCUS_RING,
	MOTION,
);

/** A section heading in a sidebar or panel: quiet, and unmistakably not a row. */
export const SECTION_LABEL =
	"text-xs font-medium tracking-wide text-[var(--uight-subtle)] uppercase";
