/**
 * The landing page.
 *
 * The only page on this site that is not prose, and therefore the only one
 * whose source is JSX rather than Markdown. It is also the one page that has to
 * *do* something: its two actions select another page, which inside the frame
 * realm means `useSelectFixture` rather than an anchor (see `Page` for why).
 *
 * Buttons rather than links, deliberately. These do not have URLs of their own
 * — the explorer's address bar carries one fixture parameter and that is the
 * whole of this site's routing — so rendering them as anchors would promise a
 * middle-click and a "copy link address" that lead nowhere.
 */

import { useSelectFixture } from "@aussieljk/uight";

const FEATURES = [
	{
		title: "Zero configuration",
		body:
			"With no config and no fixtures, uight lists the components it finds — and the places your own code already uses them — as real, renderable states.",
	},
	{
		title: "Your build, your providers",
		body:
			"It runs as a Vite plugin in the app's own server. The same aliases, the same CSS, the same Tailwind config. Nothing is mirrored into a second build.",
	},
	{
		title: "Reads your Storybook",
		body:
			"CSF 3 is a declared subset, .storybook/preview is loaded, and anything uight will not run is badged rather than silently skipped.",
	},
	{
		title: "Frame isolation",
		body:
			"Fixtures render in a separate realm, so a fixture's global styles and listeners cannot reach the explorer around it.",
	},
	{
		title: "Controls you declared",
		body:
			"useFixtureInput at the call site. Controls are never inferred from a prop name, so a control that exists is one you meant.",
	},
	{
		title: "Ejectable chrome",
		body:
			"Every chrome component is replaceable, and the registry ships the source under your own components directory when replacing is not enough.",
	},
	{
		title: "This site is one of them",
		body:
			"uight.dev is a uight instance: every page you are reading is a docs page in the tree on the left, built by bunx uight build.",
	},
];

export function Home() {
	const select = useSelectFixture();

	return (
		<div className="home">
			<h1 className="home-name">uight</h1>
			<p className="home-text">A component explorer inside your own dev server</p>
			<p className="home-tagline">
				No second process, no second port, no config file. Open <code>/uight</code> and your
				components are already there.
			</p>

			<div className="home-actions">
				<button
					type="button"
					className="home-action home-action-primary"
					onClick={() => select({ path: "guide/getting-started", name: null })}
				>
					Get started
				</button>
				<button
					type="button"
					className="home-action"
					onClick={() => select({ path: "guide/storybook", name: null })}
				>
					Coming from Storybook?
				</button>
			</div>

			<div className="home-features">
				{FEATURES.map((feature) => (
					<div className="home-feature" key={feature.title}>
						<h3>{feature.title}</h3>
						<p>{feature.body}</p>
					</div>
				))}
			</div>
		</div>
	);
}
