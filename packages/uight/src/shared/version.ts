/**
 * Package version, embedded by the plugin into `virtual:uight/runtime` too (§16.2).
 *
 * Kept in lockstep with `package.json` by `scripts/version.ts`, and asserted by
 * `tests/version.test.ts` — a runtime that disagrees with its own plugin reports
 * a version-skew error at §16.2, so a drifted constant reaches users as
 * "one of them is a stale build artefact".
 *
 * Release format: `0.0.1-canary.N`, published under the `latest` tag. The
 * counter is the only part that moves, and `scripts/version.ts` refuses to
 * bump anything else — but the tag is `latest`, because a canary nobody can
 * reach with a plain install is a canary nobody uses.
 */
export const UIGHT_VERSION = "0.0.1-canary.6";
