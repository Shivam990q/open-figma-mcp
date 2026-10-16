# OpenFigma MCP: System Architecture & Technical Specification

> **Autonomous Design Fabric (ADF)**  
> Version: `2.0.0-beast`  
> Author: Shivam  

---

## 1. High-Level Architecture Overview

OpenFigma MCP is an enterprise-grade Model Context Protocol (MCP) server and autonomous design engine. It bridges AI coding agents (Claude Code, Cursor, Windsurf, VS Code, Lovable, v0) with Figma design assets, operating with **zero paid Dev Mode seats** and offering sub-millisecond offline `.fig` Kiwi binary parsing.

```
+-----------------------------------------------------------------------------+
|                               AI CODING AGENTS                              |
|           (Cursor / VS Code / Claude Code / Windsurf / Lovable / v0)        |
+-----------------------------------------------------------------------------+
                                      |
                     [stdio / HTTP:3845 / JSON-RPC 2.0]
                                      v
+-----------------------------------------------------------------------------+
|                          OPEN-FIGMA MCP GATEWAY                             |
|               (Hybrid Rust SIMD Binary + Universal Node Engine)             |
+-----------------------------------------------------------------------------+
   |                                 |                                     |
   v                                 v                                     v
[Quad-Ingest Pipeline]    [Canonical Semantic Model]             [Synthesizer]
* Path A: Kiwi Binary     * Tree Reduction (DFS Pruning)          * 8 Token Formats
* Path B: Adaptive REST   * Single-Child Group Collapsing        * 9 UI Frameworks
* Path C: Live CDP Sniff  * Symbol Table ($C1, $R1, $S1)         * APCA / WCAG 2.2
* Path D: WebSocket Bridge* Taffy 2.0 Layout Solver              * Prompt Shield
```

---

## 2. Ingestion Pipeline: The Quad-Ingest Engine

### Path A: Zero-Copy Kiwi Binary Engine (`.fig` Unpacker)
1. **Container Extraction:** Opens the `.fig` file container as a standard ZIP archive and extracts the internal `canvas.fig` binary stream.
2. **Magic Validation:** Verifies the 8-byte magic header `b"fig-kiwi"` followed by a 32-bit little-endian version number.
3. **Dynamic Schema Decompression:** Decompresses the embedded Kiwi schema chunk using DEFLATE (`flate2`).
4. **Scenegraph Decoding:** Decompresses the Zstandard (`zstd`) data stream and decodes strongly-typed Kiwi messages into `CanonicalNode` representations.
5. **Zero Internet Requirement:** Executes entirely offline on air-gapped systems in under **15 milliseconds**.

### Path B: Adaptive Figma REST Cloud Client
* Connects via Personal Access Token (`X-Figma-Token`) or OAuth 2.0.
* Implements an **Adaptive Token Bucket Rate Limiter** with jittered exponential backoff to eliminate 429 Too Many Requests errors.
* Automatically normalizes dashed and colon-separated node IDs (e.g. `12-822` $\leftrightarrow$ `12:822`).

### Path C & D: Live WebSocket Companion Bridge
* Runs a loopback WebSocket server on `127.0.0.1:3845`.
* Pairs with the sandboxed Figma plugin (`figma-plugin/`) running in Figma Desktop or Figma Web.
* Enables bidirectional canvas writes: `CREATE_FRAME`, `CREATE_TEXT`, `UPDATE_NODE`, and `DELETE_NODE`.

---

## 3. Canonical Semantic Model (CSM) & Context Compression

Raw Figma scenegraphs frequently span 50,000+ lines of JSON (300KB to 5MB per screen), burning hundreds of thousands of LLM context tokens. OpenFigma applies a multi-pass reduction algorithm:

1. **Invisible Layer Elimination:** Non-visible layers (`node.visible == false`) are pruned.
2. **Single-Child Transparent Group Collapsing:**
   $$\text{Group}(G \to C) \Longrightarrow C \quad \text{if } G \text{ has no fills, strokes, or effects and depth} > 0$$
3. **Symbol Table (Token Deduplication):**
   Hex colors, border radii, and shadows are cataloged into an indexed Symbol Table:
   $$\$C_1 = \text{"#3B82F6"}, \quad \$C_2 = \text{"#1E293B"}, \quad \$R_1 = 8\text{px}$$
   This reduces payload size by **3× to 4×** while outputting a unified `globalVars` block.

---

## 4. Layout Solver: Taffy 2.0 Engine

Instead of relying on approximate heuristics, OpenFigma binds **Taffy 2.0**, a pure-Rust implementation of the complete CSS Flexbox and CSS Grid specifications:
* Converts Figma `layoutMode` (`HORIZONTAL` $\to$ `FlexDirection::Row`, `VERTICAL` $\to$ `FlexDirection::Column`).
* Maps `primaryAxisAlignItems` and `counterAxisAlignItems` to standard `JustifyContent` and `AlignItems`.
* Solves element bounding boxes deterministically before code generation.

---

## 5. Forensic Quality & Security Engine

### 1. Advanced Perceptual Contrast Algorithm (APCA)
Implements modern spatial vision contrast math ($L^c$) alongside legacy WCAG 2.1:
$$Y = 0.2126729 \times R_{\text{lin}} + 0.7151522 \times G_{\text{lin}} + 0.0721750 \times B_{\text{lin}}$$
$$L^c = (Y_{\text{txt}}^{\gamma} - Y_{\text{bg}}^{\gamma}) \times 1.14 \times 100$$
Evaluates contrast compliance across:
* $|L^c| \ge 75$: Preferred body text
* $|L^c| \ge 60$: Minimum content text
* $|L^c| \ge 45$: Headlines only

### 2. Prompt Injection Defense
Scans layer names and text characters with an **Aho-Corasick SIMD Automaton** (matching adversarial triggers such as `ignore previous instructions`, `system prompt:`, `eval()`) at **10 GB/s**, and sanitizes zero-width / bidi-override Unicode control characters.
