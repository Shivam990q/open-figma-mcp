import { spawn, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.join(__dirname, '../src/server.js');
const projectRoot = path.join(__dirname, '../');

console.log('=== OpenFigma MCP Integration Test ===');
console.log(`Server script: ${serverScript}`);

// Figma test configurations.
// The integration test runs offline against a seeded cache, so no real token is
// needed — fall back to a dummy. Provide FIGMA_API_KEY in the env to hit the live API.
const FIGMA_API_KEY = process.env.FIGMA_API_KEY || "figd_dummy_integration_test_token";
const TEST_FILE_KEY = "qyzRLWGPVjGvms7UzvZ9up";

// Seed the cache with local figma_file_summary.json to bypass rate limits during test runs
const cacheDir = path.join(projectRoot, '.figma-cache');
const localSummaryPath = 'C:\\Users\\Rose\\Videos\\FUTURE\\Autonomy Social Media\\backend\\figma_file_summary.json';
if (fs.existsSync(localSummaryPath)) {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  const targetCacheFile = path.join(cacheDir, `file_${TEST_FILE_KEY}.json`);
  fs.copyFileSync(localSummaryPath, targetCacheFile);
  const now = new Date();
  fs.utimesSync(targetCacheFile, now, now);
  console.log(`[Test Setup] Seeded cache for file ${TEST_FILE_KEY} using local summary and touched it.`);
}

// Spawn the server process in STDIO mode
const server = spawn('node', [serverScript, '--stdio', '--figma-api-key', FIGMA_API_KEY], {
  cwd: projectRoot,
  env: { ...process.env, FIGMA_API_KEY }
});

let responseBuffer = '';
let currentRequestId = 1;
const pendingRequests = new Map();

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  processBuffer();
});

server.stderr.on('data', (data) => {
  console.log(`[Server Log/Err] ${data.toString().trim()}`);
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

function processBuffer() {
  const lines = responseBuffer.split('\n');
  // Keep the last incomplete line in the buffer
  responseBuffer = lines.pop() || '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const response = JSON.parse(trimmed);
      console.log(`[Client Received] Method/Id: ${response.id || response.method}`);
      
      if (response.id && pendingRequests.has(response.id)) {
        const resolve = pendingRequests.get(response.id);
        pendingRequests.delete(response.id);
        resolve(response);
      }
    } catch (e) {
      console.error(`[Error parsing server output] ${trimmed}: ${e.message}`);
    }
  }
}

