/**
 * The e2e host application.
 *
 * One entry, several *modes* chosen by a query parameter, so every §20.2
 * scenario is reachable from one built artefact — a matrix that has to build a
 * different app per scenario stops being run.
 *
 *   (none)        one `<Uaight />`, history router — the default subject
 *   two           two mounts, same URL parameter → §5.4 ownership arbitration
 *   two-router    two mounts with distinct `routerId` → both routed
 *   inline        `isolation="inline"` (§5.2)
 *   ejected       a replacement `FixtureTree` compiled by the HOST's Tailwind (§10.3, §11.3)
 *   cycles        no explorer; `window.__uaightCycle(n)` mounts and unmounts one n times
 *
 * `window.__uaightE2E` is the only hook the suite uses that the package does
 * not provide itself; it exposes nothing the app could not do on its own.
 */

import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { Uaight } from "uaight";
import { Button } from "./components/Button.tsx";
import { EjectedTree } from "./EjectedTree.tsx";
import "./app.css";

declare global {
	interface Window {
		__uaightE2E?: { mode: string };
		__uaightCycle?: (n: number) => Promise<number>;
	}
}

const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "default";
/**
 * StrictMode is ON by default. §5.4's refcounted ownership and §8.2's handshake
 * both have double-invoke hazards, and a matrix that runs without StrictMode
 * tests the easy path. `?strict=0` turns it off so a failure can be attributed.
 */
const strict = params.get("strict") !== "0";

/* ------------------------------------------------------------------ *
 * Call sites — §12.2 harvests these, and the control panel is driven by
 * the props written here. They must be static literals to be readable.
 * ------------------------------------------------------------------ */

function CallSites() {
	return (
		<div hidden>
			<Button label="Save changes" variant="primary" />
			<Button label="Cancel" variant="secondary" disabled />
		</div>
	);
}

function Explorer() {
	switch (mode) {
		case "two":
			return (
				<>
					<div style={{ height: "50vh" }} data-e2e="mount-a">
						<Uaight router="history" height="100%" />
					</div>
					<div style={{ height: "50vh" }} data-e2e="mount-b">
						<Uaight router="history" height="100%" />
					</div>
				</>
			);
		case "two-router":
			return (
				<>
					{/*
						Distinct `urlParam`s, not just distinct `routerId`s. `routerId`
						only namespaces the OWNERSHIP key (`router.ts`'s
						`resolveRouterKey`); the query parameter itself is `urlParam`, so
						two mounts sharing `urlParam` would still write the same
						parameter even though neither is denied. Two routed mounts need
						two parameters.
					*/}
					<div style={{ height: "50vh" }} data-e2e="mount-a">
						<Uaight
							router="history"
							routerId="a"
							urlParam="fixtureA"
							stateParam="stateA"
							height="100%"
						/>
					</div>
					<div style={{ height: "50vh" }} data-e2e="mount-b">
						<Uaight
							router="history"
							routerId="b"
							urlParam="fixtureB"
							stateParam="stateB"
							height="100%"
						/>
					</div>
				</>
			);
		case "inline":
			return (
				<div style={{ height: "100vh" }} data-e2e="mount-a">
					<Uaight router="history" isolation="inline" height="100%" />
				</div>
			);
		case "ejected":
			return (
				<div style={{ height: "100vh" }} data-e2e="mount-a">
					<Uaight router="history" height="100%" components={{ FixtureTree: EjectedTree }} />
				</div>
			);
		default:
			return (
				<div style={{ height: "100vh" }} data-e2e="mount-a">
					<Uaight router="history" height="100%" />
				</div>
			);
	}
}

/**
 * The §20.3 memory scenario. Mounting and unmounting a whole explorer 100 times
 * exercises the transport, the frame document and the overlay store together,
 * which is where a listener or a `Map` entry would leak.
 */
function Cycler() {
	const [busy, setBusy] = useState(false);

	const run = useCallback(async (n: number) => {
		setBusy(true);
		const holder = document.createElement("div");
		holder.style.cssText = "position:fixed;left:-9999px;width:800px;height:600px";
		document.body.appendChild(holder);
		let done = 0;
		for (let i = 0; i < n; i++) {
			const el = document.createElement("div");
			el.style.cssText = "width:800px;height:600px";
			holder.appendChild(el);
			const root: Root = createRoot(el);
			root.render(<Uaight router="none" height="100%" fixture="fixtures/basic:Alpha" />);
			await new Promise((r) => setTimeout(r, 20));
			root.unmount();
			el.remove();
			done++;
		}
		holder.remove();
		setBusy(false);
		return done;
	}, []);

	useEffect(() => {
		window.__uaightCycle = run;
		return () => {
			delete window.__uaightCycle;
		};
	}, [run]);

	return <p data-e2e="cycler">{busy ? "cycling" : "idle"}</p>;
}

function App() {
	useEffect(() => {
		window.__uaightE2E = { mode };
	}, []);
	return (
		<>
			<CallSites />
			{mode === "cycles" ? <Cycler /> : <Explorer />}
		</>
	);
}

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(
	strict ? (
		<StrictMode>
			<App />
		</StrictMode>
	) : (
		<App />
	),
);
