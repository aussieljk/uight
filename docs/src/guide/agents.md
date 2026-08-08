# Point your coding agent at your design system

uight ships an MCP server. An agent that edits components has three questions
source code alone cannot answer — _what components exist_, _what states do
they have_, and _what does this one actually look like_ — and the explorer
already answers all three. `uight mcp` exposes those answers over the Model
Context Protocol, so Claude Code (or any MCP client) can use your running dev
server as a perception tool.

## Setup

For Claude Code, one command:

```bash
claude mcp add uight -- bunx --package @aussieljk/uight uight-mcp
```

Or in any MCP client config:

```json
{
	"mcpServers": {
		"uight": { "command": "uight-mcp" }
	}
}
```

No URL is needed: the server probes the ports a Vite dev server is actually
likely to be on and verifies each answer is really uight before trusting it.
Start the MCP server before or after your dev server — order does not matter,
discovery re-runs on first use. Pin a port with `--url http://localhost:5173`
or the `UIGHT_URL` env var if you prefer.

## What the agent can do

| Tool                   | Answers                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `list_fixtures`        | What fixtures exist, with display paths and names                                   |
| `list_components`      | What components were detected that have no fixtures yet                             |
| `list_call_sites`      | How a component is _actually used_ — real props, quoted from your source            |
| `component_props`      | A component's API: prop names, types, defaults, doc comments (needs `docgen: true`) |
| `render_fixture`       | **What it looks like** — a real screenshot of the rendered fixture                  |
| `fixture_url`          | A deep link to hand to a human or a browser tool                                    |
| `get_config`, `health` | Why is my fixture not found; is the index clean                                     |

Everything is read-only: the MCP server is a client of your dev server's
read-only JSON endpoints, never a writer, and it executes none of your code
itself.

`render_fixture` needs the optional `playwright` package installed in your
project; every other tool works without it. `component_props` needs
`docgen: true` in the plugin options and `react-docgen` installed.

## Why this beats reading source

An agent asked to "make the Button's danger variant less aggressive" can:

1. `list_call_sites` for `Button` — see the props your product actually
   passes, not the props the type permits;
2. `component_props` — learn the full prop surface without loading the file
   into context;
3. edit the component;
4. `render_fixture` — **see** the result, in light and dark, at any viewport,
   before claiming the work is done.

Step 4 is the one that changes agent behavior: a screenshot closes the loop
that "the code looks right" leaves open.
