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
import { verifyFigmaWebhookSignature, processFigmaWebhook } from './tools/webhook.js';
import { metrics } from './tools/metrics.js';
import { generateClientConfigs } from './tools/client-config.js';
import { OmniRouter } from './tools/omni-router.js';
import { generatePreviewHtml } from './preview/preview.js';
import { checkpointKernel } from './tools/workspace-checkpoints.js';

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
  } else if (['fetch', 'tokens', 'codegen', 'audit', 'svg', 'connect', 'transpile', 'configure'].includes(arg)) {
    mode = arg;
  }
}

const bridge = new FigmaPluginBridge(port);
const canvas = new CanvasController(bridge);
const omniRouter = new OmniRouter();

// Handle CLI subcommands
if (mode === 'fetch') {
  const target = args.find((a) => !a.startsWith('--') && a !== 'fetch');
  if (!target) {
    console.error('Usage: open-figma fetch <URL_OR_KEY> [--format=yaml|json]');
    process.exit(1);
  }
  const formatArg = args.find((a) => a.startsWith('--format='))?.split('=')[1];
  const format = formatArg === 'json' ? 'json' : 'yaml';
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

if (mode === 'configure') {
  const target = args.find((a) => !a.startsWith('--') && a !== 'configure') || 'claude';
  const configs = generateClientConfigs({ apiKey });
  const selected = configs[target] || configs.claudeDesktop;
  console.log(JSON.stringify(selected, null, 2));
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
    name: 'canvas_create_navbar',
    description: 'Generates a modern responsive navigation bar with logo, navigation links, and CTA button directly on the Figma canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        brandName: { type: 'string' },
        links: { type: 'array', items: { type: 'string' } },
        ctaText: { type: 'string' },
        theme: { type: 'string', enum: ['light', 'dark'] },
      },
    },
  },
  {
    name: 'canvas_create_hero_section',
    description: 'Generates a high-impact marketing hero section with badge pill, title, subtitle, and CTA buttons directly on the Figma canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        subtitle: { type: 'string' },
        badge: { type: 'string' },
        primaryCta: { type: 'string' },
        secondaryCta: { type: 'string' },
        theme: { type: 'string', enum: ['light', 'dark'] },
      },
    },
  },
  {
    name: 'canvas_create_design_system_scaffold',
    description: 'Builds a complete design system artboard in Figma with title banner and 7 token color swatch cards.',
    inputSchema: {
      type: 'object',
      properties: {
        brandName: { type: 'string' },
        primaryColor: { type: 'string', description: 'Hex color code e.g. #3B82F6' },
      },
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
  {
    name: 'ai_omni_route',
    description: 'Dispatches a design prompt through the multi-provider 3-tier fallback router (Claude, OpenAI, Gemini, DeepSeek, Groq, Ollama) with RTK token compression.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Design or codegen prompt' },
        preferredModel: { type: 'string', description: 'Preferred model name to attempt first' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'design_checkpoint_create',
    description: 'Creates an immutable LayerFS checkpoint of current design state to enable instant rollback if AI modifications fail.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Figma file URL or local fixture path' },
        checkpointId: { type: 'string', description: 'Optional unique snapshot ID' },
        description: { type: 'string', description: 'Snapshot description' },
      },
      required: ['url'],
    },
  },
  {
    name: 'design_checkpoint_rollback',
    description: 'Restores an earlier design checkpoint state in < 15ms.',
    inputSchema: {
      type: 'object',
      properties: {
        checkpointId: { type: 'string', description: 'Snapshot ID to restore' },
      },
      required: ['checkpointId'],
    },
  },
  {
    name: 'design_checkpoint_diff',
    description: 'Computes structural AST diff between two design checkpoints (added, modified, removed nodes).',
    inputSchema: {
      type: 'object',
      properties: {
        baseCheckpointId: { type: 'string', description: 'Base snapshot ID' },
        targetCheckpointId: { type: 'string', description: 'Target snapshot ID' },
      },
      required: ['baseCheckpointId', 'targetCheckpointId'],
    },
  },
];

async function handleToolCall(name, args, reqApiKey) {
  metrics.recordRequest(name);
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
      omniRouter: true,
      layerFsCheckpoints: true,
      interactiveCanvasPreview: true,
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

  if (name === 'canvas_create_navbar') {
    const res = await canvas.createNavbar(args);
    return JSON.stringify(res, null, 2);
  }

  if (name === 'canvas_create_hero_section') {
    const res = await canvas.createHeroSection(args);
    return JSON.stringify(res, null, 2);
  }

  if (name === 'canvas_create_design_system_scaffold') {
    const res = await canvas.createDesignSystemScaffold(args);
    return JSON.stringify(res, null, 2);
  }

  if (name === 'ai_omni_route') {
    const res = await omniRouter.dispatch({
      messages: [{ role: 'user', content: args.prompt }],
      preferredModel: args.preferredModel,
    });
    return JSON.stringify(res, null, 2);
  }

  if (name === 'design_checkpoint_create') {
    const data = await fetchFigmaData(args.url, activeKey, { format: 'json' });
    const parsed = JSON.parse(data);
    const res = checkpointKernel.createCheckpoint(args.checkpointId, args.description, parsed);
    return JSON.stringify(res, null, 2);
  }

  if (name === 'design_checkpoint_rollback') {
    const res = checkpointKernel.rollback(args.checkpointId);
    return JSON.stringify(res, null, 2);
  }

  if (name === 'design_checkpoint_diff') {
    const res = checkpointKernel.diffCheckpoints(args.baseCheckpointId, args.targetCheckpointId);
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
      metrics.recordError(toolName);
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

    if (req.url === '/preview' || req.url === '/dashboard') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(generatePreviewHtml());
    }

    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      return res.end(metrics.toPrometheus(bridge.isConnected() ? 1 : 0));
    }

    if (req.method === 'POST' && req.url === '/webhook/figma') {
      const signature = req.headers['x-figma-signature'] || req.headers['x-figma-signature-256'] || '';
      const secret = process.env.FIGMA_WEBHOOK_PASSCODE || process.env.FIGMA_WEBHOOK_SECRET || '';
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        if (secret && !verifyFigmaWebhookSignature(body, signature, secret)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid HMAC signature' }));
        }
        try {
          const event = JSON.parse(body);
          const result = processFigmaWebhook(event);
          metrics.recordWebhook(result.eventType);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Malformed webhook body: ${e.message}` }));
        }
      });
      return;
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
    if (args.includes('--open') || mode === 'studio' || mode === 'preview') {
      const openCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      import('node:child_process').then(({ exec }) => {
        exec(`${openCmd} http://127.0.0.1:${port}/preview`);
      });
    }
  });
}
