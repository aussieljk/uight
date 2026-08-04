/**
 * A dumb static file server, used only for the **relative base** cell of the
 * §20.2 matrix.
 *
 * `vite preview` always serves at the base it was built with, so it cannot
 * demonstrate the one property `base: "./"` exists for: that the artefact works
 * at a path nobody knew at build time. This serves `dist-relative/` under a
 * deliberately unrelated prefix — if anything in the built explorer resolved an
 * absolute URL, it 404s here and the frame never boots.
 *
 *   node static-server.mjs <dir> <port> <prefix>
 */

import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const [, , dirArg, portArg, prefixArg = "/"] = process.argv;
const dir = resolve(dirArg);
const port = Number(portArg);
const prefix = prefixArg.endsWith("/") ? prefixArg : `${prefixArg}/`;

const TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".map": "application/json; charset=utf-8",
};

createServer((req, res) => {
	const url = new URL(req.url ?? "/", "http://localhost");
	let path = decodeURIComponent(url.pathname);
	if (!path.startsWith(prefix)) {
		res.writeHead(404).end("outside the prefix");
		return;
	}
	path = path.slice(prefix.length - 1);
	// A single-page app: unknown paths fall back to the document, exactly as a
	// real static host would, so `?fixture=` deep links behave.
	let file = join(dir, normalize(path));
	try {
		if (statSync(file).isDirectory()) file = join(file, "index.html");
	} catch {
		file = join(dir, "index.html");
	}
	try {
		statSync(file);
	} catch {
		res.writeHead(404).end("not found");
		return;
	}
	res.writeHead(200, {
		"content-type": TYPES[extname(file)] ?? "application/octet-stream",
	});
	createReadStream(file).pipe(res);
}).listen(port, () => {
	console.log(`static server: ${dir} at http://localhost:${port}${prefix}`);
});
