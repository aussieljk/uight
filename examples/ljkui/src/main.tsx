/**
 * The host application's entry. Note what is absent: no uight bootstrap, no
 * second dev server, no second port. The explorer at /uight is served by the
 * Vite plugin from the same server this page is served from.
 */

import "ljkui/styles.css";
// ljkui's icons are a registry, not a set of files: `Icons.Bell` draws
// whatever the registered adapter provides. This side-effect import is what
// registers one — swap it for `ljkui/icons/phosphor` and every icon changes.
import "ljkui/icons/lucide";
import "./app.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from index.html");

createRoot(container).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
