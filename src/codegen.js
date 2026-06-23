/**
 * Multi-framework code generation from a SimplifiedDesign.
 *
 * The official Figma MCP only emits React + Tailwind. OpenFigma generates
 * React (Tailwind or inline-style), Vue 3 SFC, and self-contained HTML/CSS from
 * the same simplified tree + globalVars — a real starting point an agent can
 * adapt, with the design's layout/colors/typography baked in.
 *
 * This is intentionally a scaffold generator, not a pixel-perfect exporter:
 * structure, layout, and styling are faithful; the agent refines into the
 * project's conventions (per the workspace rules OpenFigma writes).
 */

const px = (n) => `${n}px`;

function paddingToCss(padding) {
  if (padding === undefined || padding === null) return undefined;
  const parts = String(padding).trim().split(/\s+/);
  return parts.map((p) => (p === '0' ? '0' : px(p))).join(' ');
}

function gradientCss(fill) {
  if (!fill || typeof fill !== 'object' || !Array.isArray(fill.stops)) return undefined;
  const dir = fill.type === 'radial-gradient' ? 'circle' : 'to bottom';
  const stops = fill.stops.map((s) => `${s.color} ${Math.round((s.position ?? 0) * 100)}%`).join(', ');
  return fill.type === 'radial-gradient'
    ? `radial-gradient(${dir}, ${stops})`
    : `linear-gradient(${dir}, ${stops})`;
}

