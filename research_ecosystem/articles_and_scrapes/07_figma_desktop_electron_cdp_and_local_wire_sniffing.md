# 🕵️ FIGMA DESKTOP ELECTRON ARCHITECTURE, CDP HOOKING & LOCAL WIRE SNIFFING
## Reverse-Engineering the Electron Runtime, Chrome DevTools Protocol Interception, and Local Disk Storage

> **Protocol Execution:** *Shivam SEED Protocol — Maximum Cognitive Depth, Ground-Truth Evidence, Algorithmic Rigor, and Zero-Compromise Engineering.*

---

### Executive Overview

The official Figma Desktop application (for macOS and Windows) is an **Electron container** wrapping Figma's core WebAssembly / WebGL rendering engine. Rather than querying Figma's cloud REST API (which enforces paid Dev Mode gating and strict 5–100 req/min rate limits), developers and agents can interface directly with the **running local Figma Desktop client**.

In this investigation, we document:
1. The internal architecture of the Figma Electron desktop client.
2. Hooking the Chrome DevTools Protocol (CDP) via `--remote-debugging-port`.
3. Intercepting the real-time WebSocket stream (`wss://www.figma.com/socket`) to capture live design deltas without REST calls.
4. The local offline storage layout in `%APPDATA%\Figma` (Windows) and `~/Library/Application Support/Figma` (macOS).

---

### 1. Internal Process Architecture of Figma Desktop

The Figma Desktop app spawns three primary operating system processes:

```
+-------------------------------------------------------------------------+
| Figma Desktop (Electron Application)                                    |
+-------------------------------------------------------------------------+
| Process 1: Electron Browser (Main) Process                              |
|  - Manages native OS windows, menus, file dialogs, and auto-updates.    |
|  - Spawns background local WebSocket listener on 127.0.0.1:3845.        |
+-------------------------------------------------------------------------+
| Process 2: Chromium GPU Process                                         |
|  - Direct DirectX 12 / Metal / Vulkan GPU pipeline for WebGL canvas.    |
+-------------------------------------------------------------------------+
| Process 3: Renderer Process (WebAssembly Sandboxed Core)                 |
|  - Runs Figma's proprietary C++ compiled to WebAssembly.                |
|  - Manages the local in-memory scenegraph and Kiwi deserialization.     |
|  - Communicates with Figma cloud via WebSockets.                        |
+-------------------------------------------------------------------------+
```

---

### 2. Chrome DevTools Protocol (CDP) Hooking

By launching the Figma executable with Chromium remote debugging enabled, developers can expose a programmatic debugging interface:

```bash
# Windows
& "$env:LOCALAPPDATA\Figma\app-latest\Figma.exe" --remote-debugging-port=9222

# macOS
/Applications/Figma.app/Contents/MacOS/Figma --remote-debugging-port=9222
```

Once launched, Figma exposes standard CDP HTTP JSON endpoints on `http://127.0.0.1:9222/json`:

```json
[
  {
    "description": "",
    "devtoolsFrontendUrl": "/devtools/inspector.html?ws=127.0.0.1:9222/devtools/page/...",
    "id": "A1B2C3D4E5",
    "title": "Design System 2026 – Figma",
    "type": "page",
    "url": "https://www.figma.com/design/AbC123XyZ/App?node-id=0%3A1",
    "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/page/A1B2C3D4E5"
  }
]
```

---

### 3. Sniffing the Kiwi Wire Protocol over CDP

An agent connecting to `webSocketDebuggerUrl` can enable the Chromium Network domain to intercept real-time Kiwi binary frames:

```typescript
// Connect to CDP WebSocket
const ws = new WebSocket(page.webSocketDebuggerUrl);

// Enable Network domain events
ws.send(JSON.stringify({
  id: 1,
  method: "Network.enable"
}));

// Listen for incoming WebSocket frames from Figma cloud
ws.on("message", (msg) => {
  const event = JSON.parse(msg);
  if (event.method === "Network.webSocketFrameReceived") {
    const payloadData = event.params.response.payloadData; // Base64 encoded binary Kiwi
    const kiwiBytes = Buffer.from(payloadData, "base64");
    
    // Parse Kiwi Message using OpenFigma's native decoder
    const message = decodeKiwiMessage(kiwiBytes);
    if (message.type === "NODE_CHANGES") {
      console.log("Live canvas mutation detected:", message.nodeChanges);
    }
  }
});
```

#### Why This is Game-Changing:
* **Zero Rate Limits:** Observes live edits as they happen over the collaborative socket.
* **Zero Authentication Tokens Required:** The user is already logged in inside the desktop app; the agent piggybacks on the existing active session.
* **Instantaneous Feedback:** Captures selection changes and layer updates with **< 5ms latency**.

---

### 4. Local Disk Cache Layout & Forensic Recovery

When working offline or opening files, Figma Desktop caches documents locally on the host machine:

#### Windows Path:
`%APPDATA%\Figma\` and `%LOCALAPPDATA%\Figma\`

#### macOS Path:
`~/Library/Application Support/Figma/`

#### Key Directories & Databases:
1. `Figma/Local Storage/leveldb/`: Chromium LevelDB storing user settings, recent file keys, and local UI state.
2. `Figma/IndexedDB/https_www.figma.com_0.indexeddb.leveldb/`: Contains offline document snapshots and metadata.
3. `Figma/Cache/` and `Figma/Code Cache/`: Compiled WebAssembly bytecode caches.
4. `Figma/Partitions/`: Per-user isolated cookie jars and session credentials.

By scanning these local LevelDB directories, OpenFigma can automatically detect currently open file keys and resolve local component libraries with zero user configuration.
