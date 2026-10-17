# Multi-stage enterprise Dockerfile for OpenFigma MCP
# Stage 1: Build native Rust binary
FROM rust:1.85-alpine AS rust-builder
WORKDIR /app

RUN apk add --no-cache musl-dev perl make

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates

RUN cargo build --release

# Stage 2: Final runtime image
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache libgcc && \
    addgroup -g 10001 appgroup && \
    adduser -u 10001 -G appgroup -s /bin/sh -D appuser

COPY package.json package-lock.json* ./
RUN npm install --production

COPY --from=rust-builder /app/target/release/open-figma /usr/local/bin/open-figma
COPY bin ./bin
COPY src ./src
COPY desktop ./desktop
COPY figma-plugin ./figma-plugin
COPY README.md ARCHITECTURE.md ./

RUN chown -R appuser:appgroup /app

USER 10001:10001

EXPOSE 3845

ENV PORT=3845
ENV NODE_ENV=production

ENTRYPOINT ["open-figma"]
CMD ["serve", "--port", "3845"]
