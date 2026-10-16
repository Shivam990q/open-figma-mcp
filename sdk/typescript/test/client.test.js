import test from 'node:test';
import assert from 'node:assert';
import { OpenFigmaClient } from '../src/index.js';

test('OpenFigmaClient initializes with default endpoint', () => {
  const client = new OpenFigmaClient({ endpoint: 'http://localhost:3845' });
  assert.strictEqual(client.endpoint, 'http://localhost:3845');
});

test('OpenFigmaClient exposes all standard MCP tool helper methods', () => {
  const client = new OpenFigmaClient();
  assert.strictEqual(typeof client.getFigmaData, 'function');
  assert.strictEqual(typeof client.getDesignTokens, 'function');
  assert.strictEqual(typeof client.generateCode, 'function');
  assert.strictEqual(typeof client.renderSvg, 'function');
  assert.strictEqual(typeof client.getCodeConnect, 'function');
  assert.strictEqual(typeof client.transpileCode, 'function');
  assert.strictEqual(typeof client.audit, 'function');
  assert.strictEqual(typeof client.createFrame, 'function');
  assert.strictEqual(typeof client.createText, 'function');
  assert.strictEqual(typeof client.createRectangle, 'function');
  assert.strictEqual(typeof client.insertCode, 'function');
  assert.strictEqual(typeof client.getCapabilities, 'function');
});

