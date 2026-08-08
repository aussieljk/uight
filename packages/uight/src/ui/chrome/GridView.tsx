/**
 * Grid mode — every fixture at once, as a contact sheet.
 *
 * The explorer is built around one selection at a time, which is right when the
 * question is "what does this look like" and wrong when it is "what do we
 * have". A design system's answer to the second question is visual: forty tiles
 * where a wrong one is obvious at a glance, and clicking it opens the single
 * view already selected.
 *
 * ── Why each tile is a frame ────────────────────────────────────────────────
 * The alternative is one frame rendering forty fixtures side by side, which is
 * cheaper and wrong: §6.2's isolation is per realm, so forty fixtures in one
 * document share global listeners, `document.body` and any CSS one of them
 * injects. The tile that breaks the grid would be indistinguishable from the
 * tile that breaks its neighbour. Each tile gets a realm, and the cost is paid
 * where it belongs — by not mounting tiles nobody is looking at.
 *
 * ── The cost control ────────────────────────────────────────────────────────
 * A tile mounts when it scrolls near the viewport and never unmounts: an
 * `IntersectionObserver` with a generous root margin, plus a hard cap on how
 * many tiles may be live at once. Past the cap a tile shows its label and a
 * "Render" button, so a 600-fixture corpus degrades into a list you can still
 * read rather than 600 iframes and a stalled tab. Nothing renders on hover, on
 * expansion or in bulk — §12's rule holds here exactly as it does in the tree.
 */

import { Button, Card, Typography } from "ljkui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { fixtureIdsEqual, serializeFixtureId } from "../../shared/fixture-id.ts";
import type { FixtureId, ResolvedUightTheme } from "../../shared/types.ts";
import { FrameHost } from "../FrameHost.tsx";

export interface GridTile {
	fixture: FixtureId;
	/** What the tree calls this row. */
	label: string;
	/** The file it came from, shown under the label. */
	path: string;
}

export interface GridViewProps {
	tiles: readonly GridTile[];
	selected: FixtureId | null;
	rendererEntryUrl: string;
	rendererStyleUrls?: readonly string[] | undefined;
	dev: boolean;
	previewDocumentUrl?: string | undefined;
	theme: ResolvedUightTheme;
	/** Tile height in pixels. The width comes from the grid's own track sizing. */
	tileHeight: number;
	/** How many tiles may hold a live frame at once. */
	budget: number;
	onSelect: (id: FixtureId) => void;
	/** Selecting and leaving grid mode — what a click on a tile does. */
	onOpen: (id: FixtureId) => void;
}

/** Mount a tile once it is within this many pixels of the scroll port. */
const PRELOAD_MARGIN = "600px";

export function GridView(props: GridViewProps): ReactElement {
	const { tiles, selected, budget, onOpen, onSelect } = props;

	/**
	 * Which tiles hold a live frame. A Set of keys rather than an index range:
	 * the user can force a tile past the cap, and that tile has no reason to be
	 * adjacent to the ones scrolling did.
	 */
	const [live, setLive] = useState<ReadonlySet<string>>(() => new Set());

	// Leaving and re-entering grid mode with a different corpus must not carry
	// mounts for fixtures that no longer exist.
	const signature = tiles.map((t) => serializeFixtureId(t.fixture)).join("\n");
	const lastSignature = useRef(signature);
	if (lastSignature.current !== signature) {
		lastSignature.current = signature;
		if (live.size) setLive(new Set());
	}

	const request = useCallback(
		(key: string, force: boolean) => {
			setLive((prev) => {
				if (prev.has(key)) return prev;
				if (!force && prev.size >= budget) return prev;
				const next = new Set(prev);
				next.add(key);
				return next;
			});
		},
		[budget],
	);

	const atBudget = live.size >= budget;

	return (
		<div className="h-full min-h-0 overflow-auto p-3" data-uight-grid="">
			{atBudget ? (
				<Typography.Text render={<p />} size="1" color="gray" className="mb-3">
					{live.size} of {tiles.length} rendered — the rest are held back so the page stays
					responsive. Open any one of them from its tile.
				</Typography.Text>
			) : null}

			<ul
				className="grid list-none gap-3 p-0"
				style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
			>
				{tiles.map((tile) => {
					const key = serializeFixtureId(tile.fixture);
					return (
						<Tile
							key={key}
							tileKey={key}
							tile={tile}
							live={live.has(key)}
							atBudget={atBudget}
							current={fixtureIdsEqual(tile.fixture, selected)}
							height={props.tileHeight}
							rendererEntryUrl={props.rendererEntryUrl}
							rendererStyleUrls={props.rendererStyleUrls}
							dev={props.dev}
							previewDocumentUrl={props.previewDocumentUrl}
							theme={props.theme}
							onRequest={request}
							onOpen={onOpen}
							onSelect={onSelect}
						/>
					);
				})}
			</ul>

			{tiles.length === 0 ? (
				<Typography.Text render={<p />} size="1" color="gray">
					Nothing to show in this grid.
				</Typography.Text>
			) : null}
		</div>
	);
}

