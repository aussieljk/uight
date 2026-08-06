/**
 * The read-only JSON endpoints. SPEC.md §19.6.
 *
 * **Development only.** Registered solely in `serve` mode, absent in
 * production builds, and read-only throughout — v1 writes no files (§1.4),
 * which removes CSRF and path-confinement risk entirely rather than
 * mitigating it. Nothing here accepts a path, a name or a body.
 *
 * **Loopback-bound by default**, which §19.6 required and this handler did not
 * do. Read-only is not the same as harmless: `/@uight/config.json` echoes
 * resolved filesystem paths and `/@uight/index.json` lists every fixture file
 * in the project, which together are a map of somebody's source tree. On a
 * default dev server nothing off-machine can reach them; run `vite --host` on a
 * shared network and everything could, and choosing `--host` is a statement
 * about the app, not about this. `devApi: 'any'` restores the old behaviour for
 * a proxy or container where the request legitimately arrives from elsewhere.
 *
 * A non-loopback request falls through to `next()` rather than being refused:
 * a 403 confirms the endpoint exists, and there is nothing to gain by
 * answering a question we have just decided not to answer.
 *
 * | Path                      | Returns                                        |
 * | ------------------------- | ---------------------------------------------- |
 * | `/@uight/index.json`     | Fixture index: paths, names, `null`s, hashes   |
 * | `/@uight/inventory.json` | Detected components                            |
 * | `/@uight/callsites.json` | Component usages harvested from the source     |
 * | `/@uight/config.json`    | Resolved config echo                           |
 * | `/@uight/health`         | version, viteVersion, protocolVersion, …       |
 *
 * Prefer the Node API for CI; this surface exists for tools that cannot import
 * the package — editor extensions, dashboards, scripts.
 */

import { version as viteVersion } from "vite";
import type { Connect, ViteDevServer } from "vite";
import { PROTOCOL_VERSION } from "../shared/protocol.ts";
import type { FixtureIndex } from "../shared/types.ts";
import { UIGHT_VERSION } from "../shared/version.ts";
import type { ResolvedUightConfig } from "./config.ts";
import { isReadRequest } from "./dev-route.ts";
import { indexStats } from "./scan.ts";

/**
 * Whether a socket address is this machine talking to itself.
 *
 * IPv6-mapped IPv4 (`::ffff:127.0.0.1`) is what a dual-stack Node server
 * actually reports for a `127.0.0.1` connection, so matching only the plain
 * forms would refuse the loopback case on most machines. The whole `127/8`
 * block counts, because it is all loopback.
 */
export function isLoopback(address: string | undefined): boolean {
	if (!address) return false;
	const host = address.startsWith("::ffff:") ? address.slice(7) : address;
	return host === "::1" || host === "localhost" || /^127\.\d+\.\d+\.\d+$/.test(host);
}

export function readOnlyApi(
	server: ViteDevServer,
	getConfig: () => ResolvedUightConfig,
	getIndex: () => FixtureIndex,
): Connect.NextHandleFunction {
	return (req, res, next) => {
		if (getConfig().devApi === "loopback" && !isLoopback(req.socket.remoteAddress)) {
			return next();
		}
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
		version: UIGHT_VERSION,
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
		version: UIGHT_VERSION,
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
function configPayload(cfg: ResolvedUightConfig, server: ViteDevServer): unknown {
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

function healthPayload(cfg: ResolvedUightConfig, index: FixtureIndex): unknown {
	return {
		ok: index.problems.every((p) => p.kind !== "collision"),
		version: UIGHT_VERSION,
		// `ResolvedConfig` does not carry the Vite version, so it comes from the
		// package itself. `@aussieljk/uight/vite` is only ever loaded by a Vite config,
		// so importing Vite here costs nothing a consumer has not already paid.
		viteVersion,
		protocolVersion: PROTOCOL_VERSION,
		fixtureCount: index.files.length,
		indexMode: cfg.index,
		problems: index.problems.length,
	};
}
