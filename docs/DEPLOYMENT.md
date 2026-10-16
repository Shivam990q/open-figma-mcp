# OpenFigma MCP: Enterprise Deployment & Operations Guide

> **Target Environments:** Local IDEs (Cursor, VS Code, Claude Code) | Docker Containers | Kubernetes Clusters | Air-Gapped Networks  

---

## 1. Local IDE Deployment

### Cursor / Windsurf Configuration
Add the server definition to your `mcp.json` (or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "open-figma": {
      "command": "node",
      "args": ["C:/Users/Rose/.gemini/antigravity-ide/scratch/open-figma-mcp/bin/open-figma.js", "--stdio"],
      "env": {
        "FIGMA_API_KEY": "figd_YOUR_PERSONAL_ACCESS_TOKEN"
      }
    }
  }
}
```

### Claude Desktop Configuration
In `%APPDATA%/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "open-figma": {
      "command": "C:/Users/Rose/.gemini/antigravity-ide/scratch/open-figma-mcp/target/release/open-figma.exe",
      "args": ["--stdio"],
      "env": {
        "FIGMA_API_KEY": "figd_YOUR_PERSONAL_ACCESS_TOKEN"
      }
    }
  }
}
```

---

## 2. Docker Container Deployment

A production-ready Dockerfile is provided at the repository root with multi-stage compilation:

```bash
# Build the Docker image
docker build -t open-figma-mcp:v2.0 .

# Run the container exposing port 3845
docker run -d \
  --name open-figma \
  -p 3845:3845 \
  -e FIGMA_API_KEY="figd_YOUR_PERSONAL_ACCESS_TOKEN" \
  open-figma-mcp:v2.0
```

---

## 3. Kubernetes Multi-Tenant Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: open-figma-mcp
  labels:
    app: open-figma
spec:
  replicas: 3
  selector:
    matchLabels:
      app: open-figma
  template:
    metadata:
      labels:
        app: open-figma
    spec:
      containers:
      - name: open-figma
        image: open-figma-mcp:v2.0
        ports:
        - containerPort: 3845
        env:
        - name: FIGMA_API_KEY
          valueFrom:
            secretKeyRef:
              name: figma-credentials
              key: api-key
        resources:
          limits:
            cpu: "2"
            memory: "512Mi"
          requests:
            cpu: "250m"
            memory: "64Mi"
        readinessProbe:
          httpGet:
            path: /health
            port: 3845
          initialDelaySeconds: 3
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: open-figma-service
spec:
  type: ClusterIP
  ports:
  - port: 3845
    targetPort: 3845
  selector:
    app: open-figma
```

---

## 4. Air-Gapped / Offline Deployment Mode

OpenFigma requires **zero internet access** when working with native `.fig` binary files:
1. Copy `.fig` files directly to the host machine or container volume.
2. Invoke CLI commands or query MCP tools pointing to local file paths:
   ```bash
   open-figma fetch ./designs/design-system.fig --format=yaml
   open-figma tokens ./designs/design-system.fig --format=tailwind-v4
   open-figma codegen ./designs/design-system.fig --framework=react-tailwind
   ```
3. The Kiwi binary engine parses, decompresses, and synthesizes code completely on-premises.
