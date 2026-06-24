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
| **Write to canvas** (create/edit frames, components, variables) | ✅ (Plugin/Make API) | ❌ **honestly unsupported** | Impossible over REST — we never fake it |
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

## The one true gap: canvas write

The official server can **create and modify native Figma content** (frames,
components, variables, auto-layout) using the Plugin/Make API. **This is
impossible over the public REST API** that OpenFigma uses. We do not fake it —
the write tools (`use_figma`, `create_new_file`, `generate_figma_design`,
`generate_diagram`, `upload_assets`) return a structured `supported:false` with
the real alternative. For the *design-to-code* direction (the overwhelmingly
common use case), OpenFigma is a complete replacement.

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
to the Figma canvas**, the official (paid, Plugin-based) server remains the only
option — and OpenFigma says so plainly.
