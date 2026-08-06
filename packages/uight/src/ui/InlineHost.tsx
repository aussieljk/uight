/**
 * Inline isolation. SPEC.md §5.2.
 *
 * One realm, two ends, no postMessage: `createDirectTransportPair()` gives the
 * host the same transport interface the frame path uses, and `<RendererApp>`
 * renders in-tree. Everything above this file is identical either way, which
 * is the point — isolation is an execution model, not a different explorer.
 *
 * This module is loaded lazily by `UightUI`, so a frame-mode mount never pays
 * for the renderer, and — importantly — never evaluates the consumer's preview
 * entry, whose CSS imports would otherwise land in the HOST document.
 */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ComponentType, ReactElement, ReactNode } from "react";
import { RendererApp, createDirectTransportPair } from "../runtime/index.ts";
import type { HostTransport, StorybookPreview } from "../runtime/index.ts";
import {
	config,
	decoratorModules,
	fixtureModules,
	inventoryModules,
} from "virtual:uight/runtime";
import { THEME_ATTRIBUTE } from "../shared/types.ts";
import type { FixtureCodec, ResolvedUightTheme } from "../shared/types.ts";

export interface InlineHostProps {
	codecs: FixtureCodec[];
	/**
	 * §10.1 — stamped on this page's own `documentElement`, because inline
	 * isolation IS this page: the preview entry's providers are in the host
	 * realm, and `readUightTheme()` reads `document` either way. The contract is
	 * "the renderer document", and inline the renderer document is this one.
	 */
	theme: ResolvedUightTheme;
	onTransport: (transport: HostTransport | null) => void;
}

type Providers = ComponentType<{ children: ReactNode }> | undefined;

export function InlineHost({
	codecs,
	theme,
	onTransport,
}: InlineHostProps): ReactElement {
	const pair = useMemo(() => createDirectTransportPair(), []);
	const [root, setRoot] = useState<HTMLElement | null>(null);
	const [providers, setProviders] = useState<{ value: Providers } | null>(
		config.hasPreviewEntry ? null : { value: undefined },
	);
	const [storybookPreview, setStorybookPreview] = useState<StorybookPreview | null>(null);

	useEffect(() => {
		document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
		// Deliberately not removed on unmount: the attribute describes the document
		// a preview entry is rendering into, and clearing it as the explorer goes
		// away would flip that tree to light for as long as it outlives us.
	}, [theme]);

	/**
	 * Publish the host end, and — deliberately — do NOT dispose the pair here.
	 *
	 * The cleanup used to dispose both ends, which is correct for a resource an
	 * effect acquired and wrong for one `useMemo` produced: StrictMode runs
	 * setup, cleanup, setup against the *same* memoized pair, so the second
	 * setup published a transport that had already latched `disposed` and could
	 * never deliver again. Inline isolation was dead under StrictMode — which is
	 * React's default — and that is what "No fixture selected. for every
	 * selection" was.
	 *
	 * Nothing is leaked by leaving it: unlike the frame transport, a direct pair
	 * owns no window listener and no timer. Its ends stop delivering when their
	 * subscribers unsubscribe, which React does on unmount, and the pair is then
	 * garbage with the component that memoized it.
	 */
	useLayoutEffect(() => {
		onTransport(pair.host);
		return () => onTransport(null);
		// `pair` is created once; `onTransport` is stable in UightUI.
	}, [pair, onTransport]);

	// §6.4 — the preview entry supplies providers. Inline it shares the host
	// realm, so it is deferred until an inline mount actually needs it.
	useEffect(() => {
		if (!config.hasPreviewEntry) return;
		let live = true;
		import("virtual:uight/preview-entry")
			.then((mod) => {
				if (live) setProviders({ value: mod.Preview });
			})
			.catch((error: unknown) => {
				console.error("[uight] the preview entry failed to load.", error);
				if (live) setProviders({ value: undefined });
			});
		return () => {
			live = false;
		};
	}, []);

	// §13 — the Storybook preview's decorators wrap every story, so an inline
	// mount has to load it for the same reason the frame entry imports it.
	useEffect(() => {
		if (!config.hasStorybookPreview) return;
		let live = true;
		import("virtual:uight/storybook-preview")
			.then((mod) => {
				if (live) setStorybookPreview(mod.storybookPreview);
			})
			.catch((error: unknown) => {
				console.error("[uight] the Storybook preview module failed to load.", error);
			});
		return () => {
			live = false;
		};
	}, []);

	return (
		<div
			ref={setRoot}
			className="relative isolate h-full w-full overflow-auto bg-[var(--u-bg)]"
			data-uight-inline=""
		>
			{root && providers ? (
				<RendererApp
					root={root}
					transport={pair.renderer}
					config={config}
					fixtureModules={fixtureModules}
					decoratorModules={decoratorModules}
					inventoryModules={inventoryModules}
					codecs={codecs}
					Providers={providers.value}
					storybookPreview={storybookPreview}
				/>
			) : null}
		</div>
	);
}
