/**
 * Call-site declared controls (SPEC §7.6, D18) — the fixture the control panel
 * and the `?state=` link tests drive.
 *
 * `Late` exists for one scenario specifically: a shared `?state=` link seeds
 * overlays BEFORE any input has registered. Its input does not register until
 * after a paint, so a host that only applies seeded patches at registration
 * time and a host that only applies them at select time are distinguishable.
 */
import { useEffect, useState } from "react";
import { useFixtureInput, useFixtureSelect } from "uaight";

function Panel() {
	const [label] = useFixtureInput("label", "Click me");
	const [variant] = useFixtureSelect("variant", {
		options: ["primary", "secondary"] as const,
	});
	const [count] = useFixtureInput("count", 3, { control: "range", min: 0, max: 10 });
	const [disabled] = useFixtureInput("disabled", false);

	return (
		<div>
			<p data-e2e="control-label">{label}</p>
			<p data-e2e="control-variant">{variant}</p>
			<p data-e2e="control-count">{count}</p>
			<p data-e2e="control-disabled">{String(disabled)}</p>
		</div>
	);
}

/** Registers its input only after the first paint. */
function Late() {
	const [ready, setReady] = useState(false);
	useEffect(() => {
		const id = setTimeout(() => setReady(true), 150);
		return () => clearTimeout(id);
	}, []);
	return ready ? <LateInner /> : <p data-e2e="late-label">(not registered yet)</p>;
}

function LateInner() {
	const [label] = useFixtureInput("lateLabel", "late default");
	return <p data-e2e="late-label">{label}</p>;
}

export default {
	Panel: <Panel />,
	Late: <Late />,
};
