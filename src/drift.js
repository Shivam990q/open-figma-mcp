/**
 * Design-vs-code drift detection.
 *
 * Only OpenFigma can ship this: it already owns BOTH halves — the Figma token
 * extractor (tokens.js) and a workspace scanner. This compares the colors a
 * design actually uses against the colors hard-coded / tokenized in your repo,
 * and reports:
 *   - figmaOnly  : design colors with no matching code value (you haven't built it)
 *   - codeOnly   : code colors absent from the design (stale / off-brand)
 *   - nearMisses : code colors that ALMOST match a design color (#3b82f6 vs #3b82f7)
 *
 * No competitor checks design<->code consistency against your real repo.
 */

import fs from 'fs';
import path from 'path';

const SCAN_EXT = new Set(['.css', '.scss', '.sass', '.less', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue', '.svelte']);
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.figma-cache', 'figma-export']);

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const int = parseInt(h, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/** Perceptual-ish color distance ("redmean"). 0 = identical; <~14 = near. */
function colorDistance(h1, h2) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  if (!a || !b) return Infinity;
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

const norm = (hex) => {
  // Normalize to #rrggbb (drop alpha, expand shorthand) for comparison.
  let h = hex.replace('#', '').toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  return '#' + h;
};

function scanDir(dir, acc, depth = 0) {
  if (depth > 8) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const ent of entries) {
    if (ent.name.startsWith('.') && ent.isDirectory() && !SKIP_DIR.has(ent.name)) { /* allow .storybook etc but still skip below */ }
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!SKIP_DIR.has(ent.name)) scanDir(full, acc, depth + 1);
    } else if (SCAN_EXT.has(path.extname(ent.name))) {
      let text;
      try { text = fs.readFileSync(full, 'utf-8'); } catch (e) { continue; }
      const matches = text.match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/g) || [];
      for (const m of matches) {
        const key = norm(m);
        if (!/^#[0-9a-f]{6}$/.test(key)) continue;
        const e = acc.get(key) || { value: key, count: 0, files: new Set() };
        e.count++;
        if (e.files.size < 5) e.files.add(path.relative(acc.root, full).replace(/\\/g, '/'));
        acc.set(key, e);
      }
    }
  }
}

/** Collect the set of hex colors used across code in a workspace. */
export function scanCodeColors(workspacePath) {
  const acc = new Map();
  acc.root = path.resolve(workspacePath);
  scanDir(acc.root, acc);
  delete acc.root;
  return acc;
}

/**
 * Detect drift between Figma design tokens and a workspace's code colors.
 *
 * @param {object} figmaTokens result of extractTokens()
 * @param {string} workspacePath directory to scan
 * @param {object} [opts]
 * @param {number} [opts.nearThreshold=14] color-distance threshold for near-miss
 */
export function detectDrift(figmaTokens, workspacePath, opts = {}) {
  const nearThreshold = opts.nearThreshold ?? 14;
  const codeMap = scanCodeColors(workspacePath);
  const figmaColors = (figmaTokens.colors || []).map((c) => ({ name: c.name, value: norm(c.value) }));

  const codeSet = new Set([...codeMap.keys()]);
  const figmaSet = new Set(figmaColors.map((c) => c.value));

  const figmaOnly = [];
  const nearMisses = [];
  for (const c of figmaColors) {
    if (codeSet.has(c.value)) continue;
    // not an exact match — is there a near one in code?
    let best = null;
    for (const codeHex of codeSet) {
      const d = colorDistance(c.value, codeHex);
      if (d <= nearThreshold && (!best || d < best.distance)) best = { value: codeHex, distance: Math.round(d * 10) / 10 };
    }
    if (best) nearMisses.push({ figma: c, code: best.value, distance: best.distance });
    else figmaOnly.push(c);
  }

  const codeOnly = [];
  for (const [hex, info] of codeMap) {
    if (figmaSet.has(hex)) continue;
    // skip ones already explained as a near-miss target
    if (nearMisses.some((n) => n.code === hex)) continue;
    codeOnly.push({ value: hex, count: info.count, files: [...info.files] });
  }

  const matched = figmaColors.filter((c) => codeSet.has(c.value)).length;
  return {
    summary: {
      figmaColors: figmaColors.length,
      codeColors: codeMap.size,
      matched,
      figmaOnly: figmaOnly.length,
      nearMisses: nearMisses.length,
      codeOnly: codeOnly.length,
      inSyncPct: figmaColors.length ? Math.round((matched / figmaColors.length) * 100) : 100,
    },
    figmaOnly,
    nearMisses,
    codeOnly: codeOnly.sort((a, b) => b.count - a.count).slice(0, 50),
  };
}
