/**
 * Package version, embedded by the plugin into `virtual:uight/runtime` too (§16.2).
 *
 * Kept in lockstep with `package.json` by `scripts/version.ts`, and asserted by
 * `tests/version.test.ts` — a runtime that disagrees with its own plugin reports
 * a version-skew error at §16.2, so a drifted constant reaches users as
 * "one of them is a stale build artefact".
 *
 * Release format: plain `X.Y.Z`, published under the `latest` tag. There is no
 * prerelease series — `scripts/version.ts` will not produce a suffixed version
 * and the release workflow refuses one, because `latest` has to mean the
 * newest usable release.
 */
export const UIGHT_VERSION = "0.0.1";
