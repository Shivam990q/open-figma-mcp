# OpenFigma MCP: Future Roadmap & Evolutionary Architecture

> **Engineering Horizons:** Next-generation capabilities and future-proofing roadmap.  

---

## 1. Decentralized Real-Time CRDT Canvas Sync (Loro Integration)

* **Objective:** Enable multi-agent swarms and human designers to concurrently mutate the same Figma canvas without merge conflicts.
* **Mechanism:** Integrate `loro-crdt` in `crates/open-figma-core`. Design operations (creating layers, moving coordinates, re-styling fills) are represented as commutative CRDT operations. Concurrent edits from multiple coding agents in different IDEs merge deterministically.

---

## 2. Vello WGPU Compute-Driven Headless Rasterizer

* **Objective:** Produce high-resolution PNG / WebP snapshots of any Figma node in under 1 millisecond locally without invoking external cloud renderers.
* **Mechanism:** Bind `vello` (Rust GPU compute-centric 2D vector renderer). Uses WGPU compute shaders to rasterize complex Bézier curves, boolean paths, and gradients directly on the GPU.

---

## 3. WebAssembly (Wasm) Browser Compilation

* **Objective:** Run OpenFigma Core natively inside browser-based IDEs (WebContainers, Bolt.new, StackBlitz, Figma Web).
* **Mechanism:** Compile `open-figma-core` to `wasm32-unknown-unknown` with `wasm-bindgen`, exposing the Kiwi binary parser, Taffy layout engine, and token exporter directly in JavaScript memory without backend server dependencies.

---

## 4. Live Chrome DevTools Protocol (CDP) Memory Sniffer

* **Objective:** Zero-API, real-time live synchronization with Figma Desktop.
* **Mechanism:** Attaches to the Figma Electron desktop client via remote debugging port `9222`, reading `commandsBlob` Kiwi packets directly from WebAssembly memory buffers.
