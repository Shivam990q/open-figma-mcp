/**
 * Multi-framework component code generator
 */

export function generateCode(node, framework = 'react-tailwind') {
  if (!node) return '// No node provided';

  switch (framework) {
    case 'react-tailwind':
      return generateReactTailwind(node);
    case 'vue':
      return generateVue(node);
    case 'svelte':
      return generateSvelte(node);
    case 'angular':
      return generateAngular(node);
    case 'html-css':
      return generateHtmlCss(node);
    default:
      return generateReactTailwind(node);
  }
}

function sanitizeName(name) {
  if (!name) return 'Component';
  return name
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') || 'Component';
}

function getTailwindClasses(node) {
  const classes = [];
  if (node.layout === 'row') classes.push('flex', 'flex-row');
  else if (node.layout === 'column') classes.push('flex', 'flex-col');

  if (node.gap) {
    if (node.gap <= 4) classes.push('gap-1');
    else if (node.gap <= 8) classes.push('gap-2');
    else if (node.gap <= 16) classes.push('gap-4');
    else classes.push('gap-6');
  }

  if (node.padding) {
    classes.push('p-4');
  }

  if (node.radius) {
    classes.push('rounded-lg');
  }

  classes.push('bg-white', 'text-slate-900');
  return classes.join(' ');
}

function generateReactTailwind(node) {
  const name = sanitizeName(node.name);
  const classes = getTailwindClasses(node);
  const text = node.text ? `      <span>{props.label || '${node.text}'}</span>\n` : '';

  return `import React from 'react';

export interface ${name}Props {
  className?: string;
  label?: string;
  children?: React.ReactNode;
}

export const ${name}: React.FC<${name}Props> = ({ className = '', label, children }) => {
  return (
    <div className="${classes} \${className}">
${text}      {children}
    </div>
  );
};

export default ${name};
`;
}

function generateVue(node) {
  const name = sanitizeName(node.name);
  const classes = getTailwindClasses(node);

  return `<script setup lang="ts">
defineProps<{
  customClass?: string;
}>();
</script>

<template>
  <div :class="['${classes}', customClass]">
    <slot>${node.text || name}</slot>
  </div>
</template>
`;
}

function generateSvelte(node) {
  const name = sanitizeName(node.name);
  const classes = getTailwindClasses(node);

  return `<script lang="ts">
  let { class: customClass = '', children } = $props();
</script>

<div class="${classes} {customClass}">
  {#if children}
    {@render children()}
  {:else}
    <span>${node.text || name}</span>
  {/if}
</div>
`;
}

function generateAngular(node) {
  const name = sanitizeName(node.name);
  const selector = name.toLowerCase();
  const classes = getTailwindClasses(node);

  return `import { Component, input } from '@angular/core';

@Component({
  selector: 'app-${selector}',
  standalone: true,
  template: \`
    <div class="${classes}">
      <ng-content>${node.text || name}</ng-content>
    </div>
  \`,
})
export class ${name}Component {
  customClass = input<string>('');
}
`;
}

function generateHtmlCss(node) {
  const classes = getTailwindClasses(node);
  return `<!-- ${node.name} -->
<div class="${classes}">
  <span>${node.text || node.name}</span>
</div>
`;
}