/** Build a CSS property map for a simplified node using its globalVars refs. */
function cssForNode(node, styles) {
  const css = {};
  const layout = node.layout && styles[node.layout];
  if (layout) {
    css.display = 'flex';
    css['flex-direction'] = layout.mode === 'row' ? 'row' : 'column';
    if (layout.wrap) css['flex-wrap'] = 'wrap';
    if (layout.justifyContent) css['justify-content'] = layout.justifyContent;
    if (layout.alignItems) css['align-items'] = layout.alignItems;
    if (layout.gap) css.gap = px(layout.gap);
    const pad = paddingToCss(layout.padding);
    if (pad) css.padding = pad;
  }

  const fills = node.fills && styles[node.fills];
  if (Array.isArray(fills) && fills.length) {
    const f = fills[0];
    if (typeof f === 'string') {
      if (node.type === 'TEXT') css.color = f;
      else css['background-color'] = f;
    } else {
      const g = gradientCss(f);
      if (g) css['background-image'] = g;
    }
  }

  const strokes = node.strokes && styles[node.strokes];
  if (strokes && Array.isArray(strokes.colors) && strokes.colors.length) {
    css.border = `${px(strokes.strokeWeight || 1)} solid ${strokes.colors[0]}`;
  }

  const effects = node.effects && styles[node.effects];
  if (Array.isArray(effects)) {
    const shadows = effects
      .filter((e) => e.type === 'drop-shadow' || e.type === 'inner-shadow')
      .map((e) => `${e.type === 'inner-shadow' ? 'inset ' : ''}${px(e.offset?.x || 0)} ${px(e.offset?.y || 0)} ${px(e.radius || 0)} ${e.spread ? px(e.spread) + ' ' : ''}${e.color}`);
    if (shadows.length) css['box-shadow'] = shadows.join(', ');
  }

  if (node.borderRadius) css['border-radius'] = node.borderRadius;
  if (typeof node.opacity === 'number') css.opacity = String(node.opacity);

  // Responsive constraints -> CSS (fixes the "everything is absolute/fixed" codegen
  // complaint). A child that stretches horizontally should be width:100%, etc.
  if (node.constraints) {
    const h = node.constraints.horizontal;
    const v = node.constraints.vertical;
    if (h === 'left_right' || h === 'scale') css.width = '100%';
    else if (h === 'center') { css['margin-left'] = 'auto'; css['margin-right'] = 'auto'; }
    if (v === 'top_bottom' || v === 'scale') css.height = '100%';
  }

  const text = node.textStyle && styles[node.textStyle];
  if (text) {
    if (text.fontFamily) css['font-family'] = `"${text.fontFamily}"`;
    if (text.fontSize) css['font-size'] = px(text.fontSize);
    if (text.fontWeight) css['font-weight'] = String(text.fontWeight);
    if (text.lineHeight) css['line-height'] = text.lineHeight;
    if (text.letterSpacing) css['letter-spacing'] = px(text.letterSpacing);
    if (text.textAlign) css['text-align'] = text.textAlign;
  }
  return css;
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

function pascal(name) {
  const s = String(name || 'Component').replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return /^[A-Za-z]/.test(s) ? s : 'Comp' + s || 'Component';
}
function kebab(name, fallback) {
  const s = String(name || fallback).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return s || fallback;
}
const tagFor = (node) => (node.type === 'TEXT' ? 'p' : 'div');

// ---------------------------------------------------------------------------
// CSS -> Tailwind arbitrary utilities
// ---------------------------------------------------------------------------

function cssToTailwind(css) {
  const u = [];
  if (css.display === 'flex') u.push('flex');
  if (css['flex-direction'] === 'column') u.push('flex-col');
  if (css['flex-wrap'] === 'wrap') u.push('flex-wrap');
  const jc = { 'flex-start': 'justify-start', center: 'justify-center', 'flex-end': 'justify-end', 'space-between': 'justify-between' };
  if (css['justify-content']) u.push(jc[css['justify-content']] || `justify-[${css['justify-content']}]`);
  const ai = { 'flex-start': 'items-start', center: 'items-center', 'flex-end': 'items-end', baseline: 'items-baseline' };
  if (css['align-items']) u.push(ai[css['align-items']] || `items-[${css['align-items']}]`);
  if (css.gap) u.push(`gap-[${css.gap}]`);
  if (css.padding) u.push(`p-[${css.padding.replace(/\s+/g, '_')}]`);
  if (css.width === '100%') u.push('w-full');
  else if (css.width) u.push(`w-[${css.width}]`);
  if (css.height === '100%') u.push('h-full');
  else if (css.height) u.push(`h-[${css.height}]`);
  if (css['margin-left'] === 'auto' && css['margin-right'] === 'auto') u.push('mx-auto');
  if (css['background-color']) u.push(`bg-[${css['background-color']}]`);
  if (css['background-image']) u.push(`bg-[image:${css['background-image'].replace(/\s+/g, '_')}]`);
  if (css.color) u.push(`text-[${css.color}]`);
  if (css.border) u.push(`border border-[${css.border.split(' ').pop()}]`);
  if (css['box-shadow']) u.push(`shadow-[${css['box-shadow'].replace(/\s+/g, '_')}]`);
  if (css['border-radius']) u.push(`rounded-[${css['border-radius']}]`);
  if (css.opacity) u.push(`opacity-[${css.opacity}]`);
  if (css['font-size']) u.push(`text-[${css['font-size']}]`);
  if (css['font-weight']) u.push(`font-[${css['font-weight']}]`);
  if (css['line-height']) u.push(`leading-[${css['line-height']}]`);
  if (css['letter-spacing']) u.push(`tracking-[${css['letter-spacing']}]`);
  const ta = { left: 'text-left', center: 'text-center', right: 'text-right', justify: 'text-justify' };
  if (css['text-align']) u.push(ta[css['text-align']] || '');
  return u.filter(Boolean).join(' ');
}

const cssBlock = (css, indent) => Object.entries(css).map(([k, v]) => `${indent}${k}: ${v};`).join('\n');
const escapeText = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderHtml(root, styles) {
  const cssRules = [];
  const usedNames = new Map();
  function render(node, depth) {
    const pad = '  '.repeat(depth + 1);
    const css = cssForNode(node, styles);
    let cls = kebab(node.name, node.type.toLowerCase());
    const n = (usedNames.get(cls) || 0) + 1; usedNames.set(cls, n);
    if (n > 1) cls = `${cls}-${n}`;
    if (Object.keys(css).length) cssRules.push(`.${cls} {\n${cssBlock(css, '  ')}\n}`);
    const tag = tagFor(node);
    const kids = (node.children || []).map((c) => render(c, depth + 1)).join('\n');
    const text = node.text ? escapeText(node.text) : '';
    if (kids) return `${pad}<${tag} class="${cls}">\n${kids}\n${pad}</${tag}>`;
    return `${pad}<${tag} class="${cls}">${text}</${tag}>`;
  }
  const body = render(root, 0);
  return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<style>\n${cssRules.join('\n\n')}\n</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}

function renderReactTailwind(root, styles) {
  function render(node, depth) {
    const pad = '  '.repeat(depth + 2);
    const cls = cssToTailwind(cssForNode(node, styles));
    const tag = tagFor(node);
    const clsAttr = cls ? ` className="${cls}"` : '';
    const kids = (node.children || []).map((c) => render(c, depth + 1)).join('\n');
    if (kids) return `${pad}<${tag}${clsAttr}>\n${kids}\n${pad}</${tag}>`;
    return `${pad}<${tag}${clsAttr}>${node.text ? escapeText(node.text) : ''}</${tag}>`;
  }
  const name = pascal(root.name);
  return `export default function ${name}() {\n  return (\n${render(root, 0)}\n  );\n}\n`;
}

function styleObj(css) {
  const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const entries = Object.entries(css).map(([k, v]) => `${camel(k)}: ${JSON.stringify(v)}`);
  return `{ ${entries.join(', ')} }`;
}

function renderReactInline(root, styles) {
  function render(node, depth) {
    const pad = '  '.repeat(depth + 2);
    const css = cssForNode(node, styles);
    const tag = tagFor(node);
    const styleAttr = Object.keys(css).length ? ` style={${styleObj(css)}}` : '';
    const kids = (node.children || []).map((c) => render(c, depth + 1)).join('\n');
    if (kids) return `${pad}<${tag}${styleAttr}>\n${kids}\n${pad}</${tag}>`;
    return `${pad}<${tag}${styleAttr}>${node.text ? escapeText(node.text) : ''}</${tag}>`;
  }
  const name = pascal(root.name);
  return `export default function ${name}() {\n  return (\n${render(root, 0)}\n  );\n}\n`;
}

function renderVue(root, styles) {
  const cssRules = [];
  const usedNames = new Map();
  function render(node, depth) {
    const pad = '  '.repeat(depth + 1);
    const css = cssForNode(node, styles);
    let cls = kebab(node.name, node.type.toLowerCase());
    const n = (usedNames.get(cls) || 0) + 1; usedNames.set(cls, n);
    if (n > 1) cls = `${cls}-${n}`;
    if (Object.keys(css).length) cssRules.push(`.${cls} {\n${cssBlock(css, '  ')}\n}`);
    const tag = tagFor(node);
    const kids = (node.children || []).map((c) => render(c, depth + 1)).join('\n');
    if (kids) return `${pad}<${tag} class="${cls}">\n${kids}\n${pad}</${tag}>`;
    return `${pad}<${tag} class="${cls}">${node.text ? escapeText(node.text) : ''}</${tag}>`;
  }
  const body = render(root, 0);
  return `<template>\n${body}\n</template>\n\n<style scoped>\n${cssRules.join('\n\n')}\n</style>\n`;
}

// ---------------------------------------------------------------------------
// Angular (standalone component, inline template + styles)
// ---------------------------------------------------------------------------

function renderAngular(root, styles) {
  const cssRules = [];
  const usedNames = new Map();
  function render(node, depth) {
    const pad = '  '.repeat(depth + 3);
    const css = cssForNode(node, styles);
    let cls = kebab(node.name, node.type.toLowerCase());
    const n = (usedNames.get(cls) || 0) + 1; usedNames.set(cls, n);
    if (n > 1) cls = `${cls}-${n}`;
    if (Object.keys(css).length) cssRules.push(`.${cls} {\n${cssBlock(css, '  ')}\n}`);
    const tag = tagFor(node);
    const kids = (node.children || []).map((c) => render(c, depth + 1)).join('\n');
    if (kids) return `${pad}<${tag} class="${cls}">\n${kids}\n${pad}</${tag}>`;
    return `${pad}<${tag} class="${cls}">${node.text ? escapeText(node.text) : ''}</${tag}>`;
  }
  const name = pascal(root.name);
  const selector = 'app-' + kebab(root.name, 'component');
  const body = render(root, 0);
  const stylesBlock = cssRules.map((r) => '    ' + r.replace(/\n/g, '\n    ')).join('\n');
  return (
    `import { Component } from '@angular/core';\n\n` +
    `@Component({\n` +
    `  selector: '${selector}',\n` +
    `  standalone: true,\n` +
    `  template: \`\n${body}\n  \`,\n` +
    `  styles: [\`\n${stylesBlock}\n  \`],\n` +
    `})\n` +
    `export class ${name}Component {}\n`
  );
}

// ---------------------------------------------------------------------------
// Svelte (markup + scoped <style>)
// ---------------------------------------------------------------------------

function renderSvelte(root, styles) {
  const cssRules = [];
  const usedNames = new Map();
  function render(node, depth) {
    const pad = '  '.repeat(depth);
    const css = cssForNode(node, styles);
    let cls = kebab(node.name, node.type.toLowerCase());
    const n = (usedNames.get(cls) || 0) + 1; usedNames.set(cls, n);
    if (n > 1) cls = `${cls}-${n}`;
    if (Object.keys(css).length) cssRules.push(`.${cls} {\n${cssBlock(css, '  ')}\n}`);
    const tag = tagFor(node);
    const kids = (node.children || []).map((c) => render(c, depth + 1)).join('\n');
    if (kids) return `${pad}<${tag} class="${cls}">\n${kids}\n${pad}</${tag}>`;
    return `${pad}<${tag} class="${cls}">${node.text ? escapeText(node.text) : ''}</${tag}>`;
  }
  const body = render(root, 0);
  return `${body}\n\n<style>\n${cssRules.join('\n\n')}\n</style>\n`;
}

// ---------------------------------------------------------------------------
// Flutter (Dart widget tree)
// ---------------------------------------------------------------------------

function hexToFlutterColor(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  let a = 'FF';
  if (h.length === 8) { a = h.slice(6, 8); h = h.slice(0, 6); }
  if (h.length !== 6) return null;
  return `Color(0x${a.toUpperCase()}${h.toUpperCase()})`;
}

function parsePadding(padding) {
  if (padding === undefined || padding === null) return null;
  const p = String(padding).trim().split(/\s+/).map(Number);
  if (p.length === 1) return { t: p[0], r: p[0], b: p[0], l: p[0] };
  if (p.length === 4) return { t: p[0], r: p[1], b: p[2], l: p[3] };
  return { t: p[0] || 0, r: p[0] || 0, b: p[0] || 0, l: p[0] || 0 };
}

const FLUTTER_MAIN_AXIS = { 'flex-start': 'start', center: 'center', 'flex-end': 'end', 'space-between': 'spaceBetween' };
const FLUTTER_CROSS_AXIS = { 'flex-start': 'start', center: 'center', 'flex-end': 'end', baseline: 'baseline' };

function renderFlutter(root, styles) {
  function fillHex(node) {
    const fills = node.fills && styles[node.fills];
    if (Array.isArray(fills) && typeof fills[0] === 'string') return fills[0];
    return null;
  }
  function render(node, indent) {
    const pad = '  '.repeat(indent);
    const inner = '  '.repeat(indent + 1);

    if (node.type === 'TEXT') {
      const ts = node.textStyle && styles[node.textStyle];
      const color = hexToFlutterColor(fillHex(node));
      const styleParts = [];
      if (ts?.fontSize) styleParts.push(`fontSize: ${ts.fontSize}`);
      if (ts?.fontWeight) styleParts.push(`fontWeight: FontWeight.w${ts.fontWeight}`);
      if (color) styleParts.push(`color: ${color}`);
      const styleArg = styleParts.length ? `, style: TextStyle(${styleParts.join(', ')})` : '';
      return `${pad}Text(${JSON.stringify(node.text || '')}${styleArg})`;
    }

    const layout = node.layout && styles[node.layout];
    const children = (node.children || []).map((c) => render(c, indent + 3));
    let childWidget;
    if (children.length) {
      const isRow = layout?.mode === 'row';
      const widget = isRow ? 'Row' : 'Column';
      const mainAxis = layout?.justifyContent ? `\n${inner}  mainAxisAlignment: MainAxisAlignment.${FLUTTER_MAIN_AXIS[layout.justifyContent] || 'start'},` : '';
      const crossAxis = layout?.alignItems ? `\n${inner}  crossAxisAlignment: CrossAxisAlignment.${FLUTTER_CROSS_AXIS[layout.alignItems] || 'start'},` : '';
      childWidget = `${widget}(${mainAxis}${crossAxis}\n${inner}  children: [\n${children.join(',\n')},\n${inner}  ],\n${inner})`;
    } else {
      childWidget = 'const SizedBox.shrink()';
    }

    // Wrap in a Container when there is paint / radius / padding to apply.
    const bg = hexToFlutterColor(fillHex(node));
    const radius = node.borderRadius ? parseInt(node.borderRadius, 10) : 0;
    const padObj = layout?.padding ? parsePadding(layout.padding) : null;
    const decoParts = [];
    if (bg) decoParts.push(`color: ${bg}`);
    if (radius) decoParts.push(`borderRadius: BorderRadius.circular(${radius})`);

    const args = [];
    if (padObj) args.push(`${inner}padding: const EdgeInsets.fromLTRB(${padObj.l}, ${padObj.t}, ${padObj.r}, ${padObj.b}),`);
    if (decoParts.length) args.push(`${inner}decoration: BoxDecoration(${decoParts.join(', ')}),`);
    if (!args.length && !bg) return `${pad}${childWidget}`;
    args.push(`${inner}child: ${childWidget},`);
    return `${pad}Container(\n${args.join('\n')}\n${pad})`;
  }
  const name = pascal(root.name);
  const tree = render(root, 4);
  return (
    `import 'package:flutter/material.dart';\n\n` +
    `class ${name} extends StatelessWidget {\n` +
    `  const ${name}({super.key});\n\n` +
    `  @override\n` +
    `  Widget build(BuildContext context) {\n` +
    `    return ${tree.trimStart()};\n` +
    `  }\n` +
    `}\n`
  );
}

// ---------------------------------------------------------------------------
// SwiftUI (View struct)
// ---------------------------------------------------------------------------

function hexToSwiftColor(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) return null;
  const int = parseInt(h, 16);
  const r = (((int >> 16) & 255) / 255).toFixed(3);
  const g = (((int >> 8) & 255) / 255).toFixed(3);
  const b = ((int & 255) / 255).toFixed(3);
  return `Color(red: ${r}, green: ${g}, blue: ${b})`;
}

