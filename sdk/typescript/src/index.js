/**
 * @open-figma/sdk
 * Enterprise client SDK for OpenFigma MCP server
 */

export class OpenFigmaClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint || 'http://127.0.0.1:3845';
    this.apiKey = options.apiKey || process.env.FIGMA_API_KEY || '';
    this.requestId = 1;
  }

  async callMcp(method, params = {}) {
    const id = this.requestId++;
    const res = await fetch(`${this.endpoint}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Figma-Token': this.apiKey,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.error) {
      throw new Error(`MCP Error ${json.error.code}: ${json.error.message}`);
    }

    return json.result;
  }

  async callTool(name, args = {}) {
    const result = await this.callMcp('tools/call', {
      name,
      arguments: args,
    });

    if (result.isError) {
      throw new Error(result.content?.[0]?.text || `Failed executing tool ${name}`);
    }

    return result.content?.[0]?.text;
  }

  async listTools() {
    return await this.callMcp('tools/list');
  }

  async getFigmaData(url, format = 'yaml', depth = null) {
    return await this.callTool('get_figma_data', { url, format, depth });
  }

  async getDesignTokens(url, format = 'tailwind-v4') {
    return await this.callTool('get_design_tokens', { url, format });
  }

  async generateCode(url, framework = 'react-tailwind') {
    return await this.callTool('generate_code', { url, framework });
  }

  async renderSvg(url, dataUri = false) {
    return await this.callTool('render_svg', { url, data_uri: dataUri });
  }

  async getCodeConnect(url, scaffold = false) {
    return await this.callTool('get_code_connect', { url, scaffold });
  }

  async transpileCode(code) {
    const res = await this.callTool('transpile_code_to_canvas', { code });
    return JSON.parse(res);
  }

  async audit(url) {
    return await this.callTool('audit_accessibility_and_security', { url });
  }

  async createFrame(name, width = 400, height = 300, x = 0, y = 0, backgroundColor = '#FFFFFF') {
    const res = await this.callTool('canvas_create_frame', { name, width, height, x, y, background_color: backgroundColor });
    return JSON.parse(res);
  }

  async createText(text, fontSize = 16, x = 0, y = 0, color = '#000000') {
    const res = await this.callTool('canvas_create_text', { text, font_size: fontSize, x, y, color });
    return JSON.parse(res);
  }

  async createRectangle(width = 100, height = 100, x = 0, y = 0, fillColor = '#3B82F6', cornerRadius = 8) {
    const res = await this.callTool('canvas_create_rectangle', { width, height, x, y, fill_color: fillColor, corner_radius: cornerRadius });
    return JSON.parse(res);
  }

  async insertCode(code, x = 0, y = 0) {
    const res = await this.callTool('canvas_insert_code', { code, x, y });
    return JSON.parse(res);
  }

  async getCapabilities() {
    const res = await this.callTool('capabilities', {});
    return JSON.parse(res);
  }
}
