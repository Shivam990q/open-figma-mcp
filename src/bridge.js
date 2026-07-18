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

import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const REPLACED_CLOSE_CODE = 4001;
const REPLACED_CLOSE_REASON = 'Replaced by a newer plugin connection';

let wss = null;
let pluginSocket = null;
let started = false;
let bridgePort = null;
const pending = new Map(); // requestId -> { resolve, reject, timer, socket }
const drainingSockets = new Set();

function hasPendingForSocket(socket) {
  for (const p of pending.values()) {
    if (p.socket === socket) return true;
  }
  return false;
}

/** Close a superseded plugin only after every command sent to it has settled. */
function closeIfDrained(socket) {
  if (!drainingSockets.has(socket) || hasPendingForSocket(socket)) return;
  drainingSockets.delete(socket);
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    try { socket.close(REPLACED_CLOSE_CODE, REPLACED_CLOSE_REASON); } catch { /* ignore */ }
  }
}

function drainAndReplace(socket) {
  drainingSockets.add(socket);
  closeIfDrained(socket);
}

/** Reject only requests that were actually sent through the given socket. */
function rejectPendingForSocket(socket, reason) {
  for (const [id, p] of pending) {
    if (p.socket !== socket) continue;
    clearTimeout(p.timer);
    pending.delete(id);
    p.reject(new Error(reason));
  }
  drainingSockets.delete(socket);
}

/** Reject (and clear) every in-flight request when the bridge itself fails. */
function rejectAllPending(reason) {
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
  }
  pending.clear();
  drainingSockets.clear();
}

/** Start the bridge once. Safe to call multiple times. */
export function startBridge(port = 3846) {
  if (started) return;
  started = true;
  bridgePort = port;
  try {
    wss = new WebSocketServer({ port, host: '127.0.0.1' });

    wss.on('connection', (socket) => {
      const previous = pluginSocket;
      pluginSocket = socket;
      if (previous && previous !== socket) {
        // Future commands use the new socket. The old one remains open only long
        // enough to return commands it already received, avoiding an error after
        // a canvas mutation may have completed.
        drainAndReplace(previous);
      }

      console.error('[Bridge] Figma plugin connected.');

      socket.on('message', (data) => {
        let msg;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          return;
        }
        if ((msg.type === 'result' || msg.type === 'error') && msg.id != null) {
          const p = pending.get(msg.id);
          // A result is accepted only from the socket that received the command.
          if (p && p.socket === socket) {
            clearTimeout(p.timer);
            pending.delete(msg.id);
            if (msg.type === 'error') p.reject(new Error(msg.error || 'Figma plugin error'));
            else p.resolve(msg.result);
          }
          closeIfDrained(socket);
        }
      });

      const onGone = (why) => {
        const wasActive = pluginSocket === socket;
        if (wasActive) pluginSocket = null;
        rejectPendingForSocket(socket, why);
        return wasActive;
      };
      socket.on('close', () => {
        if (onGone('Figma plugin disconnected before responding.')) {
          console.error('[Bridge] Figma plugin disconnected.');
        }
      });
      socket.on('error', (err) => {
        if (onGone('Figma plugin socket error.')) {
          console.error(`[Bridge] Figma plugin socket error: ${err.message}`);
        }
      });

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
        console.error(`[Bridge] Port ${port} is already in use. This process cannot accept a Figma plugin connection; stop the other process or choose a different --bridge-port.`);
      } else {
        console.error(`[Bridge] WebSocket server error: ${err.message}`);
      }
      pluginSocket = null;
      bridgePort = null;
      wss = null;
      started = false;
      rejectAllPending(`Figma plugin bridge failed: ${err.message}`);
    });
  } catch (err) {
    console.error('[Bridge] Failed to start:', err.message);
    bridgePort = null;
    wss = null;
    started = false;
  }
}

/** Is the Figma plugin currently connected? */
export function isPluginConnected() {
  return !!pluginSocket && pluginSocket.readyState === WebSocket.OPEN;
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
    const socket = pluginSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      const err = new Error('PLUGIN_NOT_CONNECTED');
      err.code = 'PLUGIN_NOT_CONNECTED';
      reject(err);
      return;
    }

    const id = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for the Figma plugin to run "${command}".`));
      closeIfDrained(socket);
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer, socket });

    try {
      socket.send(JSON.stringify({ id, type: 'command', command, params }), (err) => {
        if (!err) return;
        const p = pending.get(id);
        if (!p || p.socket !== socket) return;
        clearTimeout(p.timer);
        pending.delete(id);
        p.reject(err);
        closeIfDrained(socket);
      });
    } catch (err) {
      clearTimeout(timer);
      pending.delete(id);
      reject(err);
      closeIfDrained(socket);
    }
  });
}
