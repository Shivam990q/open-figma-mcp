# OpenFigma vs Competitor Ecosystem: Comprehensive Comparison

This document provides a forensic, feature-by-feature evaluation of **OpenFigma MCP v2.0** against all major Figma integrations and MCP servers:

1. **Official Figma MCP Server** (`mcp.figma.com` / Desktop `:3845`)
2. **Framelink MCP** (`GLips/Figma-Context-MCP` / `figma-developer-mcp`)
3. **Southleft** (`southleft/figma-console-mcp`)
4. **OpenPencil** (`open-pencil/open-pencil`)
5. **OpenFigma MCP v2.0 (Beast Edition)**

---

## 1. Feature & Capability Matrix

| Feature | Official Figma MCP | Framelink | Southleft | OpenPencil | OpenFigma v2.0 (Beast) |
|---|:---:|:---:|:---:|:---:|:---:|
| **Cost / License** | **$25–$35/mo Dev Mode** | Free (MIT) | Free (MIT) | Free (MIT) | **Free (MIT)** |
| **Full Design Seat Required for Writes?** | **YES ($75–$90/mo)** | N/A (Read-only) | No (Uses Plugin) | No (Native editor) | **NO (Free Plugin Bridge)** |
| **Offline `.fig` Parsing (Zero API)** | ❌ No | ❌ No | ❌ No | ✅ Yes (Rust) | 👑 **YES (Zero-Copy Kiwi)** |
| **Architecture / Core Runtime** | Proprietary Cloud | Node.js | Node.js | Tauri + Rust | 👑 **Rust SIMD + Node.js Dual Engine** |
| **Layout Solver** | Cloud | None | None | Yoga (C++) | 👑 **Taffy 2.0 (CSS Grid + Flexbox)** |
| **Token Formats Exported** | ~1 (Basic) | ❌ 0 | 1 (DTCG JSON) | ~1 | 👑 **8 Formats (CSS, SCSS, TW3, TW4, W3C, TS, Flutter, Style-Dict)** |
| **Multi-Framework Codegen** | React only | ❌ None | Scaffolding | Vector only | 👑 **9 Frameworks (React, Vue, Svelte, Angular, Solid, Flutter, etc.)** |
| **Accessibility Audit** | Basic | ❌ None | Basic | Linter | 👑 **WCAG 2.2 + APCA ($L^c$ Perceptual)** |
| **Design Drift Detection** | ❌ None | ❌ None | Basic | ❌ None | 👑 **Automated Token Parity Scoring** |
| **Prompt Injection Defense** | ❌ None | ❌ Open CVE | ❌ None | ❌ None | 👑 **Aho-Corasick SIMD Automaton** |
| **Dual Transport (stdio + HTTP/SSE)** | Stdio only | Stdio only | Stdio only | Stdio only | 👑 **stdio + HTTP/SSE on :3845** |

---

## 2. In-Depth Competitor Breakdown

### 1. Official Figma MCP Server
* **The Good:** First-party Code Connect integration.
* **The Fatal Flaw:** The economic barrier. A team of 25 engineers costs **$7,500 to $10,500/year** simply to allow Cursor or Claude to read Figma frames! Furthermore, their canvas mutation tool (`use_figma`) requires an active full editor seat ($75-$90/mo), locking out autonomous developers.
* **OpenFigma Advantage:** Operates on free Personal Access Tokens (PAT) or completely offline with raw `.fig` files. Zero seat costs.

### 2. Framelink (`figma-developer-mcp` / `GLips`)
* **The Good:** Popularized pruned JSON output.
* **The Fatal Flaw:** Completely read-only. Vulnerable to prompt injection (untrusted layer names injected straight into system prompts). No design token exports, no multi-framework code generation.
* **OpenFigma Advantage:** Full companion plugin for writes, 8 token formats, 9 framework synthesizers, and Aho-Corasick prompt injection filtering.

### 3. Southleft (`figma-console-mcp`)
* **The Good:** Specialized in design-system token syncing via DTCG format.
* **The Fatal Flaw:** Heavy Node.js process with 120+ tools that creates high latency on large files. Depends strictly on having an active Figma desktop app instance open. Cannot parse offline files without Figma running.
* **OpenFigma Advantage:** Sub-millisecond compiled Rust engine with offline Kiwi `.fig` decompression, Taffy layout solver, and universal Node fallback.

### 4. OpenPencil (`open-pencil/open-pencil`)
* **The Good:** Full standalone design app in Rust + Skia.
* **The Fatal Flaw:** Massive desktop application scope. It is an editor trying to replace Figma itself, rather than a focused, headless, ultra-lightweight Model Context Protocol (MCP) server for coding agents.
* **OpenFigma Advantage:** Purpose-built, headless MCP server and CLI that connects seamlessly to Cursor, VS Code, and Claude Code without requiring a separate vector editor GUI.
