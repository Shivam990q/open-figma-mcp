import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';

import {
  fetchFigmaFile,
  fetchFigmaNodes,
  downloadFigmaImages,
  fetchFigmaVariables,
  extractSparseTree,
  getScreenshot,
  whoami,
  fetchFileComponentsAndStyles,
  localComponentScanner,
  parseFigmaUrl,
  getSimplifiedDesign,
  fetchComments,
  postComment,
  fetchVersions,
  fetchImageFills,
  fetchDevResources,
  fetchTeamProjects,
  fetchProjectFiles,
  fetchFigmaNodesGeometry,
} from './figma.js';
import { writeUniversalRules } from './rules.js';
import { serialize } from './serialize.js';
import { simplifyDesign } from './simplify.js';
import { extractTokens, formatTokens, TOKEN_FORMATS } from './tokens.js';
import { auditAccessibility } from './a11y.js';
import { generateCode, generateComponentApi, CODEGEN_FRAMEWORKS } from './codegen.js';
import { buildCapabilities, unsupported } from './capabilities.js';
import { diffDesigns } from './diff.js';
import { detectDrift } from './drift.js';
import { extractVectors } from './vectors.js';
import {
  loadEnv,
  resolveConfig,
  parseFetchArgs,
  getArg,
  hasFlag,
  HELP_TEXT,
  VERSION,
} from './config.js';
import { applyProxy } from './proxy.js';

// Load env (honoring `--env <path>`) before resolving configuration.
loadEnv();

// --- Meta flags: handle before any real work -------------------------------
if (hasFlag(process.argv, '--help') || hasFlag(process.argv, '-h')) {
  process.stdout.write(HELP_TEXT);
  process.exit(0);
}
if (hasFlag(process.argv, '--version') || hasFlag(process.argv, '-v')) {
  process.stdout.write(`open-figma-mcp v${VERSION}\n`);
  process.exit(0);
}

// Resolve configuration (CLI > env > defaults).
const config = resolveConfig();
const {
  globalToken,
  port,
  host,
  format,
  imageDir: resolvedImageDir,
  skipImageDownloads,
  stdio: stdioMode,
  proxy,
} = config;
const projectPath = process.cwd();

// Apply proxy settings. This may re-exec the process with NODE_USE_ENV_PROXY set
// (and not return) so the built-in fetch routes through the configured proxy.
const proxyStatus = applyProxy(proxy);

// Request-scoped token storage for multi-tenant HTTP deployments.
const tokenStorage = new AsyncLocalStorage();

// Helper to resolve request-scoped (X-Figma-Token header) or global tokens.
function getActiveToken() {
  const store = tokenStorage.getStore();
  if (store && store.tokenOverride) {
    return store.tokenOverride;
  }
  return globalToken;
}

// ----------------------------------------------------
// CLI Subcommands: fetch | tokens | codegen | audit
// ----------------------------------------------------
const CLI_SUBCOMMANDS = ['fetch', 'tokens', 'codegen', 'audit'];

/** Resolve { fileKey, nodeId, depth } for a subcommand from its positional URL + flags. */
function resolveCliTarget(sub) {
  const argv = process.argv;
  const subIdx = argv.indexOf(sub);
  let urlOrKey = argv[subIdx + 1];
  if (urlOrKey && urlOrKey.startsWith('-')) urlOrKey = undefined;
  let fileKey = parseFetchArgs(argv).fileKey;
  let nodeId = parseFetchArgs(argv).nodeId;
  const depth = parseFetchArgs(argv).depth;
  if (urlOrKey) {
    const parsed = parseFigmaUrl(urlOrKey);
    if (parsed) {
      if (!fileKey) fileKey = parsed.fileKey;
      if (!nodeId) nodeId = parsed.nodeId;
    }
  }
  return { fileKey, nodeId, depth };
}

async function runCli(sub) {
  const { fileKey, nodeId, depth } = resolveCliTarget(sub);
  if (!fileKey) {
    console.error('[CLI Error] A Figma URL or explicit --file-key is required.');
    process.exit(1);
  }
  if (!globalToken) {
    console.error('[CLI Error] Figma API Key or OAuth Token is required (via flags or environment).');
    process.exit(1);
  }

  try {
    if (sub === 'fetch') {
      const design = await getSimplifiedDesign(fileKey, nodeId ? [nodeId] : undefined, globalToken, { maxDepth: depth });
      process.stdout.write(serialize(design, format) + '\n');
    } else if (sub === 'tokens') {
      const tokenFormat = getArg(process.argv, '--format', 'css');
      const raw = await getRawData(fileKey, nodeId ? [nodeId] : undefined, globalToken);
      let variables;
      try { variables = await fetchFigmaVariables(fileKey, globalToken); } catch (e) {}
      const tokens = extractTokens(raw, variables);
      process.stdout.write((tokenFormat === 'json' ? JSON.stringify(tokens, null, 2) : formatTokens(tokens, tokenFormat)) + '\n');
    } else if (sub === 'codegen') {
      if (!nodeId) { console.error('[CLI Error] codegen requires a node id (in the URL or via --node-id).'); process.exit(1); }
      const framework = getArg(process.argv, '--framework', 'react-tailwind');
      const design = await getSimplifiedDesign(fileKey, [nodeId], globalToken, { maxDepth: depth });
      process.stdout.write(generateCode(design, framework) + '\n');
    } else if (sub === 'audit') {
      const raw = await getRawData(fileKey, nodeId ? [nodeId] : undefined, globalToken);
      const report = auditAccessibility(raw, { pageBackground: getArg(process.argv, '--page-background') });
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    }
    process.exit(0);
  } catch (err) {
    console.error(`[CLI Error] ${sub} failed:`, err.message);
    process.exit(1);
  }
}

