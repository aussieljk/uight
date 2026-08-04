/**
 * Inline isolation. SPEC.md §5.2.
 *
 * One realm, two ends, no postMessage: `createDirectTransportPair()` gives the
 * host the same transport interface the frame path uses, and `<RendererApp>`
 * renders in-tree. Everything above this file is identical either way, which
 * is the point — isolation is an execution model, not a different explorer.
 *
 * This module is loaded lazily by `UaightUI`, so a frame-mode mount never pays
 * for the renderer, and — importantly — never evaluates the consumer's preview
 * entry, whose CSS imports would otherwise land in the HOST document.
 */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ComponentType, ReactElement, ReactNode } from "react";
import { RendererApp, createDirectTransportPair } from "../runtime/index.ts";
import type { HostTransport } from "../runtime/index.ts";
import {
	config,
	decoratorModules,
	fixtureModules,
	inventoryModules,
} from "virtual:uaight/runtime";
import type { FixtureCodec } from "../shared/types.ts";

export interface InlineHostProps {
	codecs: FixtureCodec[];
	onTransport: (transport: HostTransport | null) => void;
}

type Providers = ComponentType<{ children: ReactNode }> | undefined;

export function InlineHost({ codecs, onTransport }: InlineHostProps): ReactElement {
	const pair = useMemo(() => createDirectTransportPair(), []);
	const [root, setRoot] = useState<HTMLElement | null>(null);
	const [providers, setProviders] = useState<{ value: Providers } | null>(
		config.hasPreviewEntry ? null : { value: undefined },
	);

	useLayoutEffect(() => {
		onTransport(pair.host);
		return () => {
			onTransport(null);
			pair.host.dispose();
			pair.renderer.dispose();
		};
		// `pair` is created once; `onTransport` is stable in UaightUI.
	}, [pair, onTransport]);

	// §6.4 — the preview entry supplies providers. Inline it shares the host
	// realm, so it is deferred until an inline mount actually needs it.
	useEffect(() => {
		if (!config.hasPreviewEntry) return;
		let live = true;
		import("virtual:uaight/preview-entry")
			.then((mod) => {
				if (live) setProviders({ value: mod.Preview });
			})
			.catch((error: unknown) => {
				console.error("[uaight] the preview entry failed to load.", error);
				if (live) setProviders({ value: undefined });
			});
		return () => {
			live = false;
		};
	}, []);

	return (
		<div
			ref={setRoot}
			className="relative isolate h-full w-full overflow-auto bg-[var(--u-bg)]"
			data-uaight-inline=""
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
				/>
			) : null}
		</div>
	);
}
