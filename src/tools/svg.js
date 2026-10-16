/**
 * Pure SVG Vector Generator for OpenFigma
 */

export function renderSvg(node) {
  const width = node.bbox?.width || 800;
  const height = node.bbox?.height || 600;

  const defs = [];
  const elements = [];

  renderNodeToSvg(node, 0, 0, defs, elements);

  const defsBlock = defs.length > 0 ? `  <defs>\n${defs.join('\n')}\n  </defs>\n` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
${defsBlock}${elements.join('\n')}
</svg>`;
}

export function renderSvgDataUri(node) {
  const svg = renderSvg(node);
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

function renderNodeToSvg(node, offsetX, offsetY, defs, elements) {
  if (node.visible === false) return;

  const x = (node.bbox?.x || 0) + offsetX;
  const y = (node.bbox?.y || 0) + offsetY;
  const w = node.bbox?.width || 0;
  const h = node.bbox?.height || 0;

  const fillAttr = resolveFill(node, defs);
  const strokeAttr = resolveStroke(node);
  const rxAttr = node.cornerRadius ? ` rx="${node.cornerRadius}"` : '';
  const opacityAttr = node.opacity != null ? ` opacity="${node.opacity.toFixed(2)}"` : '';

  if (node.type === 'TEXT') {
    if (node.characters) {
      const fontSize = node.style?.fontSize || 16;
      const fontWeight = node.style?.fontWeight || 400;
      const fontFamily = node.style?.fontFamily || 'Inter, system-ui, sans-serif';
      const fill = node.fills?.[0]?.color ? colorToHex(node.fills[0].color) : '#000000';
      const baselineY = y + fontSize;

      elements.push(
        `  <text x="${x.toFixed(1)}" y="${baselineY.toFixed(1)}" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}"${opacityAttr}>${escapeXml(node.characters)}</text>`
      );
    }
    return;
  }

  if (node.type === 'ELLIPSE') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = w / 2;
    elements.push(
      `  <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"${fillAttr}${strokeAttr}${opacityAttr} id="${escapeXml(node.id || '')}" />`
    );
    return;
  }

  // Frames, Rectangles, Groups
  const hasVisuals = (node.fills && node.fills.length > 0) || (node.strokes && node.strokes.length > 0);
  if (hasVisuals && w > 0 && h > 0) {
    elements.push(
      `  <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${rxAttr}${fillAttr}${strokeAttr}${opacityAttr} id="${escapeXml(node.id || '')}" />`
    );
  }

  if (node.children) {
    for (const child of node.children) {
      renderNodeToSvg(child, offsetX, offsetY, defs, elements);
    }
  }
}

function resolveFill(node, defs) {
  if (!node.fills || node.fills.length === 0) {
    return node.type === 'TEXT' ? ' fill="#000000"' : ' fill="none"';
  }

  const fill = node.fills[0];
  if (fill.type === 'SOLID' && fill.color) {
    return ` fill="${colorToHex(fill.color)}"`;
  }

  return ' fill="none"';
}

function resolveStroke(node) {
  if (!node.strokes || node.strokes.length === 0) return '';
  const stroke = node.strokes[0];
  if (stroke.color) {
    const sw = node.strokeWeight || 1;
    return ` stroke="${colorToHex(stroke.color)}" stroke-width="${sw}"`;
  }
  return '';
}

function colorToHex(c) {
  const r = Math.round((c.r || 0) * 255).toString(16).padStart(2, '0');
  const g = Math.round((c.g || 0) * 255).toString(16).padStart(2, '0');
  const b = Math.round((c.b || 0) * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
