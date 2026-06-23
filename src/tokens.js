/**
 * Design token extraction + multi-format export.
 *
 * Works on FREE-tier files: most Figma files (and all free accounts) have no
 * published variables or named styles, so the primary strategy is to SCAN the
 * document tree for the values actually used — colors, type ramp, spacing,
 * radii, shadows — deduplicate them, give them sensible palette-style names,
 * and emit them as CSS / SCSS / JS / TS / Tailwind (v3 + v4) / W3C design tokens
 * / style-dictionary. Named styles and Variables are folded in when present.
 *
 * No competitor exports the full token set from an arbitrary free-tier file.
 */

import { figmaColorToHex, round } from './simplify.js';

// ---------------------------------------------------------------------------
// Color naming (HSL -> palette name like blue-500 / gray-100)
// ---------------------------------------------------------------------------

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

const HUE_NAMES = [
  [15, 'red'], [45, 'orange'], [70, 'yellow'], [160, 'green'],
  [200, 'teal'], [250, 'blue'], [275, 'indigo'], [300, 'purple'],
  [345, 'pink'], [360, 'red'],
];

function lightnessBucket(l) {
  const stops = [[0.95, 50], [0.9, 100], [0.8, 200], [0.7, 300], [0.6, 400],
    [0.5, 500], [0.4, 600], [0.3, 700], [0.2, 800], [0.1, 900]];
  for (const [thr, name] of stops) if (l >= thr) return name;
  return 950;
}

/** Generate a Tailwind-ish palette name (e.g. "blue-500", "gray-100"). */
export function nameColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'color';
  const { h, s, l } = rgbToHsl(rgb);
  const bucket = lightnessBucket(l);
  if (s < 0.1) return `gray-${bucket}`;
  let hue = 'red';
  for (const [max, name] of HUE_NAMES) { if (h < max) { hue = name; break; } }
  return `${hue}-${bucket}`;
}

// ---------------------------------------------------------------------------
// Frequency map helper
// ---------------------------------------------------------------------------

class Counter {
  constructor() { this.map = new Map(); }
  add(value, meta) {
    if (value === undefined || value === null) return;
    const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const e = this.map.get(key) || { value, count: 0, meta };
    e.count++;
    this.map.set(key, e);
  }
  entries() { return [...this.map.values()]; }
}

// ---------------------------------------------------------------------------
// Tree scan
// ---------------------------------------------------------------------------

function solidHexes(paints) {
  const out = [];
  for (const p of paints || []) {
    if (p && p.visible !== false && p.type === 'SOLID' && p.color) {
      out.push(figmaColorToHex(p.color, p.opacity));
    }
  }
  return out;
}

function shadowCss(effects) {
  const out = [];
  for (const e of effects || []) {
    if (e.visible === false) continue;
    if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
      const c = figmaColorToHex(e.color) || '#000000';
      const inset = e.type === 'INNER_SHADOW' ? 'inset ' : '';
      const x = round(e.offset?.x || 0), y = round(e.offset?.y || 0);
      const blur = round(e.radius || 0), spread = round(e.spread || 0);
      out.push(`${inset}${x}px ${y}px ${blur}px ${spread}px ${c}`);
    }
  }
  return out;
}

function scanNode(node, acc) {
  if (!node) return;
  solidHexes(node.fills).forEach((h) => acc.colors.add(h));
  solidHexes(node.strokes).forEach((h) => acc.colors.add(h));
  shadowCss(node.effects).forEach((s) => acc.shadows.add(s));

  if (node.style) {
    const st = node.style;
    if (st.fontFamily) acc.fontFamilies.add(st.fontFamily);
    if (typeof st.fontSize === 'number') acc.fontSizes.add(round(st.fontSize));
    if (st.fontWeight) acc.fontWeights.add(st.fontWeight);
    if (typeof st.lineHeightPx === 'number') acc.lineHeights.add(round(st.lineHeightPx));
    if (typeof st.letterSpacing === 'number' && st.letterSpacing !== 0) acc.letterSpacing.add(round(st.letterSpacing, 3));
  }

  for (const k of ['itemSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
    if (typeof node[k] === 'number' && node[k] > 0) acc.spacing.add(round(node[k]));
  }
  if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0) acc.radius.add(round(node.cornerRadius));
  if (Array.isArray(node.rectangleCornerRadii)) {
    node.rectangleCornerRadii.forEach((r) => { if (r > 0) acc.radius.add(round(r)); });
  }

  (node.children || []).forEach((c) => scanNode(c, acc));
}