const activeSub = process.argv.slice(2).find((a) => !a.startsWith('-'));
if (CLI_SUBCOMMANDS.includes(activeSub)) {
  await runCli(activeSub);
}

// ----------------------------------------------------
// Server Startup Mode
// ----------------------------------------------------
if (!globalToken && stdioMode) {
  console.error('[Error] Figma API credentials are required in stdio mode!');
  process.exit(1);
}

// Write/Update Universal rules on startup
console.error(`[Startup] Writing Universal rules to workspace: ${projectPath}`);
writeUniversalRules(projectPath);
console.error(`[Startup] Output format: ${format} | Network: ${proxyStatus}`);

// Initialize high-level MCP server
const server = new McpServer({
  name: 'open-figma-mcp',
  version: VERSION,
});

// Register Tool: get_figma_data
server.tool(
  'get_figma_data',
  {
    fileKey: z.string().describe('The Figma file key (from the URL, e.g. ABC123 in figma.com/design/ABC123/...)'),
    nodeIds: z
      .array(z.string())
      .optional()
      .describe('Optional node/layer IDs to fetch specifically (recommended — keeps the response focused and small)'),
    depth: z
      .number()
      .optional()
      .describe('Optional maximum tree depth to traverse (0 or omitted = unlimited)'),
  },
  async ({ fileKey, nodeIds, depth }) => {
    try {
      const activeToken = getActiveToken();
      console.error(`[Tool get_figma_data] Fetching + simplifying data for file ${fileKey}`);
      const design = await getSimplifiedDesign(fileKey, nodeIds, activeToken, {
        maxDepth: depth || 0,
      });
      return {
        content: [{ type: 'text', text: serialize(design, format) }],
      };
    } catch (err) {
      console.error('[Tool get_figma_data] Error:', err);
      return {
        content: [{ type: 'text', text: `Error fetching figma data: ${err.message}` }],
        isError: true,
      };
    }
  },
);

