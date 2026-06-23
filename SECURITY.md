# Security Policy

## Supported Versions

The latest minor release on the `main` branch receives security fixes.

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting:
**Security → Report a vulnerability** on the repository, or email the maintainer.

We aim to acknowledge reports within 72 hours and to ship a fix or mitigation as
quickly as is responsible.

## Scope and design notes

OpenFigma is built with a few security properties on purpose:

- **No telemetry.** The server collects and transmits no usage data.
- **Local-first networking.** HTTP/SSE mode binds to `127.0.0.1` by default.
  If you bind to a non-loopback host (`--host 0.0.0.0`) for a shared
  deployment, **the SSE/`messages` endpoints have no built-in authentication** —
  put it behind a reverse proxy / auth layer and rely on per-request
  `X-Figma-Token` headers for credential isolation.
- **Untrusted design text.** Figma text (`node.characters`) is authored by
  anyone with file access, so the simplification pipeline scans it for
  prompt-injection patterns and surfaces a `securityWarnings` block rather than
  letting design text act as instructions to a reading agent.
- **Token handling.** Personal Access Tokens / OAuth tokens are read from
  flags, environment, or per-request headers and are never written to disk or
  logged. Never commit a token; never paste one into an issue.

## Credential hygiene

If you accidentally expose a Figma token (in a commit, screenshot, or issue),
revoke it immediately at **Figma → Settings → Security → Personal access
tokens** and generate a new one.
