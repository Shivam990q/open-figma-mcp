// OpenFigma Companion Plugin Canvas Controller
figma.showUI(__html__, { width: 320, height: 280, themeColors: true });

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

        if (payload.fillColor) {
          const c = payload.fillColor;
          frame.fills = [{ type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } }];
        }

        figma.currentPage.appendChild(frame);
        figma.currentPage.selection = [frame];
        figma.viewport.scrollAndZoomIntoView([frame]);

        figma.ui.postMessage({ responseId: id, result: { nodeId: frame.id, name: frame.name } });
        break;
      }

      case 'CREATE_TEXT': {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        const textNode = figma.createText();
        textNode.characters = payload.text || 'Hello from AI';
        textNode.fontSize = payload.fontSize || 16;

        figma.currentPage.appendChild(textNode);
        figma.currentPage.selection = [textNode];
        figma.viewport.scrollAndZoomIntoView([textNode]);

        figma.ui.postMessage({ responseId: id, result: { nodeId: textNode.id, text: textNode.characters } });
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