// Register Tool: get_metadata
server.tool(
  'get_metadata',
  {
    fileKey: z.string().describe('The Figma file key (from URL)'),
    nodeId: z.string().optional().describe('Optional specific nodeId to inspect')
  },
  async ({ fileKey, nodeId }) => {
    try {
      const activeToken = getActiveToken();
      console.error(`[Tool get_metadata] Fetching metadata for file ${fileKey}`);
      let rawData;
      if (nodeId) {
        rawData = await fetchFigmaNodes(fileKey, [nodeId], activeToken);
        const nodeObj = rawData.nodes?.[nodeId]?.document;
        if (!nodeObj) {
          throw new Error(`Node ${nodeId} not found in file response.`);
        }
        const sparseTree = extractSparseTree(nodeObj);
        return {
          content: [{ type: 'text', text: JSON.stringify(sparseTree, null, 2) }]
        };
      } else {
        rawData = await fetchFigmaFile(fileKey, activeToken);
        const sparseTree = extractSparseTree(rawData.document);
        return {
          content: [{ type: 'text', text: JSON.stringify({ name: rawData.name, document: sparseTree }, null, 2) }]
        };
      }
    } catch (err) {
      console.error('[Tool get_metadata] Error:', err);
      return {
        content: [{ type: 'text', text: `Error fetching metadata: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Register Tool: get_design_context
server.tool(
  'get_design_context',
  {
    fileKey: z.string().describe('The Figma file key (from URL)'),
    nodeId: z.string().describe('The specific nodeId to inspect')
  },
  async ({ fileKey, nodeId }) => {
    try {
      const activeToken = getActiveToken();
      console.error(`[Tool get_design_context] Fetching design details for node ${nodeId}`);
      const rawData = await fetchFigmaNodes(fileKey, [nodeId], activeToken);
      const nodeData = rawData.nodes?.[nodeId];
      if (!nodeData) {
        throw new Error(`Node ${nodeId} was not found in the file.`);
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(nodeData, null, 2) }]
      };
    } catch (err) {
      console.error('[Tool get_design_context] Error:', err);
      return {
        content: [{ type: 'text', text: `Error fetching design context: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Register Tool: get_variable_defs
server.tool(
  'get_variable_defs',
  {
    fileKey: z.string().describe('The Figma file key (from URL)')
  },
  async ({ fileKey }) => {
    try {
      const activeToken = getActiveToken();
      console.error(`[Tool get_variable_defs] Fetching design tokens/variables for file ${fileKey}`);
      const vars = await fetchFigmaVariables(fileKey, activeToken);
      return {
        content: [{ type: 'text', text: JSON.stringify(vars, null, 2) }]
      };
    } catch (err) {
      console.error('[Tool get_variable_defs] Error:', err);
      return {
        content: [{ type: 'text', text: `Error fetching variables: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Shared helper: fetch the RAW Figma response (file or specific nodes).
async function getRawData(fileKey, nodeIds, token) {
  if (nodeIds && nodeIds.length > 0) return fetchFigmaNodes(fileKey, nodeIds, token);
  return fetchFigmaFile(fileKey, token);
}

// Recursively find a node by id within a raw document tree.
function findNode(node, targetId) {
  if (!node) return null;
  if (node.id === targetId) return node;
  for (const child of node.children || []) {
    const found = findNode(child, targetId);
    if (found) return found;
  }
  return null;
}

// Register Tool: get_design_tokens
server.tool(
  'get_design_tokens',
  {
    fileKey: z.string().describe('The Figma file key'),
    nodeIds: z.array(z.string()).optional().describe('Optional node IDs to scope token extraction'),
    format: z
      .enum(['json', ...TOKEN_FORMATS])
      .optional()
      .default('json')
      .describe('Output format: json (raw token set), css, scss, tailwind, tailwind4, js, ts, style-dictionary'),
  },
  async ({ fileKey, nodeIds, format }) => {
    try {
      const activeToken = getActiveToken();
      console.error(`[Tool get_design_tokens] Extracting tokens for ${fileKey} as ${format}`);
      const raw = await getRawData(fileKey, nodeIds, activeToken);
      let variables;
      try { variables = await fetchFigmaVariables(fileKey, activeToken); } catch (e) {}
      const tokens = extractTokens(raw, variables);
      const text = format === 'json' ? JSON.stringify(tokens, null, 2) : formatTokens(tokens, format);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      console.error('[Tool get_design_tokens] Error:', err);
      return { content: [{ type: 'text', text: `Error extracting tokens: ${err.message}` }], isError: true };
    }
  },
);

// Register Tool: generate_code
server.tool(
  'generate_code',
  {
    fileKey: z.string().describe('The Figma file key'),
    nodeId: z.string().describe('The node ID to generate code from'),
    framework: z
      .enum(CODEGEN_FRAMEWORKS)
      .optional()
      .default('react-tailwind')
      .describe('Target: react-tailwind, react-inline, vue, svelte, angular, html, flutter, or swiftui'),
    depth: z.number().optional().describe('Optional max tree depth'),
  },
  async ({ fileKey, nodeId, framework, depth }) => {
    try {
      const activeToken = getActiveToken();
      console.error(`[Tool generate_code] Generating ${framework} for node ${nodeId}`);
      const design = await getSimplifiedDesign(fileKey, [nodeId], activeToken, { maxDepth: depth || 0 });
      const code = generateCode(design, framework);
      return { content: [{ type: 'text', text: code }] };
    } catch (err) {
      console.error('[Tool generate_code] Error:', err);
      return { content: [{ type: 'text', text: `Error generating code: ${err.message}` }], isError: true };
    }
  },
);

// Register Tool: audit_accessibility
server.tool(
  'audit_accessibility',
  {
    fileKey: z.string().describe('The Figma file key'),
    nodeIds: z.array(z.string()).optional().describe('Optional node IDs to scope the audit'),
    pageBackground: z.string().optional().describe('Assumed root background color hex (default #ffffff)'),
  },
  async ({ fileKey, nodeIds, pageBackground }) => {
    try {
      const activeToken = getActiveToken();
      console.error(`[Tool audit_accessibility] Auditing ${fileKey}`);
      const raw = await getRawData(fileKey, nodeIds, activeToken);
      const report = auditAccessibility(raw, { pageBackground });
      return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
    } catch (err) {
      console.error('[Tool audit_accessibility] Error:', err);
      return { content: [{ type: 'text', text: `Error auditing accessibility: ${err.message}` }], isError: true };
    }
  },
);

// Register Tool: get_comments
server.tool(
  'get_comments',
  { fileKey: z.string().describe('The Figma file key') },
  async ({ fileKey }) => {
    try {
      const data = await fetchComments(fileKey, getActiveToken());
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error fetching comments: ${err.message}` }], isError: true };
    }
  },
);

// Register Tool: add_comment (write — requires a write-enabled token)
server.tool(
  'add_comment',
  {
    fileKey: z.string().describe('The Figma file key'),
    message: z.string().describe('Comment text'),
    nodeId: z.string().optional().describe('Optional node ID to anchor the comment to'),
  },
  async ({ fileKey, message, nodeId }) => {
    try {
      const clientMeta = nodeId ? { node_id: nodeId, node_offset: { x: 0, y: 0 } } : undefined;
      const data = await postComment(fileKey, message, getActiveToken(), clientMeta);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error posting comment: ${err.message}` }], isError: true };
    }
  },
);

// Register Tool: get_versions
server.tool(
  'get_versions',
  { fileKey: z.string().describe('The Figma file key') },
  async ({ fileKey }) => {
    try {
      const data = await fetchVersions(fileKey, getActiveToken());
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error fetching versions: ${err.message}` }], isError: true };
    }
  },
);

// Register Tool: get_image_fills (imageRef -> URL map)
server.tool(
  'get_image_fills',
  { fileKey: z.string().describe('The Figma file key') },
  async ({ fileKey }) => {
    try {
      const data = await fetchImageFills(fileKey, getActiveToken());
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error fetching image fills: ${err.message}` }], isError: true };
    }
  },
);

// Register Tool: get_dev_resources
server.tool(
  'get_dev_resources',
  { fileKey: z.string().describe('The Figma file key') },
  async ({ fileKey }) => {
    try {
      const data = await fetchDevResources(fileKey, getActiveToken());
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error fetching dev resources: ${err.message}` }], isError: true };
    }
  },
);

