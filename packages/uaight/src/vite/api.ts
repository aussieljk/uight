/**
 * The read-only JSON endpoints. SPEC.md §19.6.
 *
 * **Development only.** Registered solely in `serve` mode, absent in
 * production builds, and read-only throughout — v1 writes no files (§1.4),
 * which removes CSRF and path-confinement risk entirely rather than
 * mitigating it. Nothing here accepts a path, a name or a body.
 *
 * | Path                      | Returns                                        |
 * | ------------------------- | ---------------------------------------------- |
 * | `/@uaight/index.json`     | Fixture index: paths, names, `null`s, hashes   |
 * | `/@uaight/inventory.json` | Detected components                            |
 * | `/@uaight/callsites.json` | Component usages harvested from the source     |
 * | `/@uaight/config.json`    | Resolved config echo                           |
 * | `/@uaight/health`         | version, viteVersion, protocolVersion, …       |
 *
 * Prefer the Node API for CI; this surface exists for tools that cannot import
 * the package — editor extensions, dashboards, scripts.
 */

import { version as viteVersion } from "vite";
import type { Connect, ViteDevServer } from "vite";
import { PROTOCOL_VERSION } from "../shared/protocol.ts";
import type { FixtureIndex } from "../shared/types.ts";
import { UAIGHT_VERSION } from "../shared/version.ts";
import type { ResolvedUaightConfig } from "./config.ts";
import { isReadRequest } from "./dev-route.ts";
import { indexStats } from "./scan.ts";

export function readOnlyApi(
	server: ViteDevServer,
	getConfig: () => ResolvedUaightConfig,
	getIndex: () => FixtureIndex,
): Connect.NextHandleFunction {
	return (req, res, next) => {
		const pathname = (req.url ?? "/").split("?")[0] ?? "/";
		const route = pathname.replace(/\/+$/, "") || "/";

		const body = (() => {
			switch (route) {
				case "/index.json":
					return indexPayload(getIndex());
				case "/inventory.json":
					return { components: getIndex().inventory };
				case "/callsites.json":
					return callSitesPayload(getIndex());
				case "/config.json":
					return configPayload(getConfig(), server);
				case "/health":
					return healthPayload(getConfig(), getIndex());
				default:
					return undefined;
			}
		})();

		if (body === undefined) return next();

		// Read-only means read-only. A write verb is refused, not ignored,
		// so a mistaken client gets a clear answer.
		if (!isReadRequest(req.method)) {
			res.statusCode = 405;
			res.setHeader("Allow", "GET, HEAD");
			res.end();
			return;
		}

		const json = `${JSON.stringify(body, null, 2)}\n`;
		res.statusCode = 200;
		res.setHeader("Content-Type", "application/json; charset=utf-8");
		res.setHeader("Cache-Control", "no-store");
		res.setHeader("Content-Length", String(Buffer.byteLength(json)));
		res.end(req.method === "HEAD" ? undefined : json);
	};
}

/* ------------------------------------------------------------------ *
 * Payloads
 * ------------------------------------------------------------------ */

function indexPayload(index: FixtureIndex): unknown {
	const stats = indexStats(index);
	return {
		version: UAIGHT_VERSION,
		files: index.files,
		decorators: index.decorators,
		problems: index.problems,
		stats,
	};
}

/**
 * Component usages harvested from the project's own source.
 *
 * `callSiteSources` is deliberately not served: it is the Node-side working set
 * the ranking derives from, and the ranked groups are what a client can act on.
 */
function callSitesPayload(index: FixtureIndex): unknown {
	return {
		version: UAIGHT_VERSION,
		components: index.callSites.length,
		sites: index.callSites.reduce((sum, group) => sum + group.sites.length, 0),
		groups: index.callSites,
	};
}

/**
 * "Answers *why is my fixture not found*" (§19.6), so it echoes both path
 * representations (§4.2) and the patterns actually used, not just the options
 * the user typed.
 */
function configPayload(
	cfg: ResolvedUaightConfig,
	server: ViteDevServer,
): unknown {
	return {
		root: cfg.root,
		command: cfg.command,
		route: cfg.route,
		// Vite's own root and base, because half of "why is my fixture not
		// found" is a root the user did not realise they had set (§4.2).
		viteRoot: server.config.root,
		base: server.config.base,
		fixturesDirFsPath: cfg.fixturesDirFsPath,
		fixturesDirGlobPath: cfg.fixturesDirGlobPath,
		fixtureFileSuffix: cfg.fixtureFileSuffix,
		decoratorFileSuffixes: cfg.decoratorFileSuffixes,
		include: cfg.include,
		exclude: cfg.exclude,
		caseSensitive: cfg.caseSensitive,
		inventory: cfg.inventory,
		callSites: cfg.callSites,
		storybookPreview: cfg.storybookPreview ?? null,
		previewEntry: cfg.previewEntry ?? null,
		previewHtmlPath: cfg.previewHtmlPath ?? null,
		codecs: cfg.codecs ?? null,
		index: cfg.index,
		production: cfg.production,
		storybook: cfg.storybook,
		docgen: cfg.docgen,
		configFile: cfg.configFile ?? null,
	};
}

function healthPayload(cfg: ResolvedUaightConfig, index: FixtureIndex): unknown {
	return {
		ok: index.problems.every((p) => p.kind !== "collision"),
		version: UAIGHT_VERSION,
		// `ResolvedConfig` does not carry the Vite version, so it comes from the
		// package itself. `uaight/vite` is only ever loaded by a Vite config,
		// so importing Vite here costs nothing a consumer has not already paid.
		viteVersion,
		protocolVersion: PROTOCOL_VERSION,
		fixtureCount: index.files.length,
		indexMode: cfg.index,
		problems: index.problems.length,
	};
}
