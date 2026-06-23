/**
 * Accessibility (WCAG) audit of a Figma design.
 *
 * No other Figma MCP audits designs for accessibility. This walks the tree,
 * computes the WCAG 2.1 contrast ratio for every text layer against its
 * effective background (resolved by inheriting the nearest ancestor fill, with
 * alpha compositing), and flags AA/AAA pass/fail. It also flags likely-tappable
 * elements smaller than the WCAG 2.5.5 target size.
 *
 * Lets an agent catch contrast/target failures BEFORE writing code.
 */

import { figmaColorToHex } from './simplify.js';

// ---------------------------------------------------------------------------
// Color math
// ---------------------------------------------------------------------------

function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex || '');
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const a = m[2] === undefined ? 1 : parseInt(m[2], 16) / 255;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255, a };
}

/** Composite a (possibly translucent) foreground hex over an opaque bg hex. */
function composite(fgHex, bgHex) {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex) || { r: 255, g: 255, b: 255, a: 1 };
  if (!fg) return bgHex;
  const a = fg.a;
  const r = Math.round(fg.r * a + bg.r * (1 - a));
  const g = Math.round(fg.g * a + bg.g * (1 - a));
  const b = Math.round(fg.b * a + bg.b * (1 - a));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function relLuminance(hex) {
  const c = parseHex(hex);
  if (!c) return 0;
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG contrast ratio (1..21) between two opaque colors. */
export function contrastRatio(fgHex, bgHex) {
  const l1 = relLuminance(fgHex);
  const l2 = relLuminance(bgHex);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Math.round(ratio * 100) / 100;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstSolid(paints) {
  for (const p of paints || []) {
    if (p && p.visible !== false && p.type === 'SOLID' && p.color) {
      return figmaColorToHex(p.color, p.opacity);
    }
  }
  return null;
}

function isLargeText(style) {
  if (!style) return false;
  const size = style.fontSize || 0;
  const bold = (style.fontWeight || 400) >= 700;
  // WCAG: large = >=18pt (24px) or >=14pt (18.66px) bold.
  return size >= 24 || (bold && size >= 18.66);
}

const TAPPABLE = /\b(button|btn|cta|link|tab|toggle|checkbox|radio|chip|icon[-\s]?button|fab)\b/i;

// ---------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------

// Node types that paint a surface text can sit on (NOT text/vector/line).
const SURFACE = new Set(['FRAME', 'RECTANGLE', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'GROUP', 'SECTION', 'ELLIPSE']);

function walk(node, inheritedBg, findings) {
  if (!node || node.visible === false) return;

  // Update the running background only for surface nodes — never for a TEXT node
  // (whose own fill is the text color, not a background).
  let bg = inheritedBg;
  if (SURFACE.has(node.type)) {
    const ownFill = firstSolid(node.fills) || firstSolid(node.background);
    if (ownFill) {
      const parsed = parseHex(ownFill);
      if (parsed && parsed.a >= 0.5) bg = composite(ownFill, inheritedBg);
    }
  }

  // Contrast check for text nodes — against the inherited (ancestor) surface.
  if (node.type === 'TEXT') {
    const textColor = firstSolid(node.fills);
    if (textColor) {
      const fg = composite(textColor, inheritedBg);
      const ratio = contrastRatio(fg, inheritedBg);
      const large = isLargeText(node.style);
      const aaReq = large ? 3.0 : 4.5;
      const aaaReq = large ? 4.5 : 7.0;
      const passes = ratio >= aaReq ? (ratio >= aaaReq ? 'AAA' : 'AA') : 'fail';
      findings.contrast.push({
        nodeId: node.id,
        name: node.name,
        text: typeof node.characters === 'string' ? node.characters.slice(0, 40) : undefined,
        fontSize: node.style?.fontSize,
        large,
        textColor: fg,
        bgColor: bg,
        ratio,
        required: aaReq,
        level: passes,
      });
    }
  }

  // Tappable target size check.
  if (TAPPABLE.test(node.name || '') && node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox;
    if (width > 0 && height > 0 && (width < 24 || height < 24)) {
      findings.targets.push({
        nodeId: node.id,
        name: node.name,
        width: Math.round(width),
        height: Math.round(height),
        required: 24,
      });
    }
  }

  (node.children || []).forEach((c) => walk(c, bg, findings));
}

/**
 * Audit a Figma file/nodes response for accessibility issues.
 *
 * @param {object} fileData raw Figma response (file or nodes endpoint)
 * @param {object} [opts]
 * @param {string} [opts.pageBackground='#ffffff'] assumed root background
 */
export function auditAccessibility(fileData, opts = {}) {
  const findings = { contrast: [], targets: [] };
  const roots = [];
  if (fileData?.document) roots.push(fileData.document);
  if (fileData?.nodes) Object.values(fileData.nodes).forEach((n) => n?.document && roots.push(n.document));

  const pageBg = opts.pageBackground || '#ffffff';
  roots.forEach((r) => walk(r, pageBg, findings));

  const total = findings.contrast.length;
  const failed = findings.contrast.filter((c) => c.level === 'fail');
  const aa = findings.contrast.filter((c) => c.level === 'AA' || c.level === 'AAA');
  const aaa = findings.contrast.filter((c) => c.level === 'AAA');

  return {
    summary: {
      textLayersChecked: total,
      passAA: aa.length,
      passAAA: aaa.length,
      contrastFailures: failed.length,
      undersizedTargets: findings.targets.length,
      aaPassRate: total ? Math.round((aa.length / total) * 100) : 100,
    },
    contrastFailures: failed,
    undersizedTargets: findings.targets,
    allContrast: findings.contrast,
  };
}
