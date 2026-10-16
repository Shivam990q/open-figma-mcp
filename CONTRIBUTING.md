# Contributing to OpenFigma MCP

Thank you for contributing to OpenFigma MCP!

## Development Setup

1. **Prerequisites:**
   * Rust toolchain: `rustc` and `cargo` (>= 1.80)
   * Node.js (>= 18)

2. **Clone & Build:**
   ```bash
   git clone https://github.com/Shivam990q/open-figma-mcp.git
   cd open-figma-mcp

   # Build native Rust crates
   cargo build

   # Run Rust tests
   cargo test --workspace

   # Run Node tests
   npm test
   ```

3. **Submitting Changes:**
   * Create a feature branch (`git checkout -b feature/my-feature`).
   * Ensure all unit tests pass (`cargo test --workspace && npm test`).
   * Commit with clear, descriptive commit messages.
   * Open a Pull Request.
