# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Desktop app** (`desktop/`) — a cross-platform Electron + React + Tailwind GUI
  that reuses the core engine over IPC. Onboarding, MCP server control with live
  logs + client-config snippets, visual Explore/Tokens/Codegen, and settings.

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
