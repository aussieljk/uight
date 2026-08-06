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
import type {
	FixtureCodec,
	RendererError,
	UightComponents,
	UightProps,
} from "../shared/types.ts";
import { UightProviderContext } from "./provider-context.ts";
import type { ThemeSetting } from "./theme.ts";

/**
 * §9.2 — written so Rollup can drop the chunk. `__UIGHT_ENABLED__` is a
 * `define` from the plugin's `config` hook, so this whole expression folds to
 * `null` in a build with `production: 'exclude'` and the dynamic import
 * disappears with it.
 */
const UightUI = __UIGHT_ENABLED__ ? lazy(() => import("./UightUI.tsx")) : null;

export function Uight(props: UightProps): ReactElement {
	if (!UightUI || props.enabled === false) return <>{props.fallback ?? null}</>;
	return (
		<Suspense fallback={props.loading ?? null}>
			<UightUI {...props} />
		</Suspense>
	);
}

/* ------------------------------------------------------------------ *
 * UightProvider — shared components, theme and codecs. §19.1
 * ------------------------------------------------------------------ */

export interface UightProviderProps {
	components?: Partial<UightComponents>;
	theme?: ThemeSetting;
	codecs?: FixtureCodec[];
	children: ReactNode;
}

export function UightProvider({
	components,
	theme,
	codecs,
	children,
}: UightProviderProps): ReactElement {
	// The value is intentionally not memoized on identity of `components`:
	// callers pass a literal, and the explorer only reads it during render.
	return (
		<UightProviderContext.Provider value={{ components, theme, codecs }}>
			{children}
		</UightProviderContext.Provider>
	);
}

/* ------------------------------------------------------------------ *
 * Fixture — one fixture, no chrome. §19.1
 * ------------------------------------------------------------------ */

export interface FixtureProps extends Pick<
	UightProps,
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
	/** A `FixtureId`, a canonical `uight:1|…` string, or the `path:name` form. */
	fixture: NonNullable<UightProps["fixture"]>;
}

export function Fixture(props: FixtureProps): ReactElement {
	return <Uight {...props} chrome={false} router="none" />;
}

/* ------------------------------------------------------------------ *
 * UightErrorBoundary — Experimental (§19.1)
 * ------------------------------------------------------------------ */

export interface UightErrorBoundaryProps {
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

export class UightErrorBoundary extends Component<
	UightErrorBoundaryProps,
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

	componentDidUpdate(previous: UightErrorBoundaryProps): void {
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
				className="uight-root p-3 text-sm leading-5 text-[var(--u-danger,#b91c1c)]"
			>
				{error.message}
			</div>
		);
	}
}
