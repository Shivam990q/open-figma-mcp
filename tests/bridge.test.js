/**
 * Bridge tests — the WebSocket bridge that powers canvas writes via the Figma
 * plugin. Uses a loopback WebSocket "mock plugin" to exercise the real protocol:
 * connect, round-trip, plugin error, and the disconnect-rejects-pending fix.
 */

import { WebSocket } from 'ws';
import { startBridge, sendCommand, isPluginConnected } from '../src/bridge.js';

const PORT = 38477;
let passed = 0;
let failed = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log('  FAIL: ' + msg); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('--- bridge: WebSocket plugin protocol ---');
  startBridge(PORT);
  await sleep(250);

  // 1. No plugin connected → sendCommand rejects fast with a typed code.
  ok(!isPluginConnected(), 'no plugin connected initially');
  try {
    await sendCommand('ping');
    ok(false, 'sendCommand should reject when no plugin connected');
  } catch (e) {
    ok(e.code === 'PLUGIN_NOT_CONNECTED', 'sendCommand rejects PLUGIN_NOT_CONNECTED when no plugin');
  }

  // Connect a mock plugin.
  const ws = new WebSocket('ws://127.0.0.1:' + PORT);
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const echoResponder = (d) => {
    const m = JSON.parse(d.toString());
    if (m.type === 'command' && m.command !== 'noreply') {
      ws.send(JSON.stringify({ type: 'result', id: m.id, result: { echoed: m.command, params: m.params } }));
    }
  };
  ws.on('message', echoResponder);
  await sleep(250);
  ok(isPluginConnected(), 'plugin shows connected after WS open');

  // 2. Command round-trips and returns the plugin's result.
  const r = await sendCommand('create_frame', { name: 'X' });
  ok(r && r.echoed === 'create_frame' && r.params.name === 'X', 'sendCommand round-trips the plugin result');

  // 3. Plugin error propagates as a rejection.
  ws.off('message', echoResponder);
  const errResponder = (d) => {
    const m = JSON.parse(d.toString());
    if (m.type === 'command') ws.send(JSON.stringify({ type: 'error', id: m.id, error: 'boom' }));
  };
  ws.on('message', errResponder);
  try {
    await sendCommand('set_text', {});
    ok(false, 'sendCommand should reject when the plugin returns an error');
  } catch (e) {
    ok(e.message === 'boom', 'plugin error message propagates');
  }

  // 4. Disconnect mid-flight rejects the pending request immediately (no 30s wait).
  ws.off('message', errResponder); // nobody answers 'noreply'
  const pendingPromise = sendCommand('noreply', {}, 5000);
  await sleep(120);
  ws.close();
  try {
    await pendingPromise;
    ok(false, 'pending command should reject on plugin disconnect');
  } catch (e) {
    ok(/disconnected/i.test(e.message), 'pending request rejected immediately on plugin disconnect');
  }
  await sleep(150);
  ok(!isPluginConnected(), 'not connected after socket close');

  console.log(`\nBridge tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('FAILURES:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
  console.log('All bridge tests passed.');
  process.exit(0);
}

main().catch((e) => { console.error('Bridge test crashed:', e); process.exit(1); });
