# Lovable & AI Agent Project Rules

## Universal Figma Asset Configuration
* All images, vector graphics, and icons downloaded by the Figma MCP server are stored in the project's public folder at `/figma-export/`.
* Do NOT use temporary AI-generated placeholders or ask the user to upload these files.
* In your generated React/HTML/Next.js components, always use the matching files directly with their relative paths (e.g., `<img src="/figma-export/filename.png" />` or `/figma-export/node-id.png`).

## Figma Design Guidelines
* Always fetch layout metadata, colors, typographies, and positioning using the local figma MCP server tools (`get_figma_data`).
* Do not invent ad-hoc styling metrics. Use the spacing, margins, and padding values returned by the server.
* Map vertical stacks in Figma directly to Tailwind `flex flex-col` and horizontal layout groupings directly to `flex flex-row`.
