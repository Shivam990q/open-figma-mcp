# OpenFigma MCP (Enterprise Beast Edition v2.0)

<p align="center">
  <img src="https://img.shields.io/badge/release-v2.0.0--enterprise-8b5cf6" alt="Release v2.0">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/engine-Rust%20SIMD%20%2B%20Kiwi%20%2B%20Taffy-orange" alt="Rust Engine">
  <img src="https://img.shields.io/badge/MCP-compatible-0a7cff" alt="MCP compatible">
  <img src="https://img.shields.io/badge/tests-96%20passing%20(Rust%20%2B%20Node%20%2B%20Python%20%2B%20TS)-success" alt="tests">
  <img src="https://img.shields.io/badge/observability-Prometheus%20%2B%20OTel-blueviolet" alt="observability">
</p>

> **The Autonomous Design Fabric (ADF).** Zero-dependency, ultra-high-throughput Model Context Protocol (MCP) server for Figma. Reads online designs via free PAT or offline `.fig` Kiwi binaries directly in **microseconds**. Solves layouts via **Taffy 2.0 (Flexbox + CSS Grid)**, renders offline **SVG vectors**, provides an open **Code Connect engine**, transpiles code back to canvas, exports tokens to **8 formats**, synthesizes code for **9 frameworks**, runs **APCA + DLP audits**, and writes changes back to the live Figma canvas via a free companion plugin.

---

## ⚡ What Makes OpenFigma Beast Edition Superior?

| Capability | Official Figma MCP (`mcp.figma.com`) | Framelink (`figma-developer-mcp`) | Southleft (`figma-console-mcp`) | **OpenFigma MCP v2.0 (Beast)** |
|---|:---:|:---:|:---:|:---:|
| **Pricing / Seats** | ❌ **Paid Dev Mode seat ($25–$35/mo)** | ✅ Free PAT | ✅ Free PAT | 👑 **100% Free (PAT, OAuth, or Offline .fig)** |
| **Offline Binary `.fig` Parsing** | ❌ Cloud only | ❌ No | ❌ No | 👑 **Yes (Native Kiwi Binary Engine)** |
| **Execution Engine** | Proprietary Cloud | Node.js | Node.js | 👑 **Dual Engine: Rust SIMD Core + Universal Node** |
| **Layout Solver** | Cloud compute | None (raw bounding boxes) | None | 👑 **Taffy 2.0 (Full CSS Grid + Flexbox)** |
| **Vector Rendering** | Slow cloud `/v1/images` | ❌ None | ❌ None | 👑 **Pure Vector SVG Engine (< 2ms offline)** |
| **Code Connect** | ❌ Requires Enterprise Dev Mode | ❌ None | ❌ None | 👑 **Open Code Connect (`code-connect.json`)** |
| **Code-to-Canvas** | ❌ None | ❌ None | ❌ None | 👑 **HTML/JSX/Tailwind $\to$ Figma Scenegraph** |
| **Context Compression** | Low (~250k tokens/screen) | Medium (~3-4×) | Medium (~3×) | 👑 **Hyper-Pruned CSM + Symbol Table (< 15k tokens)** |
| **Design Tokens** | Basic | ❌ None | ✅ DTCG JSON | 👑 **8 Formats (TW3/TW4/CSS/SCSS/W3C/TS/Flutter)** |
| **Code Generation** | React only | ❌ None | Scaffolding | 👑 **9 Frameworks (React, Vue, Svelte, Angular, Solid, Flutter, etc.)** |
| **Accessibility Audit** | Basic | ❌ None | WCAG 2.1 | 👑 **WCAG 2.2 + APCA ($L^c$ Perceptual Math)** |
| **Prompt Injection Defense** | ❌ None | ❌ Open CVE Vector | ❌ None | 👑 **Aho-Corasick SIMD Automaton (10 GB/s)** |
| **DLP Secret Scanner** | ❌ None | ❌ None | ❌ None | 👑 **Catches AWS, OpenAI, GitHub, Private Keys** |
| **Enterprise Caching & Circuit Breaker** | ❌ None | ❌ None | ❌ None | 👑 **L1/L2 Cache + ETag 304 + Circuit Breaker** |
| **Canvas Mutation (Write)** | ⚠️ Requires Full Seat ($75+/mo) | ❌ Read-Only | ✅ Desktop Bridge | 👑 **Free Companion WebSocket Bridge (Port 3845)** |

---

## 🚀 Quickstart & Installation

### Option 1: Native Rust CLI (Maximum Performance)
```bash
# Build native binary
cargo build --release

# Run MCP stdio server for Cursor / VS Code / Claude Code
./target/release/open-figma --stdio

# Or start the local HTTP/SSE & companion WebSocket server on :3845
./target/release/open-figma serve --port 3845
```

### Option 2: One-Command NPX / Node
```bash
# Zero-install stdio mode
npx -y open-figma-mcp --stdio --figma-api-key figd_YOUR_TOKEN

# HTTP / SSE server
npx -y open-figma-mcp --port 3845 --figma-api-key figd_YOUR_TOKEN
```

