# 🔍 FORENSIC AUDIT REPORT: `bernaferrari/FigmaToCode`
## Deep Codebase Audit, Performance Profiling, Architectural Strengths, and Bottleneck Analysis

> **Target Repository:** `bernaferrari/FigmaToCode` (Cloned at `research_ecosystem/repos/bernaferrari-FigmaToCode`)  
> **Key Focus:** Translating Figma designs to Tailwind CSS, Flutter, and SwiftUI  
> **Audit Status:** Complete Source-Level Forensic Review

---

### 1. Repository Overview & Topology

```
bernaferrari-FigmaToCode/
├── apps/ (Figma plugin UI and web application wrappers)
├── packages/
│   ├── core/ (Scenegraph walker and property normalization)
│   ├── generators/
│   │   ├── html/ (Tailwind and standard CSS code generator)
│   │   ├── flutter/ (Dart Widget tree synthesizer)
│   │   └── swiftui/ (Swift view builder)
│   └── ui/ (Design system components for plugin window)
└── turbo.json, pnpm-workspace.yaml & manifest.json
```

---

### 2. Architectural Strengths & High-Value Inventions

1. **Multi-Target Code Generation:**
   - One of the first projects to demonstrate translating Figma Auto Layout cleanly into both web (Tailwind CSS) and native mobile (Flutter & SwiftUI).
2. **Auto Layout Property Mapping:**
   - Maps `primaryAxisAlignItems` and `counterAxisAlignItems` into proper Tailwind flex classes (`items-center`, `justify-between`).
3. **Clean Component Scaffolding:**
   - Produces idiomatic Dart and Swift classes with constructor props and styling decorations.

---

### 3. Critical Architectural Bottlenecks & Design Flaws

1. **Brittle Heuristic Templates vs Compiler ASTs:**
   - Relies on string concatenations rather than an AST builder (such as Babel, SWC, or Oxc).
   - Complex nested layouts or mixed constraints frequently produce mismatched tags or syntax errors.
2. **Rigid Pixel Fallbacks:**
   - When Auto Layout is missing, `FigmaToCode` falls back to absolute fixed pixel positions (`w-[342px] h-[52px]`), producing non-responsive components that break on mobile screens.
3. **No MCP Server or Headless Mode:**
   - Designed exclusively as an interactive Figma desktop plugin; cannot run as a standalone headless MCP daemon for AI coding agents.
4. **No Reverse Transpiler (Code $\to$ Design):**
   - Strictly a one-way export tool; cannot take code and update the Figma canvas.

---

### 4. Comparison Summary: FigmaToCode vs OpenFigma Beast Edition

| Feature | `bernaferrari/FigmaToCode` | **OpenFigma Beast Edition v2.0** |
| :--- | :--- | :--- |
| **Execution Context** | Interactive Plugin UI only | **Headless MCP Server + CLI + Dual Engine** |
| **Framework Targets** | 3 (HTML, Flutter, SwiftUI) | **9 (React, Vue, Svelte, Angular, Solid, Flutter, etc.)** |
| **Layout Solver** | Heuristic strings | **Taffy 2.0 (Flexbox + CSS Grid + Subgrid)** |
| **Bidirectional Synthesis**| One-way (Figma $\to$ Code) | **✅ Full Bidirectional (Figma $\leftrightarrow$ Code)** |
| **Design Token Extraction**| Basic inline styles | **✅ 8 Enterprise Token Formats** |
| **Security & DLP Auditing** | ❌ None | **✅ APCA Math + Aho-Corasick + DLP Secret Scanner** |
