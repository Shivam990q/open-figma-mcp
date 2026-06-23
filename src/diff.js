/**
 * Semantic design diff between two SimplifiedDesign snapshots (e.g. two file
 * versions, or a node now vs. before).
 *
 * NO other Figma MCP — free or paid — diffs designs. Competitors only LIST
 * versions. This turns OpenFigma into a design-review / PR-gate tool: it answers
 * "what changed in this design since I last implemented it, and do I need to
 * re-code anything?"
 *
 * Matching is by node id (stable across edits); style refs are resolved through
 * each design's own globalVars before comparison, because the dedup ids differ
 * between snapshots.
 */

function indexNodes(design, map = new Map()) {
  for (const node of design?.nodes || []) walk(node, map);
  return map;
}
function walk(node, map) {
  if (!node || !node.id) return;
  map.set(node.id, node);
  (node.children || []).forEach((c) => walk(c, map));
}

const resolve = (design, ref) =>
  typeof ref === 'string' && design.globalVars?.styles ? design.globalVars.styles[ref] : ref;

const j = (v) => (v === undefined ? undefined : JSON.stringify(v));

// Fields compared by resolved value.
const REF_FIELDS = ['fills', 'strokes', 'effects', 'layout', 'textStyle'];
const PLAIN_FIELDS = ['name', 'type', 'text', 'borderRadius', 'opacity'];

function compareNode(baseDesign, headDesign, a, b) {
  const changes = [];

  for (const f of PLAIN_FIELDS) {
    if (j(a[f]) !== j(b[f])) changes.push({ field: f, from: a[f], to: b[f] });
  }
  for (const f of REF_FIELDS) {
    const av = resolve(baseDesign, a[f]);
    const bv = resolve(headDesign, b[f]);
    if (j(av) !== j(bv)) changes.push({ field: f, from: av, to: bv });
  }

  // Geometry: split position (moved) from size (resized).
  const ab = a.boundingBox, bb = b.boundingBox;
  if (ab && bb) {
    if (ab.x !== bb.x || ab.y !== bb.y) {
      changes.push({ field: 'position', from: { x: ab.x, y: ab.y }, to: { x: bb.x, y: bb.y } });
    }
    if (ab.width !== bb.width || ab.height !== bb.height) {
      changes.push({ field: 'size', from: { width: ab.width, height: ab.height }, to: { width: bb.width, height: bb.height } });
    }
  } else if (j(ab) !== j(bb)) {
    changes.push({ field: 'boundingBox', from: ab, to: bb });
  }

  return changes;
}

/**
 * Diff two SimplifiedDesigns. Returns added / removed / changed node lists and
 * a summary. `changed` entries carry the specific field deltas.
 */
export function diffDesigns(baseDesign, headDesign) {
  const baseMap = indexNodes(baseDesign);
  const headMap = indexNodes(headDesign);

  const added = [];
  const removed = [];
  const changed = [];

  for (const [id, node] of headMap) {
    if (!baseMap.has(id)) added.push({ id, name: node.name, type: node.type });
  }
  for (const [id, node] of baseMap) {
    if (!headMap.has(id)) removed.push({ id, name: node.name, type: node.type });
  }
  for (const [id, a] of baseMap) {
    const b = headMap.get(id);
    if (!b) continue;
    const changes = compareNode(baseDesign, headDesign, a, b);
    if (changes.length) changed.push({ id, name: b.name, type: b.type, changes });
  }

  return {
    summary: {
      baseNodes: baseMap.size,
      headNodes: headMap.size,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged: headMap.size - added.length - changed.length,
    },
    added,
    removed,
    changed,
  };
}
