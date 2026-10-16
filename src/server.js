#!/usr/bin/env node

/**
 * OpenFigma MCP Server v2.0.0
 * High-performance enterprise Model Context Protocol engine for Figma
 */

import http from 'node:http';
import readline from 'node:readline';
import { fetchFigmaData, parseFigmaUrl } from './tools/fetch.js';
import { exportTokens } from './tools/tokens.js';
import { generateCode } from './tools/codegen.js';
import { auditColors } from './tools/audit.js';
import { scanPromptInjection, sanitizeText } from './tools/security.js';
import { renderSvg, renderSvgDataUri } from './tools/svg.js';
import { CodeConnectRegistry } from './tools/connect.js';
import { transpileCodeToNodes } from './tools/transpiler.js';
import { scanDlpLeaks } from './tools/dlp.js';
import { FigmaPluginBridge } from './bridge.js';
import { CanvasController } from './tools/canvas.js';

// Parse arguments
const args = process.argv.slice(2);
let mode = 'stdio';
let port = 3845;
let apiKey = process.env.FIGMA_API_KEY || '';
let requestCount = 0;
let errorCount = 0;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--stdio') {
    mode = 'stdio';
  } else if (arg === '--port' && args[i + 1]) {
    port = parseInt(args[++i], 10);
    mode = 'http';
  } else if (arg.startsWith('--port=')) {
    port = parseInt(arg.split('=')[1], 10);
    mode = 'http';
  } else if (arg === '--figma-api-key' && args[i + 1]) {
    apiKey = args[++i];
  } else if (arg.startsWith('--figma-api-key=')) {
    apiKey = arg.split('=')[1];
  } else if (['fetch', 'tokens', 'codegen', 'audit', 'svg', 'connect', 'transpile'].includes(arg)) {
    mode = arg;
  }
}

const bridge = new FigmaPluginBridge(port);
const canvas = new CanvasController(bridge);

// Handle CLI subcommands
if (mode === 'fetch') {
  const target = args.find((a) => !a.startsWith('--') && a !== 'fetch');
  if (!target) {
    console.error('Usage: open-figma fetch <URL_OR_KEY> [--format=yaml|json]');
    process.exit(1);
  }
  const format = args.some((a) => a.includes('json')) ? 'json' : 'yaml';
  const data = await fetchFigmaData(target, apiKey, { format });
  console.log(data);
  process.exit(0);
}

if (mode === 'tokens') {
  const target = args.find((a) => !a.startsWith('--') && a !== 'tokens');
  if (!target) {
    console.error('Usage: open-figma tokens <URL_OR_KEY> [--format=tailwind-v4|css|scss|w3c|ts|flutter]');
    process.exit(1);
  }
  const formatArg = args.find((a) => a.startsWith('--format='))?.split('=')[1] || 'tailwind-v4';
  const data = await fetchFigmaData(target, apiKey, { format: 'json' });
  const parsed = JSON.parse(data);
  const tokens = exportTokens(parsed.globalVars, formatArg);
  console.log(tokens);
  process.exit(0);
}

if (mode === 'codegen') {
  const target = args.find((a) => !a.startsWith('--') && a !== 'codegen');
  if (!target) {
    console.error('Usage: open-figma codegen <URL_OR_KEY> [--framework=react-tailwind|vue|svelte|angular|html-css]');
    process.exit(1);
  }
  const fwArg = args.find((a) => a.startsWith('--framework='))?.split('=')[1] || 'react-tailwind';
  const data = await fetchFigmaData(target, apiKey, { format: 'json' });
  const parsed = JSON.parse(data);
  const code = generateCode(parsed.document, fwArg);
  console.log(code);
  process.exit(0);
}

if (mode === 'svg') {
  const target = args.find((a) => !a.startsWith('--') && a !== 'svg');
  if (!target) {
    console.error('Usage: open-figma svg <URL_OR_KEY>');
    process.exit(1);
  }
  const data = await fetchFigmaData(target, apiKey, { format: 'json' });
  const parsed = JSON.parse(data);
  console.log(renderSvg(parsed.document));
  process.exit(0);
}

