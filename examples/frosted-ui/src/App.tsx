/**
 * The host application.
 *
 * There is deliberately almost nothing here. The explorer is already running
 * at /uight because vite.config.ts has one plugin in it; this page exists to
 * explain that, and to show the second entry path (SPEC §1.2) — the same
 * explorer mounted as a component inside an ordinary React tree.
 */

import {
	Badge,
	Callout,
	Card,
	Code,
	Heading,
	Link,
	Select,
	Separator,
	Text,
	Theme,
} from "frosted-ui";
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
	{ id: "stories/components/button/button:Default", label: "frosted-ui · Button" },
	{ id: "stories/components/callout/callout:Default", label: "frosted-ui · Callout" },
	{ id: "stories/components/data-list/data-list:Default", label: "frosted-ui · DataList" },
	{ id: "stories/components/table/table:Default", label: "frosted-ui · Table" },
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

				<Text size="1" color="gray">
					<Code>?fixture=</Code> {param ?? "(unset)"}
				</Text>
			</div>

			<div className="embed-frame" style={{ height: 520 }}>
				<Uight
					selected={selected}
					onSelect={onSelect}
					filter={["fixtures/*", "stories/components/*"]}
					height="100%"
				/>
			</div>

			<Text size="1" color="gray">
				Selecting in the tree writes the URL through <Code>onSelect</Code>; the browser's back
				button writes it back through <Code>selected</Code>. An unknown-but-well-formed id
				keeps the parameter and shows an empty state, because it may become valid after the
				next HMR update (§5.4).
			</Text>
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
						<Heading size="8">uight × frosted-ui</Heading>
						<Badge color="blue">demo</Badge>
					</div>

					<Text size="3" color="gray">
						This is an ordinary Vite + React application. Its <Code>vite.config.ts</Code> has
						one extra plugin in it, and that is the entire installation. Open{" "}
						<Link href="/uight">
							<Code>/uight</Code>
						</Link>{" "}
						— same server, same port, no second process, no HTML file in the repository.
					</Text>

					<Text size="3" color="gray">
						What you will find there is all 581 of frosted-ui's Storybook stories, read straight
						off disk as fixtures. <strong>Storybook is not installed in this project.</strong>{" "}
						Component Story Format is a file format, not a runtime: a default export of metadata
						and named exports of stories. uight reads the subset it can honestly run (§13) and
						badges anything it declines — <Code>play</Code>, loaders and interactions do not
						silently no-op.
					</Text>
				</div>

				<Callout.Root color="gray" style={{ marginTop: "2rem" }}>
					<Callout.Title>frosted-ui is Whop's, not ours</Callout.Title>
					<Callout.Description>
						<Link href="https://storybook.whop.dev" target="_blank">
							frosted-ui
						</Link>{" "}
						is Whop's design system, used here under its MIT licence and unmodified apart from
						import rewriting. uight is an unaffiliated project and this demo is not endorsed by
						Whop. The licence travels with the copied files, in{" "}
						<Code>src/stories/LICENSE-frosted-ui.md</Code>.
					</Callout.Description>
				</Callout.Root>

				<div className="section">
					<Heading size="6">Embedded, no chrome, inline isolation</Heading>
					<Text size="2" color="gray">
						The same explorer, pinned to one fixture and stripped of its chrome — a fixture
						rendered into a documentation page. <Code>isolation</Code> is an execution model,
						not a style (§5.2): <Code>inline</Code> shares this page's realm, so this fixture
						can see the host's CSS and React context, its media queries resolve against the page
						viewport, and it costs no iframe. That is exactly what you want on a docs page and
						exactly what you do not want when you are checking a component at 320px.
					</Text>

					<Card size="2">
						<Uight
							fixture="fixtures/controls"
							chrome={false}
							isolation="inline"
							height="auto"
						/>
					</Card>

					<Text size="1" color="gray">
						<Code>
							{'<Uight fixture="fixtures/controls" chrome={false} isolation="inline" />'}
						</Code>
					</Text>
				</div>

				<Separator size="4" style={{ marginTop: "3rem" }} />

				<div className="section">
					<Heading size="6">Controlled selection</Heading>
					<Text size="2" color="gray">
						The recommended integration for any app that already has a router (§5.4). The host
						owns the query parameter; uight is told what is selected and reports what the user
						picked. Nothing calls <Code>pushState</Code> behind your router's back.
					</Text>
					<ControlledSelection />
				</div>

				<Separator size="4" style={{ marginTop: "3rem" }} />

				<div className="section">
					<Heading size="6">What else is in here</Heading>
					<Text size="2" color="gray">
						<Code>src/stories/</Code> — 77 copied CSF files, imports rewritten to the published{" "}
						<Code>frosted-ui</Code> package.
						<br />
						<Code>src/fixtures/</Code> — hand-written fixtures covering what CSF cannot express:
						live controls, multi-fixture files with metadata, a directory decorator, value
						codecs, and a file whose fixture names cannot be determined without running it.
						<br />
						<Code>src/components/</Code> — three components with no fixture and no story, so the
						component inventory has something to find.
						<br />
						<Code>src/uight.preview.tsx</Code> — the frame realm's CSS and providers.
						<br />
						<Code>src/uight.codecs.tsx</Code> — codecs that make two domain classes editable
						instead of opaque.
					</Text>
				</div>
			</div>
		</Theme>
	);
}
