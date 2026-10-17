// OpenFigma Companion Plugin Canvas Controller v2.0
figma.showUI(__html__, { width: 340, height: 320, themeColors: true });

function normalizeColor(c) {
  if (!c) return { r: 0.2, g: 0.5, b: 0.96 };
  if (typeof c === 'string' && c.startsWith('#')) {
    const hex = c.replace('#', '');
    const num = parseInt(hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex, 16);
    return {
      r: ((num >> 16) & 255) / 255,
      g: ((num >> 8) & 255) / 255,
      b: (num & 255) / 255,
    };
  }
  if (typeof c === 'object' && c.r !== undefined) {
    return {
      r: c.r > 1 ? c.r / 255 : c.r,
      g: c.g > 1 ? c.g / 255 : c.g,
      b: c.b > 1 ? c.b / 255 : c.b,
    };
  }
  return { r: 0.2, g: 0.5, b: 0.96 };
}

async function safeLoadFont(family = 'Inter', weight = 400) {
  const style = weight >= 700 ? 'Bold' : weight >= 600 ? 'Semi Bold' : weight >= 500 ? 'Medium' : 'Regular';
  try {
    await figma.loadFontAsync({ family, style });
    return { family, style };
  } catch (_) {
    try {
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      return { family: 'Inter', style: 'Regular' };
    } catch (e) {
      console.warn('Font load fallback failed', e);
      return { family: 'Inter', style: 'Regular' };
    }
  }
}

