/**
 * Open Code Connect Engine for Node.js
 */
import fs from 'node:fs';

export class CodeConnectRegistry {
  constructor(mappings = []) {
    this.mappings = mappings;
  }

  static loadFromFile(filePath) {
    if (!fs.existsSync(filePath)) return new CodeConnectRegistry();
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    const mappings = parsed.mappings || (Array.isArray(parsed) ? parsed : []);
    return new CodeConnectRegistry(mappings);
  }

  findMatch(node) {
    return this.mappings.find(
      (m) =>
        m.target === node.id ||
        m.target?.toLowerCase() === node.name?.toLowerCase() ||
        (node.componentId && m.target === node.componentId)
    );
  }

  generateConnectedCode(node) {
    const mapping = this.findMatch(node);
    if (!mapping) return null;

    if (mapping.template) {
      let code = mapping.template;
      if (node.componentProperties) {
        for (const [k, v] of Object.entries(node.componentProperties)) {
          code = code.replaceAll(`{{${k}}}`, String(v));
        }
      }
      if (node.characters) {
        code = code.replaceAll('{{children}}', node.characters);
        code = code.replaceAll('{{label}}', node.characters);
      }
      return code;
    }

    const propsList = [];
    if (node.componentProperties) {
      for (const [figmaProp, val] of Object.entries(node.componentProperties)) {
        const codeProp = mapping.propsMapping?.[figmaProp] || figmaProp;
        propsList.push(`${codeProp}="${val}"`);
      }
    }

    const propsStr = propsList.length > 0 ? ` ${propsList.join(' ')}` : '';
    const childText = node.characters || '';

    if (!childText) {
      return `<${mapping.componentName}${propsStr} />`;
    }
    return `<${mapping.componentName}${propsStr}>${childText}</${mapping.componentName}>`;
  }

  static scaffoldFromTree(node) {
    const mappings = [];
    function walk(n) {
      if (n.type === 'COMPONENT' || n.type === 'INSTANCE') {
        const importName = n.name.replace(/\s+/g, '');
        mappings.push({
          target: n.name,
          importPath: `@/components/ui/${n.name.toLowerCase().replace(/\s+/g, '-')}`,
          componentName: importName,
          propsMapping: {},
        });
      }
      if (n.children) {
        for (const c of n.children) walk(c);
      }
    }
    walk(node);
    return new CodeConnectRegistry(mappings);
  }
}