// Register Tool: get_projects (team projects + project files)
server.tool(
  'get_projects',
  {
    teamId: z.string().optional().describe('Team ID (from figma.com/files/team/<id>/...) to list its projects'),
    projectId: z.string().optional().describe('Project ID to list its files'),
  },
  async ({ teamId, projectId }) => {
    try {
      const token = getActiveToken();
      let data;
      if (projectId) data = await fetchProjectFiles(projectId, token);
      else if (teamId) data = await fetchTeamProjects(teamId, token);
      else throw new Error('Provide either teamId or projectId.');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error fetching projects: ${err.message}` }], isError: true };
    }
  },
);

// Register Tool: get_design_diff (compare two versions of a file/node)
server.tool(
  'get_design_diff',
  {
    fileKey: z.string().describe('The Figma file key'),
    baseVersion: z.string().describe('Older version id (from get_versions)'),
    headVersion: z.string().optional().describe('Newer version id; omit for current'),
    nodeId: z.string().optional().describe('Optional node to scope the diff'),
  },
  async ({ fileKey, baseVersion, headVersion, nodeId }) => {
    try {
      const token = getActiveToken();
      console.error(`[Tool get_design_diff] Diffing ${fileKey} ${baseVersion}..${headVersion || 'current'}`);
      const baseRaw = await fetchFigmaFile(fileKey, token, { version: baseVersion });
      const headRaw = await fetchFigmaFile(fileKey, token, headVersion ? { version: headVersion } : {});
      const pick = (raw) => {
        if (!nodeId) return raw;
        const found = findNode(raw.document, nodeId);
        return found ? { name: raw.name, document: found } : raw;
      };
      const base = simplifyDesign(pick(baseRaw));
      const head = simplifyDesign(pick(headRaw));
      const diff = diffDesigns(base, head);
      return { content: [{ type: 'text', text: JSON.stringify(diff, null, 2) }] };
    } catch (err) {
      console.error('[Tool get_design_diff] Error:', err);
      return { content: [{ type: 'text', text: `Error diffing design: ${err.message}` }], isError: true };
    }
  },
);

// Register Tool: audit_drift (design tokens vs workspace code colors)
server.tool(
  'audit_drift',
  {
    fileKey: z.string().describe('The Figma file key'),
    nodeIds: z.array(z.string()).optional().describe('Optional node IDs to scope token extraction'),
    workspacePath: z.string().optional().describe('Directory to scan for code colors (default: server cwd)'),
  },
  async ({ fileKey, nodeIds, workspacePath }) => {
    try {
      const token = getActiveToken();
      console.error(`[Tool audit_drift] Checking design-vs-code drift for ${fileKey}`);
      const raw = await getRawData(fileKey, nodeIds, token);
      let variables;
      try { variables = await fetchFigmaVariables(fileKey, token); } catch (e) {}
      const tokens = extractTokens(raw, variables);
      const report = detectDrift(tokens, workspacePath || projectPath);
      return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
    } catch (err) {
      console.error('[Tool audit_drift] Error:', err);
      return { content: [{ type: 'text', text: `Error auditing drift: ${err.message}` }], isError: true };
    }
  },
);

// Register Tool: generate_component_api (typed props from componentPropertyDefinitions)
server.tool(
  'generate_component_api',
  {
    fileKey: z.string().describe('The Figma file key'),
    nodeId: z.string().describe('Component / component-set node ID'),
    framework: z.enum(['react', 'vue']).optional().default('react').describe('react (TS interface) or vue (defineProps)'),
  },
  async ({ fileKey, nodeId, framework }) => {
    try {
      const token = getActiveToken();
      console.error(`[Tool generate_component_api] For node ${nodeId}`);
      const raw = await fetchFigmaNodes(fileKey, [nodeId], token);
      const node = raw.nodes?.[nodeId]?.document;
      if (!node) throw new Error(`Node ${nodeId} not found.`);
      const code = generateComponentApi(node, framework);
      return { content: [{ type: 'text', text: code }] };
    } catch (err) {
      console.error('[Tool generate_component_api] Error:', err);
      return { content: [{ type: 'text', text: `Error generating component API: ${err.message}` }], isError: true };
    }
  },
);

// Register Tool: extract_vectors (inline SVG icons)
server.tool(
  'extract_vectors',
  {
    fileKey: z.string().describe('The Figma file key'),
    nodeIds: z.array(z.string()).describe('Node IDs to extract vector/icon geometry from'),
    useDesignColor: z.boolean().optional().describe('Bake design colors instead of currentColor'),
  },
  async ({ fileKey, nodeIds, useDesignColor }) => {
    try {
      const token = getActiveToken();
      console.error(`[Tool extract_vectors] Extracting SVG for ${nodeIds}`);
      const geo = await fetchFigmaNodesGeometry(fileKey, nodeIds, token);
      const result = extractVectors(geo, { useDesignColor });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      console.error('[Tool extract_vectors] Error:', err);
      return { content: [{ type: 'text', text: `Error extracting vectors: ${err.message}` }], isError: true };
    }
  },
);

// Conditional Image Download Tools Registration
if (!skipImageDownloads) {
  // Register Tool: download_figma_images (Legacy alias)
  server.tool(
    'download_figma_images',
    {
      fileKey: z.string().describe('The Figma file key'),
      nodeIds: z.array(z.string()).describe('Array of node IDs to render and export as images'),
      format: z.string().optional().default('png').describe('Format of image: png or svg')
    },
    async ({ fileKey, nodeIds, format }) => {
      try {
        const activeToken = getActiveToken();
        console.error(`[Tool download_figma_images] Rendering nodes ${nodeIds}`);
        const results = await downloadFigmaImages(fileKey, nodeIds, activeToken, resolvedImageDir, format);
        
        return {
          content: [
            {
              type: 'text',
              text: `Successfully downloaded ${results.length} images to figma-export folder.\n` + 
                    JSON.stringify(results, null, 2)
            }
          ]
        };
      } catch (err) {
        console.error('[Tool download_figma_images] Error:', err);
        return {
          content: [
            {
              type: 'text',
              text: `Error downloading figma images: ${err.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Register Tool: get_screenshot
  server.tool(
    'get_screenshot',
    {
      fileKey: z.string().describe('The Figma file key (from URL)'),
      nodeId: z.string().describe('The specific nodeId to render as a screenshot'),
      scale: z.number().optional().default(1).describe('Render scale factor (1-4)')
    },
    async ({ fileKey, nodeId, scale }) => {
      try {
        const activeToken = getActiveToken();
        console.error(`[Tool get_screenshot] Rendering screenshot for node ${nodeId}`);
        const result = await getScreenshot(fileKey, nodeId, activeToken, resolvedImageDir, scale);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully captured and saved screenshot to figma-export folder.\n` + 
                    JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (err) {
        console.error('[Tool get_screenshot] Error:', err);
        return {
          content: [{ type: 'text', text: `Error capturing screenshot: ${err.message}` }],
          isError: true
        };
      }
    }
  );

  // Register Tool: download_assets
  server.tool(
    'download_assets',
    {
      fileKey: z.string().describe('The Figma file key (from URL)'),
      nodeIds: z.array(z.string()).describe('Array of node IDs to render and export as assets'),
      format: z.string().optional().default('png').describe('Format of image: png or svg')
    },
    async ({ fileKey, nodeIds, format }) => {
      try {
        const activeToken = getActiveToken();
        console.error(`[Tool download_assets] Exporting nodes ${nodeIds}`);
        const results = await downloadFigmaImages(fileKey, nodeIds, activeToken, resolvedImageDir, format);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully downloaded ${results.length} assets to figma-export folder.\n` + 
                    JSON.stringify(results, null, 2)
            }
          ]
        };
      } catch (err) {
        console.error('[Tool download_assets] Error:', err);
        return {
          content: [{ type: 'text', text: `Error downloading assets: ${err.message}` }],
          isError: true
        };
      }
    }
  );
}

