# OpenFigma MCP — Desktop

A stunning, beginner-friendly desktop app for [OpenFigma MCP](../README.md). Run
the MCP server, explore designs, extract tokens, and generate code — all without
touching a terminal. Power users can still use the CLI.

> Built with **Electron + electron-vite + React + TypeScript + Tailwind + Framer
> Motion**. The app reuses the exact same Node engine as the CLI/server (`../src`)
> over IPC — zero duplicated logic.

## Features

- **Connect** — validate a free Figma Personal Access Token (stored locally).
- **MCP Server** — start/stop the server, watch live logs, copy ready-made
  config for Cursor / VS Code / Claude Desktop / Lovable.
- **Explore** — paste a Figma URL, see simplified data + how much context you saved.
- **Design Tokens** — extract & preview a palette, export to 8 formats.
- **Code Gen** — 8 framework targets (React/Vue/Svelte/Angular/HTML/Flutter/SwiftUI).
- **Settings** — defaults for host/port/format, disconnect account.

## Develop

```bash
cd desktop
npm install
npm run dev        # launches the app with hot reload
```

## Build a distributable

```bash
npm run build          # bundle main/preload/renderer into out/
npm run dist:win       # package installer (or dist:mac / dist:linux)
```

Installers are written to `desktop/release/`.

## Architecture

```
desktop/
  src/main/        Electron main process (Node)
    core.ts        imports ../../src/* (the OpenFigma engine)
    ipc.ts         IPC handlers + spawns the MCP server process
    store.ts       persists token + settings (electron-store)
  src/preload/     contextBridge — safe window.api surface
  src/renderer/    React + Tailwind UI (pages + components)
```

The renderer never touches Node directly; everything goes through the typed
`window.api` bridge defined in `src/preload/index.ts`.
