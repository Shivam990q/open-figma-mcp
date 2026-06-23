/**
 * Dependency-free serializers for simplified Figma design data.
 *
 * Provides:
 *   - toYaml(value)            -> block-style YAML (correct for nested arrays-of-objects)
 *   - toTree(simplifiedDesign) -> compact positional "tree" format with a globalVars block
 *   - serialize(design, format) -> dispatch helper used by the tools and the CLI
 *
 * The previous YAML implementation emitted invalid YAML for arrays of objects
 * (sibling mapping keys were over-indented relative to the `- ` marker). This
 * module fixes that with a key-aware, line-based writer.
 */

const SP = '  '; // two spaces per indent level
const pad = (n) => SP.repeat(n);

function isScalar(v) {
  return (
    v === null ||
    v === undefined ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  );
}

/** Render a number without floating-point noise or invalid YAML tokens. */
function formatNumber(n) {
  if (!Number.isFinite(n)) return 'null'; // NaN/Infinity are not valid YAML/JSON
  if (Number.isInteger(n)) return String(n);
  // Strip IEEE-754 round-trip noise (0.1+0.2 -> 0.3) using significant-digit
  // precision, which — unlike toFixed — preserves small-magnitude values
  // (0.0000004 stays 0.0000004 instead of collapsing to 0).
  let s = String(parseFloat(n.toPrecision(15)));
  // JS renders tiny/huge numbers in exponential form ("4e-7"). YAML 1.1 parsers
  // require a dot before the exponent or they read it as a string, so insert one
  // ("4e-7" -> "4.0e-7"). Harmless for JSON/YAML 1.2.
  const e = s.search(/[eE]/);
  if (e !== -1 && !s.slice(0, e).includes('.')) s = s.slice(0, e) + '.0' + s.slice(e);
  return s;
}

/**
 * Decide whether a string must be quoted to round-trip as the same scalar.
 * Conservative: when in doubt, quote.
 */
