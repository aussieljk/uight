/**
 * The preview entry (SPEC §6.4) — this site's whole runtime, such as it is.
 *
 * It executes inside the frame realm, once, before any page renders. Two jobs:
 * load the stylesheet where the pages actually live (Vite's CSS handling
 * targets the frame's document from here, and only from here), and hold the
 * Suspense boundary the highlighter needs.
 *
 * That boundary belongs here rather than in `Page`. `use(highlighter())`
 * suspends exactly once per realm — the first page anyone opens — and a
 * boundary inside `Page` would unmount and remount the article around it. One
 * boundary above every page, and the fallback is seen once.
 */

import "./doc.css";

import { Suspense } from "react";
import type { ReactNode } from "react";

export function Preview({ children }: { children: ReactNode }) {
	return (
		<Suspense fallback={<div className="doc-loading">Loading…</div>}>{children}</Suspense>
	);
}
