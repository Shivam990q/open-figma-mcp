/**
 * Code-to-Canvas Transpiler in JavaScript
 * Converts HTML/JSX/Tailwind snippets into CanonicalNode trees.
 */

export function transpileCodeToNodes(code) {
  const warnings = [];
  const nodes = parseElements(code, warnings);
  return { rootNodes: nodes, warnings };
}

function parseElements(html, warnings) {
  const nodes = [];
  const openRe = /<([a-zA-Z0-9_-]+)([^>]*?)(\/?)>/g;

  let cursor = 0;
  let idCounter = 1;
  let match;

  while ((match = openRe.exec(html)) !== null) {
    const tagName = match[1];
    const attrsStr = match[2];
    const isSelfClosing = match[3] === '/';

    const id = `code_node_${idCounter++}`;
    const nodeType = ['button', 'div', 'section', 'main', 'card'].includes(tagName.toLowerCase())
      ? 'FRAME'
      : ['span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label'].includes(tagName.toLowerCase())
      ? 'TEXT'
      : 'FRAME';

    const node = {
      id,
      name: `${capitalize(tagName)}Layer`,
      type: nodeType,
      visible: true,
      bbox: { x: 0, y: 0, width: 320, height: 48 },
      layoutMode: 'NONE',
      fills: [],
      strokes: [],
      effects: [],
      children: [],
    };

    // Extract classes
    const classMatch = attrsStr.match(/(?:class|className)=["']([^"']+)["']/);
    if (classMatch) {
      applyTailwindClasses(node, classMatch[1]);
    }

    if (isSelfClosing) {
      nodes.push(node);
    } else {
      const closeTag = `</${tagName}>`;
      const closeIdx = html.indexOf(closeTag, openRe.lastIndex);
      if (closeIdx !== -1) {
        const innerContent = html.substring(openRe.lastIndex, closeIdx).trim();
        if (innerContent) {
          if (innerContent.includes('<')) {
            node.children = parseElements(innerContent, warnings);
          } else {
            node.characters = innerContent;
            if (node.type === 'FRAME') {
              node.children.push({
                id: `${id}_text`,
                name: 'Label',
                type: 'TEXT',
                visible: true,
                bbox: { x: 0, y: 0, width: 0, height: 0 },
                characters: innerContent,
                style: { fontSize: 14, fontWeight: 500, fontFamily: 'Inter' },
                fills: node.fills.length > 0 ? [{ ...node.fills[0] }] : [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
                children: [],
              });
            }
          }
        }
        openRe.lastIndex = closeIdx + closeTag.length;
      }
      nodes.push(node);
    }
  }

  return nodes;
}

function applyTailwindClasses(node, classes) {
  for (const token of classes.split(/\s+/)) {
    if (token === 'flex') node.layoutMode = 'HORIZONTAL';
    if (token === 'flex-col') node.layoutMode = 'VERTICAL';
    if (token === 'rounded-lg') node.cornerRadius = 8;
    if (token === 'rounded-md') node.cornerRadius = 6;
    if (token === 'rounded-full') node.cornerRadius = 9999;

    if (token === 'bg-blue-600' || token === 'bg-blue-500') {
      node.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.5, b: 0.95, a: 1 }, opacity: 1, visible: true }];
    }
    if (token === 'bg-white') {
      node.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }];
    }
    if (token === 'bg-black') {
      node.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }];
    }

    if (token.startsWith('p-')) {
      const px = parseFloat(token.replace('p-', '')) * 4;
      node.padding = { top: px, right: px, bottom: px, left: px };
    }
    if (token.startsWith('gap-')) {
      node.itemSpacing = parseFloat(token.replace('gap-', '')) * 4;
    }
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