function needsQuote(s) {
  if (s === '') return true;
  if (/^\s|\s$/.test(s)) return true; // leading/trailing whitespace
  if (/[\n\r\t\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s)) return true; // control chars / newlines
  if (/^[-?:,\[\]{}#&*!|>'"%@`]/.test(s)) return true; // leading YAML indicator
  // Any colon is unsafe: "foo: bar" mapping ambiguity AND the YAML 1.1
  // sexagesimal trap where Figma ids like "1:1" or "12:34" parse as base-60
  // integers (1:1 -> 61). Quoting all colon-bearing strings keeps ids intact.
  if (s.includes(':')) return true;
  if (/\s#/.test(s)) return true; // trailing comment ambiguity
  if (/^(true|false|null|yes|no|on|off|~|none)$/i.test(s)) return true; // reserved words
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return true; // number-like
  if (/^0[xob]/i.test(s)) return true; // hex/octal/binary-like
  return false;
}

/** Format a scalar value as a YAML node string (no indentation). */
function scalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return formatNumber(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v);
  // JSON.stringify produces a valid YAML double-quoted scalar (same escape set).
  return needsQuote(s) ? JSON.stringify(s) : s;
}

const definedKeys = (obj) => Object.keys(obj).filter((k) => obj[k] !== undefined);

function writeObject(obj, indent, lines) {
  for (const k of definedKeys(obj)) {
    const v = obj[k];
    const keyStr = pad(indent) + scalar(k) + ':';
    if (isScalar(v)) {
      lines.push(keyStr + ' ' + scalar(v));
    } else if (Array.isArray(v)) {
      if (v.length === 0) lines.push(keyStr + ' []');
      else {
        lines.push(keyStr);
        writeArray(v, indent, lines); // YAML allows `- ` at the key's own indent
      }
    } else {
      const ks = definedKeys(v);
      if (ks.length === 0) lines.push(keyStr + ' {}');
      else {
        lines.push(keyStr);
        writeObject(v, indent + 1, lines);
      }
    }
  }
}

function writeArray(arr, indent, lines) {
  for (const item of arr) {
    if (isScalar(item)) {
      lines.push(pad(indent) + '- ' + scalar(item));
    } else if (Array.isArray(item)) {
      if (item.length === 0) lines.push(pad(indent) + '- []');
      else {
        lines.push(pad(indent) + '-');
        writeArray(item, indent + 1, lines);
      }
    } else {
      writeObjectInArray(item, indent, lines);
    }
  }
}

/**
 * Emit an object that is an array element. The first key shares the `- ` line so
 * that the key sits at indent+1; subsequent keys align at the same indent+1.
 */
function writeObjectInArray(obj, indent, lines) {
  const keys = definedKeys(obj);
  if (keys.length === 0) {
    lines.push(pad(indent) + '- {}');
    return;
  }
  const childIndent = indent + 1;
  let first = true;
  for (const k of keys) {
    const v = obj[k];
    const prefix = first ? pad(indent) + '- ' : pad(childIndent);
    first = false;
    const keyStr = prefix + scalar(k) + ':';
    if (isScalar(v)) {
      lines.push(keyStr + ' ' + scalar(v));
    } else if (Array.isArray(v)) {
      if (v.length === 0) lines.push(keyStr + ' []');
      else {
        lines.push(keyStr);
        writeArray(v, childIndent, lines);
      }
    } else {
      const ks = definedKeys(v);
      if (ks.length === 0) lines.push(keyStr + ' {}');
      else {
        lines.push(keyStr);
        writeObject(v, childIndent + 1, lines);
      }
    }
  }
}

/**
 * Serialize a value to block-style YAML.
 */
export function toYaml(value) {
  const lines = [];
  if (isScalar(value)) {
    lines.push(scalar(value));
  } else if (Array.isArray(value)) {
    if (value.length === 0) return '[]\n';
    writeArray(value, 0, lines);
  } else {
    if (definedKeys(value).length === 0) return '{}\n';
    writeObject(value, 0, lines);
  }
  return lines.join('\n') + '\n';
}

/**
 * Render a single inline "key=value" attribute for the tree format.
 * Refs (style ids) and scalars are printed inline; everything else is JSON.
 */
function treeAttr(key, value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    // Quote text that contains spaces or special chars; ids/refs stay bare.
    const v = /[\s"=|]/.test(value) ? JSON.stringify(value) : value;
    return `${key}=${v}`;
  }
  if (typeof value === 'number') return `${key}=${formatNumber(value)}`;
  if (typeof value === 'boolean') return `${key}=${value}`;
  // Arrays of refs (e.g. multiple fills) -> comma joined
  if (Array.isArray(value) && value.every((x) => typeof x === 'string')) {
    return `${key}=${value.join(',')}`;
  }
  return `${key}=${JSON.stringify(value)}`;
}

const STRUCTURAL = new Set(['id', 'name', 'type', 'children']);

/** Quote a positional tree token if it contains whitespace or a delimiter. */
function treeToken(v) {
  const s = String(v ?? '');
  if (s === '') return '""';
  return /[\s"=|,]/.test(s) ? JSON.stringify(s) : s;
}

function writeTreeNode(node, indent, lines) {
  const id = node.id ?? '';
  const name = node.name ?? '';
  const type = node.type ?? '';
  let line = `${pad(indent)}- ${treeToken(id)} ${treeToken(name)} ${type}`;

  const attrs = [];
  for (const key of Object.keys(node)) {
    if (STRUCTURAL.has(key)) continue;
    const a = treeAttr(key, node[key]);
    if (a) attrs.push(a);
  }
  if (attrs.length) line += ' ' + attrs.join(' ');
  lines.push(line);

  if (Array.isArray(node.children)) {
    for (const child of node.children) writeTreeNode(child, indent + 1, lines);
  }
}

/**
 * Compact positional "tree" format. Structural keys (id, name, type) are encoded
 * positionally on each node line; deduplicated style refs appear as `key=ref`
 * attributes, and the actual style values live in a `globalVars` block emitted
 * as YAML above the tree.
 *
 * Accepts a SimplifiedDesign ({ name, nodes, globalVars }) or a single node.
 */
export function toTree(design) {
  const lines = [];
  const header = {};
  // Only emit a design-level header for an actual SimplifiedDesign (which has a
  // `nodes` array). A bare node also has a `name`, but hoisting it into a header
  // would invent a phantom design named after the node.
  const isDesign = design && typeof design === 'object' && !Array.isArray(design) && Array.isArray(design.nodes);
  if (isDesign) {
    if (design.name !== undefined) header.name = design.name;
    if (design.lastModified !== undefined) header.lastModified = design.lastModified;
    if (design.globalVars !== undefined) header.globalVars = design.globalVars;
  }
  let out = '';
  if (Object.keys(header).length) out += toYaml(header) + '\n';

  const nodes = Array.isArray(design?.nodes)
    ? design.nodes
    : Array.isArray(design)
      ? design
      : design?.children
        ? [design]
        : design?.id
          ? [design]
          : [];

  out += '# nodes\n';
  for (const node of nodes) writeTreeNode(node, 0, lines);
  out += lines.join('\n') + (lines.length ? '\n' : '');
  return out;
}

/**
 * Dispatch helper: serialize a simplified design to the requested format.
 */
export function serialize(design, format = 'yaml') {
  if (format === 'json') return JSON.stringify(design, null, 2);
  if (format === 'tree') return toTree(design);
  return toYaml(design);
}
