# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
## [Unreleased]

### Added
- **Complete canvas toolset** — added `create_ellipse`, `create_component_from_node`,
  `create_instance`, `set_stroke_color`, `set_opacity`, `add_drop_shadow`,
  `set_image_fill` (image-from-URL), `set_auto_layout`, `group_nodes`, `set_name`,
  `get_node_info` on top of the initial write tools — professional canvas parity.
- **`ARCHITECTURE.md`** — deep architecture & working-mechanism doc (with diagrams)
  explaining how OpenFigma *and* the official Figma MCP work.
- **Real canvas writes** 🎉 — a free companion **Figma plugin** (`figma-plugin/`)
  + WebSocket bridge gives agents live canvas read/write: `create_frame`,
  `create_rectangle`, `create_text`, `set_fill_color`, `set_corner_radius`,
  `set_text`, `move_node`, `resize_node`, `clone_node`, `delete_node`,
  `get_canvas_selection`, `get_canvas_document`. Closes the last parity gap with
  the official Figma MCP. Honest `supported:false` when the plugin isn't open.
  New flags: `--bridge-port` / `--no-bridge`. Verified end-to-end over `/mcp`.
- **`create_design_system_rules` tool** — generates a rules file from the design's
  real extracted tokens (colors, type ramp, spacing, radii, shadows), matching the
  official Figma MCP tool. Optionally writes `figma-design-rules.md` to the workspace.
- **`COMPARISON.md`** — honest, sourced feature-by-feature comparison vs. the official Figma Dev Mode MCP.
- **`get_code` and `get_image` tool aliases** — match the official Figma Dev Mode
  MCP tool names for closer drop-in compatibility in editors.
- **Streamable HTTP transport** (MCP spec 2025-03-26) at `/mcp` — what Lovable and
  recent Cursor/Claude clients expect. Server refactored to a per-session factory;
  legacy SSE remains at `/sse`. Verified end-to-end with a real `initialize` +
  `tools/list` handshake.
- Root `/` info page and richer `/health` (lists both transports + active sessions).
- **Desktop app** (`desktop/`) — a cross-platform Electron + React + Tailwind GUI
  that reuses the core engine over IPC. Onboarding, MCP server control with live
  logs + client-config snippets, visual Explore/Tokens/Codegen/**Accessibility**/**Assets**, and settings.
- **Docker support** — `Dockerfile`, `.dockerignore`, `docker-compose.yml`, and a
  `DEPLOYMENT.md` covering stdio/HTTP/Docker/cloud with security guidance.
- **CI** now also typechecks and builds the desktop app.

### Fixed
- **Rate-limit UX**: on a 429/error, the server now serves a cached copy
  *immediately* (one short attempt) instead of waiting through ~17s of backoff —
  which previously caused client-side tool timeouts (e.g. in Lovable). Verified:
  cached `get_figma_data` returns in ~0.1s instead of ~17s.
- Cache TTL raised from 5 to **30 minutes** to cut API calls during long builds.
- `fetchWithRetry` no longer makes a redundant extra request after exhausting retries.
- Desktop: spawned server runs in a stable working dir (consistent `.figma-cache`/exports).

### Changed
- Lovable / HTTP client config now uses `http://localhost:3845/mcp`.
- **Desktop app redesigned** — simplified from 8 screens to 3 (Home / Playground /
  Settings). Home merges server control + editor setup (Cursor/VS Code/Claude/
  Windsurf/Lovable config with copy). Restrained Linear-style visual language
  (neutral palette, one accent) replacing the gradient-heavy look. The 5 tools
  are now consolidated under one tabbed Playground.

## [1.3.0]

### Added
- **Four new codegen targets**: `svelte`, `angular` (standalone component),
  `flutter` (Dart `StatelessWidget` tree), and `swiftui` (`View` struct).
  `generate_code` now supports **8 framework targets** total.
- GitHub launch kit: `LICENSE` (MIT), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, `.env.example`, issue/PR templates, CI + publish workflows.
- README badges, a token-bloat positioning hook, and updated framework matrix.

### Changed
- `generate_code` tool + CLI `codegen` help now list all 8 frameworks.
- Full npm metadata (keywords, repository, engines, files) in `package.json`.

## [1.2.0]

### Added
- Design-token export in 8 formats (CSS/SCSS/Tailwind v3 + v4/JS/TS/W3C/style-dictionary).
- WCAG accessibility audit (`audit_accessibility`).
- Design version diff (`get_design_diff`) and design-vs-code drift (`audit_drift`).
- Typed component-API generation (`generate_component_api`).
- Inline-SVG icon extraction (`extract_vectors`).
- Prompt-injection scanning of untrusted Figma text.
- Honesty layer: canvas-write tools return structured `supported:false`;
  `capabilities` tool reports what actually works.
- HTTP proxy support and a `--proxy` flag.

## [1.0.0]

### Added
- Initial release: `get_figma_data` with simplification + `globalVars` dedup,
  CLI `fetch`, asset downloads, dual transport (HTTP/SSE + stdio), disk caching,
  rate-limit handling with stale-cache fallback.
