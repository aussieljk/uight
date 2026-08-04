/**
 * Renderer error boundaries — SPEC.md §3.3, §19.3.
 *
 * The interesting requirement is attribution: "a throwing decorator is caught
 * by the fixture error boundary and reported as a **decorator** error naming
 * the file, not as a fixture error." A boundary can only catch what is below
 * it, so each decorator gets its own boundary placed immediately *outside* it,
 * and the fixture gets the innermost one. Whoever throws, the nearest boundary
 * above it already knows what it is wrapping.
 */

import * as React from "react";
import type { RendererError } from "../shared/types.ts";

export interface RendererErrorBoundaryProps {
	kind: RendererError["kind"];
	/** Named by a decorator error, or the module that failed to load. */
	file?: string;
	/** Prefixed onto the message, e.g. the fixture or story that owns it. */
	label?: string;
	onError?: (error: RendererError) => void;
	/** Changing this clears a caught error — fixture change, or a retry. */
	resetKey?: string;
	fallback?: (error: RendererError, reset: () => void) => React.ReactNode;
	children: React.ReactNode;
}

interface State {
	error: RendererError | null;
	resetKey: string | undefined;
}

export function toRendererError(
	error: unknown,
	kind: RendererError["kind"],
	extra: { file?: string; label?: string; componentStack?: string } = {},
): RendererError {
	const base =
		error instanceof Error
			? { message: error.message, stack: error.stack }
			: { message: String(error) };
	const out: RendererError = {
		kind,
		message: extra.label ? `${extra.label}: ${base.message}` : base.message,
	};
	if (base.stack) out.stack = base.stack;
	if (extra.file) out.file = extra.file;
	if (extra.componentStack) out.componentStack = extra.componentStack;
	return out;
}

export class RendererErrorBoundary extends React.Component<RendererErrorBoundaryProps, State> {
	constructor(props: RendererErrorBoundaryProps) {
		super(props);
		this.state = { error: null, resetKey: props.resetKey };
	}

	static getDerivedStateFromProps(
		props: RendererErrorBoundaryProps,
		state: State,
	): Partial<State> | null {
		if (props.resetKey !== state.resetKey) {
			return { error: null, resetKey: props.resetKey };
		}
		return null;
	}

	static getDerivedStateFromError(error: unknown): Partial<State> {
		return { error: toRendererError(error, "fixture") };
	}

	override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
		const rendererError = toRendererError(error, this.props.kind, {
			file: this.props.file,
			label: this.props.label,
			componentStack: info.componentStack ?? undefined,
		});
		this.setState({ error: rendererError });
		this.props.onError?.(rendererError);
	}

	private reset = (): void => {
		this.setState({ error: null });
	};

	override render(): React.ReactNode {
		const { error } = this.state;
		if (!error) return this.props.children;
		// componentDidCatch has not run yet on the very first paint after a
		// throw; normalize the kind so the fallback never lies about it.
		const shown = error.kind === this.props.kind ? error : { ...error, kind: this.props.kind };
		if (this.props.fallback) return this.props.fallback(shown, this.reset);
		return <ErrorPanel error={shown} />;
	}
}

/* ------------------------------------------------------------------ *
 * A minimal in-realm error display.
 *
 * The chrome renders its own ErrorState from RENDERER_ERROR; this exists so a
 * frame is never silently blank, and so inline mode without chrome still says
 * what happened. Inline styles only — the renderer must not depend on our
 * stylesheet having been injected.
 * ------------------------------------------------------------------ */

const panelStyle: React.CSSProperties = {
	font: "13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
	color: "#b42318",
	background: "#fff",
	border: "1px solid #f0c4c0",
	borderRadius: 6,
	padding: "12px 14px",
	margin: 12,
	whiteSpace: "pre-wrap",
	overflowWrap: "anywhere",
};

const KIND_LABEL: Record<RendererError["kind"], string> = {
	fixture: "Fixture error",
	decorator: "Decorator error",
	bootstrap: "Bootstrap error",
	module: "Module error",
	protocol: "Protocol error",
};

export function ErrorPanel(props: { error: RendererError }): React.ReactElement {
	const { error } = props;
	return (
		<div style={panelStyle} role="alert" data-uaight-error={error.kind}>
			<strong>{KIND_LABEL[error.kind]}</strong>
			{error.file ? <div>{error.file}</div> : null}
			<div>{error.message}</div>
		</div>
	);
}
