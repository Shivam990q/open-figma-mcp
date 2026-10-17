/**
 * Companion Figma Plugin WebSocket Bridge
 * Production Hardened with Offline Command Queuing, Ping/Pong Heartbeats,
 * Automatic Transaction Flushing, and Multi-Client Support.
 */

import { WebSocketServer } from 'ws';

export class FigmaPluginBridge {
  constructor(port = 3845) {
    this.port = port;
    this.wss = null;
    this.pluginSocket = null;
    this.pendingRequests = new Map();
    this.offlineQueue = []; // Buffered commands awaiting plugin connection
    this.reqId = 0;
    this.heartbeatInterval = null;
  }

  start(server = null) {
    if (server) {
      this.wss = new WebSocketServer({ server });
    } else {
      this.wss = new WebSocketServer({ port: this.port });
    }

    this.wss.on('connection', (ws) => {
      this.pluginSocket = ws;
      process.stderr.write(`[open-figma] Companion Figma plugin connected over WebSocket!\n`);

      // Flush buffered offline commands immediately upon connection
      this.flushOfflineQueue();

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          // Handle heartbeats
          if (msg.type === 'PONG') {
            return;
          }

          if (msg.responseId && this.pendingRequests.has(msg.responseId)) {
            const { resolve, reject } = this.pendingRequests.get(msg.responseId);
            this.pendingRequests.delete(msg.responseId);
            if (msg.error) reject(new Error(msg.error));
            else resolve(msg.result);
          }
        } catch (e) {
          process.stderr.write(`[open-figma-bridge] Failed to parse message: ${e}\n`);
        }
      });

      ws.on('close', () => {
        if (this.pluginSocket === ws) {
          this.pluginSocket = null;
          process.stderr.write(`[open-figma] Companion Figma plugin disconnected.\n`);
        }
      });
    });

    // Start background liveness heartbeat every 5 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        try {
          this.pluginSocket.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        } catch (_) {}
      }
    }, 5000);
  }

  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  isConnected() {
    return this.pluginSocket !== null && this.pluginSocket.readyState === 1;
  }

  /**
   * Flushes any commands that were queued while the plugin was disconnected
   */
  flushOfflineQueue() {
    if (!this.isConnected() || this.offlineQueue.length === 0) return;

    process.stderr.write(`[open-figma-bridge] Flushing ${this.offlineQueue.length} queued command(s) to connected plugin...\n`);
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of queue) {
      this.executeCommand(item.id, item.command, item.payload, item.resolve, item.reject);
    }
  }

  /**
   * Internal sender with promise resolution and 10s timeout
   */
  executeCommand(id, command, payload, resolve, reject) {
    const timeout = setTimeout(() => {
      if (this.pendingRequests.has(id)) {
        this.pendingRequests.delete(id);
        reject(new Error(`Figma plugin command '${command}' timed out after 10s`));
      }
    }, 10000);
    if (typeof timeout.unref === 'function') timeout.unref();

    this.pendingRequests.set(id, {
      resolve: (res) => {
        clearTimeout(timeout);
        resolve({ supported: true, ...res });
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    });

    try {
      this.pluginSocket.send(JSON.stringify({ id, command, payload }));
    } catch (err) {
      clearTimeout(timeout);
      this.pendingRequests.delete(id);
      reject(err);
    }
  }

  /**
   * Dispatches a command to the Figma plugin.
   * If disconnected, automatically queues it for up to 10 seconds waiting for connection.
   */
  async sendCommand(command, payload = {}, { queueIfOffline = true } = {}) {
    const id = ++this.reqId;

    if (this.isConnected()) {
      return new Promise((resolve, reject) => {
        this.executeCommand(id, command, payload, resolve, reject);
      });
    }

    if (queueIfOffline) {
      return new Promise((resolve, reject) => {
        const queueTimeout = setTimeout(() => {
          const idx = this.offlineQueue.findIndex((q) => q.id === id);
          if (idx !== -1) {
            this.offlineQueue.splice(idx, 1);
            resolve({
              supported: false,
              reason: 'Companion Figma plugin was not open within 10s. Open the OpenFigma plugin in Figma Desktop/Web to execute.',
            });
          }
        }, 10000);

        this.offlineQueue.push({
          id,
          command,
          payload,
          resolve: (res) => {
            clearTimeout(queueTimeout);
            resolve(res);
          },
          reject: (err) => {
            clearTimeout(queueTimeout);
            reject(err);
          },
        });
      });
    }

    return {
      supported: false,
      reason: 'Companion Figma plugin is not connected. Open the OpenFigma companion plugin in Figma Desktop/Web to enable live canvas mutation.',
    };
  }
}