// ---------------------------------------------------------------------------
// Naming + assembly
// ---------------------------------------------------------------------------

function uniqueNamed(named) {
  const seen = new Map();
  return named.map((t) => {
    let name = t.name;
    if (seen.has(name)) {
      const n = seen.get(name) + 1;
      seen.set(name, n);
      name = `${name}-${n}`;
    } else {
      seen.set(name, 1);
    }
    return { ...t, name };
  });
}

function nameColors(entries) {
  const sorted = entries.sort((a, b) => b.count - a.count);
  return uniqueNamed(sorted.map((e) => ({ name: nameColor(e.value), value: e.value, count: e.count })));
}

function nameNumericRamp(entries, prefix) {
  const sorted = entries.sort((a, b) => a.value - b.value);
  return sorted.map((e, i) => ({ name: `${prefix}-${e.value}`, value: e.value, count: e.count }));
}

function nameFontSizes(entries) {
  // Sort and map to t-shirt sizes when the ramp is small, else numeric.
  const sorted = entries.sort((a, b) => a.value - b.value);
  const tshirt = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];
  return sorted.map((e, i) => ({
    name: i < tshirt.length ? tshirt[i] : `size-${e.value}`,
    value: e.value,
    count: e.count,
  }));
}

/**
 * Extract a normalized token set from a Figma file response (+ optional
 * variables response). Returns groups of { name, value, count }.
 */
export function extractTokens(fileData, variablesData) {
  const acc = {
    colors: new Counter(), fontFamilies: new Counter(), fontSizes: new Counter(),
    fontWeights: new Counter(), lineHeights: new Counter(), letterSpacing: new Counter(),
    spacing: new Counter(), radius: new Counter(), shadows: new Counter(),
  };

  // Accept a file response (.document) or a nodes response (.nodes[*].document).
  const roots = [];
  if (fileData?.document) roots.push(fileData.document);
  if (fileData?.nodes) Object.values(fileData.nodes).forEach((n) => n?.document && roots.push(n.document));
  roots.forEach((r) => scanNode(r, acc));

  // Fold in Figma Variables (when the API returned them on a paid plan).
  let source = 'inferred';
  if (variablesData?.source === 'variables_api' && variablesData.meta?.variables) {
    source = 'variables';
    foldVariables(variablesData, acc);
  }

  return {
    source,
    colors: nameColors(acc.colors.entries()),
    fontFamilies: uniqueNamed(acc.fontFamilies.entries().sort((a, b) => b.count - a.count)
      .map((e) => ({ name: `font-${String(e.value).toLowerCase().replace(/\s+/g, '-')}`, value: e.value, count: e.count }))),
    fontSizes: nameFontSizes(acc.fontSizes.entries()),
    fontWeights: nameNumericRamp(acc.fontWeights.entries(), 'weight'),
    lineHeights: nameNumericRamp(acc.lineHeights.entries(), 'leading'),
    letterSpacing: nameNumericRamp(acc.letterSpacing.entries(), 'tracking'),
    spacing: nameNumericRamp(acc.spacing.entries(), 'space'),
    radius: uniqueNamed(acc.radius.entries().sort((a, b) => a.value - b.value)
      .map((e) => ({ name: e.value >= 9999 ? 'radius-full' : `radius-${e.value}`, value: e.value >= 9999 ? 9999 : e.value, count: e.count }))),
    shadows: uniqueNamed(acc.shadows.entries().sort((a, b) => b.count - a.count)
      .map((e, i) => ({ name: `shadow-${i + 1}`, value: e.value, count: e.count }))),
  };
}