function renderSwiftUI(root, styles) {
  function fillHex(node) {
    const fills = node.fills && styles[node.fills];
    if (Array.isArray(fills) && typeof fills[0] === 'string') return fills[0];
    return null;
  }
  function modifiers(node, indent) {
    const pad = '  '.repeat(indent);
    const lines = [];
    const layout = node.layout && styles[node.layout];
    if (layout?.padding) {
      const p = parsePadding(layout.padding);
      if (p && p.t === p.r && p.r === p.b && p.b === p.l) lines.push(`${pad}.padding(${p.t})`);
      else if (p) lines.push(`${pad}.padding(.init(top: ${p.t}, leading: ${p.l}, bottom: ${p.b}, trailing: ${p.r}))`);
    }
    const bg = hexToSwiftColor(fillHex(node));
    if (bg && node.type !== 'TEXT') lines.push(`${pad}.background(${bg})`);
    if (node.borderRadius) {
      const radius = parseInt(node.borderRadius, 10);
      if (radius) lines.push(`${pad}.cornerRadius(${radius})`);
    }
    return lines.join('\n');
  }
  function render(node, indent) {
    const pad = '  '.repeat(indent);
    if (node.type === 'TEXT') {
      const ts = node.textStyle && styles[node.textStyle];
      let line = `${pad}Text(${JSON.stringify(node.text || '')})`;
      const mods = [];
      if (ts?.fontSize) mods.push(`${pad}  .font(.system(size: ${ts.fontSize}${ts.fontWeight >= 700 ? ', weight: .bold' : ''}))`);
      const color = hexToSwiftColor(fillHex(node));
      if (color) mods.push(`${pad}  .foregroundColor(${color})`);
      return mods.length ? `${line}\n${mods.join('\n')}` : line;
    }
    const layout = node.layout && styles[node.layout];
    const isRow = layout?.mode === 'row';
    const stack = isRow ? 'HStack' : 'VStack';
    const spacing = layout?.gap ? `(spacing: ${layout.gap})` : '';
    const children = (node.children || []).map((c) => render(c, indent + 2)).join('\n');
    const block = `${pad}${stack}${spacing} {\n${children}\n${pad}}`;
    const mods = modifiers(node, indent);
    return mods ? `${block}\n${mods}` : block;
  }
  const name = pascal(root.name);
  const body = render(root, 2);
  return (
    `import SwiftUI\n\n` +
    `struct ${name}: View {\n` +
    `  var body: some View {\n${body}\n  }\n` +
    `}\n`
  );
}

