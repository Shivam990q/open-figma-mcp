/**
 * Canvas Mutation, Write Operations & High-Level Design Scaffolding Engine
 */
import { transpileCodeToNodes } from './transpiler.js';

export function parseColorToFigma(colorInput) {
  if (!colorInput) return { r: 0.2, g: 0.5, b: 0.96 };
  if (typeof colorInput === 'object' && colorInput.r !== undefined) {
    // If values are 0-255, normalize to 0-1
    return {
      r: colorInput.r > 1 ? colorInput.r / 255 : colorInput.r,
      g: colorInput.g > 1 ? colorInput.g / 255 : colorInput.g,
      b: colorInput.b > 1 ? colorInput.b / 255 : colorInput.b,
    };
  }
  if (typeof colorInput === 'string' && colorInput.startsWith('#')) {
    const hex = colorInput.replace('#', '');
    const num = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
    return {
      r: ((num >> 16) & 255) / 255,
      g: ((num >> 8) & 255) / 255,
      b: (num & 255) / 255,
    };
  }
  return { r: 0.2, g: 0.5, b: 0.96 };
}

export class CanvasController {
  constructor(bridge) {
    this.bridge = bridge;
  }

  async createFrame(options) {
    const payload = { ...options };
    if (payload.fillColor) payload.fillColor = parseColorToFigma(payload.fillColor);
    return this.bridge.sendCommand('CREATE_FRAME', payload);
  }

  async createRectangle(options) {
    const payload = { ...options };
    if (payload.fillColor) payload.fillColor = parseColorToFigma(payload.fillColor);
    return this.bridge.sendCommand('CREATE_RECTANGLE', payload);
  }

