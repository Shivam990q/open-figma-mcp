# OpenFigma MCP: API Reference & Enterprise Protocol Specification

> **Version:** `2.0.0`  
> **Transports:** `stdio` (CLI/IDE) | `HTTP/SSE` (Port 3845) | `WebSocket` (Port 3845)  
> **Engines:** Native Rust SIMD (`target/release/open-figma`) | Universal Node.js / Bun (`src/server.js`)

---

## 1. Model Context Protocol (MCP) Tool Matrix

### `get_figma_data`
Extracts a pruned, simplified Canonical Semantic Model (CSM) from a Figma URL or offline `.fig` binary file.
* **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "url": { "type": "string", "description": "Figma design URL or path to local .fig archive" },
      "format": { "type": "string", "enum": ["yaml", "json"], "default": "yaml" },
      "depth": { "type": "integer", "description": "Maximum tree depth to parse" }
    },
    "required": ["url"]
  }
  ```
* **Response:**
  Returns simplified YAML or JSON containing the pruned document tree alongside a `globalVars` block deduplicating all colors, radii, and shadows into symbol tables.

---

### `get_design_tokens`
Extracts design tokens in 8 industry-standard formats.
* **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "url": { "type": "string", "description": "Figma design URL or path to local .fig archive" },
      "format": {
        "type": "string",
        "enum": ["tailwind-v4", "tailwind-v3", "css", "scss", "w3c", "style-dictionary", "typescript", "flutter"],
        "default": "tailwind-v4"
      }
    },
    "required": ["url"]
  }
  ```
* **Supported Formats:**
  1. `tailwind-v4`: Modern CSS `@theme` variables block.
  2. `tailwind-v3`: JavaScript `module.exports = { theme: { ... } }` config.
  3. `css`: Standard CSS custom properties (`:root { --color-... }`).
  4. `scss`: SCSS variables (`$color-...: ...;`).
  5. `w3c` / `style-dictionary`: W3C Design Tokens Community Group (DTCG) JSON specification.
  6. `typescript`: Strongly typed `export const tokens = { ... } as const;`.
  7. `flutter`: Dart `AppColors` class with `Color(0xFF...)` values.

---

### `generate_code`
Synthesizes production-ready UI component code across 9 frontend and mobile framework targets.
* **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "url": { "type": "string", "description": "Figma design URL or path to local .fig archive" },
      "framework": {
        "type": "string",
        "enum": [
          "react-tailwind",
          "react-inline",
          "vue",
          "svelte",
          "angular",
          "solid",
          "html-css",
          "flutter",
          "swiftui"
        ],
        "default": "react-tailwind"
      }
    },
    "required": ["url"]
  }
  ```
* **Response:**
  Returns complete, lint-clean component code with TypeScript interfaces, props, responsive flexbox/grid layout classes, and children slots.

---

### `render_svg`
Renders pure vector SVG markup or base64 data URI directly from any Figma frame or local `.fig` file with zero cloud dependency.
* **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "url": { "type": "string", "description": "Figma design URL or path to local .fig archive" },
      "data_uri": { "type": "boolean", "default": false, "description": "Return as data:image/svg+xml;base64,... URI" }
    },
    "required": ["url"]
  }
  ```
* **Response:**
  Returns clean, self-contained SVG string `<svg xmlns="http://www.w3.org/2000/svg" viewBox="...">` or a base64 encoded data URI.

---

### `get_code_connect`
Maps Figma nodes to real production codebase components using the Open Code Connect registry (alternative to Figma's paid Dev Mode Code Connect).
* **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "url": { "type": "string", "description": "Figma design URL or path to local .fig archive" },
      "scaffold": { "type": "boolean", "default": false, "description": "Generate starter code-connect.json scaffolding from design tree" }
    },
    "required": ["url"]
  }
  ```

---

### `transpile_code_to_canvas`
Transpiles HTML / JSX / Tailwind code into native Figma scenegraph nodes for bidirectional canvas synthesis.
* **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "code": { "type": "string", "description": "HTML, JSX, or Tailwind snippet to convert into Figma layers" }
    },
    "required": ["code"]
  }
  ```

---

### `audit_accessibility_and_security`
Runs forensic quality, APCA contrast, prompt-injection defense, and DLP secret leak audits.
* **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "url": { "type": "string", "description": "Figma design URL or path to local .fig archive" }
    },
    "required": ["url"]
  }
  ```
* **Response Details:**
  * **WCAG 2.2:** Calculates standard luminance contrast ratios ($CR \ge 4.5:1$ AA, $\ge 7:1$ AAA).
  * **APCA ($L^c$):** Modern perceptual lightness contrast calculation.
  * **Prompt Injection Shield:** Detects and neutralizes adversarial prompt injection payloads.
  * **DLP Secret Scanner:** Detects leaked AWS Access Keys, OpenAI Keys, GitHub Tokens, and Private Keys embedded in design layers.

---

### `canvas_create_frame` & `canvas_create_text`
Creates frames and editable text layers on the live Figma canvas via companion plugin bridge.

---

### `capabilities`
Returns active server status, engine info, supported transports, and companion plugin connection status.

---

## 2. Enterprise HTTP Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/healthz` or `/health` | `GET` | Kubernetes Liveness probe: returns `{ "status": "healthy", "uptime_seconds": ... }` |
| `/readyz` | `GET` | Kubernetes Readiness probe: verifies cache, memory, and engine readiness |
| `/metrics` | `GET` | Standard Prometheus metrics: `open_figma_requests_total`, `open_figma_errors_total` |
| `/mcp` | `POST` | Standard Model Context Protocol JSON-RPC 2.0 gateway |

---

## 3. Companion Plugin WebSocket Protocol (`ws://127.0.0.1:3845`)

The WebSocket server coordinates requests between the MCP server and the running Figma plugin:

### Client $\to$ Plugin Message:
```json
{
  "id": 1,
  "command": "CREATE_FRAME",
  "payload": {
    "name": "Header Frame",
    "width": 1200,
    "height": 80
  }
}
```

### Plugin $\to$ Client Reply:
```json
{
  "responseId": 1,
  "result": {
    "nodeId": "123:456",
    "name": "Header Frame"
  }
}
```
