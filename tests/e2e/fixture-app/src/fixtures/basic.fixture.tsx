/**
 * Two plain fixtures. `basic/Alpha` is the suite's default landing target: it
 * has no controls, no portal and no timers, so a failure here is the frame
 * bootstrap and nothing else.
 */

export default {
	Alpha: <p data-e2e="basic">ALPHA</p>,
	Beta: <p data-e2e="basic">BETA</p>,
};
