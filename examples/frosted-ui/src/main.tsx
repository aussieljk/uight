/**
 * The host application's entry. Note what is absent: no uaight bootstrap, no
 * second dev server, no second port. The explorer at /uaight is served by the
 * Vite plugin from the same server this page is served from.
 */

import "frosted-ui/styles.css";
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
