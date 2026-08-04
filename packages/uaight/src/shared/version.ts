/**
 * Package version, embedded by the plugin into `virtual:uaight/runtime` too (§16.2).
 *
 * Kept in lockstep with `package.json` by `scripts/version.ts`, and asserted by
 * `tests/version.test.ts` — a runtime that disagrees with its own plugin reports
 * a version-skew error at §16.2, so a drifted constant reaches users as
 * "one of them is a stale build artefact".
 *
 * Release format: `0.0.1-canary.N`. Everything published while the surface is
 * still moving is a canary, and the counter is the only part that changes.
 */
export const UAIGHT_VERSION = "0.0.1-canary.0";