// Register Tool: whoami
server.tool(
  'whoami',
  {},
  async () => {
    try {
      const activeToken = getActiveToken();
      if (!activeToken) throw new Error('No Figma token is currently available.');
      console.error('[Tool whoami] Fetching user identity');
      const data = await whoami(activeToken);
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    } catch (err) {
      console.error('[Tool whoami] Error:', err);
      return {
        content: [{ type: 'text', text: `Error fetching user info: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Register Tool: get_libraries
server.tool(
  'get_libraries',
  {
    fileKey: z.string().describe('The Figma file key')
  },
  async ({ fileKey }) => {
    try {
      const activeToken = getActiveToken();
      console.error(`[Tool get_libraries] Fetching libraries for file ${fileKey}`);
      const libData = await fetchFileComponentsAndStyles(fileKey, activeToken);
      const results = {
        file: {
          name: libData.name || 'This file',
          key: fileKey,
          sourceType: 'file',
        },
        components: libData.components || [],
        styles: libData.styles || [],
        componentsCount: libData.components?.length || 0,
        stylesCount: libData.styles?.length || 0,
        note: 'Published org/community libraries require the official Figma MCP (search_design_system); OpenFigma reports the real components and styles defined in this file.',
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }]
      };
    } catch (err) {
      console.error('[Tool get_libraries] Error:', err);
      return {
        content: [{ type: 'text', text: `Error getting libraries: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Register Tool: search_design_system
server.tool(
  'search_design_system',
  {
    fileKey: z.string().describe('The Figma file key'),
    query: z.string().describe('Search query for design system assets')
  },
  async ({ fileKey, query }) => {
    try {
      const activeToken = getActiveToken();
      console.error(`[Tool search_design_system] Searching for "${query}" in file ${fileKey}`);
      const libData = await fetchFileComponentsAndStyles(fileKey, activeToken);
      const lowerQuery = query.toLowerCase();
      
      const matchedComponents = libData.components.filter(c => 
        c.name.toLowerCase().includes(lowerQuery) || c.description.toLowerCase().includes(lowerQuery)
      );
      const matchedStyles = libData.styles.filter(s => 
        s.name.toLowerCase().includes(lowerQuery) || s.description.toLowerCase().includes(lowerQuery)
      );

      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ components: matchedComponents, styles: matchedStyles }, null, 2) 
        }]
      };
    } catch (err) {
      console.error('[Tool search_design_system] Error:', err);
      return {
        content: [{ type: 'text', text: `Error searching design system: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Register Tool: get_figjam
server.tool(
  'get_figjam',
  {
    fileKey: z.string().describe('The FigJam file key')
  },
  async ({ fileKey }) => {
    try {
      const activeToken = getActiveToken();
      console.error(`[Tool get_figjam] Fetching FigJam diagram structures for ${fileKey}`);
      const rawData = await fetchFigmaFile(fileKey, activeToken);
      
      const extractFigJamNodes = (node) => {
        if (!node) return null;
        const result = {
          id: node.id,
          name: node.name,
          type: node.type
        };
        if (['STICKY', 'CONNECTOR', 'SHAPE', 'TABLE', 'CODE_BLOCK'].includes(node.type)) {
          result.text = node.characters || '';
          result.absoluteBoundingBox = node.absoluteBoundingBox;
        }
        if (node.children) {
          result.children = node.children
            .map(child => extractFigJamNodes(child))
            .filter(Boolean);
        }
        return result;
      };

      const sparseTree = extractFigJamNodes(rawData.document);
      return {
        content: [{ type: 'text', text: JSON.stringify({ name: rawData.name, document: sparseTree }, null, 2) }]
      };
    } catch (err) {
      console.error('[Tool get_figjam] Error:', err);
      return {
        content: [{ type: 'text', text: `Error fetching FigJam: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Register Tool: capabilities — what this server can really do (no fabrication).
server.tool(
  'capabilities',
  {},
  async () => {
    let me = null;
    try { me = await whoami(getActiveToken()); } catch (e) { me = { error: e.message }; }
    return { content: [{ type: 'text', text: JSON.stringify(buildCapabilities(me), null, 2) }] };
  },
);

// --- Canvas-write tools: honestly unsupported on a REST PAT ------------------
// These previously fabricated success with mock IDs. They now tell the truth so
// an agent never reports work that did not happen. (Canvas writes need the
// Figma Plugin API; OpenFigma is REST-only.)
server.tool(
  'use_figma',
  {
    fileKey: z.string().describe('The Figma file key'),
    commands: z.array(z.any()).or(z.string()).describe('Plugin API write/draw commands'),
  },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(unsupported('use_figma', 'Use generate_code to produce component code and download_assets for images.'), null, 2) }],
    isError: true,
  }),
);

server.tool(
  'create_new_file',
  {
    name: z.string().optional().describe('The name of the file to create'),
    type: z.enum(['design', 'figjam', 'slides']).optional().default('design').describe('Type of document'),
  },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(unsupported('create_new_file', 'Create files in the Figma app; OpenFigma reads existing files.'), null, 2) }],
    isError: true,
  }),
);