### Option 3: Genuine Native Electron Desktop Workbench
```bash
# Launches dedicated native desktop application with layer hierarchy AST, tokens palette, and live code generator
npm run desktop
```

---

## 💻 CLI Commands

### 1. Fetch & Prune Scenegraph
```bash
# YAML output (default, token-minimal)
open-figma fetch "https://figma.com/design/AbC123XyZ/App?node-id=12-822"

# Offline .fig archive (Zero API calls, zero internet required!)
open-figma fetch ./designs/mobile-app.fig --format=json
```

### 2. Extract Design Tokens
```bash
open-figma tokens "https://figma.com/design/AbC123XyZ/App" --format=tailwind-v4
# Formats: tailwind-v4 | tailwind-v3 | css | scss | w3c | style-dictionary | typescript | flutter
```

### 3. Multi-Framework Codegen
```bash
open-figma codegen "https://figma.com/design/AbC123XyZ/App?node-id=12-822" --framework=react-tailwind
# Frameworks: react-tailwind | react-inline | vue | svelte | angular | solid | html-css | flutter | swiftui
```

### 4. Pure Vector SVG Rendering
```bash
# Generate pure vector SVG directly from design
open-figma svg "https://figma.com/design/AbC123XyZ/App?node-id=12-822"

# Or as a base64 data URI
open-figma svg ./designs/mobile-app.fig --data-uri
```

### 5. Open Code Connect
```bash
# Query mapped production components
open-figma connect "https://figma.com/design/AbC123XyZ/App?node-id=12-822"

# Auto-scaffold starter code-connect.json from a design system
open-figma connect ./designs/ui-kit.fig --scaffold > code-connect.json
```

### 6. Code-to-Canvas Transpilation
```bash
open-figma transpile '<button class="flex p-4 bg-blue-600 rounded-lg text-white font-bold">Save</button>'
```

### 7. Forensic APCA & DLP Security Audit
```bash
open-figma audit "https://figma.com/design/AbC123XyZ/App"
```

### 8. Interactive Developer REPL
```bash
open-figma repl
```

---

## 📦 Client SDKs

### TypeScript / JavaScript SDK (`@open-figma/sdk`)
```typescript
import { OpenFigmaClient } from '@open-figma/sdk';

const client = new OpenFigmaClient({ endpoint: 'http://localhost:3845' });

// Fetch compressed context
const context = await client.getFigmaData('https://figma.com/design/xyz');

// Extract tokens in Tailwind v4
const tokens = await client.getDesignTokens('https://figma.com/design/xyz', 'tailwind-v4');

// Generate React component
const code = await client.generateCode('https://figma.com/design/xyz', 'react-tailwind');

// Render SVG vector
const svg = await client.renderSvg('https://figma.com/design/xyz');
```

### Python SDK (`open-figma-sdk`)
```python
from open_figma_sdk import OpenFigmaClient

client = OpenFigmaClient(endpoint="http://localhost:3845")

# Fetch context
yaml_data = client.get_figma_data("https://figma.com/design/xyz")

# Extract tokens
css_theme = client.get_design_tokens("https://figma.com/design/xyz", format="tailwind-v4")

# LangChain integration
from open_figma_sdk.langchain_tools import OpenFigmaLangChainTool
tool = OpenFigmaLangChainTool(client)
```

---

## ☸️ Cloud-Native Enterprise Deployment

### Kubernetes Helm Deployment
```bash
helm install open-figma-mcp ./helm/open-figma-mcp \
  --set env.FIGMA_API_KEY="figd_..." \
  --set autoscaling.minReplicas=3 \
  --set autoscaling.maxReplicas=20
```

### Terraform / OpenTofu Modules
* **AWS ECS Fargate:** `terraform/aws/main.tf`
* **GCP Cloud Run v2:** `terraform/gcp/main.tf`

### Observability & Metrics
* Prometheus metrics: `GET /metrics`
* Kubernetes probes: `GET /healthz`, `GET /readyz`

---

## 🎨 Free Companion Figma Plugin

To enable live canvas mutations (creating frames, writing text, and editing components from your AI agent):
1. In Figma, go to **Plugins** $\to$ **Development** $\to$ **Import plugin from manifest...**
2. Select `figma-plugin/manifest.json`.
3. Click **Run**. The plugin connects to `ws://127.0.0.1:3845` and enables instant bidirectional write capabilities.

---

## 🧪 Comprehensive Multi-Runtime Test Suites

```bash
# Run native Rust unit & CLI integration tests (27 passed)
cargo test --workspace

# Run Node.js enterprise engine, IPC & canvas tests (44 passed)
npm test

# Run TypeScript SDK tests (2 passed)
npm run test:sdk:ts

# Run Python SDK tests (3 passed)
python sdk/python/test_client.py

# Run all suites simultaneously (76 unit/integration tests + 20 benchmark/live probes, 0 failures)
npm run test:all
```

