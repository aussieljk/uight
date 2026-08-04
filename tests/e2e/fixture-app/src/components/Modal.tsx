/**
 * A portal into the frame document's own `body`. The whole point of frame
 * isolation (SPEC §5.2) is that this lands in the frame's DOM and not in the
 * host's, and a portal is the case most likely to escape — so the e2e suite
 * asserts on which document ends up owning the node.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export function Modal({ title, children }: { title: string; children?: ReactNode }) {
	const [host, setHost] = useState<HTMLElement | null>(null);

	useEffect(() => {
		const el = document.createElement("div");
		el.setAttribute("data-portal-host", "");
		document.body.appendChild(el);
		setHost(el);
		return () => el.remove();
	}, []);

	if (!host) return null;

	return createPortal(
		<div role="dialog" aria-label={title} data-e2e="modal">
			<h2>{title}</h2>
			{children}
		</div>,
		host,
	);
}
