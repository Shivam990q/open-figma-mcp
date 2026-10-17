/**
 * Scenegraph pruning and globalVars deduplication engine
 */

import YAML from 'yaml';
import fs from 'node:fs';

export function parseFigmaUrl(urlOrKey) {
  if (!urlOrKey.startsWith('http://') && !urlOrKey.startsWith('https://')) {
    return { fileKey: urlOrKey, nodeId: null };
  }

  const parsed = new URL(urlOrKey);
  const segments = parsed.pathname.split('/').filter(Boolean);

  let fileKey = null;
  if (segments.length >= 2 && (segments[0] === 'design' || segments[0] === 'file')) {
    fileKey = segments[1];
  } else {
    throw new Error('URL path must contain /design/:fileKey or /file/:fileKey');
  }

  const rawNodeId = parsed.searchParams.get('node-id');
  const nodeId = rawNodeId ? rawNodeId.replace(/-/g, ':') : null;

  return { fileKey, nodeId };
}

export function rgbaToHex(r, g, b, a = 1) {
  const toHex = (n) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0').toUpperCase();
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return Math.abs(a - 1) < 0.001 ? hex : `${hex}${toHex(a)}`;
}

export class ScenegraphReducer {
  constructor(options = {}) {
    this.maxDepth = options.depth ?? Infinity;
    this.symbolTable = {
      colors: {},       // "#3B82F6" -> "$C1"
      colorDefs: {},    // "$C1" -> "#3B82F6"
      radii: {},        // "8" -> "$R1"
      radiusDefs: {},   // "$R1" -> 8
      shadows: {},      // CSS string -> "$S1"
      shadowDefs: {},   // "$S1" -> CSS string
      colorCounter: 0,
      radiusCounter: 0,
      shadowCounter: 0,
    };
  }

  registerColor(hex) {
    const norm = hex.toUpperCase();
    if (this.symbolTable.colors[norm]) {
      return this.symbolTable.colors[norm];
    }
    this.symbolTable.colorCounter++;
    const sym = `$C${this.symbolTable.colorCounter}`;
    this.symbolTable.colors[norm] = sym;
    this.symbolTable.colorDefs[sym] = norm;
    return sym;
  }

  registerRadius(r) {
    const key = String(r);
    if (this.symbolTable.radii[key]) {
      return this.symbolTable.radii[key];
    }
    this.symbolTable.radiusCounter++;
    const sym = `$R${this.symbolTable.radiusCounter}`;
    this.symbolTable.radii[key] = sym;
    this.symbolTable.radiusDefs[sym] = r;
    return sym;
  }

  reduceNode(node, currentDepth = 0) {
    if (!node || node.visible === false || currentDepth > this.maxDepth) {
      return null;
    }

    const reduced = {
      id: node.id,
      name: node.name,
      type: node.type,
    };

    // Autolayout
    if (node.layoutMode && node.layoutMode !== 'NONE') {
      reduced.layout = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
      if (node.itemSpacing) reduced.gap = node.itemSpacing;
      if (node.paddingTop || node.paddingLeft) {
        reduced.padding = [
          node.paddingTop || 0,
          node.paddingRight || 0,
          node.paddingBottom || 0,
          node.paddingLeft || 0,
        ];
      }
    }

    // Fills
    if (Array.isArray(node.fills)) {
      const solidFill = node.fills.find((f) => f.type === 'SOLID' && f.visible !== false);
      if (solidFill && solidFill.color) {
        const hex = rgbaToHex(solidFill.color.r, solidFill.color.g, solidFill.color.b, solidFill.opacity ?? 1);
        reduced.fill = this.registerColor(hex);
      }
    }

    // Corner Radius
    if (node.cornerRadius) {
      reduced.radius = this.registerRadius(node.cornerRadius);
    }

    // Text content
    if (node.characters) {
      reduced.text = node.characters;
      if (node.style) {
        reduced.typography = `${node.style.fontFamily || 'Inter'} ${node.style.fontWeight || 400} ${node.style.fontSize || 14}px`;
      }
    }

    // Bounds
    if (node.absoluteBoundingBox) {
      reduced.bbox = [
        Math.round(node.absoluteBoundingBox.x),
        Math.round(node.absoluteBoundingBox.y),
        Math.round(node.absoluteBoundingBox.width),
        Math.round(node.absoluteBoundingBox.height),
      ];
    }

    // Children
    if (Array.isArray(node.children)) {
      const children = [];
      for (const child of node.children) {
        const r = this.reduceNode(child, currentDepth + 1);
        if (r) children.push(r);
      }

      // Single-child transparent group collapsing
      if ((node.type === 'GROUP' || node.type === 'FRAME') && children.length === 1 && !reduced.fill && !reduced.padding) {
        return children[0];
      }

      if (children.length > 0) {
        reduced.children = children;
      }
    }

    return reduced;
  }
}

export async function fetchFigmaData(urlOrKey, apiKey, options = {}) {
  // Check if target is a local file on disk
  if (typeof urlOrKey === 'string' && fs.existsSync(urlOrKey)) {
    const rawContent = await fs.promises.readFile(urlOrKey, 'utf8');
    const json = JSON.parse(rawContent);

    // If it is already a pre-reduced CSM schema with globalVars and document
    if (json.globalVars && json.document) {
      if (options.format === 'json') {
        return JSON.stringify(json, null, 2);
      }
      return YAML.stringify(json);
    }

    const rawRoot = json.document || json.nodes?.[Object.keys(json.nodes || {})[0]]?.document || json;
    const reducer = new ScenegraphReducer(options);
    const document = reducer.reduceNode(rawRoot);

    const result = {
      document,
      globalVars: {
        colors: reducer.symbolTable.colorDefs,
        radii: reducer.symbolTable.radiusDefs,
        shadows: reducer.symbolTable.shadowDefs,
      },
    };

    if (options.format === 'json') {
      return JSON.stringify(result, null, 2);
    }
    return YAML.stringify(result);
  }

  const { fileKey, nodeId } = parseFigmaUrl(urlOrKey);
  const endpoint = nodeId
    ? `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`
    : `https://api.figma.com/v1/files/${fileKey}`;

  const res = await fetch(endpoint, {
    headers: {
      'X-Figma-Token': apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Figma REST API returned status ${res.status}: ${text}`);
  }

  const json = await res.json();
  const rawRoot = nodeId ? json.nodes[nodeId]?.document : json.document;
  if (!rawRoot) {
    throw new Error(`Target node '${nodeId || 'document'}' was not returned by Figma API`);
  }

  const reducer = new ScenegraphReducer(options);
  const document = reducer.reduceNode(rawRoot);

  const result = {
    document,
    globalVars: {
      colors: reducer.symbolTable.colorDefs,
      radii: reducer.symbolTable.radiusDefs,
      shadows: reducer.symbolTable.shadowDefs,
    },
  };

  if (options.format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  return YAML.stringify(result);
}
