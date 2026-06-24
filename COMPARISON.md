# OpenFigma MCP vs. Official Figma Dev Mode MCP

A grounded, honest comparison (sources: Figma developer docs + Figma blog, early 2026).
The goal: be the server people reach for *instead of* the official one for the
**design-to-code** workflow — while being honest about the one thing only Figma's
first-party server can do (write to the canvas).

## Capability matrix

| Capability | Official Figma MCP | OpenFigma MCP | Notes |
|---|:--:|:--:|---|
| **Cost / access** | Paid — needs a Dev/Full seat; free tiers capped (~6 tool calls/mo) | **Free PAT, unlimited** | OpenFigma's core wedge |
| **Generate code from a node** | ✅ `get_code` (React-ish) | ✅ `get_code` / `generate_code` — **8 frameworks** | We cover more targets |
| **Extract design context** | ✅ `get_metadata` | ✅ `get_metadata`, `get_figma_data`, `get_design_context` | Ours dedups → 3–4× smaller |
| **Variables / tokens** | ✅ `get_variable_defs` | ✅ `get_variable_defs` + `get_design_tokens` (8 export formats) | We export; they list |
| **Image / screenshot** | ✅ `get_image` | ✅ `get_image` / `get_screenshot` / `download_assets` | Both bound by Figma render limits |
| **Code Connect** | ✅ `get_code_connect_map` | ✅ full Code Connect toolchain | Parity |
| **Design-system rules file** | ✅ `create_design_system_rules` | ✅ `create_design_system_rules` (from real tokens) | Parity (built from extracted tokens) |
| **Make resources** | ✅ | ~ `get_dev_resources` | Partial |
| **Write to canvas** (create/edit frames, components, variables) | ✅ (Plugin/Make API) | ✅ **via free companion plugin** (Plugin API + WS bridge) | Real writes — honest `supported:false` only when the plugin isn't open |
| **Token/context efficiency** | Heavy (one screen ~350k tokens reported) | **3–4× smaller** via simplify + globalVars dedup | Our biggest practical win |
| **Transport** | Remote (hosted) + local; Streamable HTTP | **Streamable HTTP (`/mcp`) + legacy SSE (`/sse`) + stdio** | Parity + legacy support |
| **Multi-framework codegen** | React-focused | React-TW/inline, Vue, Svelte, Angular, HTML, Flutter, SwiftUI | We cover more |
| **Accessibility audit** | ❌ | ✅ `audit_accessibility` (WCAG) | Unique |
| **Version diff / design drift** | ❌ | ✅ `get_design_diff`, `audit_drift` | Unique |
| **Inline-SVG icon extraction** | ❌ | ✅ `extract_vectors` | Unique |
| **Prompt-injection hardening** | ❌ | ✅ scans untrusted design text | Unique |
| **Rate-limit resilience** | n/a (hosted) | ✅ disk cache + fast stale fallback | Survives free-tier 429s |
| **Desktop control app** | ❌ (enabled in prefs) | ✅ Electron app (Home/Playground/Settings) | Unique |
| **Telemetry** | Collected | **None** | Privacy win |

## Canvas write — now supported via the companion plugin

The official server creates and modifies native Figma content (frames,
components, variables, auto-layout) using the Plugin/Make API. The public REST
API alone can't do this — so OpenFigma ships a **free companion Figma plugin**
that runs inside Figma (full Plugin API access) and connects to the MCP server
over a local WebSocket bridge. With it open, agents can `create_frame`,
`create_text`, `create_rectangle`, `set_fill_color`, `move/resize/clone/delete`
nodes, and read the live selection — real writes, same mechanism the official
server uses internally.

When the plugin **isn't** connected, those tools return a structured
`supported:false` (never fabricated success). File-level operations
(`create_new_file`, HTML→canvas, Mermaid→FigJam, raw asset upload) remain out of
scope and are honestly reported as such.

## Where OpenFigma should win adoption

1. **Free** — no Dev seat, no per-call cap.
2. **Cheaper context** — 3–4× smaller payloads; fewer "file too large" failures.
3. **More targets** — 8 frameworks + 8 token formats.
4. **More analysis** — a11y, diff, drift, vectors.
5. **Honest** — never reports work it didn't do.
6. **Self-hostable + private** — Docker, no telemetry.

## Verdict

For **reading designs and turning them into code, tokens, and assets**,
OpenFigma matches or exceeds the official server and is free. For **writing back
to the Figma canvas**, OpenFigma now does real writes through its free companion
plugin — closing the last gap. The only things it deliberately doesn't do are
creating whole new files and HTML/Mermaid→canvas conversion, which it reports
honestly rather than faking.
