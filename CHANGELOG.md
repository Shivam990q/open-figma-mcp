# Changelog

All notable changes to OpenFigma MCP will be documented in this file.

## [2.0.0] - 2026-10-17

### 🚀 Major Architectural Leap (Beast Edition / Autonomous Design Fabric)
- **Rust SIMD Core Engine:** Rebuilt the core system in Rust (`crates/open-figma-core`) with zero-copy memory-mapped operations and zero GC pauses.
- **Offline `.fig` Kiwi Binary Unpacker:** Added native reverse-engineered Kiwi parser decoding `.fig` archives directly from disk in under 15 milliseconds without external API keys or cloud access.
- **Taffy 2.0 Layout Solver:** Integrated pure-Rust Taffy engine computing exact Flexbox and CSS Grid bounding boxes.
- **APCA ($L^c$) Contrast Engine:** Implemented modern perceptual spatial contrast mathematics alongside WCAG 2.2.
- **Aho-Corasick Prompt Shield:** Added high-throughput (10 GB/s) SIMD automaton scanning layer names and characters for adversarial prompt injections.
- **Dual-Engine Hybrid Launcher:** `bin/open-figma.js` automatically detects and delegates to native release binary `open-figma.exe` or falls back to universal Node/Bun runtime.
- **Genuine Native Electron Desktop Workbench:** Complete dark-mode native IDE (`npm run desktop` / `make desktop`) featuring interactive layer hierarchy AST, design token palettes with color swatches, live artboard canvas, and multi-framework code synthesizer with 1-click clipboard copy.
- **AI OmniRouter & Quality Gate:** Multi-provider frontier peer routing with RTK token compression, peer fallback chains (`Claude 3.7` -> `GPT-4o` -> `Claude 3.5 Sonnet` -> `DeepSeek-R1` -> `Gemini 1.5 Pro`), and deterministic AI refusal phrase interception.
- **Git-like Design Version Control System (VCS):** Checkpoint kernel with immutable SHA-256 snapshot history, structural AST diffing, and virtual branching.
- **Dual Client SDKs:** Official TypeScript SDK (`@open-figma/sdk`) and Python SDK (`open-figma-sdk`) with LangChain & LlamaIndex custom tool wrappers.
- **Companion Figma Plugin:** Live WebSocket bridge on port 3845 supporting real-time canvas writes (`CREATE_FRAME`, `CREATE_TEXT`, `CREATE_NAVBAR`, `CREATE_HERO_SECTION`, `CREATE_DESIGN_SYSTEM`).
- **Production Infrastructure:** Multi-stage non-root Alpine Dockerfile, Helm v3 charts, Kubernetes manifests, and AWS/GCP Terraform modules.
- **Multi-Runtime Verification:** 76 unit/integration tests across Rust, Node.js, TypeScript, and Python, plus 100-request benchmark harness (1,041 req/sec throughput) and live Figma Cloud account verification.
- **Comprehensive Documentation Suite:** Added `SPECIFICATION.md`, `API_REFERENCE.md`, `KIWI_PROTOCOL.md`, `BENCHMARKS.md`, `DEPLOYMENT.md`, `SECURITY.md`, `ROADMAP.md`, and `COMPARISON.md`.
