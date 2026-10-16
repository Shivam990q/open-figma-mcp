/**
 * Canvas mutation and write operations
 */
import { transpileCodeToNodes } from './transpiler.js';

export class CanvasController {
  constructor(bridge) {
    this.bridge = bridge;
  }

  async createFrame(options) {
    return this.bridge.sendCommand('CREATE_FRAME', options);
  }

  async createRectangle(options) {
    return this.bridge.sendCommand('CREATE_RECTANGLE', options);
  }

  async createText(options) {
    return this.bridge.sendCommand('CREATE_TEXT', options);
  }

  async setAutoLayout(nodeId, layoutOptions) {
    return this.bridge.sendCommand('SET_AUTO_LAYOUT', { nodeId, ...layoutOptions });
  }

  async batchCreate(nodes) {
    return this.bridge.sendCommand('BATCH_CREATE', { nodes });
  }

  async insertCode(code) {
    const { rootNodes } = transpileCodeToNodes(code);
    return this.bridge.sendCommand('BATCH_CREATE', { nodes: rootNodes });
  }

  async updateNode(nodeId, properties) {
    return this.bridge.sendCommand('UPDATE_NODE', { nodeId, properties });
  }

  async deleteNode(nodeId) {
    return this.bridge.sendCommand('DELETE_NODE', { nodeId });
  }

  async getSelection() {
    return this.bridge.sendCommand('GET_SELECTION', {});
  }
}
