# Lovable & Web IDE Integration Guide

OpenFigma MCP natively supports web-based AI builders like Lovable, v0, Bolt, and Replit.

## Connection Setup
Start OpenFigma in HTTP / SSE mode:
```bash
open-figma serve --port 3845
```

In your Lovable / MCP client settings:
* **Server URL:** `http://127.0.0.1:3845/mcp`
* **Transport:** `http` / `sse`
* **Auth Header (Optional):** `X-Figma-Token: figd_YOUR_TOKEN`

## Recommended Prompt Workflow
When asking Lovable to build a feature from Figma:
> *"Use the OpenFigma MCP server to fetch design context for https://figma.com/design/AbC/App?node-id=1:2 and generate a pixel-matched React + Tailwind component using the extracted design tokens."*
