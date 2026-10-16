/**
 * Canvas mutation and write operations
 */

export class CanvasController {
  constructor(bridge) {
    this.bridge = bridge;
  }

  async createFrame(options) {
    return this.bridge.sendCommand('CREATE_FRAME', options);
  }

  async createText(options) {
    return this.bridge.sendCommand('CREATE_TEXT', options);
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
