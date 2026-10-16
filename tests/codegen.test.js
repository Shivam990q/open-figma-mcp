import test from 'node:test';
import assert from 'node:assert';
import { generateCode } from '../src/tools/codegen.js';

test('generateCode produces React Tailwind component', () => {
  const node = {
    id: '10:20',
    name: 'Primary Button',
    layout: 'row',
    gap: 8,
    padding: [12, 16, 12, 16],
    radius: '$R1',
    text: 'Click Me',
  };

  const code = generateCode(node, 'react-tailwind');
  assert.ok(code.includes('export const PrimaryButton: React.FC'));
  assert.ok(code.includes('flex flex-row'));
  assert.ok(code.includes('gap-2'));
  assert.ok(code.includes('Click Me'));
});

test('generateCode produces Vue 3 SFC', () => {
  const node = {
    id: '10:21',
    name: 'Hero Section',
    layout: 'column',
    gap: 16,
    text: 'Welcome to App',
  };

  const code = generateCode(node, 'vue');
  assert.ok(code.includes('<script setup lang="ts">'));
  assert.ok(code.includes('flex flex-col'));
  assert.ok(code.includes('Welcome to App'));
});

test('generateCode produces Svelte 5 component', () => {
  const node = {
    id: '10:22',
    name: 'CardContainer',
    layout: 'column',
    text: 'Card details',
  };

  const code = generateCode(node, 'svelte');
  assert.ok(code.includes('$props()'));
  assert.ok(code.includes('Card details'));
});
