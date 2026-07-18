# OpenFigma Bridge — Figma plugin

This plugin gives OpenFigma MCP **real canvas read/write access** (create and edit
frames, text, rectangles, fills, etc.) — the one capability the public REST API
can't provide. It runs inside Figma (full Plugin API access) and connects to the
OpenFigma MCP server over a local WebSocket bridge.

```
AI agent ──MCP──► OpenFigma server ──WebSocket(:3846)──► this plugin ──Plugin API──► canvas
```

## Install (one time, dev mode)

The plugin is included in both the Git repository and the published npm package.
If you installed OpenFigma locally from npm, its manifest is at
`node_modules/open-figma-mcp/figma-plugin/manifest.json`.

1. Start the OpenFigma MCP server (any mode). It opens the WebSocket bridge on
   `ws://127.0.0.1:3846` automatically. (Change with `--bridge-port`, disable with `--no-bridge`.)
2. In the **Figma desktop app**: menu → **Plugins → Development → Import plugin from manifest…**
3. Select `figma-plugin/manifest.json` from this repo, or the npm path above.
4. Open a design file, then **Plugins → Development → OpenFigma Bridge**.
5. The plugin auto-connects. The status dot turns green ("Connected").

Keep the plugin window open while your agent works.

## What it enables

Once connected, all of these MCP tools operate on the open file. When the plugin
is unavailable, they return an honest `supported:false` response instead of
claiming a canvas change succeeded.

| Tools | Action |
|---|---|
| `get_canvas_selection`, `get_canvas_document`, `get_node_info` | Inspect the live selection, page, document, or a node |
| `create_frame`, `create_rectangle`, `create_ellipse`, `create_text` | Create canvas nodes, optionally inside a parent |
| `set_fill_color`, `set_stroke_color`, `set_corner_radius`, `set_opacity` | Apply fills, borders, radii, and opacity |
| `add_drop_shadow`, `set_image_fill` | Add effects or fill a node from an HTTP(S) image URL |
| `set_text`, `set_name` | Change text content or rename a node |
| `set_auto_layout`, `group_nodes` | Configure auto-layout or group sibling nodes |
| `move_node`, `resize_node`, `clone_node`, `delete_node` | Reposition, resize, duplicate, or remove nodes |
| `create_component_from_node`, `create_instance` | Build reusable components and instances |

`set_image_fill` asks Figma to fetch the exact URL supplied in the tool call; use
only image URLs you trust. Check status anytime with the `capabilities` tool — it
reports whether the plugin is connected and lists the live canvas tools.

## Troubleshooting

- **Status stays red:** make sure the server is running and the port in the
  plugin matches `--bridge-port` (default `3846`).
- **"plugin is not connected" from a tool:** open the plugin window in Figma and
  wait for the green dot, then retry.
- **Firewall prompt:** allow the local connection (it's loopback only, `127.0.0.1`).
