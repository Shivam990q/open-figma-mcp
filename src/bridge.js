/**
 * Companion Figma Plugin WebSocket Bridge
 */

import { WebSocketServer } from 'ws';

export class FigmaPluginBridge {
  constructor(port = 3845) {
    this.port = port;
    this.wss = null;
    this.pluginSocket = null;
    this.pendingRequests = new Map();
    this.reqId = 0;
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

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
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
  }

  isConnected() {
    return this.pluginSocket !== null && this.pluginSocket.readyState === 1;
  }

  async sendCommand(command, payload = {}) {
    if (!this.isConnected()) {
      return {
        supported: false,
        reason: 'Companion Figma plugin is not connected. Open the OpenFigma companion plugin in Figma Desktop/Web to enable live canvas mutation.',
      };
    }

    const id = ++this.reqId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Figma plugin command '${command}' timed out after 10s`));
        }
      }, 10000);

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

      this.pluginSocket.send(JSON.stringify({ id, command, payload }));
    });
  }
}