// ---------------------------------------------------------------------------
// Component API / typed prop generation from componentPropertyDefinitions
// ---------------------------------------------------------------------------

function cleanPropName(raw) {
  // Figma appends "#<id>" to TEXT/BOOLEAN/INSTANCE prop names — strip it.
  const base = String(raw).replace(/#[0-9:;]+$/, '');
  const camel = base.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/)
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
  return camel || 'prop';
}

/**
 * Generate a typed component API from a RAW Figma node's
 * componentPropertyDefinitions (BOOLEAN/TEXT/VARIANT/INSTANCE_SWAP).
 *
 * @param {object} node raw Figma node (component / component-set)
 * @param {string} framework 'react' (TS interface + stub) or 'vue' (defineProps)
 */
export function generateComponentApi(node, framework = 'react') {
  const defs = node?.componentPropertyDefinitions || {};
  const name = pascal(node?.name || 'Component');
  const props = Object.entries(defs).map(([rawName, def]) => {
    const propName = cleanPropName(rawName);
    let tsType = 'string';
    if (def.type === 'BOOLEAN') tsType = 'boolean';
    else if (def.type === 'TEXT') tsType = 'string';
    else if (def.type === 'INSTANCE_SWAP') tsType = 'React.ReactNode';
    else if (def.type === 'VARIANT') {
      const opts = (def.variantOptions || []).map((o) => `'${o}'`);
      tsType = opts.length ? opts.join(' | ') : 'string';
    }
    const optional = def.type === 'BOOLEAN' || def.defaultValue !== undefined;
    return { propName, tsType, optional, figmaType: def.type, defaultValue: def.defaultValue };
  });

  if (framework === 'vue') {
    const lines = props.map((p) => `  ${p.propName}: { type: ${vueType(p)}, required: ${!p.optional} }`);
    return `defineProps({\n${lines.join(',\n')}\n})\n`;
  }

  const interfaceLines = props.map((p) => `  ${p.propName}${p.optional ? '?' : ''}: ${p.tsType};`);
  const propList = props.map((p) => p.propName).join(', ');
  return (
    `export interface ${name}Props {\n${interfaceLines.join('\n')}\n}\n\n` +
    `export const ${name}: React.FC<${name}Props> = ({ ${propList} }) => {\n` +
    `  // TODO: implement using get_figma_data / generate_code output for this node\n` +
    `  return null;\n};\n`
  );
}

