/** `bun run test:e2e:build` — the production bundles the matrix serves, built
 *  once and skipped when they are newer than their sources. Playwright calls
 *  `prepare()` itself for whatever the selected projects need; this is the same
 *  thing for a CI step that wants the builds warmed up front. */
import { BUILDS, prepare } from "./prepare.mjs";
prepare(Object.keys(BUILDS));