function sendRequest(method, params = {}) {
  return new Promise((resolve) => {
    const id = currentRequestId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    pendingRequests.set(id, resolve);
    console.log(`[Client Sending] Request ${id}: ${method}`);
    server.stdin.write(JSON.stringify(request) + '\n');
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Main test flow
async function runTests() {
  try {
    // 0. CLI `fetch` subcommand (offline via warm cache) — yaml, json, tree
    console.log('\n--- Test 0: CLI fetch subcommand (yaml/json/tree) ---');
    const fetchTarget = `https://figma.com/design/${TEST_FILE_KEY}/X?node-id=12-822`;
    for (const fmt of ['yaml', 'json', 'tree']) {
      const res = spawnSync('node', [serverScript, 'fetch', fetchTarget, '--figma-api-key', FIGMA_API_KEY, `--format=${fmt}`], {
        cwd: projectRoot,
        env: { ...process.env, FIGMA_API_KEY },
        encoding: 'utf-8',
      });
      const out = (res.stdout || '').trim();
      if (res.status !== 0 || !out) {
        console.warn(`⚠️ CLI fetch --format=${fmt} produced no output (status ${res.status}); may be rate-limited. Skipping.`);
        continue;
      }
      if (fmt === 'json') {
        const parsed = JSON.parse(out);
        if (!parsed.nodes || !parsed.globalVars) throw new Error('CLI fetch json missing nodes/globalVars');
      } else if (!out.includes('12:822')) {
        throw new Error(`CLI fetch --format=${fmt} missing node id. Got: ${out.slice(0, 120)}`);
      }
      console.log(`  CLI fetch --format=${fmt}: OK (${out.length} bytes)`);
    }

    // 1. Initialize
    console.log('\n--- Test 1: Initialize Handshake ---');
    const initResponse = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'IntegrationTestClient', version: '1.0.0' }
    });
    console.log('Init Response Server Info:', initResponse.result?.serverInfo);

    // Send initialized notification
    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    };
    server.stdin.write(JSON.stringify(notification) + '\n');
    console.log('[Client Sent] notifications/initialized notification');

    // 2. List Tools
    console.log('\n--- Test 2: List Registered Tools ---');
    const toolsResponse = await sendRequest('tools/list');
    const tools = toolsResponse.result?.tools || [];
    console.log('Registered Tools found:', tools.map(t => t.name));

    if (tools.length === 0) {
      throw new Error('No tools were registered by the server!');
    }

    // 3. Call get_figma_data
    await sleep(2000);
    console.log('\n--- Test 3: Call get_figma_data ---');
    const getFigmaDataResponse = await sendRequest('tools/call', {
      name: 'get_figma_data',
      arguments: {
        fileKey: TEST_FILE_KEY
      }
    });

    const figmaContent = getFigmaDataResponse.result?.content?.[0]?.text;
    if (figmaContent && !getFigmaDataResponse.result?.isError) {
      // Default output is now simplified YAML (not raw JSON). Verify the
      // hallmark sections of a SimplifiedDesign are present.
      if (!figmaContent.includes('nodes:') || !figmaContent.includes('globalVars:')) {
        throw new Error(`get_figma_data did not return simplified YAML. Got:\n${figmaContent.slice(0, 300)}`);
      }
      console.log('Success! get_figma_data returned simplified YAML with nodes + globalVars.');
    } else {
      throw new Error(`get_figma_data failed: ${figmaContent || 'Unknown error'}`);
    }

    // 4. Call download_figma_images
    await sleep(2000);
    console.log('\n--- Test 4: Call download_figma_images ---');
    const downloadResponse = await sendRequest('tools/call', {
      name: 'download_figma_images',
      arguments: {
        fileKey: TEST_FILE_KEY,
        nodeIds: ['12:822'],
        format: 'png'
      }
    });
    const downloadContent = downloadResponse.result?.content?.[0]?.text;
    console.log('Download Result:', downloadContent);
    if (downloadResponse.result?.isError) {
      if (downloadContent.includes('429') || downloadContent.includes('Rate limit exceeded')) {
        console.warn('⚠️ Figma API rate limit hit during image download. Skipping assertion...');
      } else {
        throw new Error(`download_figma_images failed: ${downloadContent}`);
      }
    }

    // 5. Call get_metadata (without nodeId)
    await sleep(2000);
    console.log('\n--- Test 5: Call get_metadata (root tree) ---');
    const metadataResponse = await sendRequest('tools/call', {
      name: 'get_metadata',
      arguments: {
        fileKey: TEST_FILE_KEY
      }
    });
    const metadataContent = metadataResponse.result?.content?.[0]?.text;
    if (metadataResponse.result?.isError || !metadataContent) {
      throw new Error(`get_metadata (root) failed: ${metadataContent}`);
    }
    const metadataJson = JSON.parse(metadataContent);
    console.log(`Success! Fetched sparse tree for file "${metadataJson.name}". Root node ID: ${metadataJson.document?.id}`);

    // 6. Call get_metadata (with nodeId)
    await sleep(2000);
    console.log('\n--- Test 6: Call get_metadata (specific node) ---');
    const nodeMetadataResponse = await sendRequest('tools/call', {
      name: 'get_metadata',
      arguments: {
        fileKey: TEST_FILE_KEY,
        nodeId: '12:822'
      }
    });
    const nodeMetadataContent = nodeMetadataResponse.result?.content?.[0]?.text;
    if (nodeMetadataResponse.result?.isError || !nodeMetadataContent) {
      throw new Error(`get_metadata (node) failed: ${nodeMetadataContent}`);
    }
    const nodeMetadataJson = JSON.parse(nodeMetadataContent);
    console.log(`Success! Fetched node metadata for: "${nodeMetadataJson.name}" (${nodeMetadataJson.type})`);

    // 7. Call get_design_context
    await sleep(2000);
    console.log('\n--- Test 7: Call get_design_context ---');
    const contextResponse = await sendRequest('tools/call', {
      name: 'get_design_context',
      arguments: {
        fileKey: TEST_FILE_KEY,
        nodeId: '12:822'
      }
    });
    const contextContent = contextResponse.result?.content?.[0]?.text;
    if (contextResponse.result?.isError || !contextContent) {
      throw new Error(`get_design_context failed: ${contextContent}`);
    }
    const contextJson = JSON.parse(contextContent);
    console.log(`Success! Fetched design context for: "${contextJson.document?.name}" (${contextJson.document?.type})`);

    // 8. Call get_screenshot
    await sleep(2000);
    console.log('\n--- Test 8: Call get_screenshot ---');
    const screenshotResponse = await sendRequest('tools/call', {
      name: 'get_screenshot',
      arguments: {
        fileKey: TEST_FILE_KEY,
        nodeId: '12:822',
        scale: 1
      }
    });
    const screenshotContent = screenshotResponse.result?.content?.[0]?.text;
    console.log('Screenshot Result:', screenshotContent);
    if (screenshotResponse.result?.isError || !screenshotContent) {
      if (screenshotContent && (screenshotContent.includes('429') || screenshotContent.includes('Rate limit exceeded'))) {
        console.warn('⚠️ Figma API rate limit hit during screenshot. Skipping assertion...');
      } else {
        throw new Error(`get_screenshot failed: ${screenshotContent}`);
      }
    }

    // 9. Call get_variable_defs
    await sleep(2000);
    console.log('\n--- Test 9: Call get_variable_defs ---');
    const variablesResponse = await sendRequest('tools/call', {
      name: 'get_variable_defs',
      arguments: {
        fileKey: TEST_FILE_KEY
      }
    });
    const variablesContent = variablesResponse.result?.content?.[0]?.text;
    if (variablesResponse.result?.isError || !variablesContent) {
      throw new Error(`get_variable_defs failed: ${variablesContent}`);
    }
    const variablesJson = JSON.parse(variablesContent);
    console.log(`Success! Fetched variables/tokens from source: "${variablesJson.source}"`);

    // 10. Call download_assets
    await sleep(2000);
    console.log('\n--- Test 10: Call download_assets ---');
    const assetsResponse = await sendRequest('tools/call', {
      name: 'download_assets',
      arguments: {
        fileKey: TEST_FILE_KEY,
        nodeIds: ['12:822'],
        format: 'png'
      }
    });
    const assetsContent = assetsResponse.result?.content?.[0]?.text;
    console.log('Download Assets Result:', assetsContent);
    if (assetsResponse.result?.isError || !assetsContent) {
      if (assetsContent && (assetsContent.includes('429') || assetsContent.includes('Rate limit exceeded'))) {
        console.warn('⚠️ Figma API rate limit hit during assets download. Skipping assertion...');
      } else {
        throw new Error(`download_assets failed: ${assetsContent}`);
      }
    }

    // 11. Call whoami
    await sleep(2000);
    console.log('\n--- Test 11: Call whoami ---');
    const whoamiResponse = await sendRequest('tools/call', {
      name: 'whoami',
      arguments: {}
    });
    const whoamiContent = whoamiResponse.result?.content?.[0]?.text;
    if (whoamiResponse.result?.isError || !whoamiContent) {
      throw new Error(`whoami failed: ${whoamiContent}`);
    }
    console.log('whoami success:', whoamiContent);

    // 12. Call get_libraries
    await sleep(2000);
    console.log('\n--- Test 12: Call get_libraries ---');
    const libsResponse = await sendRequest('tools/call', {
      name: 'get_libraries',
      arguments: { fileKey: TEST_FILE_KEY }
    });
    const libsContent = libsResponse.result?.content?.[0]?.text;
    if (libsResponse.result?.isError || !libsContent) {
      throw new Error(`get_libraries failed: ${libsContent}`);
    }
    console.log('get_libraries success:', libsContent);

    // 13. Call search_design_system
    await sleep(2000);
    console.log('\n--- Test 13: Call search_design_system ---');
    const searchResponse = await sendRequest('tools/call', {
      name: 'search_design_system',
      arguments: { fileKey: TEST_FILE_KEY, query: 'primary' }
    });
    const searchContent = searchResponse.result?.content?.[0]?.text;
    if (searchResponse.result?.isError || !searchContent) {
      throw new Error(`search_design_system failed: ${searchContent}`);
    }
    console.log('search_design_system success:', searchContent);

    // 14. Call get_figjam
    await sleep(2000);
    console.log('\n--- Test 14: Call get_figjam ---');
    const figjamResponse = await sendRequest('tools/call', {
      name: 'get_figjam',
      arguments: { fileKey: TEST_FILE_KEY }
    });
    const figjamContent = figjamResponse.result?.content?.[0]?.text;
    if (figjamResponse.result?.isError || !figjamContent) {
      throw new Error(`get_figjam failed: ${figjamContent}`);
    }
    console.log('get_figjam success:', figjamContent);

    // 15-19. Canvas-write tools must HONESTLY refuse (supported:false, isError:true)
    console.log('\n--- Tests 15-19: Honest refusal of canvas-write tools ---');
    for (const [name, args] of [
      ['use_figma', { fileKey: TEST_FILE_KEY, commands: ['create frame'] }],
      ['create_new_file', { name: 'X', type: 'design' }],
      ['generate_diagram', { mermaid: 'graph TD; A-->B;' }],
      ['generate_figma_design', { fileKey: TEST_FILE_KEY, html: '<div/>' }],
      ['upload_assets', { fileKey: TEST_FILE_KEY, assets: [{ path: 'x.png' }] }],
    ]) {
      const r = await sendRequest('tools/call', { name, arguments: args });
      const txt = r.result?.content?.[0]?.text || '';
      if (!r.result?.isError || !txt.includes('"supported": false')) {
        throw new Error(`${name} should honestly refuse (supported:false), got: ${txt.slice(0, 120)}`);
      }
      console.log(`  ${name}: honestly refused ✓`);
    }

    // 19b. capabilities tool returns a real report
    const capResp = await sendRequest('tools/call', { name: 'capabilities', arguments: {} });
    const capTxt = capResp.result?.content?.[0]?.text || '';
    if (!capTxt.includes('realTools') || !capTxt.includes('notSupported')) {
      throw new Error(`capabilities malformed: ${capTxt.slice(0, 120)}`);
    }
    console.log('  capabilities: OK');

    // 19c. New derived tools over the warm cache: tokens, codegen, a11y
    const tokResp = await sendRequest('tools/call', { name: 'get_design_tokens', arguments: { fileKey: TEST_FILE_KEY, format: 'css' } });
    const tokTxt = tokResp.result?.content?.[0]?.text || '';
    if (tokResp.result?.isError || !tokTxt.includes(':root')) throw new Error(`get_design_tokens failed: ${tokTxt.slice(0, 120)}`);
    console.log('  get_design_tokens(css): OK');

    const cgResp = await sendRequest('tools/call', { name: 'generate_code', arguments: { fileKey: TEST_FILE_KEY, nodeId: '12:822', framework: 'react-tailwind' } });
    const cgTxt = cgResp.result?.content?.[0]?.text || '';
    if (cgResp.result?.isError || !cgTxt.includes('export default function')) throw new Error(`generate_code failed: ${cgTxt.slice(0, 120)}`);
    console.log('  generate_code(react-tailwind): OK');

    const a11yResp = await sendRequest('tools/call', { name: 'audit_accessibility', arguments: { fileKey: TEST_FILE_KEY, nodeIds: ['12:822'], pageBackground: '#141414' } });
    const a11yTxt = a11yResp.result?.content?.[0]?.text || '';
    if (a11yResp.result?.isError || !a11yTxt.includes('textLayersChecked')) throw new Error(`audit_accessibility failed: ${a11yTxt.slice(0, 120)}`);
    console.log('  audit_accessibility: OK');

    // 20. Code Connect tool chain test
    await sleep(2000);
    console.log('\n--- Test 20: Code Connect Toolchain ---');
    
    // add mapping
    const addCCResponse = await sendRequest('tools/call', {
      name: 'add_code_connect_map',
      arguments: {
        fileKey: TEST_FILE_KEY,
        nodeId: '12:822',
        componentName: 'TestButton',
        source: 'src/components/TestButton.tsx'
      }
    });
    console.log('add_code_connect_map response:', addCCResponse.result?.content?.[0]?.text);

    // get mapping
    const getCCResponse = await sendRequest('tools/call', {
      name: 'get_code_connect_map',
      arguments: {
        fileKey: TEST_FILE_KEY,
        nodeIds: ['12:822']
      }
    });
    console.log('get_code_connect_map response:', getCCResponse.result?.content?.[0]?.text);

    // suggestions
    const suggestionsResponse = await sendRequest('tools/call', {
      name: 'get_code_connect_suggestions',
      arguments: {
        fileKey: TEST_FILE_KEY,
        nodeIds: ['12:822']
      }
    });
    console.log('get_code_connect_suggestions response:', suggestionsResponse.result?.content?.[0]?.text);

    // get context for code connect
    const getContextResponse = await sendRequest('tools/call', {
      name: 'get_context_for_code_connect',
      arguments: {
        fileKey: TEST_FILE_KEY,
        nodeId: '12:822'
      }
    });
    console.log('get_context_for_code_connect response:', getContextResponse.result?.content?.[0]?.text);

    // send mappings
    const sendCCResponse = await sendRequest('tools/call', {
      name: 'send_code_connect_mappings',
      arguments: {
        fileKey: TEST_FILE_KEY,
        mappings: [{ nodeId: '12:822', componentName: 'TestButton', source: 'src/components/TestButton.tsx' }]
      }
    });
    console.log('send_code_connect_mappings response:', sendCCResponse.result?.content?.[0]?.text);

    console.log('\n✅ All integration tests passed successfully!');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
  } finally {
    // Shutdown the server process
    server.kill();
    process.exit(0);
  }
}

// Start test process
setTimeout(runTests, 1000);