interface TileProps {
	tileKey: string;
	tile: GridTile;
	live: boolean;
	atBudget: boolean;
	current: boolean;
	height: number;
	rendererEntryUrl: string;
	rendererStyleUrls: readonly string[] | undefined;
	dev: boolean;
	previewDocumentUrl: string | undefined;
	theme: ResolvedUightTheme;
	onRequest: (key: string, force: boolean) => void;
	onOpen: (id: FixtureId) => void;
	onSelect: (id: FixtureId) => void;
}

function Tile(props: TileProps): ReactElement {
	const { tile, tileKey, live, atBudget, current, onRequest, onOpen, onSelect } = props;
	const ref = useRef<HTMLLIElement | null>(null);

	useEffect(() => {
		if (live) return;
		const el = ref.current;
		if (!el || typeof IntersectionObserver === "undefined") {
			// No observer — a jsdom test, or a very old engine. Mounting everything
			// would be the wrong failure, so tiles stay on their button.
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				// `force: false` — scrolling asks, the budget answers.
				if (entries.some((e) => e.isIntersecting)) onRequest(tileKey, false);
			},
			{ rootMargin: PRELOAD_MARGIN },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [live, tileKey, onRequest]);

	const overlays = useMemo(() => [], []);
	const noop = useCallback(() => {}, []);

	return (
		<Card
			render={<li ref={ref} />}
			// The current tile is outlined rather than filled: a contact sheet is
			// read by its contents, and a filled tile would recolour the fixture
			// inside it.
			className={
				"m-0 flex min-w-0 flex-col overflow-hidden p-0 " +
				(current ? "outline-2 -outline-offset-2 outline-[var(--uight-accent)]" : "")
			}
		>
			{/*
			 * The whole tile is one button. A click that only *selected* would leave
			 * the user in the grid wondering what happened, and a click that opened
			 * without selecting would lose the control values they are about to want.
			 */}
			<button
				type="button"
				onClick={() => {
					onSelect(tile.fixture);
					onOpen(tile.fixture);
				}}
				aria-current={current ? "true" : undefined}
				className={
					"flex w-full min-w-0 flex-col items-start gap-0 border-0 border-b border-[var(--uight-line)] " +
					"bg-transparent px-2 py-1.5 text-left hover:bg-[var(--uight-sunken)] " +
					"focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--uight-accent)]"
				}
			>
				<Typography.Text size="1" weight="medium" className="w-full truncate">
					{tile.label}
				</Typography.Text>
				<Typography.Text size="1" color="gray" className="w-full truncate">
					{tile.path}
				</Typography.Text>
			</button>

			<div className="relative w-full" style={{ height: props.height }}>
				{live ? (
					<FrameHost
						mountId={`uight-grid-${tileKey.replace(/[^\w-]/g, "-")}`}
						rendererEntryUrl={props.rendererEntryUrl}
						rendererStyleUrls={props.rendererStyleUrls}
						dev={props.dev}
						initialFixture={tile.fixture}
						initialOverlays={overlays}
						previewDocumentUrl={props.previewDocumentUrl}
						title={`Preview: ${tile.label}`}
						theme={props.theme}
						// A tile is a picture. It sends no messages, so it needs no
						// transport handle, and a bootstrap failure in one tile must not
						// take the grid down with it — the empty tile is the report.
						onTransport={noop}
						onBootstrapError={noop}
						className="pointer-events-none block h-full w-full border-0 bg-[var(--uight-surface)]"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center bg-[var(--uight-sunken)]">
						<Button size="1" variant="surface" onClick={() => onRequest(tileKey, true)}>
							{atBudget ? "Render anyway" : "Render"}
						</Button>
					</div>
				)}
			</div>
		</Card>
	);
}
