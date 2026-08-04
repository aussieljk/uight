/**
 * The eager entry. SPEC.md §9.2, §19.1.
 *
 * Everything here must stay small and free of virtual-module imports: this is
 * what a consumer's application bundle keeps even when the explorer is gated
 * out. The explorer itself is behind one `React.lazy` guarded by a
 * compile-time constant, so `production: 'exclude'` genuinely removes the
 * chunk rather than loading it and declining to render.
 */

import { Component, Suspense, lazy } from "react";
import type { ErrorInfo, ReactElement, ReactNode } from "react";
import type { FixtureCodec, RendererError, UaightComponents, UaightProps } from "../shared/types.ts";
import { UaightProviderContext } from "./provider-context.ts";
import type { ThemeSetting } from "./theme.ts";

/**
 * §9.2 — written so Rollup can drop the chunk. `__UAIGHT_ENABLED__` is a
 * `define` from the plugin's `config` hook, so this whole expression folds to
 * `null` in a build with `production: 'exclude'` and the dynamic import
 * disappears with it.
 */
const UaightUI = __UAIGHT_ENABLED__ ? lazy(() => import("./UaightUI.tsx")) : null;

export function Uaight(props: UaightProps): ReactElement {
	if (!UaightUI || props.enabled === false) return <>{props.fallback ?? null}</>;
	return (
		<Suspense fallback={props.loading ?? null}>
			<UaightUI {...props} />
		</Suspense>
	);
}

/* ------------------------------------------------------------------ *
 * UaightProvider — shared components, theme and codecs. §19.1
 * ------------------------------------------------------------------ */

export interface UaightProviderProps {
	components?: Partial<UaightComponents>;
	theme?: ThemeSetting;
	codecs?: FixtureCodec[];
	children: ReactNode;
}

export function UaightProvider({
	components,
	theme,
	codecs,
	children,
}: UaightProviderProps): ReactElement {
	// The value is intentionally not memoized on identity of `components`:
	// callers pass a literal, and the explorer only reads it during render.
	return (
		<UaightProviderContext.Provider value={{ components, theme, codecs }}>
			{children}
		</UaightProviderContext.Provider>
	);
}

/* ------------------------------------------------------------------ *
 * Fixture — one fixture, no chrome. §19.1
 * ------------------------------------------------------------------ */

export interface FixtureProps
	extends Pick<
		UaightProps,
		| "isolation"
		| "height"
		| "className"
		| "style"
		| "components"
		| "theme"
		| "enabled"
		| "fallback"
		| "loading"
		| "previewDocumentUrl"
	> {
	/** A `FixtureId`, a canonical `uaight:1|…` string, or the `path:name` form. */
	fixture: NonNullable<UaightProps["fixture"]>;
}

export function Fixture(props: FixtureProps): ReactElement {
	return <Uaight {...props} chrome={false} router="none" />;
}

/* ------------------------------------------------------------------ *
 * UaightErrorBoundary — Experimental (§19.1)
 * ------------------------------------------------------------------ */

export interface UaightErrorBoundaryProps {
	children: ReactNode;
	/** Receives the same shape the renderer reports, so one handler covers both. */
	fallback?: ReactNode | ((error: RendererError) => ReactNode);
	onError?: (error: RendererError) => void;
	/** Change this to clear a caught error — a fixture id works well. */
	resetKey?: unknown;
}

interface BoundaryState {
	error: RendererError | null;
}

export class UaightErrorBoundary extends Component<
	UaightErrorBoundaryProps,
	BoundaryState
> {
	state: BoundaryState = { error: null };

	static getDerivedStateFromError(error: unknown): BoundaryState {
		return {
			error: {
				kind: "fixture",
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			},
		};
	}

	componentDidCatch(error: unknown, info: ErrorInfo): void {
		const reported: RendererError = {
			kind: "fixture",
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			componentStack: info.componentStack ?? undefined,
		};
		this.setState({ error: reported });
		this.props.onError?.(reported);
	}

	componentDidUpdate(previous: UaightErrorBoundaryProps): void {
		if (this.state.error && previous.resetKey !== this.props.resetKey) {
			this.setState({ error: null });
		}
	}

	render(): ReactNode {
		const { error } = this.state;
		if (!error) return this.props.children;
		const { fallback } = this.props;
		if (typeof fallback === "function") return fallback(error);
		if (fallback !== undefined) return fallback;
		return (
			<div
				role="alert"
				className="uaight-root p-3 text-sm leading-5 text-[var(--u-danger,#b91c1c)]"
			>
				{error.message}
			</div>
		);
	}
}