figma.ui.onmessage = async (msg) => {
  const { id, command, payload } = msg;

  try {
    switch (command) {
      case 'CREATE_FRAME': {
        const frame = figma.createFrame();
        frame.name = payload.name || 'AI Generated Frame';
        frame.resize(payload.width || 300, payload.height || 200);

        if (payload.layoutMode === 'HORIZONTAL') {
          frame.layoutMode = 'HORIZONTAL';
        } else if (payload.layoutMode === 'VERTICAL') {
          frame.layoutMode = 'VERTICAL';
        }

        if (payload.cornerRadius) {
          frame.cornerRadius = payload.cornerRadius;
        }

        if (payload.fillColor) {
          const c = normalizeColor(payload.fillColor);
          frame.fills = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } }];
        }

        figma.currentPage.appendChild(frame);
        figma.currentPage.selection = [frame];
        figma.viewport.scrollAndZoomIntoView([frame]);

        figma.ui.postMessage({ responseId: id, result: { nodeId: frame.id, name: frame.name } });
        break;
      }

      case 'CREATE_RECTANGLE': {
        const rect = figma.createRectangle();
        rect.name = payload.name || 'Rectangle';
        rect.resize(payload.width || 100, payload.height || 100);

        if (payload.cornerRadius) {
          rect.cornerRadius = payload.cornerRadius;
        }

        if (payload.fillColor) {
          const c = normalizeColor(payload.fillColor);
          rect.fills = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } }];
        }

        figma.currentPage.appendChild(rect);
        figma.currentPage.selection = [rect];
        figma.viewport.scrollAndZoomIntoView([rect]);

        figma.ui.postMessage({ responseId: id, result: { nodeId: rect.id, name: rect.name } });
        break;
      }

      case 'CREATE_TEXT': {
        const fontName = await safeLoadFont('Inter', payload.fontWeight || 400);
        const textNode = figma.createText();
        textNode.fontName = fontName;
        textNode.characters = payload.text || 'Hello from AI';
        textNode.fontSize = payload.fontSize || 16;

        if (payload.fillColor) {
          const c = normalizeColor(payload.fillColor);
          textNode.fills = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } }];
        }

        figma.currentPage.appendChild(textNode);
        figma.currentPage.selection = [textNode];
        figma.viewport.scrollAndZoomIntoView([textNode]);

        figma.ui.postMessage({ responseId: id, result: { nodeId: textNode.id, text: textNode.characters } });
        break;
      }

      case 'SET_AUTO_LAYOUT': {
        const node = figma.getNodeById(payload.nodeId);
        if (!node || node.type !== 'FRAME') {
          throw new Error(`Frame node not found: ${payload.nodeId}`);
        }

        if (payload.layoutMode === 'HORIZONTAL') {
          node.layoutMode = 'HORIZONTAL';
        } else if (payload.layoutMode === 'VERTICAL') {
          node.layoutMode = 'VERTICAL';
        }

        if (payload.padding) {
          node.paddingTop = payload.padding.top || 0;
          node.paddingRight = payload.padding.right || 0;
          node.paddingBottom = payload.padding.bottom || 0;
          node.paddingLeft = payload.padding.left || 0;
        }

        if (payload.itemSpacing !== undefined) {
          node.itemSpacing = payload.itemSpacing;
        }

        figma.ui.postMessage({ responseId: id, result: { success: true, nodeId: node.id } });
        break;
      }

      case 'BATCH_CREATE': {
        const createdNodes = [];

        async function instantiateNode(spec, parent) {
          let node;
          if (spec.type === 'TEXT') {
            const fontName = await safeLoadFont('Inter', spec.style?.fontWeight || 400);
            node = figma.createText();
            node.fontName = fontName;
            node.characters = spec.characters || 'Text';
            node.fontSize = spec.style?.fontSize || 16;

            if (spec.fills && spec.fills.length > 0 && spec.fills[0].color) {
              const c = normalizeColor(spec.fills[0].color);
              node.fills = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } }];
            }
          } else {
            node = figma.createFrame();
            node.name = spec.name || 'Frame';
            const w = spec.bbox?.width || 320;
            const h = spec.bbox?.height || 48;
            node.resize(w, h);

            if (spec.layoutMode === 'HORIZONTAL') node.layoutMode = 'HORIZONTAL';
            if (spec.layoutMode === 'VERTICAL') node.layoutMode = 'VERTICAL';
            if (spec.cornerRadius) node.cornerRadius = spec.cornerRadius;

            if (spec.padding) {
              node.paddingTop = spec.padding.top || 0;
              node.paddingRight = spec.padding.right || 0;
              node.paddingBottom = spec.padding.bottom || 0;
              node.paddingLeft = spec.padding.left || 0;
            }
            if (spec.itemSpacing) node.itemSpacing = spec.itemSpacing;

            if (spec.fills && spec.fills.length > 0 && spec.fills[0].color) {
              const c = normalizeColor(spec.fills[0].color);
              node.fills = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } }];
            }

            if (spec.children) {
              for (const childSpec of spec.children) {
                await instantiateNode(childSpec, node);
              }
            }
          }

          if (parent) {
            parent.appendChild(node);
          } else {
            figma.currentPage.appendChild(node);
            createdNodes.push(node);
          }
          return node;
        }

        for (const rootSpec of payload.nodes || []) {
          await instantiateNode(rootSpec, null);
        }

        if (createdNodes.length > 0) {
          figma.currentPage.selection = createdNodes;
          figma.viewport.scrollAndZoomIntoView(createdNodes);
        }

        figma.ui.postMessage({
          responseId: id,
          result: { success: true, createdCount: createdNodes.length },
        });
        break;
      }

      case 'UPDATE_NODE': {
        const node = figma.getNodeById(payload.nodeId);
        if (!node) {
          throw new Error(`Node not found: ${payload.nodeId}`);
        }

        if (payload.properties.name) node.name = payload.properties.name;
        if (payload.properties.opacity !== undefined) node.opacity = payload.properties.opacity;

        figma.ui.postMessage({ responseId: id, result: { success: true, nodeId: node.id } });
        break;
      }

      case 'DELETE_NODE': {
        const node = figma.getNodeById(payload.nodeId);
        if (node) {
          node.remove();
          figma.ui.postMessage({ responseId: id, result: { success: true } });
        } else {
          throw new Error(`Node not found: ${payload.nodeId}`);
        }
        break;
      }

      case 'GET_SELECTION': {
        const selection = figma.currentPage.selection.map((n) => ({
          id: n.id,
          name: n.name,
          type: n.type,
          width: n.width,
          height: n.height,
        }));
        figma.ui.postMessage({ responseId: id, result: { selection } });
        break;
      }

      default:
        throw new Error(`Unknown plugin command: ${command}`);
    }
  } catch (err) {
    figma.ui.postMessage({ responseId: id, error: err.message });
  }
};