function vueType(p) {
  if (p.tsType === 'boolean') return 'Boolean';
  if (p.tsType === 'React.ReactNode') return 'Object';
  return 'String';
}

export const CODEGEN_FRAMEWORKS = [
  'react-tailwind',
  'react-inline',
  'vue',
  'svelte',
  'angular',
  'html',
  'flutter',
  'swiftui',
];

/**
 * Generate component code from a SimplifiedDesign (or a single simplified node).
 *
 * @param {object} design SimplifiedDesign ({ nodes, globalVars }) or a node.
 * @param {string} framework one of CODEGEN_FRAMEWORKS
 */
export function generateCode(design, framework = 'react-tailwind') {
  const styles = design?.globalVars?.styles || {};
  const root = Array.isArray(design?.nodes) ? design.nodes[0] : design;
  if (!root) return '';
  switch (framework) {
    case 'react-inline': return renderReactInline(root, styles);
    case 'vue': return renderVue(root, styles);
    case 'svelte': return renderSvelte(root, styles);
    case 'angular': return renderAngular(root, styles);
    case 'html': return renderHtml(root, styles);
    case 'flutter': return renderFlutter(root, styles);
    case 'swiftui': return renderSwiftUI(root, styles);
    case 'react-tailwind':
    default: return renderReactTailwind(root, styles);
  }
}
