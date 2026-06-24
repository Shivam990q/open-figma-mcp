/**
 * OpenFigma Bridge — plugin main thread (Figma Plugin API).
 *
 * Receives commands relayed from ui.html (which holds the WebSocket to the
 * OpenFigma MCP bridge) and executes them with full canvas read/write access,
 * then posts the result back to the UI to return over the socket.
 */

figma.showUI(__html__, { width: 340, height: 260, title: 'OpenFigma Bridge' });

function hexToRgba(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  let a = 1;
  if (h.length === 8) { a = parseInt(h.slice(6, 8), 16) / 255; h = h.slice(0, 6); }
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
    a
  };
}

function solidPaint(hex) {
  const c = hexToRgba(hex);
  if (!c) return null;
  return { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a };
}

function serialize(node) {
  const o = { id: node.id, name: node.name, type: node.type };
  if ('x' in node) { o.x = Math.round(node.x); o.y = Math.round(node.y); }
  if ('width' in node) { o.width = Math.round(node.width); o.height = Math.round(node.height); }
  if ('characters' in node) o.text = node.characters;
  return o;
}

async function getNode(id) {
  const n = await figma.getNodeByIdAsync(id);
  if (!n) throw new Error('Node not found: ' + id);
  return n;
}

async function appendTo(node, parentId) {
  if (parentId) {
    const parent = await figma.getNodeByIdAsync(parentId);
    if (parent && 'appendChild' in parent) {
      parent.appendChild(node);
      return;
    }
  }
  figma.currentPage.appendChild(node);
}

async function handle(command, p) {
  p = p || {};
  switch (command) {
    case 'get_document_info':
      return {
        name: figma.root.name,
        currentPage: figma.currentPage.name,
        pageId: figma.currentPage.id,
        selectionCount: figma.currentPage.selection.length
      };

    case 'get_selection':
      return { selection: figma.currentPage.selection.map(serialize) };

    case 'create_frame': {
      const f = figma.createFrame();
      f.x = p.x || 0;
      f.y = p.y || 0;
      f.resize(p.width || 400, p.height || 300);
      if (p.name) f.name = p.name;
      const paint = p.fillColor ? solidPaint(p.fillColor) : null;
      if (paint) f.fills = [paint];
      if (p.layoutMode && p.layoutMode !== 'NONE') {
        f.layoutMode = p.layoutMode;
        if (p.itemSpacing != null) f.itemSpacing = p.itemSpacing;
        if (p.padding != null) {
          f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = p.padding;
        }
      }
      await appendTo(f, p.parentId);
      return serialize(f);
    }

    case 'create_rectangle': {
      const r = figma.createRectangle();
      r.x = p.x || 0;
      r.y = p.y || 0;
      r.resize(p.width || 100, p.height || 100);
      if (p.name) r.name = p.name;
      const paint = p.fillColor ? solidPaint(p.fillColor) : null;
      if (paint) r.fills = [paint];
      if (p.cornerRadius != null) r.cornerRadius = p.cornerRadius;
      await appendTo(r, p.parentId);
      return serialize(r);
    }

    case 'create_text': {
      const family = 'Inter';
      const style = p.fontWeight && p.fontWeight >= 700 ? 'Bold' : 'Regular';
      try {
        await figma.loadFontAsync({ family, style });
      } catch (e) {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      }
      const t = figma.createText();
      t.fontName = { family, style };
      t.characters = String(p.text == null ? '' : p.text);
      if (p.fontSize) t.fontSize = p.fontSize;
      t.x = p.x || 0;
      t.y = p.y || 0;
      if (p.name) t.name = p.name;
      const paint = p.color ? solidPaint(p.color) : null;
      if (paint) t.fills = [paint];
      await appendTo(t, p.parentId);
      return serialize(t);
    }

    case 'set_fill_color': {
      const n = await getNode(p.nodeId);
      const paint = solidPaint(p.color);
      if (!paint) throw new Error('Invalid color: ' + p.color);
      if (!('fills' in n)) throw new Error('Node does not support fills');
      n.fills = [paint];
      return serialize(n);
    }

    case 'set_corner_radius': {
      const n = await getNode(p.nodeId);
      if (!('cornerRadius' in n)) throw new Error('Node does not support cornerRadius');
      n.cornerRadius = p.radius;
      return serialize(n);
    }

    case 'set_text': {
      const n = await getNode(p.nodeId);
      if (n.type !== 'TEXT') throw new Error('Node is not a text node');
      try { await figma.loadFontAsync(n.fontName); } catch (e) { await figma.loadFontAsync({ family: 'Inter', style: 'Regular' }); }
      n.characters = String(p.text == null ? '' : p.text);
      return serialize(n);
    }

    case 'move_node': {
      const n = await getNode(p.nodeId);
      n.x = p.x;
      n.y = p.y;
      return serialize(n);
    }

    case 'resize_node': {
      const n = await getNode(p.nodeId);
      if (!('resize' in n)) throw new Error('Node cannot be resized');
      n.resize(p.width, p.height);
      return serialize(n);
    }

    case 'clone_node': {
      const n = await getNode(p.nodeId);
      const c = n.clone();
      if (p.x != null) c.x = p.x;
      if (p.y != null) c.y = p.y;
      return serialize(c);
    }

    case 'delete_node': {
      const n = await getNode(p.nodeId);
      const id = n.id;
      n.remove();
      return { deleted: id };
    }

    default:
      throw new Error('Unknown command: ' + command);
  }
}

figma.ui.onmessage = async (msg) => {
  if (!msg || !msg.command) return;
  const { id, command, params } = msg;
  try {
    const result = await handle(command, params);
    figma.ui.postMessage({ id, ok: true, result });
  } catch (e) {
    figma.ui.postMessage({ id, ok: false, error: (e && e.message) || String(e) });
  }
};
