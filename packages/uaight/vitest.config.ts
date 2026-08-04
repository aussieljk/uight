import { defineConfig } from "vitest/config";

/**
 * SPEC.md §20.1. Vitest covers what does not need a browser: parsing and
 * classification, fixture-id round-tripping, serialization and codecs, overlay
 * application and patch dropping, path rejection, filter semantics, config
 * resolution, index scanning, collision detection, routing utilities and
 * decorator composition order. Everything about realms, frames, focus and HMR
 * is Playwright's (§20.2) and is deliberately not attempted here.
 */
export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		environment: "node",
		restoreMocks: true,
		// A module another agent has not written yet resolves to `null` and its
		// suite skips (see tests/helpers/optional.ts). That must not look like a
		// pass, so the run reports skips explicitly.
		reporters: ["default"],
	},
});
