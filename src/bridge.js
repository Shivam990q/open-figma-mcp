/**
 * WebSocket bridge between the OpenFigma MCP server and the OpenFigma Figma
 * plugin. This is what unlocks REAL canvas writes (create/edit frames,
 * components, variables, text, ...) — the one thing the public REST API can't
 * do. The plugin runs inside Figma (full Plugin API access) and connects here
 * over WebSocket; MCP tools send commands and await results.
 *
 * Architecture (same proven model as cursor-talk-to-figma / claude-talk-to-figma):
 *
 *   editor/agent ──MCP──► server ──WS(this bridge)──► Figma plugin (Plugin API)
 *                                ◄──────── result ───────────┘
 *
 * Single-process singleton: started once regardless of transport (stdio/HTTP),
 * so per-session MCP servers all share one bridge and one plugin connection.
 */

import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

let wss = null;
let pluginSocket = null;
let started = false;
let bridgePort = null;
const pending = new Map(); // requestId -> { resolve, reject, timer }

/** Reject (and clear) every in-flight request — used when the plugin drops. */
function rejectAllPending(reason) {
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
  }
  pending.clear();
}

/** Start the bridge once. Safe to call multiple times. */
export function startBridge(port = 3846) {
  if (started) return;
  started = true;
  bridgePort = port;
  try {
    wss = new WebSocketServer({ port, host: '127.0.0.1' });

    wss.on('connection', (socket) => {
      console.error('[Bridge] Figma plugin connected.');
      pluginSocket = socket;

      socket.on('message', (data) => {
        let msg;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          return;
        }
        if ((msg.type === 'result' || msg.type === 'error') && msg.id) {
          const p = pending.get(msg.id);
          if (p) {
            clearTimeout(p.timer);
            pending.delete(msg.id);
            if (msg.type === 'error') p.reject(new Error(msg.error || 'Figma plugin error'));
            else p.resolve(msg.result);
          }
        }
      });

      const onGone = (why) => {
        if (pluginSocket === socket) pluginSocket = null;
        rejectAllPending(why);
      };
      socket.on('close', () => {
        console.error('[Bridge] Figma plugin disconnected.');
        onGone('Figma plugin disconnected before responding.');
      });
      socket.on('error', () => onGone('Figma plugin socket error.'));

      try {
        socket.send(JSON.stringify({ type: 'welcome', server: 'open-figma-mcp' }));
      } catch {
        /* ignore */
      }
    });

    wss.on('listening', () => {
      console.error(`[Bridge] Listening on ws://127.0.0.1:${port} — open the OpenFigma plugin in Figma to enable canvas writes.`);
    });
    wss.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`[Bridge] Port ${port} already in use — another OpenFigma instance likely owns the bridge (that's fine; canvas writes route through it).`);
      } else {
        console.error(`[Bridge] WebSocket server error: ${err.message}`);
      }
    });
  } catch (err) {
    console.error('[Bridge] Failed to start:', err.message);
    started = false;
  }
}

/** Is the Figma plugin currently connected? */
export function isPluginConnected() {
  return !!pluginSocket && pluginSocket.readyState === 1;
}

export function getBridgePort() {
  return bridgePort;
}

/**
 * Send a command to the connected plugin and await its result.
 * Rejects with code 'PLUGIN_NOT_CONNECTED' when no plugin is connected.
 */
export function sendCommand(command, params = {}, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (!isPluginConnected()) {
      const err = new Error('PLUGIN_NOT_CONNECTED');
      err.code = 'PLUGIN_NOT_CONNECTED';
      reject(err);
      return;
    }
    const id = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for the Figma plugin to run "${command}".`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    try {
      pluginSocket.send(JSON.stringify({ id, type: 'command', command, params }));
    } catch (err) {
      clearTimeout(timer);
      pending.delete(id);
      reject(err);
    }
  });
}
