/**
 * Inline-SVG vector/icon extraction.
 *
 * Every other Figma MCP treats icons as opaque PNG/SVG downloads. OpenFigma
 * reconstructs real inline <svg> markup from the JSON path geometry
 * (fillGeometry/strokeGeometry returned by &geometry=paths). Inline SVG is what
 * frontend devs actually want: themeable via currentColor, no extra HTTP
 * request, and no agent inventing a `lucide-react` import for an icon that
 * doesn't exist in the design.
 */

import { figmaColorToHex } from './simplify.js';

const VECTOR_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'REGULAR_POLYGON', 'ELLIPSE']);

function firstSolidHex(paints) {
  for (const p of paints || []) {
    if (p && p.visible !== false && p.type === 'SOLID' && p.color) return figmaColorToHex(p.color, p.opacity);
  }
  return null;
}

const round = (n) => Math.round((n || 0) * 100) / 100;
const wind = (w) => (w === 'EVENODD' ? 'evenodd' : 'nonzero');

/** Build an inline <svg> string for one vector-bearing node. */
export function nodeToSvg(node, opts = {}) {
  const fillGeo = node.fillGeometry || [];
  const strokeGeo = node.strokeGeometry || [];
  if (!fillGeo.length && !strokeGeo.length) return null;

  const box = node.absoluteBoundingBox || node.size || {};
  const w = round(box.width || node.size?.x || 24);
  const h = round(box.height || node.size?.y || 24);

  // currentColor by default (themeable); pass useDesignColor to bake the fill.
  const fillColor = opts.useDesignColor ? (firstSolidHex(node.fills) || 'currentColor') : 'currentColor';
  const strokeColor = opts.useDesignColor ? (firstSolidHex(node.strokes) || 'currentColor') : 'currentColor';
  const strokeW = node.strokeWeight ? round(node.strokeWeight) : 1;

  const paths = [];
  for (const g of fillGeo) {
    if (g.path) paths.push(`  <path d="${g.path}" fill-rule="${wind(g.windingRule)}" fill="${fillColor}"/>`);
  }
  for (const g of strokeGeo) {
    if (g.path) paths.push(`  <path d="${g.path}" fill="none" stroke="${strokeColor}" stroke-width="${strokeW}"/>`);
  }
  if (!paths.length) return null;

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">\n${paths.join('\n')}\n</svg>`;
}

function collect(node, out, opts) {
  if (!node) return;
  if (VECTOR_TYPES.has(node.type) || node.fillGeometry || node.strokeGeometry) {
    const svg = nodeToSvg(node, opts);
    if (svg) out.push({ id: node.id, name: node.name || node.type, svg });
  }
  (node.children || []).forEach((c) => collect(c, out, opts));
}

/**
 * Extract every vector/icon under the requested nodes as inline SVG.
 *
 * @param {object} geometryResponse raw /nodes?geometry=paths response
 * @param {object} [opts]
 * @param {boolean} [opts.useDesignColor=false] bake design colors instead of currentColor
 */
export function extractVectors(geometryResponse, opts = {}) {
  const icons = [];
  const roots = [];
  if (geometryResponse?.nodes) Object.values(geometryResponse.nodes).forEach((n) => n?.document && roots.push(n.document));
  else if (geometryResponse?.document) roots.push(geometryResponse.document);
  roots.forEach((r) => collect(r, icons, opts));

  // De-duplicate identical SVGs (same icon reused) by markup.
  const seen = new Map();
  for (const icon of icons) {
    if (!seen.has(icon.svg)) seen.set(icon.svg, icon);
  }
  return { count: seen.size, icons: [...seen.values()] };
}