server.tool(
  'generate_diagram',
  {
    mermaid: z.string().describe('Mermaid chart definition'),
    fileKey: z.string().optional().describe('Optional target FigJam fileKey'),
  },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(unsupported('generate_diagram', 'Mermaid-to-FigJam needs the Plugin API; not available over REST.'), null, 2) }],
    isError: true,
  }),
);

server.tool(
  'generate_figma_design',
  {
    fileKey: z.string().describe('The Figma file key'),
    html: z.string().optional().describe('HTML layout'),
    css: z.string().optional().describe('Optional CSS'),
  },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(unsupported('generate_figma_design', 'Code-to-canvas needs the Plugin API; OpenFigma goes design-to-code via generate_code.'), null, 2) }],
    isError: true,
  }),
);

server.tool(
  'upload_assets',
  {
    fileKey: z.string().describe('The Figma file key'),
    assets: z.array(z.any()).describe('Assets to upload'),
  },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(unsupported('upload_assets', 'Uploading bytes into a Figma file needs the Plugin API.'), null, 2) }],
    isError: true,
  }),
);

// Code Connect In-Memory Registry to simulate CLI/UI mappings
const codeConnectRegistry = new Map();

// Register Tool: add_code_connect_map
server.tool(
  'add_code_connect_map',
  {
    fileKey: z.string().describe('The Figma file key'),
    nodeId: z.string().describe('Figma component node ID'),
    componentName: z.string().describe('Code component class/export name'),
    source: z.string().describe('File path of the code component in workspace')
  },
  async ({ fileKey, nodeId, componentName, source }) => {
    try {
      const mappingKey = `${fileKey}_${nodeId}`;
      const mappingValue = {
        componentName,
        source,
        version: 'Code Connect UI (Simulated)',
        label: 'React',
        timestamp: Date.now()
      };
      codeConnectRegistry.set(mappingKey, mappingValue);
      console.error(`[Code Connect] Registered mapping for node ${nodeId} -> component ${componentName}`);

      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            status: 'success',
            nodeId,
            componentName,
            message: 'Successfully mapped Figma component to local workspace implementation.'
          }, null, 2) 
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error saving Code Connect mapping: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Register Tool: get_code_connect_map
server.tool(
  'get_code_connect_map',
  {
    fileKey: z.string().describe('The Figma file key'),
    nodeIds: z.array(z.string()).optional().describe('Optional array of node IDs to inspect')
  },
  async ({ fileKey, nodeIds }) => {
    try {
      console.error(`[Code Connect] Retrieving mappings for file ${fileKey}`);
      const mappings = {};
      const idsToCheck = nodeIds || [];

      // Scan first
      const scanned = localComponentScanner(projectPath);

      for (const id of idsToCheck) {
        const mappingKey = `${fileKey}_${id}`;
        if (codeConnectRegistry.has(mappingKey)) {
          mappings[id] = codeConnectRegistry.get(mappingKey);
        } else {
          // Fallback check
          let nodeName = '';
          try {
            const activeToken = getActiveToken();
            const rawNodes = await fetchFigmaNodes(fileKey, [id], activeToken);
            nodeName = rawNodes.nodes?.[id]?.document?.name || '';
          } catch (e) {}

          const match = scanned.find(c => c.name.toLowerCase() === nodeName.toLowerCase());
          if (match) {
            mappings[id] = {
              componentName: match.name,
              source: match.filePath,
              version: 'Workspace Autodiscovery',
              label: 'React',
              isSuggested: true
            };
          }
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(mappings, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error retrieving mappings: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Register Tool: get_code_connect_suggestions
server.tool(
  'get_code_connect_suggestions',
  {
    fileKey: z.string().describe('The Figma file key'),
    nodeIds: z.array(z.string()).optional().describe('Figma node IDs to scan suggestions for')
  },
  async ({ fileKey, nodeIds }) => {
    try {
      console.error(`[Code Connect] Scanning workspace for suggestions on file ${fileKey}`);
      const scanned = localComponentScanner(projectPath);
      const suggestions = [];

      const idsToCheck = nodeIds || [];
      for (const id of idsToCheck) {
        let nodeName = '';
        let nodeType = '';
        try {
          const activeToken = getActiveToken();
          const rawNodes = await fetchFigmaNodes(fileKey, [id], activeToken);
          nodeName = rawNodes.nodes?.[id]?.document?.name || '';
          nodeType = rawNodes.nodes?.[id]?.document?.type || '';
        } catch (e) {}

        const bestMatches = scanned.filter(c => 
          c.name.toLowerCase().includes(nodeName.toLowerCase()) || 
          nodeName.toLowerCase().includes(c.name.toLowerCase())
        );

        if (bestMatches.length > 0) {
          suggestions.push({
            nodeId: id,
            nodeName,
            nodeType,
            suggestions: bestMatches.map(m => ({
              componentName: m.name,
              source: m.filePath,
              confidence: m.name.toLowerCase() === nodeName.toLowerCase() ? 'high' : 'medium'
            }))
          });
        }
      }

      if (suggestions.length === 0) {
        suggestions.push({
          message: 'Workspace scanned. No specific Figma node associations matched. Here is the list of available workspace components:',
          components: scanned
        });
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(suggestions, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error getting suggestions: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Register Tool: get_context_for_code_connect
server.tool(
  'get_context_for_code_connect',
  {
    fileKey: z.string().describe('The Figma file key'),
    nodeId: z.string().describe('Component node ID')
  },
  async ({ fileKey, nodeId }) => {
    try {
      const activeToken = getActiveToken();
      console.error(`[Code Connect] Fetching template context for node ${nodeId}`);
      const rawNodes = await fetchFigmaNodes(fileKey, [nodeId], activeToken);
      const node = rawNodes.nodes?.[nodeId]?.document;
      if (!node) throw new Error(`Node ${nodeId} not found in cache/api`);

      const properties = {};
      if (node.componentPropertyDefinitions) {
        for (const [propName, def] of Object.entries(node.componentPropertyDefinitions)) {
          properties[propName] = {
            type: def.type,
            defaultValue: def.defaultValue,
            variantOptions: def.variantOptions || []
          };
        }
      }

      const context = {
        componentName: node.name,
        nodeId,
        properties,
        descendantTree: extractSparseTree(node)
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(context, null, 2) }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error retrieving template context: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Register Tool: send_code_connect_mappings
server.tool(
  'send_code_connect_mappings',
  {
    fileKey: z.string().describe('The Figma file key'),
    mappings: z.any().describe('List of confirmed mappings to register')
  },
  async ({ fileKey, mappings }) => {
    try {
      console.error(`[Code Connect] Storing verified mappings for file ${fileKey}`);
      const list = Array.isArray(mappings) ? mappings : [mappings];
      
      for (const map of list) {
        if (map.nodeId && map.componentName) {
          const mappingKey = `${fileKey}_${map.nodeId}`;
          codeConnectRegistry.set(mappingKey, {
            componentName: map.componentName,
            source: map.source || 'Autodetected',
            version: 'Confirmed Suggestions',
            label: 'React',
            timestamp: Date.now()
          });
        }
      }

      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            status: 'success',
            mappingsRegistered: list.length,
            message: 'Mappings confirmed and stored in simulated registry.'
          }, null, 2) 
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error saving confirmed mappings: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Start the server based on the selected transport mode
if (stdioMode) {
  // Stdio mode
  console.error('[Mode] Starting OpenFigma MCP Server in Stdio mode...');
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.error('[Server] Connected via Stdio.');
  }).catch(err => {
    console.error('[Server] Connection error:', err);
  });
} else {
  // HTTP/SSE mode (Express)
  console.error(`[Mode] Starting OpenFigma MCP Server in HTTP/SSE mode on port ${port}...`);
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Serve downloaded assets over localhost so agents can reference real URLs
  // (mirrors the official Figma MCP's asset endpoint). The download tools save
  // into <imageDir>/figma-export and return /figma-export/<file> paths.
  const exportDir = path.join(resolvedImageDir, 'figma-export');
  app.use('/figma-export', express.static(exportDir));
  app.use('/assets', express.static(exportDir));

  let activeTransport = null;

  app.get('/sse', async (req, res) => {
    console.error('[HTTP/SSE] Client initiated SSE stream connection.');
    
    if (activeTransport) {
      console.error('[HTTP/SSE] Closing active previous SSE connection.');
      try {
        await activeTransport.close();
      } catch (e) {
        console.error('[HTTP/SSE] Error closing transport:', e);
      }
    }

    activeTransport = new SSEServerTransport('/messages', res);
    await server.connect(activeTransport);

    activeTransport.onclose = () => {
      console.error('[HTTP/SSE] Transport connection closed.');
      activeTransport = null;
    };
  });

  app.post('/messages', async (req, res) => {
    const { sessionId } = req.query;
    console.error(`[HTTP/SSE] Received POST message for session: ${sessionId}`);
    
    // Per-request token override. Normalize to the structured {token}/{oauthToken}
    // contract so auth headers are chosen deterministically rather than via a
    // string heuristic: X-Figma-Token is always a PAT (-> X-Figma-Token header),
    // Authorization is always an OAuth Bearer token.
    const xFigmaToken = req.headers['x-figma-token'];
    const authHeader = req.headers['authorization'];
    let tokenOverride;
    if (xFigmaToken) {
      tokenOverride = { token: xFigmaToken };
    } else if (authHeader) {
      tokenOverride = { oauthToken: authHeader.replace(/^Bearer\s+/i, '') };
    }

    tokenStorage.run({ tokenOverride }, async () => {
      if (activeTransport && activeTransport.sessionId === sessionId) {
        await activeTransport.handlePostMessage(req, res);
      } else {
        console.error('[HTTP/SSE] Session mismatch or no active transport connection found.');
        res.status(400).send('Session mismatch or SSE stream not connected.');
      }
    });
  });

  app.get('/mcp', (req, res) => {
    res.send('OpenFigma MCP Server is running. Establish SSE stream at /sse.');
  });

  app.listen(port, host, () => {
    console.error(`[Server] Listening on http://${host}:${port}`);
    console.error(`[SSE Endpoint] http://${host}:${port}/sse`);
    console.error(`[Assets] Served at http://${host}:${port}/figma-export/ (from ${exportDir})`);
  });
}
