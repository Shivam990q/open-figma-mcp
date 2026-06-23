# Contributing to OpenFigma MCP

Thanks for your interest in making OpenFigma better. This project thrives on community contributions — bug reports, new codegen targets, token formats, docs, and tests are all welcome.

## Ways to contribute

- **Report a bug** — open a [bug report](https://github.com/Shivam990q/open-figma-mcp/issues/new?template=bug_report.yml).
- **Request a feature** — open a [feature request](https://github.com/Shivam990q/open-figma-mcp/issues/new?template=feature_request.yml).
- **Improve docs** — typos, clarity, and examples matter.
- **Write code** — pick up a [good first issue](https://github.com/Shivam990q/open-figma-mcp/labels/good%20first%20issue).

## Development setup

```bash
git clone https://github.com/Shivam990q/open-figma-mcp.git
cd open-figma-mcp
npm install
npm test          # unit + integration, runs offline with no token
```

Requirements: **Node.js >= 18** (uses the built-in global `fetch`).

### Project layout

| Path | Purpose |
| --- | --- |
| `src/server.js` | MCP tool registration + HTTP/stdio transport + CLI subcommands |
| `src/figma.js` | Figma REST client, caching, retries, URL parsing |
| `src/simplify.js` | Raw Figma JSON → compact `SimplifiedDesign` + `globalVars` dedup |
| `src/serialize.js` | YAML / JSON / tree serializers (dependency-free) |
| `src/tokens.js` | Design-token extraction + 8 export formats |
| `src/codegen.js` | Multi-framework code generation |
| `src/a11y.js` `diff.js` `drift.js` `vectors.js` | Quality + analysis tools |
| `tests/` | `unit.test.js` (offline, deterministic) + `integration.js` |

## Pull request checklist

1. **Open an issue first** for anything non-trivial so we can align on approach.
2. **Add tests.** Unit tests live in `tests/unit.test.js` and run with no network. New behavior needs coverage.
3. **Run `npm test`** and make sure it's green before pushing.
4. **Keep the honesty layer intact.** OpenFigma never fabricates success for operations the Figma REST API cannot perform (see `src/capabilities.js`). New canvas-write surfaces must return a structured `supported:false`, not a fake result.
5. **No new heavy dependencies** without discussion. A small, auditable dependency tree is a core value of this project.
6. **Match the existing style** — ESM modules, 2-space indent, clear comments explaining *why*.

### Adding a new codegen framework

1. Add a `renderX(root, styles)` function in `src/codegen.js`.
2. Register it in `CODEGEN_FRAMEWORKS` and the `generateCode` switch.
3. Add assertions to the codegen section of `tests/unit.test.js`.
4. Update the framework list in `README.md` and the `generate_code` tool description in `src/server.js`.

### Adding a new token export format

1. Add a `tokensToX(t)` formatter in `src/tokens.js`.
2. Register it in `TOKEN_FORMATS` and the `formatTokens` switch.
3. Add a round-trip assertion in `tests/unit.test.js`.

## Commit messages

Use clear, conventional-style prefixes where possible: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.

## Code of Conduct

By participating you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
