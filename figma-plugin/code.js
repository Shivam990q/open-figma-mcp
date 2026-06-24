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

    case 'set_stroke_color': {
      const n = await getNode(p.nodeId);
      const paint = solidPaint(p.color);
      if (!paint) throw new Error('Invalid color: ' + p.color);
      if (!('strokes' in n)) throw new Error('Node does not support strokes');
      n.strokes = [paint];
      if (p.strokeWeight != null && 'strokeWeight' in n) n.strokeWeight = p.strokeWeight;
      return serialize(n);
    }

    case 'set_opacity': {
      const n = await getNode(p.nodeId);
      if (!('opacity' in n)) throw new Error('Node does not support opacity');
      n.opacity = p.opacity;
      return serialize(n);
    }

    case 'add_drop_shadow': {
      const n = await getNode(p.nodeId);
      if (!('effects' in n)) throw new Error('Node does not support effects');
      const c = hexToRgba(p.color || '#00000040') || { r: 0, g: 0, b: 0, a: 0.25 };
      const shadow = {
        type: 'DROP_SHADOW',
        color: { r: c.r, g: c.g, b: c.b, a: c.a },
        offset: { x: p.offsetX || 0, y: p.offsetY != null ? p.offsetY : 4 },
        radius: p.radius != null ? p.radius : 8,
        spread: p.spread || 0,
        visible: true,
        blendMode: 'NORMAL'
      };
      n.effects = [...n.effects, shadow];
      return serialize(n);
    }

    case 'create_ellipse': {
      const e = figma.createEllipse();
      e.x = p.x || 0;
      e.y = p.y || 0;
      e.resize(p.width || 100, p.height || 100);
      if (p.name) e.name = p.name;
      const paint = p.fillColor ? solidPaint(p.fillColor) : null;
      if (paint) e.fills = [paint];
      await appendTo(e, p.parentId);
      return serialize(e);
    }

    case 'create_component_from_node': {
      const n = await getNode(p.nodeId);
      const comp = figma.createComponentFromNode(n);
      if (p.name) comp.name = p.name;
      return serialize(comp);
    }

    case 'create_instance': {
      const comp = await getNode(p.componentId);
      if (comp.type !== 'COMPONENT') throw new Error('Node ' + p.componentId + ' is not a COMPONENT');
      const inst = comp.createInstance();
      if (p.x != null) inst.x = p.x;
      if (p.y != null) inst.y = p.y;
      await appendTo(inst, p.parentId);
      return serialize(inst);
    }

    case 'set_auto_layout': {
      const n = await getNode(p.nodeId);
      if (!('layoutMode' in n)) throw new Error('Node does not support auto-layout');
      n.layoutMode = p.mode || 'VERTICAL';
      if (p.itemSpacing != null) n.itemSpacing = p.itemSpacing;
      if (p.padding != null) {
        n.paddingTop = n.paddingBottom = n.paddingLeft = n.paddingRight = p.padding;
      }
      if (p.primaryAxisAlignItems) n.primaryAxisAlignItems = p.primaryAxisAlignItems;
      if (p.counterAxisAlignItems) n.counterAxisAlignItems = p.counterAxisAlignItems;
      return serialize(n);
    }

    case 'group_nodes': {
      const ids = p.nodeIds || [];
      const nodes = [];
      for (const id of ids) nodes.push(await getNode(id));
      if (!nodes.length) throw new Error('No nodes to group');
      const group = figma.group(nodes, nodes[0].parent || figma.currentPage);
      if (p.name) group.name = p.name;
      return serialize(group);
    }

    case 'set_name': {
      const n = await getNode(p.nodeId);
      n.name = String(p.name == null ? '' : p.name);
      return serialize(n);
    }

    case 'get_node_info': {
      const n = await getNode(p.nodeId);
      const info = serialize(n);
      if ('children' in n) info.childCount = n.children.length;
      if ('fills' in n && Array.isArray(n.fills)) info.fillCount = n.fills.length;
      if ('layoutMode' in n) info.layoutMode = n.layoutMode;
      if ('cornerRadius' in n) info.cornerRadius = n.cornerRadius;
      return info;
    }

    case 'set_image_fill': {
      const n = await getNode(p.nodeId);
      if (!('fills' in n)) throw new Error('Node does not support fills');
      const image = await figma.createImageAsync(p.imageUrl);
      n.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: p.scaleMode || 'FILL' }];
      return serialize(n);
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
