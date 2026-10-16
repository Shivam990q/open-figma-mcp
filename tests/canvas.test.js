import test from 'node:test';
import assert from 'node:assert';
import { CanvasController } from '../src/tools/canvas.js';

class MockBridge {
  constructor() {
    this.commands = [];
  }

  async sendCommand(command, payload) {
    this.commands.push({ command, payload });
    return {
      status: 'ok',
      id: 'mock_node_' + this.commands.length,
      received: { command, payload },
    };
  }
}

test('CanvasController sends CREATE_FRAME command to bridge', async () => {
  const bridge = new MockBridge();
  const canvas = new CanvasController(bridge);

  const res = await canvas.createFrame({ name: 'Hero Container', width: 800, height: 600, x: 100, y: 100 });
  assert.strictEqual(bridge.commands.length, 1);
  assert.strictEqual(bridge.commands[0].command, 'CREATE_FRAME');
  assert.strictEqual(bridge.commands[0].payload.name, 'Hero Container');
  assert.strictEqual(res.status, 'ok');
});

test('CanvasController sends CREATE_RECTANGLE command with styles', async () => {
  const bridge = new MockBridge();
  const canvas = new CanvasController(bridge);

  await canvas.createRectangle({ width: 200, height: 100, x: 50, y: 50, fillColor: '#3B82F6', cornerRadius: 12 });
  assert.strictEqual(bridge.commands.length, 1);
  assert.strictEqual(bridge.commands[0].command, 'CREATE_RECTANGLE');
  assert.strictEqual(bridge.commands[0].payload.cornerRadius, 12);
});

test('CanvasController sends CREATE_TEXT command', async () => {
  const bridge = new MockBridge();
  const canvas = new CanvasController(bridge);

  await canvas.createText({ text: 'Autonomous Design Fabric', fontSize: 24, x: 10, y: 20 });
  assert.strictEqual(bridge.commands[0].command, 'CREATE_TEXT');
  assert.strictEqual(bridge.commands[0].payload.text, 'Autonomous Design Fabric');
});

test('CanvasController transpiles code and invokes BATCH_CREATE on bridge', async () => {
  const bridge = new MockBridge();
  const canvas = new CanvasController(bridge);

  const html = '<button class="bg-blue-600 text-white p-4">Deploy System</button>';
  await canvas.insertCode(html);

  assert.strictEqual(bridge.commands.length, 1);
  assert.strictEqual(bridge.commands[0].command, 'BATCH_CREATE');
  assert.ok(Array.isArray(bridge.commands[0].payload.nodes));
  assert.strictEqual(bridge.commands[0].payload.nodes[0].type, 'FRAME');
});
