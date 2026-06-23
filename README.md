# OpenFigma MCP

<p align="center">
  <img src="https://img.shields.io/npm/v/open-figma-mcp?color=8b5cf6&label=npm" alt="npm version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="node version">
  <img src="https://img.shields.io/badge/MCP-compatible-0a7cff" alt="MCP compatible">
  <img src="https://img.shields.io/badge/tests-167%20passing-success" alt="tests">
  <img src="https://img.shields.io/badge/telemetry-none-blueviolet" alt="no telemetry">
  <img src="https://img.shields.io/badge/PRs-welcome-ff69b4" alt="PRs welcome">
</p>

> **Stop your AI agent from burning 350k tokens on a single Figma screen.** OpenFigma returns a deduplicated, simplified design — typically **3–4× smaller** than the raw API JSON — then turns it into tokens, code for **8 frameworks**, and accessibility/diff/drift reports. All on a **free** Figma Personal Access Token. No paid Dev Mode seat.

The **most capable free** Model Context Protocol (MCP) server for Figma. It connects your designs to AI coding assistants (Lovable, Cursor, VS Code, Claude, Gemini) **without a paid Figma Dev Mode seat** — using a free Personal Access Token against the Figma REST API.

It is a drop-in superset of [Framelink's `figma-developer-mcp`](https://github.com/GLips/Figma-Context-MCP) (same `get_figma_data`, simplified output, CLI `fetch`, config flags) and then goes well beyond every free *and* paid competitor.

## ✨ What makes it stand out

OpenFigma is the only free Figma MCP that does **all** of these — several of which **no Figma MCP at any price** offers:

| Capability | OpenFigma | Framelink | Composio | Figma Official |
|---|:--:|:--:|:--:|:--:|
| Works on a free PAT (no Dev seat) | ✅ | ✅ | ✅ | ❌ |
| Simplified data + `globalVars` dedup | ✅ | ✅ | ~ | ~ |
| **Design-token export — 8 formats** (CSS/SCSS/TW3/TW4/JS/TS/W3C/style-dictionary) | ✅ | ❌ | ~ (Tailwind only) | ❌ |
| **Multi-framework codegen** (React-Tailwind/inline, Vue, Svelte, Angular, HTML, Flutter, SwiftUI) | ✅ | ❌ | ❌ | ~ (React only) |
| **WCAG accessibility audit** | ✅ | ❌ | ❌ | ❌ |
| **Design diff between versions** | ✅ | ❌ | ❌ | ❌ |
| **Design-vs-code drift detection** | ✅ | ❌ | ❌ | ❌ |
| **Typed component-API generation** | ✅ | ❌ | ❌ | ~ |
| **Inline-SVG icon extraction** | ✅ | ❌ | ❌ | ❌ |
| **Prompt-injection hardening** | ✅ | ❌ (open CVE) | ❌ | ❌ |
| Comments / versions / image-fills / dev-resources | ✅ | ❌ | ✅ | ~ |
| Localhost asset serving | ✅ | ❌ | ❌ | ✅ |
| **Honest about what it can't do** (no fake "success") | ✅ | — | — | — |

## 🚀 Core features

1. **Free-account friendly** — PAT or OAuth Bearer token; no paid Dev Mode seat.
2. **Simplified design data** — `get_figma_data` keeps only what matters (layout, fills, strokes, effects, text, radius, opacity, bbox), converts autolayout → flexbox, colors → hex, and **deduplicates** styles into a `globalVars` block. **~3–4× smaller** than raw API JSON; far smaller on style-heavy files. Untrusted Figma text is scanned for **prompt injection** and flagged.
3. **Design → tokens → code, in one server** — extract a full design-token system, export it to 8 formats, generate typed components for **8 framework targets** (React-Tailwind, React-inline, Vue, Svelte, Angular, HTML/CSS, Flutter, SwiftUI), and pull real inline-SVG icons.
4. **Quality + safety tooling** — WCAG contrast audit, version diffing, and design-vs-code drift detection.
5. **Three output formats** — `yaml` (default), `json`, or `tree`.
6. **CLI** — `fetch`, `tokens`, `codegen`, `audit` subcommands print straight to stdout.
7. **Auto-routing assets + rules writer** — downloads images into the right `figma-export/` folder and keeps `LOVABLE.md` / `.cursorrules` current; serves assets over localhost in HTTP mode.
8. **Dual transport + multi-tenant** — HTTP/SSE (Lovable, default port **3845**) or stdio; per-request `X-Figma-Token` header for shared deployments.
9. **Honesty layer** — canvas-write tools (which need the Plugin API, impossible over REST) return a structured `supported:false` instead of fabricating success. A `capabilities` tool reports exactly what will work.

---

## 🛠️ Installation & Usage

### 🖥️ Desktop app (no terminal required)

Prefer a UI? OpenFigma ships a stunning cross-platform desktop app (Electron + React) that runs the server, explores designs, extracts tokens, and generates code — all visually. See [`desktop/`](desktop/README.md).

```bash
cd desktop && npm install && npm run dev     # or build an installer: npm run dist
```

### One-command (npx)
```bash
npx open-figma-mcp --figma-api-key figd_YOUR_TOKEN --stdio
```

### Local clone
```bash
npm install
node src/server.js --figma-api-key figd_YOUR_TOKEN          # HTTP/SSE on :3845
node src/server.js --figma-api-key figd_YOUR_TOKEN --stdio  # stdio for editors
```

---

## ⌨️ CLI `fetch`

Print simplified design data and exit — same pipeline as the `get_figma_data` tool.

```bash
# YAML (default)
node src/server.js fetch "https://figma.com/design/ABC123/My-File?node-id=12-822" --figma-api-key figd_x

# JSON, piped into jq
node src/server.js fetch "https://figma.com/design/ABC123/My-File?node-id=12-822" --figma-api-key figd_x --format=json | jq '.nodes[0]'

# Experimental compact tree
node src/server.js fetch "https://figma.com/design/ABC123/My-File?node-id=12-822" --figma-api-key figd_x --format=tree

# Explicit flags instead of a URL, with a depth cap
node src/server.js fetch --file-key ABC123 --node-id 12:822 --depth 3 --figma-api-key figd_x
```

> Wrap URLs in quotes — characters like `&` and `?` break unquoted in most shells.

`fetch` flags: `--file-key`, `--node-id`, `--depth`, `--format`, `--json`, `--figma-api-key`, `--figma-oauth-token`, `--env`. Explicit flags override values parsed from the URL.

### More CLI subcommands

```bash
# Export design tokens (css/scss/tailwind/tailwind4/js/ts/json/style-dictionary)
node src/server.js tokens "https://figma.com/design/ABC123/..." --figma-api-key figd_x --format=tailwind4 > theme.css

# Generate component code from a node
node src/server.js codegen "https://figma.com/design/ABC123/...?node-id=12-822" --figma-api-key figd_x --framework=vue

# WCAG accessibility audit (JSON)
node src/server.js audit "https://figma.com/design/ABC123/..." --figma-api-key figd_x --page-background "#0b0b0b"
```

---

## ⚙️ Configuration

All options can be set via CLI flag **or** environment variable. Precedence: **CLI args > environment > defaults**. (A per-request `X-Figma-Token` header overrides everything for that one request.)

| CLI flag | Env var | Default | Description |
| --- | --- | --- | --- |
| `--figma-api-key` | `FIGMA_API_KEY` | — | Figma Personal Access Token |
| `--figma-oauth-token` | `FIGMA_OAUTH_TOKEN` | — | OAuth Bearer token (uses `Authorization: Bearer`) |
| `--port` | `FRAMELINK_PORT` / `PORT` | `3845` | HTTP port (3845 = Lovable autodetect) |
| `--host` | `FRAMELINK_HOST` / `HOST` | `127.0.0.1` | HTTP host |
| `--format` | `OUTPUT_FORMAT` | `yaml` | `yaml`, `json`, or `tree` |
| `--json` | — | — | Alias for `--format=json` |
| `--image-dir` | `IMAGE_DIR` | autodetected | Base dir for image downloads |
| `--skip-image-downloads` | `SKIP_IMAGE_DOWNLOADS` | `false` | Don't register image download tools |
| `--proxy` | `FIGMA_PROXY` | — | HTTP(S) proxy URL, or `none` to bypass proxy env vars |
| `--env` | — | `./.env` | Load env vars from a custom `.env` path |
| `--stdio` | — | — | Run over stdio (editors) instead of HTTP |
| `--no-telemetry` | `FRAMELINK_TELEMETRY=off` / `DO_NOT_TRACK` | — | Accepted for compatibility (OpenFigma collects **no** telemetry) |
| `--help`, `--version` | — | — | Print help / version and exit |

> **Lovable note:** the default port is `3845` so Lovable Desktop can autodetect the connector. For drop-in compatibility with `figma-developer-mcp` configs that assume `3333`, set `FRAMELINK_PORT=3333` or `--port=3333`.

### Authentication

- **Personal Access Token** (recommended): generate under *Figma → Settings → Security → Personal access tokens* with **File content: Read** and **Dev resources: Read** scopes.
- **OAuth Bearer token**: pass `--figma-oauth-token` / `FIGMA_OAUTH_TOKEN`; the server then sends `Authorization: Bearer` instead of `X-Figma-Token`. OAuth takes precedence over a PAT when both are set.
- **Per-request (HTTP mode):** send `X-Figma-Token: figd_xxxx` on each request to override the server's configured credentials for that request only — ideal for centrally hosted, multi-user deployments.

### Network proxy

Behind a corporate proxy? Set `--proxy=http://proxy:8080` (or `FIGMA_PROXY`). The server also respects the standard `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` variables automatically. Use `--proxy=none` to ignore inherited proxy env vars and connect directly.

---

## 🤖 MCP Client Setup

### Lovable Desktop
Start the server in HTTP mode on port `3845`; Lovable scans localhost and enables the connector automatically.

### Cursor / VS Code / Claude Desktop
```json
{
  "mcpServers": {
    "open-figma-mcp": {
      "command": "node",
      "args": ["C:/path/to/open-figma-mcp/src/server.js", "--stdio"],
      "env": { "FIGMA_API_KEY": "figd_YOUR_TOKEN" }
    }
  }
}
```

### HTTP / SSE
```json
{
  "mcpServers": {
    "open-figma-mcp": {
      "url": "http://localhost:3845/sse",
      "env": { "FIGMA_API_KEY": "figd_YOUR_TOKEN" }
    }
  }
}
```

---

## 🧰 Tools

**Read & simplify**
- `get_figma_data` — fetch + simplify a file or `nodeIds` (with `depth`), in yaml/json/tree. **Start here.**
- `get_metadata` / `get_design_context` — lighter structural views.
- `get_variable_defs` — variables/tokens (falls back to document styles on free accounts).
- `get_figjam`, `get_libraries`, `search_design_system`, `whoami`.

**Design → code**
- `get_design_tokens` — extract a token system, export as `css`/`scss`/`tailwind`/`tailwind4`/`js`/`ts`/`json` (W3C)/`style-dictionary`.
- `generate_code` — component code in `react-tailwind`, `react-inline`, `vue`, `svelte`, `angular`, `html`, `flutter`, or `swiftui` (responsive via constraints).
- `generate_component_api` — typed TS `interface` / Vue `defineProps` from component properties & variants.
- `extract_vectors` — real **inline SVG** icons from path geometry (themeable `currentColor`).

**Quality & review**
- `audit_accessibility` — WCAG contrast + tap-target audit.
- `get_design_diff` — semantic diff between two file **versions** (added/removed/changed nodes).
- `audit_drift` — design tokens vs. your repo's colors (missing / stale / near-miss).

**Figma API coverage**
- `get_comments` / `add_comment`, `get_versions`, `get_image_fills`, `get_dev_resources`, `get_projects`.
- `download_figma_images` / `download_assets` / `get_screenshot` (disabled by `--skip-image-downloads`).

**Meta**
- `capabilities` — what this server can and cannot really do.
- Code Connect toolchain (`get_code_connect_map`, `get_code_connect_suggestions`, …).
- Canvas-write tools (`use_figma`, `create_new_file`, `generate_figma_design`, `generate_diagram`, `upload_assets`) **honestly return `supported:false`** — REST cannot write to the canvas; use `generate_code` + `download_assets` instead.

---

## ✅ Testing

```bash
npm run test:unit          # offline, deterministic (serializers, simplify, config, proxy, URL parsing)
npm run test:integration   # spins up the server over stdio + exercises the CLI fetch
npm test                   # both
```

The unit tests run with no network and no token; the simplification tests use a cached fixture when present.

---

## 🤝 Project & community

- [Contributing guide](CONTRIBUTING.md) — dev setup, how to add a framework or token format
- [Changelog](CHANGELOG.md) — what changed, version by version
- [Security policy](SECURITY.md) — how to report issues, and the localhost/auth notes
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Launch & market-research notes](LAUNCH_PLAN.md) — positioning and roadmap

Issues and PRs are welcome. Good first issues are labeled. If OpenFigma saved you tokens, a ⭐ helps others find it.

## 📄 License
MIT License. Feel free to share and modify!