  async createText(options) {
    const payload = { ...options };
    if (payload.fillColor) payload.fillColor = parseColorToFigma(payload.fillColor);
    return this.bridge.sendCommand('CREATE_TEXT', payload);
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

  /**
   * Generates a modern responsive navigation bar directly on the canvas
   */
  async createNavbar(options = {}) {
    const brandName = options.brandName || 'Brand';
    const links = options.links || ['Features', 'Solutions', 'Pricing', 'Docs'];
    const ctaText = options.ctaText || 'Get Started';
    const isDark = options.theme === 'dark';

    const navbarNode = {
      name: `Navbar / ${brandName}`,
      type: 'FRAME',
      layoutMode: 'HORIZONTAL',
      itemSpacing: 24,
      padding: { top: 16, right: 32, bottom: 16, left: 32 },
      bbox: { width: 1200, height: 72 },
      cornerRadius: 16,
      fills: [{ color: parseColorToFigma(isDark ? '#0F172A' : '#FFFFFF') }],
      children: [
        {
          name: 'Brand Logo',
          type: 'TEXT',
          characters: brandName,
          style: { fontSize: 20, fontWeight: 700 },
          fills: [{ color: parseColorToFigma(isDark ? '#FFFFFF' : '#0F172A') }],
        },
        ...links.map((link) => ({
          name: `Nav Link / ${link}`,
          type: 'TEXT',
          characters: link,
          style: { fontSize: 14, fontWeight: 500 },
          fills: [{ color: parseColorToFigma(isDark ? '#94A3B8' : '#64748B') }],
        })),
        {
          name: 'CTA Button',
          type: 'FRAME',
          layoutMode: 'HORIZONTAL',
          padding: { top: 10, right: 20, bottom: 10, left: 20 },
          cornerRadius: 8,
          fills: [{ color: parseColorToFigma('#3B82F6') }],
          children: [
            {
              name: 'Button Label',
              type: 'TEXT',
              characters: ctaText,
              style: { fontSize: 14, fontWeight: 600 },
              fills: [{ color: parseColorToFigma('#FFFFFF') }],
            },
          ],
        },
      ],
    };

    return this.bridge.sendCommand('BATCH_CREATE', { nodes: [navbarNode] });
  }

  /**
   * Generates a modern Hero section directly on the canvas
   */
  async createHeroSection(options = {}) {
    const badge = options.badge || '✨ Introducing v2.0';
    const title = options.title || 'Build Beautiful Designs at Lightspeed';
    const subtitle = options.subtitle || 'The autonomous design engine powering AI pair programming and live canvas creation.';
    const primaryCta = options.primaryCta || 'Start Free Trial';
    const secondaryCta = options.secondaryCta || 'Read Documentation';
    const isDark = options.theme !== 'light';

    const heroNode = {
      name: 'Hero Section',
      type: 'FRAME',
      layoutMode: 'VERTICAL',
      itemSpacing: 24,
      padding: { top: 80, right: 64, bottom: 80, left: 64 },
      bbox: { width: 1200, height: 500 },
      cornerRadius: 24,
      fills: [{ color: parseColorToFigma(isDark ? '#0B0F19' : '#F8FAFC') }],
      children: [
        {
          name: 'Badge Pill',
          type: 'FRAME',
          layoutMode: 'HORIZONTAL',
          padding: { top: 6, right: 14, bottom: 6, left: 14 },
          cornerRadius: 9999,
          fills: [{ color: parseColorToFigma(isDark ? '#1E293B' : '#E2E8F0') }],
          children: [
            {
              name: 'Badge Text',
              type: 'TEXT',
              characters: badge,
              style: { fontSize: 13, fontWeight: 600 },
              fills: [{ color: parseColorToFigma('#38BDF8') }],
            },
          ],
        },
        {
          name: 'Hero Title',
          type: 'TEXT',
          characters: title,
          style: { fontSize: 44, fontWeight: 800 },
          fills: [{ color: parseColorToFigma(isDark ? '#FFFFFF' : '#0F172A') }],
        },
        {
          name: 'Hero Subtitle',
          type: 'TEXT',
          characters: subtitle,
          style: { fontSize: 18, fontWeight: 400 },
          fills: [{ color: parseColorToFigma(isDark ? '#94A3B8' : '#475569') }],
        },
        {
          name: 'CTA Button Row',
          type: 'FRAME',
          layoutMode: 'HORIZONTAL',
          itemSpacing: 16,
          children: [
            {
              name: 'Primary Button',
              type: 'FRAME',
              layoutMode: 'HORIZONTAL',
              padding: { top: 14, right: 28, bottom: 14, left: 28 },
              cornerRadius: 10,
              fills: [{ color: parseColorToFigma('#3B82F6') }],
              children: [
                {
                  name: 'Primary Label',
                  type: 'TEXT',
                  characters: primaryCta,
                  style: { fontSize: 16, fontWeight: 600 },
                  fills: [{ color: parseColorToFigma('#FFFFFF') }],
                },
              ],
            },
            {
              name: 'Secondary Button',
              type: 'FRAME',
              layoutMode: 'HORIZONTAL',
              padding: { top: 14, right: 28, bottom: 14, left: 28 },
              cornerRadius: 10,
              fills: [{ color: parseColorToFigma(isDark ? '#1E293B' : '#FFFFFF') }],
              children: [
                {
                  name: 'Secondary Label',
                  type: 'TEXT',
                  characters: secondaryCta,
                  style: { fontSize: 16, fontWeight: 600 },
                  fills: [{ color: parseColorToFigma(isDark ? '#FFFFFF' : '#0F172A') }],
                },
              ],
            },
          ],
        },
      ],
    };

    return this.bridge.sendCommand('BATCH_CREATE', { nodes: [heroNode] });
  }

  /**
   * Generates a complete Design System Artboard scaffold in Figma
   */
  async createDesignSystemScaffold(options = {}) {
    const brandName = options.brandName || 'Acme Design System';
    const primaryColor = options.primaryColor || '#3B82F6';

    const colors = [
      { name: 'Primary 500', hex: primaryColor },
      { name: 'Primary 700', hex: '#1D4ED8' },
      { name: 'Slate 900', hex: '#0F172A' },
      { name: 'Slate 500', hex: '#64748B' },
      { name: 'Slate 100', hex: '#F1F5F9' },
      { name: 'Emerald 500', hex: '#10B981' },
      { name: 'Rose 500', hex: '#F43F5E' },
    ];

    const swatches = colors.map((c) => ({
      name: `Swatch / ${c.name}`,
      type: 'FRAME',
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      padding: { top: 12, right: 12, bottom: 12, left: 12 },
      cornerRadius: 12,
      fills: [{ color: parseColorToFigma('#FFFFFF') }],
      children: [
        {
          name: 'Color Chip',
          type: 'FRAME',
          bbox: { width: 140, height: 80 },
          cornerRadius: 8,
          fills: [{ color: parseColorToFigma(c.hex) }],
        },
        {
          name: 'Color Name',
          type: 'TEXT',
          characters: c.name,
          style: { fontSize: 14, fontWeight: 600 },
          fills: [{ color: parseColorToFigma('#0F172A') }],
        },
        {
          name: 'Color Hex',
          type: 'TEXT',
          characters: c.hex,
          style: { fontSize: 12, fontWeight: 400 },
          fills: [{ color: parseColorToFigma('#64748B') }],
        },
      ],
    }));

    const artboard = {
      name: `Design System / ${brandName}`,
      type: 'FRAME',
      layoutMode: 'VERTICAL',
      itemSpacing: 32,
      padding: { top: 48, right: 48, bottom: 48, left: 48 },
      bbox: { width: 1300, height: 800 },
      cornerRadius: 24,
      fills: [{ color: parseColorToFigma('#F8FAFC') }],
      children: [
        {
          name: 'Title Block',
          type: 'TEXT',
          characters: `${brandName} — Foundation Token Library`,
          style: { fontSize: 32, fontWeight: 800 },
          fills: [{ color: parseColorToFigma('#0F172A') }],
        },
        {
          name: 'Color Palette Section',
          type: 'FRAME',
          layoutMode: 'HORIZONTAL',
          itemSpacing: 16,
          children: swatches,
        },
      ],
    };

    return this.bridge.sendCommand('BATCH_CREATE', { nodes: [artboard] });
  }
}
