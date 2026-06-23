# Deployment Guide

OpenFigma MCP runs three ways: **stdio** (editors), **local HTTP/SSE** (Lovable),
and **self-hosted / cloud HTTP** (shared teams). This guide covers all three plus
Docker and common platforms.

## 1. Local — stdio (Cursor / VS Code / Claude)

No deployment needed. Point your client at the script:

```json
{ "mcpServers": { "open-figma-mcp": {
  "command": "npx",
  "args": ["open-figma-mcp", "--stdio"],
  "env": { "FIGMA_API_KEY": "figd_YOUR_TOKEN" }
}}}
```

## 2. Local — HTTP/SSE (Lovable, browsers)

```bash
node src/server.js --figma-api-key figd_x            # binds 127.0.0.1:3845
```

Connect via `http://localhost:3845/sse`.

## 3. Docker (self-host / cloud)

```bash
# Build
docker build -t open-figma-mcp .

# Run with a server-wide token
docker run -p 3845:3845 -e FIGMA_API_KEY=figd_xxx open-figma-mcp

# …or run token-less and have each client send X-Figma-Token per request
docker run -p 3845:3845 open-figma-mcp
```

Or with compose:

```bash
echo "FIGMA_API_KEY=figd_xxx" > .env
docker compose up -d
```

### ⚠️ Security for shared/cloud deployments

When the server is reachable beyond localhost (`FRAMELINK_HOST=0.0.0.0`), the
`/sse` and `/messages` endpoints have **no built-in authentication**. For any
multi-user or internet-facing deployment:

1. Put it behind a reverse proxy (nginx/Caddy/Traefik) that terminates TLS and
   enforces auth (mTLS, basic auth, an API gateway, or your SSO).
2. Prefer **per-request credentials**: omit `FIGMA_API_KEY` on the server and
   have each client send `X-Figma-Token: figd_xxx`. Tokens then never live on the
   shared host.
3. Restrict network exposure (security groups / firewall) to known clients.

## 4. Platform notes

### Railway / Render / Fly.io
- Use the `Dockerfile`. Set the start command to the image default (`node src/server.js`).
- Set env: `FIGMA_API_KEY` (optional), `FRAMELINK_HOST=0.0.0.0`, and map the
  platform's `$PORT` → the server reads `PORT` automatically, or set
  `FRAMELINK_PORT`.
- Expose port `3845` (or `$PORT`).

### Behind a corporate proxy
```bash
node src/server.js --proxy http://proxy:8080      # or FIGMA_PROXY env
node src/server.js --proxy none                    # bypass inherited proxy env
```

## 5. Desktop app distributables

```bash
cd desktop
npm install
npm run dist:win     # NSIS installer  → desktop/release/
npm run dist:mac     # DMG
npm run dist:linux   # AppImage + deb
```

The packaged app bundles the core engine (`../src`) as an extra resource and
spawns the MCP server using the embedded Node runtime — no system Node required
on the end-user machine.

## 6. Environment variables

| Var | Default | Notes |
| --- | --- | --- |
| `FIGMA_API_KEY` | — | Personal Access Token |
| `FIGMA_OAUTH_TOKEN` | — | OAuth Bearer (takes precedence) |
| `FRAMELINK_PORT` / `PORT` | `3845` | HTTP port |
| `FRAMELINK_HOST` / `HOST` | `127.0.0.1` | `0.0.0.0` for containers |
| `OUTPUT_FORMAT` | `yaml` | `yaml` / `json` / `tree` |
| `IMAGE_DIR` | autodetected | Asset download dir |
| `SKIP_IMAGE_DOWNLOADS` | `false` | Disable image tools |
| `FIGMA_PROXY` | — | Proxy URL, or `none` |