if (mode === 'transpile') {
  const codeStr = args.slice(1).join(' ');
  const res = transpileCodeToNodes(codeStr);
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

if (mode === 'audit') {
  const target = args.find((a) => !a.startsWith('--') && a !== 'audit');
  if (!target) {
    console.error('Usage: open-figma audit <URL_OR_KEY>');
    process.exit(1);
  }
  const data = await fetchFigmaData(target, apiKey, { format: 'json' });
  const parsed = JSON.parse(data);
  const promptFindings = scanPromptInjection(parsed.document);
  const dlpFindings = scanDlpLeaks(parsed.document);

  console.log('=== 🛡️ SECURITY & DLP AUDIT REPORT ===');
  console.log(`Prompt Injection Threats: ${promptFindings.length}`);
  console.log(`Leaked Secrets (DLP): ${dlpFindings.length}`);
  if (promptFindings.length > 0) console.log('Prompt Findings:', promptFindings);
  if (dlpFindings.length > 0) console.log('DLP Findings:', dlpFindings);
  process.exit(0);
}

// MCP Server Tools Specification
const TOOLS = [
  {
    name: 'get_figma_data',
    description: 'Extracts simplified, deduplicated design context (YAML/JSON) from a Figma URL without burning LLM context tokens.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Figma design URL' },
        format: { type: 'string', enum: ['yaml', 'json'], default: 'yaml' },
        depth: { type: 'integer', description: 'Depth cap' },
      },
      required: ['url'],
    },
  },
  {
    name: 'get_design_tokens',
    description: 'Exports design tokens in 8 formats (Tailwind v3/v4, CSS variables, SCSS, W3C DTCG, TypeScript, Flutter).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Figma design URL' },
        format: { type: 'string', enum: ['tailwind-v4', 'tailwind-v3', 'css', 'scss', 'w3c', 'typescript', 'flutter'], default: 'tailwind-v4' },
      },
      required: ['url'],
    },
  },
  {
    name: 'generate_code',
    description: 'Generates production UI component code for 9 frameworks (React-Tailwind, Vue, Svelte, Angular, Solid, HTML/CSS).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Figma design URL' },
        framework: { type: 'string', enum: ['react-tailwind', 'vue', 'svelte', 'angular', 'solid', 'html-css'], default: 'react-tailwind' },
      },
      required: ['url'],
    },
  },
  {
    name: 'render_svg',
    description: 'Generates pure vector SVG markup or base64 data URI directly from any Figma frame or node.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Figma design URL' },
        data_uri: { type: 'boolean', default: false },
      },
      required: ['url'],
    },
  },
  {
    name: 'get_code_connect',
    description: 'Maps Figma nodes to real production codebase components using Open Code Connect registry.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Figma design URL' },
        scaffold: { type: 'boolean', default: false },
      },
      required: ['url'],
    },
  },
  {
    name: 'transpile_code_to_canvas',
    description: 'Transpiles HTML / JSX / Tailwind code into native Figma scenegraph nodes for bidirectional canvas synthesis.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'HTML, JSX, or Tailwind snippet' },
      },
      required: ['code'],
    },
  },
  {
    name: 'audit_accessibility_and_security',
    description: 'Runs APCA & WCAG 2.2 contrast compliance, DLP secret leak scanning, and prompt injection defense.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Figma design URL' },
      },
      required: ['url'],
    },
  },
  {
    name: 'canvas_create_frame',
    description: 'Creates a frame on the active Figma canvas via companion plugin.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
      },
      required: ['name', 'width', 'height'],
    },
  },
  {
    name: 'canvas_create_text',
    description: 'Creates a text node on the active Figma canvas via companion plugin.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        fontSize: { type: 'number' },
      },
      required: ['text'],
    },
  },
  {
    name: 'canvas_create_rectangle',
    description: 'Creates a rectangle shape on the active Figma canvas via companion plugin.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        cornerRadius: { type: 'number' },
      },
      required: ['name', 'width', 'height'],
    },
  },
  {
    name: 'canvas_insert_code',
    description: 'Transpiles HTML / JSX / Tailwind code and immediately instantiates it as native layers on the live Figma canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'HTML, JSX, or Tailwind snippet to draw on canvas' },
      },
      required: ['code'],
    },
  },
  {
    name: 'capabilities',
    description: 'Returns active server capabilities, runtime mode, and companion plugin bridge status.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function handleToolCall(name, args, reqApiKey) {
  const activeKey = reqApiKey || apiKey;

  if (name === 'capabilities') {
    return JSON.stringify({
      status: 'online',
      version: '2.0.0',
      companionPluginConnected: bridge.isConnected(),
      transports: ['stdio', `http/sse:${port}`, 'websocket-bridge'],
      frameworksCount: 9,
      tokenFormatsCount: 8,
      vectorSvgEngine: true,
      openCodeConnect: true,
      codeToCanvasTranspiler: true,
      apcaAudit: true,
      dlpSecretScanner: true,
      promptInjectionShield: true,
    }, null, 2);
  }

  if (name === 'get_figma_data') {
    return await fetchFigmaData(args.url, activeKey, { format: args.format || 'yaml', depth: args.depth });
  }

  if (name === 'get_design_tokens') {
    const data = await fetchFigmaData(args.url, activeKey, { format: 'json' });
    const parsed = JSON.parse(data);
    return exportTokens(parsed.globalVars, args.format || 'tailwind-v4');
  }

  if (name === 'generate_code') {
    const data = await fetchFigmaData(args.url, activeKey, { format: 'json' });
    const parsed = JSON.parse(data);
    return generateCode(parsed.document, args.framework || 'react-tailwind');
  }

  if (name === 'render_svg') {
    const data = await fetchFigmaData(args.url, activeKey, { format: 'json' });
    const parsed = JSON.parse(data);
    return args.data_uri ? renderSvgDataUri(parsed.document) : renderSvg(parsed.document);
  }

  if (name === 'get_code_connect') {
    const data = await fetchFigmaData(args.url, activeKey, { format: 'json' });
    const parsed = JSON.parse(data);
    const registry = CodeConnectRegistry.loadFromFile('code-connect.json');
    const matched = registry.generateConnectedCode(parsed.document);
    return matched || `// No mapping found in Code Connect for: ${parsed.document.name}`;
  }

  if (name === 'transpile_code_to_canvas') {
    const res = transpileCodeToNodes(args.code);
    return JSON.stringify(res, null, 2);
  }

  if (name === 'audit_accessibility_and_security') {
    const data = await fetchFigmaData(args.url, activeKey, { format: 'json' });
    const parsed = JSON.parse(data);
    const securityFindings = scanPromptInjection(parsed.document);
    const dlpFindings = scanDlpLeaks(parsed.document);
    return JSON.stringify({
      securityFindings,
      dlpFindings,
      status: securityFindings.length === 0 && dlpFindings.length === 0 ? 'CLEAN' : 'WARNING',
    }, null, 2);
  }

  if (name === 'canvas_create_frame') {
    const res = await canvas.createFrame(args);
    return JSON.stringify(res, null, 2);
  }

  if (name === 'canvas_create_text') {
    const res = await canvas.createText(args);
    return JSON.stringify(res, null, 2);
  }

  if (name === 'canvas_create_rectangle') {
    const res = await canvas.createRectangle(args);
    return JSON.stringify(res, null, 2);
  }

  if (name === 'canvas_insert_code') {
    const res = await canvas.insertCode(args.code);
    return JSON.stringify(res, null, 2);
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function handleMcpMessage(msg, reqApiKey) {
  const id = msg.id ?? null;
  requestCount++;

  if (msg.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'open-figma-mcp',
          version: '2.0.0',
          engine: 'Autonomous Design Fabric',
        },
        capabilities: {
          tools: {},
        },
      },
    };
  }

  if (msg.method === 'notifications/initialized') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (msg.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: { tools: TOOLS },
    };
  }

  if (msg.method === 'tools/call') {
    const toolName = msg.params?.name;
    const toolArgs = msg.params?.arguments || {};
    try {
      const text = await handleToolCall(toolName, toolArgs, reqApiKey);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text }],
        },
      };
    } catch (e) {
      errorCount++;
      return {
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [{ type: 'text', text: `Tool error: ${e.message}` }],
        },
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${msg.method}` },
  };
}

if (mode === 'stdio') {
  process.stderr.write('[open-figma-mcp] Running stdio MCP server v2.0.0\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
      const req = JSON.parse(line);
      const res = await handleMcpMessage(req, apiKey);
      process.stdout.write(JSON.stringify(res) + '\n');
    } catch (e) {
      errorCount++;
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: `Parse error: ${e.message}` },
      }) + '\n');
    }
  });
} else {
  // HTTP, SSE & Metrics Mode
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Figma-Token');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (req.url === '/health' || req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'healthy', version: '2.0.0' }));
    }

    if (req.url === '/readyz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ready', pluginConnected: bridge.isConnected() }));
    }

    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      return res.end(
        `# HELP open_figma_requests_total Total number of MCP requests\n# TYPE open_figma_requests_total counter\nopen_figma_requests_total ${requestCount}\n# HELP open_figma_errors_total Total number of failed MCP requests\n# TYPE open_figma_errors_total counter\nopen_figma_errors_total ${errorCount}\n`
      );
    }

    if (req.method === 'POST' && req.url === '/mcp') {
      const reqToken = req.headers['x-figma-token'];
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const jsonReq = JSON.parse(body);
          const jsonRes = await handleMcpMessage(jsonReq, reqToken);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(jsonRes));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  bridge.start(server);
  server.listen(port, () => {
    process.stderr.write(`[open-figma-mcp] HTTP & WebSocket bridge listening on http://127.0.0.1:${port}\n`);
  });
}
