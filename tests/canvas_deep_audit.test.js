import test from 'node:test';
import assert from 'node:assert';
import { CanvasController, parseColorToFigma } from '../src/tools/canvas.js';
import { FigmaPluginBridge } from '../src/bridge.js';

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

test('parseColorToFigma converts hex, rgb object, and normalized floats correctly', () => {
  // Hex conversion
  const blue = parseColorToFigma('#3B82F6');
  assert.ok(Math.abs(blue.r - 0.231) < 0.01);
  assert.ok(Math.abs(blue.g - 0.509) < 0.01);
  assert.ok(Math.abs(blue.b - 0.964) < 0.01);

  // 0-255 RGB object conversion
  const white255 = parseColorToFigma({ r: 255, g: 255, b: 255 });
  assert.strictEqual(white255.r, 1);
  assert.strictEqual(white255.g, 1);
  assert.strictEqual(white255.b, 1);

  // 0-1 float object conversion
  const custom = parseColorToFigma({ r: 0.5, g: 0.5, b: 0.5 });
  assert.strictEqual(custom.r, 0.5);
  assert.strictEqual(custom.g, 0.5);
  assert.strictEqual(custom.b, 0.5);
});

test('CanvasController createNavbar generates responsive navigation bar structure', async () => {
  const bridge = new MockBridge();
  const canvas = new CanvasController(bridge);

  await canvas.createNavbar({
    brandName: 'OpenFigma AI',
    links: ['Product', 'Showcase', 'Pricing'],
    ctaText: 'Deploy Now',
    theme: 'dark',
  });

  assert.strictEqual(bridge.commands.length, 1);
  assert.strictEqual(bridge.commands[0].command, 'BATCH_CREATE');
  const root = bridge.commands[0].payload.nodes[0];
  assert.strictEqual(root.name, 'Navbar / OpenFigma AI');
  assert.strictEqual(root.layoutMode, 'HORIZONTAL');
  assert.strictEqual(root.children.length, 5); // Logo + 3 Links + CTA Button
  assert.strictEqual(root.children[0].characters, 'OpenFigma AI');
});

test('CanvasController createHeroSection generates high-impact marketing hero artboard', async () => {
  const bridge = new MockBridge();
  const canvas = new CanvasController(bridge);

  await canvas.createHeroSection({
    title: 'The Autonomous Design Fabric',
    subtitle: 'Generate, mutate, and sync Figma designs natively.',
    badge: '🚀 Production Ready',
  });

  assert.strictEqual(bridge.commands.length, 1);
  const root = bridge.commands[0].payload.nodes[0];
  assert.strictEqual(root.name, 'Hero Section');
  assert.strictEqual(root.layoutMode, 'VERTICAL');
  assert.strictEqual(root.children[1].characters, 'The Autonomous Design Fabric');
  assert.strictEqual(root.children[3].name, 'CTA Button Row');
});

test('CanvasController createDesignSystemScaffold builds complete token swatches artboard', async () => {
  const bridge = new MockBridge();
  const canvas = new CanvasController(bridge);

  await canvas.createDesignSystemScaffold({
    brandName: 'Quantum UI',
    primaryColor: '#6366F1',
  });

  assert.strictEqual(bridge.commands.length, 1);
  const artboard = bridge.commands[0].payload.nodes[0];
  assert.strictEqual(artboard.name, 'Design System / Quantum UI');
  assert.strictEqual(artboard.children.length, 2); // Title block + Color Palette Section
  const palette = artboard.children[1];
  assert.strictEqual(palette.children.length, 7); // 7 Swatch cards
});

test('FigmaPluginBridge buffers commands in offline queue when disconnected and flushes upon connection', async () => {
  const bridge = new FigmaPluginBridge(3899);

  // Send command while disconnected -> should be queued in offlineQueue
  let resolved = false;
  const sendPromise = bridge.sendCommand('CREATE_FRAME', { name: 'Deferred Frame' });

  assert.strictEqual(bridge.offlineQueue.length, 1);
  assert.strictEqual(bridge.offlineQueue[0].command, 'CREATE_FRAME');

  // Simulate mock socket connection
  const mockSocket = {
    readyState: 1,
    sent: [],
    send(str) {
      this.sent.push(JSON.parse(str));
    },
  };

  bridge.pluginSocket = mockSocket;
  bridge.flushOfflineQueue();

  assert.strictEqual(mockSocket.sent.length, 1);
  assert.strictEqual(mockSocket.sent[0].command, 'CREATE_FRAME');
  assert.strictEqual(mockSocket.sent[0].payload.name, 'Deferred Frame');
  assert.strictEqual(bridge.offlineQueue.length, 0);

  // Simulate plugin replying with success
  const pending = bridge.pendingRequests.get(1);
  if (pending) {
    pending.resolve({ success: true, nodeId: 'deferred_node_1' });
  }

  const result = await sendPromise;
  assert.strictEqual(result.supported, true);
  assert.strictEqual(result.nodeId, 'deferred_node_1');

  bridge.stop();
});
