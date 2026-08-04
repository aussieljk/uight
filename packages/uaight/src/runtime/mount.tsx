/**
 * Frame realm entry — SPEC.md §6.2 step 5, §8.2.
 *
 * `mountRenderer` performs the child half of the handshake and only then
 * renders. A bootstrap or version failure paints an explicit panel: a blank
 * frame is the one outcome §8.2 rules out.
 */

import * as React from "react";
import { createRoot } from "react-dom/client";
import type { InitMessage } from "../shared/protocol.ts";
import type { RendererError } from "../shared/types.ts";
import { ErrorPanel } from "./error-boundary.tsx";
import type { MountRendererOptions } from "./RendererApp.tsx";
import { RendererApp } from "./RendererApp.tsx";
import { createRendererChildTransport } from "./transport.ts";

export function mountRenderer(options: MountRendererOptions): () => void {
	const root = createRoot(options.root);
	let disposed = false;
	let init: InitMessage | null = null;
	let generation = 0;

	const showError = (error: RendererError): void => {
		if (disposed) return;
		root.render(<ErrorPanel error={error} />);
	};

	const child = createRendererChildTransport({ onMismatch: showError });

	const render = (): void => {
		if (disposed) return;
		root.render(
			<RendererApp
				{...options}
				key={generation}
				transport={child.transport}
				isolation="frame"
				root={options.root}
				initialFixture={init?.initialFixture ?? null}
				initialOverlays={init?.overlays ?? []}
			/>,
		);
	};

	void child.ready.then((message) => {
		init = message;
		generation++;
		render();
	});

	// A re-INIT means the host decided we reloaded: rebuild from the overlays
	// it replayed rather than keeping half of a previous mount.
	child.onReinit((message) => {
		init = message;
		generation++;
		render();
	});

	return () => {
		if (disposed) return;
		disposed = true;
		child.transport.dispose();
		root.unmount();
	};
}
