/**
 * Design token export engine in 8 industry formats
 */

export function exportTokens(symbolTable, format = 'tailwind-v4') {
  const colors = symbolTable.colorDefs || symbolTable.colors || {};
  const radii = symbolTable.radiusDefs || symbolTable.radii || {};
  const shadows = symbolTable.shadowDefs || symbolTable.shadows || {};

  switch (format) {
    case 'css':
      return exportCss(colors, radii, shadows);
    case 'scss':
      return exportScss(colors, radii, shadows);
    case 'tailwind-v3':
      return exportTailwindV3(colors, radii);
    case 'tailwind-v4':
      return exportTailwindV4(colors, radii);
    case 'w3c':
    case 'style-dictionary':
      return exportW3c(colors, radii, shadows);
    case 'typescript':
    case 'ts':
      return exportTypescript(colors, radii);
    case 'flutter':
      return exportFlutter(colors);
    default:
      return exportTailwindV4(colors, radii);
  }
}

function exportCss(colors, radii, shadows) {
  let out = ':root {\n  /* Colors */\n';
  for (const [sym, hex] of Object.entries(colors)) {
    const name = sym.toLowerCase().replace('$', '');
    out += `  --color-${name}: ${hex};\n`;
  }
  out += '\n  /* Radii */\n';
  for (const [sym, r] of Object.entries(radii)) {
    const name = sym.toLowerCase().replace('$', '');
    const radiusVal = typeof r === 'number' ? `${r}px` : r;
    out += `  --radius-${name}: ${radiusVal};\n`;
  }
  out += '}\n';
  return out;
}

function exportScss(colors, radii) {
  let out = '// SCSS Tokens\n';
  for (const [sym, hex] of Object.entries(colors)) {
    const name = sym.toLowerCase().replace('$', '');
    out += `$color-${name}: ${hex};\n`;
  }
  for (const [sym, r] of Object.entries(radii)) {
    const name = sym.toLowerCase().replace('$', '');
    const radiusVal = typeof r === 'number' ? `${r}px` : r;
    out += `$radius-${name}: ${radiusVal};\n`;
  }
  return out;
}

function exportTailwindV4(colors, radii) {
  let out = '@theme {\n  /* Tailwind CSS v4 Theme Variables */\n';
  for (const [sym, hex] of Object.entries(colors)) {
    const name = sym.toLowerCase().replace('$', '');
    out += `  --color-${name}: ${hex};\n`;
  }
  for (const [sym, r] of Object.entries(radii)) {
    const name = sym.toLowerCase().replace('$', '');
    const radiusVal = typeof r === 'number' ? `${r}px` : r;
    out += `  --radius-${name}: ${radiusVal};\n`;
  }
  out += '}\n';
  return out;
}

function exportTailwindV3(colors) {
  let cols = '';
  for (const [sym, hex] of Object.entries(colors)) {
    const name = sym.toLowerCase().replace('$', '');
    cols += `      '${name}': '${hex}',\n`;
  }
  return `/** @type {import('tailwindcss').Config} */\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${cols}      },\n    },\n  },\n};\n`;
}

function exportW3c(colors, radii) {
  const root = { color: {}, borderRadius: {} };
  for (const [sym, hex] of Object.entries(colors)) {
    const name = sym.toLowerCase().replace('$', '');
    root.color[name] = { $value: hex, $type: 'color' };
  }
  for (const [sym, r] of Object.entries(radii)) {
    const name = sym.toLowerCase().replace('$', '');
    const radiusVal = typeof r === 'number' ? `${r}px` : r;
    root.borderRadius[name] = { $value: radiusVal, $type: 'dimension' };
  }
  return JSON.stringify(root, null, 2);
}

function exportTypescript(colors, radii) {
  let out = 'export const tokens = {\n  colors: {\n';
  for (const [sym, hex] of Object.entries(colors)) {
    const name = sym.toLowerCase().replace('$', '');
    out += `    '${name}': '${hex}',\n`;
  }
  out += '  },\n  radii: {\n';
  for (const [sym, r] of Object.entries(radii)) {
    const name = sym.toLowerCase().replace('$', '');
    const radiusVal = typeof r === 'number' ? `${r}px` : `'${r}'`;
    out += `    '${name}': ${radiusVal},\n`;
  }
  out += '  },\n} as const;\n';
  return out;
}

function exportFlutter(colors) {
  let out = "import 'package:flutter/material.dart';\n\nclass AppColors {\n";
  for (const [sym, hex] of Object.entries(colors)) {
    const name = sym.toLowerCase().replace('$', '');
    const cleanHex = hex.replace('#', '');
    const dartHex = cleanHex.length === 6 ? `0xFF${cleanHex}` : `0x${cleanHex}`;
    out += `  static const Color color${name.toUpperCase()} = Color(${dartHex});\n`;
  }
  out += '}\n';
  return out;
}
