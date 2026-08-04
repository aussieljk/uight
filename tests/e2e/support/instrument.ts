/**
 * Page instrumentation, installed with `page.addInitScript` before anything the
 * app does.
 *
 * Everything here observes the package from the OUTSIDE — a `message` listener
 * and a `MutationObserver`. Nothing is patched, and no hook is asked of
 * `src/**`, because a budget that is only measurable through instrumentation
 * the product ships for the test's benefit measures the instrumentation.
 *
 * What it records (SPEC §8.2, §20.3):
 *
 *   frameAttached  the moment an `iframe[data-uaight-frame]` enters the host DOM
 *   ready          the child's `READY` reaching the host window
 *   initAck        the child's `INIT_ACK` — the handshake is complete here
 *   firstPaint     `#uaight-root` in the frame document gains its first child
 *
 * All four are `performance.now()` in the HOST realm, so they subtract.
 */

export const INSTRUMENT_SOURCE = `(() => {
	const marks = { navigationStart: performance.now(), frameAttached: null, ready: null, initAck: null, firstPaint: null };
	const protocol = [];
	const errors = [];
	window.__uaightMarks = marks;
	window.__uaightProtocol = protocol;
	window.__uaightConsoleErrors = errors;

	// §8.2 messages are channelled; anything else on the window is not ours.
	window.addEventListener("message", (event) => {
		const data = event.data;
		if (!data || typeof data !== "object" || data.__uaight !== "uaight") return;
		const at = performance.now();
		protocol.push({ type: data.type, at });
		if (data.type === "READY" && marks.ready === null) marks.ready = at;
		if (data.type === "INIT_ACK" && marks.initAck === null) marks.initAck = at;
	}, true);

	const watchFrame = (frame) => {
		if (frame.__uaightWatched) return;
		frame.__uaightWatched = true;
		if (marks.frameAttached === null) marks.frameAttached = performance.now();
		const poll = () => {
			let doc = null;
			try { doc = frame.contentDocument; } catch { doc = null; }
			const root = doc && doc.getElementById("uaight-root");
			if (root && root.firstElementChild) {
				if (marks.firstPaint === null) marks.firstPaint = performance.now();
				return;
			}
			requestAnimationFrame(poll);
		};
		poll();
	};

	const scan = (node) => {
		if (!(node instanceof Element)) return;
		if (node.matches && node.matches("iframe[data-uaight-frame]")) watchFrame(node);
		node.querySelectorAll && node.querySelectorAll("iframe[data-uaight-frame]").forEach(watchFrame);
	};

	// The target is \`document\`, not \`document.documentElement\`: an init script
	// runs before the parser has created the root element, and this file also
	// runs inside the preview frame, whose document is written from scratch.
	new MutationObserver((records) => {
		for (const record of records) record.addedNodes.forEach(scan);
	}).observe(document, { childList: true, subtree: true });
	if (document.documentElement) scan(document.documentElement);

	/** Reset the marks so a second selection can be timed on a warm page. */
	window.__uaightResetMarks = () => {
		marks.navigationStart = performance.now();
		marks.frameAttached = marks.ready = marks.initAck = marks.firstPaint = null;
		protocol.length = 0;
	};
})();`;

export interface Marks {
	navigationStart: number;
	frameAttached: number | null;
	ready: number | null;
	initAck: number | null;
	firstPaint: number | null;
}