function foldVariables(variablesData, acc) {
  const vars = variablesData.meta.variables || {};
  for (const v of Object.values(vars)) {
    if (v.resolvedType === 'COLOR') {
      const modeVal = Object.values(v.valuesByMode || {})[0];
      if (modeVal && typeof modeVal === 'object' && 'r' in modeVal) {
        acc.colors.add(figmaColorToHex(modeVal), { name: v.name });
      }
    } else if (v.resolvedType === 'FLOAT') {
      const modeVal = Object.values(v.valuesByMode || {})[0];
      if (typeof modeVal === 'number') acc.spacing.add(round(modeVal), { name: v.name });
    }
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const cssVar = (name, value) => `  --${name}: ${value};`;

function tokensToCss(t) {
  const lines = [':root {'];
  const group = (label, items, fmt) => {
    if (!items.length) return;
    lines.push(`  /* ${label} */`);
    items.forEach((i) => lines.push(cssVar(i.name, fmt(i.value))));
  };
  group('Colors', t.colors, (v) => v);
  group('Font families', t.fontFamilies, (v) => v);
  group('Font sizes', t.fontSizes, (v) => `${v}px`);
  group('Font weights', t.fontWeights, (v) => v);
  group('Line heights', t.lineHeights, (v) => `${v}px`);
  group('Letter spacing', t.letterSpacing, (v) => `${v}px`);
  group('Spacing', t.spacing, (v) => `${v}px`);
  group('Radius', t.radius, (v) => (v >= 9999 ? '9999px' : `${v}px`));
  group('Shadows', t.shadows, (v) => v);
  lines.push('}');
  return lines.join('\n') + '\n';
}

function tokensToScss(t) {
  const lines = [];
  const group = (label, items, fmt) => {
    if (!items.length) return;
    lines.push(`// ${label}`);
    items.forEach((i) => lines.push(`$${i.name}: ${fmt(i.value)};`));
    lines.push('');
  };
  group('Colors', t.colors, (v) => v);
  group('Font sizes', t.fontSizes, (v) => `${v}px`);
  group('Spacing', t.spacing, (v) => `${v}px`);
  group('Radius', t.radius, (v) => (v >= 9999 ? '9999px' : `${v}px`));
  group('Shadows', t.shadows, (v) => v);
  return lines.join('\n') + '\n';
}

function tokensToTailwind(t) {
  const obj = (items, fmt) => {
    const o = {};
    items.forEach((i) => { o[i.name] = fmt(i.value); });
    return o;
  };
  const config = {
    theme: {
      extend: {
        colors: obj(t.colors, (v) => v),
        fontSize: obj(t.fontSizes, (v) => `${v}px`),
        fontFamily: obj(t.fontFamilies, (v) => [v]),
        fontWeight: obj(t.fontWeights, (v) => String(v)),
        lineHeight: obj(t.lineHeights, (v) => `${v}px`),
        letterSpacing: obj(t.letterSpacing, (v) => `${v}px`),
        spacing: obj(t.spacing, (v) => `${v}px`),
        borderRadius: obj(t.radius, (v) => (v >= 9999 ? '9999px' : `${v}px`)),
        boxShadow: obj(t.shadows, (v) => v),
      },
    },
  };
  return `/** @type {import('tailwindcss').Config} */\nexport default ${JSON.stringify(config, null, 2)};\n`;
}

function tokensToTailwind4(t) {
  // Tailwind v4 CSS-first @theme block with the canonical namespaces.
  const lines = ['@theme {'];
  t.colors.forEach((i) => lines.push(`  --color-${i.name}: ${i.value};`));
  t.fontSizes.forEach((i) => lines.push(`  --text-${i.name}: ${i.value}px;`));
  t.fontFamilies.forEach((i) => lines.push(`  --${i.name}: ${i.value};`));
  t.spacing.forEach((i) => lines.push(`  --spacing-${i.value}: ${i.value}px;`));
  t.radius.forEach((i) => lines.push(`  --radius-${i.name.replace('radius-', '')}: ${i.value >= 9999 ? '9999px' : i.value + 'px'};`));
  t.shadows.forEach((i) => lines.push(`  --shadow-${i.name.replace('shadow-', '')}: ${i.value};`));
  lines.push('}');
  return lines.join('\n') + '\n';
}

function tokensToJs(t, ts) {
  const grp = (items, fmt) => {
    const o = {};
    items.forEach((i) => { o[i.name] = fmt(i.value); });
    return o;
  };
  const tokens = {
    colors: grp(t.colors, (v) => v),
    fontSizes: grp(t.fontSizes, (v) => `${v}px`),
    fontFamilies: grp(t.fontFamilies, (v) => v),
    fontWeights: grp(t.fontWeights, (v) => v),
    lineHeights: grp(t.lineHeights, (v) => `${v}px`),
    spacing: grp(t.spacing, (v) => `${v}px`),
    radius: grp(t.radius, (v) => (v >= 9999 ? '9999px' : `${v}px`)),
    shadows: grp(t.shadows, (v) => v),
  };
  const suffix = ts ? ' as const' : '';
  return `export const tokens = ${JSON.stringify(tokens, null, 2)}${suffix};\n`;
}

function tokensToW3C(t) {
  const colorGroup = {};
  t.colors.forEach((i) => { colorGroup[i.name] = { $type: 'color', $value: i.value }; });
  const dim = (items, fmt) => {
    const g = {};
    items.forEach((i) => { g[i.name] = { $type: 'dimension', $value: fmt(i.value) }; });
    return g;
  };
  const doc = {
    color: colorGroup,
    fontSize: dim(t.fontSizes, (v) => `${v}px`),
    spacing: dim(t.spacing, (v) => `${v}px`),
    borderRadius: dim(t.radius, (v) => (v >= 9999 ? '9999px' : `${v}px`)),
    fontWeight: (() => { const g = {}; t.fontWeights.forEach((i) => { g[i.name] = { $type: 'fontWeight', $value: i.value }; }); return g; })(),
    shadow: (() => { const g = {}; t.shadows.forEach((i) => { g[i.name] = { $type: 'shadow', $value: i.value }; }); return g; })(),
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

function tokensToStyleDictionary(t) {
  const leaf = (value) => ({ value });
  const grp = (items, fmt) => { const g = {}; items.forEach((i) => { g[i.name] = leaf(fmt(i.value)); }); return g; };
  const doc = {
    color: grp(t.colors, (v) => v),
    size: { font: grp(t.fontSizes, (v) => `${v}px`) },
    spacing: grp(t.spacing, (v) => `${v}px`),
    radius: grp(t.radius, (v) => (v >= 9999 ? '9999px' : `${v}px`)),
    shadow: grp(t.shadows, (v) => v),
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

export const TOKEN_FORMATS = ['css', 'scss', 'tailwind', 'tailwind4', 'js', 'ts', 'json', 'style-dictionary'];

/** Serialize an extracted token set into the requested format. */
export function formatTokens(tokens, format = 'css') {
  switch (format) {
    case 'scss': return tokensToScss(tokens);
    case 'tailwind': return tokensToTailwind(tokens);
    case 'tailwind4': return tokensToTailwind4(tokens);
    case 'js': return tokensToJs(tokens, false);
    case 'ts': return tokensToJs(tokens, true);
    case 'json': return tokensToW3C(tokens);
    case 'style-dictionary': return tokensToStyleDictionary(tokens);
    case 'css':
    default: return tokensToCss(tokens);
  }
}
