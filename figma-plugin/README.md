# OpenFigma Bridge — Figma plugin

This plugin gives OpenFigma MCP **real canvas read/write access** (create and edit
frames, text, rectangles, fills, etc.) — the one capability the public REST API
can't provide. It runs inside Figma (full Plugin API access) and connects to the
OpenFigma MCP server over a local WebSocket bridge.

```
AI agent ──MCP──► OpenFigma server ──WebSocket(:3846)──► this plugin ──Plugin API──► canvas
```

## Install (one time, dev mode)

1. Start the OpenFigma MCP server (any mode). It opens the WebSocket bridge on
   `ws://127.0.0.1:3846` automatically. (Change with `--bridge-port`, disable with `--no-bridge`.)
2. In the **Figma desktop app**: menu → **Plugins → Development → Import plugin from manifest…**
3. Select `figma-plugin/manifest.json` from this repo.
4. Open a design file, then **Plugins → Development → OpenFigma Bridge**.
5. The plugin auto-connects. The status dot turns green ("Connected").

Keep the plugin window open while your agent works.

## What it enables

Once connected, these MCP tools become live (otherwise they return an honest
`supported:false`):

| Tool | Action |
|---|---|
| `get_canvas_selection` | Read the current selection |
| `get_canvas_document` | Read page/document info |
| `create_frame` | Create a frame (optional auto-layout) |
| `create_rectangle` | Create a rectangle |
| `create_text` | Create a text node |
| `set_fill_color` | Set a node's solid fill |
| `set_corner_radius` | Set corner radius |
| `set_text` | Replace text content |
| `move_node` / `resize_node` | Reposition / resize |
| `clone_node` / `delete_node` | Duplicate / remove |

Check status anytime with the `capabilities` tool — it reports whether the plugin
is connected and lists the live canvas tools.

## Troubleshooting

- **Status stays red:** make sure the server is running and the port in the
  plugin matches `--bridge-port` (default `3846`).
- **"plugin is not connected" from a tool:** open the plugin window in Figma and
  wait for the green dot, then retry.
- **Firewall prompt:** allow the local connection (it's loopback only, `127.0.0.1`).
