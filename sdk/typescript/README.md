# OpenFigma TypeScript SDK (`@open-figma/sdk`)

Enterprise TypeScript and JavaScript SDK for OpenFigma Model Context Protocol (MCP) server & design engine.

## Installation

```bash
npm install @open-figma/sdk
```

## Quickstart

```typescript
import { OpenFigmaClient } from '@open-figma/sdk';

const client = new OpenFigmaClient({
  endpoint: 'http://127.0.0.1:3845',
  apiKey: process.env.FIGMA_API_KEY,
});

// Fetch compressed scenegraph context
const yamlData = await client.getFigmaData('https://figma.com/design/AbC123XyZ/App?node-id=12-822');
console.log(yamlData);

// Extract design tokens in Tailwind v4 format
const tokens = await client.getDesignTokens('https://figma.com/design/AbC123XyZ/App', 'tailwind-v4');
console.log(tokens);

// Synthesize code into React + Tailwind
const reactCode = await client.generateCode('https://figma.com/design/AbC123XyZ/App?node-id=12-822', 'react-tailwind');
console.log(reactCode);

// Pure vector SVG rendering
const svg = await client.renderSvg('https://figma.com/design/AbC123XyZ/App?node-id=12-822');
```

## API Methods

- `client.getFigmaData(url, format, depth)`
- `client.getDesignTokens(url, format)`
- `client.generateCode(url, framework)`
- `client.renderSvg(url, dataUri)`
- `client.queryCodeConnect(url)`
- `client.transpileToCanvas(markup)`
- `client.auditDesign(url)`
- `client.callTool(name, args)`

## License
MIT
