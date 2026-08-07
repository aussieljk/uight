/**
 * The host application.
 *
 * There is deliberately almost nothing here. The explorer is already running
 * at /uight because vite.config.ts has one plugin in it; this page exists to
 * explain that, and to show the second entry path (SPEC §1.2) — the same
 * explorer mounted as a component inside an ordinary React tree.
 */

import { Alert, Badge, Card, Link, Select, Separator, Theme, Typography } from "ljkui";
import * as React from "react";
import { parseFixtureId, serializeFixtureId, Uight } from "@aussieljk/uight";
import type { FixtureId } from "@aussieljk/uight";

/* ------------------------------------------------------------------ *
 * §5.4 — controlled selection over a URL parameter the host owns.
 * ------------------------------------------------------------------ */

/**
 * A miniature router. A real app would use its own — `useSearchParams` from
 * React Router, `useRouter` from TanStack, whatever it already has.
 *
 * The point of §5.4 is that uight does not guess. `router="history"` calls
 * `pushState` directly, and `pushState` does not emit `popstate`, so a host
 * router would never learn about the navigation. Passing `selected`/`onSelect`
 * instead makes the host the single owner of the URL, and uight ignores
 * `router` entirely (§5.3, precedence 1).
 */
function useSearchParam(key: string) {
	const read = React.useCallback(
		() => new URLSearchParams(window.location.search).get(key),
		[key],
	);

	const [value, setValue] = React.useState(read);

	React.useEffect(() => {
		const onPopState = () => setValue(read());
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, [read]);

	const write = React.useCallback(
		(next: string | null) => {
			const params = new URLSearchParams(window.location.search);
			if (next) params.set(key, next);
			else params.delete(key);
			const query = params.toString();
			window.history.pushState(
				null,
				"",
				`${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
			);
			setValue(next);
		},
		[key],
	);

	return [value, write] as const;
}

/** Fixtures worth linking to from the picker below. */
const PICKS: Array<{ id: string; label: string }> = [
	{ id: "fixtures/controls", label: "Hand-written · controls" },
	{ id: "fixtures/money", label: "Hand-written · value codecs" },
	{ id: "fixtures/pricing:Plans", label: "Hand-written · pricing plans" },
	{ id: "stories/components/button/button:Default", label: "ljkui · Button" },
	{ id: "stories/components/callout/callout:Default", label: "ljkui · Alert" },
	{ id: "stories/components/data-list/data-list:Default", label: "ljkui · DataTable" },
	{ id: "stories/components/table/table:Default", label: "ljkui · Table" },
];

function ControlledSelection() {
	const [param, setParam] = useSearchParam("fixture");

	// `parseFixtureId` is total: anything malformed comes back as null, which is
	// the empty state rather than a crash.
	const selected: FixtureId | null = param ? parseFixtureId(param) : null;

	const onSelect = React.useCallback(
		(id: FixtureId | null) => setParam(id ? serializeFixtureId(id) : null),
		[setParam],
	);

	return (
		<>
			<div className="row">
				<Select.Root
					size="2"
					value={param ?? ""}
					onValueChange={(next) => setParam(next || null)}
				>
					<Select.Trigger placeholder="Pick a fixture…" />
					<Select.Content>
						{PICKS.map((pick) => (
							<Select.Item
								key={pick.id}
								// The convenience `path:name` form is accepted on input and
								// normalized to the canonical encoding immediately (§3.2).
								value={serializeFixtureId(parseFixtureId(pick.id) as FixtureId)}
							>
								{pick.label}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>

				<Typography.Text size="1" color="gray">
					<Typography.Code>?fixture=</Typography.Code> {param ?? "(unset)"}
				</Typography.Text>
			</div>

			<div className="embed-frame" style={{ height: 520 }}>
				<Uight
					selected={selected}
					onSelect={onSelect}
					filter={["fixtures/*", "stories/components/*"]}
					height="100%"
				/>
			</div>

			<Typography.Text size="1" color="gray">
				Selecting in the tree writes the URL through{" "}
				<Typography.Code>onSelect</Typography.Code>; the browser's back button writes it back
				through <Typography.Code>selected</Typography.Code>. An unknown-but-well-formed id
				keeps the parameter and shows an empty state, because it may become valid after the
				next HMR update (§5.4).
			</Typography.Text>
		</>
	);
}

/* ------------------------------------------------------------------ */

export function App() {
	return (
		<Theme accentColor="blue" grayColor="gray" appearance="inherit">
			<div className="page">
				<div className="stack">
					<div className="row">
						<Typography.Heading size="8">uight × ljkui</Typography.Heading>
						<Badge color="blue">demo</Badge>
					</div>

					<Typography.Text size="3" color="gray">
						This is an ordinary Vite + React application. Its{" "}
						<Typography.Code>vite.config.ts</Typography.Code> has one extra plugin in it, and
						that is the entire installation. Open{" "}
						<Link href="/uight">
							<Typography.Code>/uight</Typography.Code>
						</Link>{" "}
						— same server, same port, no second process, no HTML file in the repository.
					</Typography.Text>

					<Typography.Text size="3" color="gray">
						What you will find there is ljkui's whole component library as Storybook stories,
						read straight off disk as fixtures.{" "}
						<strong>Storybook is not installed in this project.</strong> Component Story Format
						is a file format, not a runtime: a default export of metadata and named exports of
						stories. uight reads the subset it can honestly run (§13) and badges anything it
						declines — <Typography.Code>play</Typography.Code>, loaders and interactions do not
						silently no-op.
					</Typography.Text>
				</div>

				<Alert.Root color="gray" style={{ marginTop: "2rem" }}>
					<Alert.Title>Where these stories came from</Alert.Title>
					<Alert.Description>
						<Link href="https://ljkui.com" target="_blank">
							ljkui
						</Link>{" "}
						is a fork of{" "}
						<Link href="https://storybook.whop.dev" target="_blank">
							frosted-ui
						</Link>
						, Whop's MIT-licensed design system, and these story files are frosted-ui's own with
						their imports rewritten to ljkui and renamed components ported. That licence travels
						with the copied files, in{" "}
						<Typography.Code>src/stories/LICENSE-frosted-ui.md</Typography.Code>. Neither
						project endorses this demo.
					</Alert.Description>
				</Alert.Root>

				<div className="section">
					<Typography.Heading size="6">
						Embedded, no chrome, inline isolation
					</Typography.Heading>
					<Typography.Text size="2" color="gray">
						The same explorer, pinned to one fixture and stripped of its chrome — a fixture
						rendered into a documentation page. <Typography.Code>isolation</Typography.Code> is
						an execution model, not a style (§5.2): <Typography.Code>inline</Typography.Code>{" "}
						shares this page's realm, so this fixture can see the host's CSS and React context,
						its media queries resolve against the page viewport, and it costs no iframe. That is
						exactly what you want on a docs page and exactly what you do not want when you are
						checking a component at 320px.
					</Typography.Text>

					<Card size="2">
						<Uight
							fixture="fixtures/controls"
							chrome={false}
							isolation="inline"
							height="auto"
						/>
					</Card>

					<Typography.Text size="1" color="gray">
						<Typography.Code>
							{'<Uight fixture="fixtures/controls" chrome={false} isolation="inline" />'}
						</Typography.Code>
					</Typography.Text>
				</div>

				<Separator size="4" style={{ marginTop: "3rem" }} />

				<div className="section">
					<Typography.Heading size="6">Controlled selection</Typography.Heading>
					<Typography.Text size="2" color="gray">
						The recommended integration for any app that already has a router (§5.4). The host
						owns the query parameter; uight is told what is selected and reports what the user
						picked. Nothing calls <Typography.Code>pushState</Typography.Code> behind your
						router's back.
					</Typography.Text>
					<ControlledSelection />
				</div>

				<Separator size="4" style={{ marginTop: "3rem" }} />

				<div className="section">
					<Typography.Heading size="6">What else is in here</Typography.Heading>
					<Typography.Text size="2" color="gray">
						<Typography.Code>src/stories/</Typography.Code> — copied CSF files, imports
						rewritten to the published <Typography.Code>ljkui</Typography.Code> package.
						<br />
						<Typography.Code>src/fixtures/</Typography.Code> — hand-written fixtures covering
						what CSF cannot express: live controls, multi-fixture files with metadata, a
						directory decorator, value codecs, and a file whose fixture names cannot be
						determined without running it.
						<br />
						<Typography.Code>src/components/</Typography.Code> — three components with no
						fixture and no story, so the component inventory has something to find.
						<br />
						<Typography.Code>src/uight.preview.tsx</Typography.Code> — the frame realm's CSS and
						providers.
						<br />
						<Typography.Code>src/uight.codecs.tsx</Typography.Code> — codecs that make two
						domain classes editable instead of opaque.
					</Typography.Text>
				</div>
			</div>
		</Theme>
	);
}
