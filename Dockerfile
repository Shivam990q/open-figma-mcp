# OpenFigma MCP — HTTP/SSE server image
# Build:  docker build -t open-figma-mcp .
# Run:    docker run -p 3845:3845 -e FIGMA_API_KEY=figd_xxx open-figma-mcp
FROM node:20-alpine AS base
WORKDIR /app

# Install production deps only (uses the committed lockfile for reproducibility)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App source
COPY src ./src
COPY bin ./bin
COPY README.md LICENSE ./

# Bind to all interfaces inside the container. NOTE: the SSE/messages endpoints
# have no built-in auth — front this with a reverse proxy / network policy and
# pass credentials per-request via the X-Figma-Token header in shared setups.
ENV FRAMELINK_HOST=0.0.0.0
ENV FRAMELINK_PORT=3845
ENV NODE_ENV=production

EXPOSE 3845

# Healthcheck hits the lightweight /mcp info endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3845/mcp || exit 1

# Drop privileges (node user ships with the official image).
USER node

CMD ["node", "src/server.js"]
