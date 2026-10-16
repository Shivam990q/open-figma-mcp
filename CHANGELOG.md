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
- **Companion Figma Plugin:** Live WebSocket bridge on port 3845 supporting real-time canvas writes (`CREATE_FRAME`, `CREATE_TEXT`, `UPDATE_NODE`, `DELETE_NODE`).
- **Comprehensive Documentation Suite:** Added `SPECIFICATION.md`, `API_REFERENCE.md`, `KIWI_PROTOCOL.md`, `BENCHMARKS.md`, `DEPLOYMENT.md`, `SECURITY.md`, `ROADMAP.md`, and `COMPARISON.md`.
