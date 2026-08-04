/**
 * `matchMedia` inside the frame (SPEC §5.2, §6.5).
 *
 * The claim frame isolation makes is that a fixture's media queries measure the
 * FRAME, not the page. So this reports the frame's own `innerWidth` alongside
 * what `matchMedia` says, and the viewport presets in the toolbar must move
 * both. Inline, §5.2 documents that this reads the host page instead — the
 * suite asserts that difference rather than pretending it away.
 */
import { useEffect, useState } from "react";

function useMatch(query: string): boolean {
	const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
	useEffect(() => {
		const mql = window.matchMedia(query);
		const on = () => setMatches(mql.matches);
		on();
		mql.addEventListener("change", on);
		return () => mql.removeEventListener("change", on);
	}, [query]);
	return matches;
}

function Report() {
	const narrow = useMatch("(max-width: 500px)");
	const [width, setWidth] = useState(() => window.innerWidth);
	useEffect(() => {
		const on = () => setWidth(window.innerWidth);
		window.addEventListener("resize", on);
		on();
		return () => window.removeEventListener("resize", on);
	}, []);
	return (
		<div>
			<p data-e2e="media-narrow">{narrow ? "narrow" : "wide"}</p>
			<p data-e2e="media-width">{width}</p>
		</div>
	);
}

export default {
	Report: <Report />,
};
