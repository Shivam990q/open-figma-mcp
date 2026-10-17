# 🔬 FORENSIC TEARDOWN: OPEN CLAUDE DESIGN & CANVAS PREVIEW ARCHITECTURE
## Sandboxed Iframe Runtimes, Bidirectional `postMessage` RPC, and Codebase-to-Canvas Sync

> **Target Repository:** `imsai-sh/open-claude-design` (Cloned at `research_ecosystem/repos/open-claude-design`)  
> **Protocol Execution:** *Shivam SEED Protocol — Maximum Cognitive Depth, Ground-Truth Evidence, and Algorithmic Rigor.*

---

### 1. Executive Summary & Purpose

Anthropic's **Claude Design** (`claude.ai/design`) introduced an intuitive paradigm for AI frontend development: an interactive visual canvas where users view live running React prototypes side-by-side with conversational agent loops, with four in-place visual tools:
1. **Tweaks:** In-place token adjusters exposed directly by component code.
2. **Comment:** Dropping spatial pins on rendered DOM elements to pass precise bounding box coordinates and component names back into the AI agent prompt.
3. **Edit:** Direct visual manipulation of styles with priority write-back to Tailwind utility classes.
4. **Draw:** Freehand vector sketching and spatial callouts on top of live running apps.

**`imsai-sh/open-claude-design`** is the premier open-source implementation of this architecture.

---

### 2. Architectural Decompilation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 OPEN CLAUDE DESIGN PREVIEW BRIDGE ARCHITECTURE              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Host Web App: React 18 + Vite / Tailwind / Zustand]                       │
│  ├── Workspace State Manager (File tree, active component, chat thread)     │
│  ├── ToolLoopAgent (Orchestrates multi-turn Claude Code tool calls)         │
│  └── Preview Host Controller                                                │
│            │                                                                │
│            │ postMessage RPC Protocol (ChannelMessaging / window.postMessage)│
│            ▼                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Sandboxed <iframe> Container (sandbox="allow-scripts allow-same-origin")│
│  │                                                                       │  │
│  │  [Injected Preview Runtime: @open-design/iframe-runtime]             │  │
│  │  ├── 1. Babel Standalone: Dynamic on-the-fly JSX/TSX Compilation     │  │
│  │  ├── 2. Tailwind CDN / CSS Engine: Injects utility styles in memory   │  │
│  │  ├── 3. DOM Inspector Overlay: Captures mousemove & click events      │  │
│  │  │     └─► Emits ELEMENT_SELECTED { tagName, classes, rect, path }   │  │
│  │  ├── 4. Style Mutation Engine:                                        │  │
│  │  │     └─► Receives EDIT_STYLE { targetId, tailwindClass, inlineCss } │  │
│  │  └── 5. Live Tweaks Bridge (__edit_mode_set_keys):                    │  │
│  │        └─► Hot-reloads design tokens without re-mounting the root DOM │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### The `postMessage` Protocol Grammar:
* `OVERLAY_READY`: Iframe signals that React and the DOM inspector have mounted.
* `SET_MODE`: Switches the overlay between `'inspect'`, `'edit'`, `'comment'`, and `'draw'`.
* `ELEMENT_SELECTED`: User clicks an element in the iframe; host receives:
  ```json
  {
    "type": "ELEMENT_SELECTED",
    "payload": {
      "tagName": "BUTTON",
      "classList": ["px-4", "py-2", "bg-blue-600", "rounded", "text-white"],
      "rect": { "x": 120, "y": 240, "width": 140, "height": 44 },
      "componentPath": "src/components/Button.jsx:14:5"
    }
  }
  ```
* `APPLY_TWEAK`: Modifies a declared variable key and triggers a micro-render.

---

### 3. Critical Limitations of `open-claude-design`

1. **Browser-Only Isolation:**
   Because it compiles JSX inside the browser via Babel Standalone, large component trees cause noticeable UI stutter and high browser RAM usage (> 400MB).
2. **Disconnected from Figma:**
   `open-claude-design` is purely a code previewer. It has **zero connection to Figma**. It cannot read `.fig` binary files, cannot parse Figma variables, and cannot write components back to a Figma canvas.
3. **Fragile Tailwind Class Mapping:**
   When a user drags a border-radius slider in Edit Mode, mapping a pixel value (`8px`) back to a Tailwind class (`rounded-lg`) relies on brittle regex lookup tables that frequently fall back to ugly inline styles.

---

### 4. How OpenFigma Beast Edition Supersedes `open-claude-design`

By unifying **Open Claude Design's live visual canvas** with **OpenFigma's native Rust scenegraph engine**:
* **Tri-Directional Synchronization:** Changes made in code update both the **Live Web Preview** AND the **Live Figma Canvas** simultaneously!
* **Click-to-Figma Inspection:** Clicking an element in OpenFigma's web preview immediately selects and highlights the corresponding vector node in Figma Desktop via our loopback WebSocket bridge.
* **Token-Driven Tweaks:** OpenFigma binds Tweaks directly to Figma design tokens (`globalVars`), guaranteeing that any slider adjustment in the preview writes valid CSS variables without breaking design system rules.
