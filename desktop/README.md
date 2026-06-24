# OpenFigma MCP — Desktop

A stunning, beginner-friendly desktop app for [OpenFigma MCP](../README.md). Run
the MCP server, explore designs, extract tokens, and generate code — all without
touching a terminal. Power users can still use the CLI.

> Built with **Electron + electron-vite + React + TypeScript + Tailwind + Framer
> Motion**. The app reuses the exact same Node engine as the CLI/server (`../src`)
> over IPC — zero duplicated logic.

## Features

- **Home** — connect your Figma token, start/stop the MCP server, and copy a
  ready-made config for **Cursor / VS Code / Claude / Windsurf / Lovable**.
  Live logs are one collapsible panel away.
- **Playground** — try every tool (Explore, Tokens, Code, Accessibility, Assets)
  in one tabbed view, no editor required.
- **Settings** — host/port/format defaults and account.

Three focused screens, a restrained Linear-style UI — not a cluttered dashboard.

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

## Troubleshooting

**`Error: Electron uninstall` when running `npm run dev`**
Electron's binary download was interrupted and a corrupt/empty zip got cached, so
electron-vite can't find the executable. Clear the cache and reinstall the binary:

```bash
# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron\Cache"
node node_modules/electron/install.js

# macOS / Linux
rm -rf ~/Library/Caches/electron ~/.cache/electron
node node_modules/electron/install.js
```

Verify with `node -e "console.log(require('electron'))"` — it should print a path
to the `electron` executable. If the download keeps failing behind a proxy, set
`HTTPS_PROXY` (or `ELECTRON_GET_USE_PROXY=true`) before reinstalling.

**TypeScript "Cannot write file … would overwrite input file"**
Fixed via `noEmit: true` in `tsconfig.json` (the type checker shouldn't emit; the
build is handled by electron-vite/esbuild). If your editor still shows it,
reload the TS server.

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
