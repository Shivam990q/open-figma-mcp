import { test } from 'node:test';
import assert from 'node:assert';
import { generateClientConfigs } from '../src/tools/client-config.js';

test('generateClientConfigs outputs valid configs for Claude, Cursor, Zed, Windsurf, VS Code, and Gemini', () => {
  const configs = generateClientConfigs({ apiKey: 'fig_pat_test12345' });

  assert.ok(configs.claudeDesktop);
  assert.ok(configs.claudeDesktop.config.mcpServers['open-figma']);
  assert.strictEqual(configs.claudeDesktop.config.mcpServers['open-figma'].env.FIGMA_API_KEY, 'fig_pat_test12345');

  assert.ok(configs.cursor);
  assert.ok(configs.cursor.config.mcpServers['open-figma']);

  assert.ok(configs.zed);
  assert.ok(configs.zed.config.experimental.mcp.servers['open-figma']);

  assert.ok(configs.windsurf);
  assert.ok(configs.windsurf.config.mcpServers['open-figma']);

  assert.ok(configs.vscode);
  assert.ok(configs.vscode.config.servers['open-figma']);

  assert.ok(configs.gemini);
  assert.strictEqual(configs.gemini.config.name, 'open-figma-mcp');
});
