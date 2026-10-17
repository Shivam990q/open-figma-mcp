import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScenegraphReducer } from '../src/tools/fetch.js';
import { exportTokens } from '../src/tools/tokens.js';
import { generateCode } from '../src/tools/codegen.js';
import { scanPromptInjection } from '../src/tools/security.js';
import { scanDlpLeaks } from '../src/tools/dlp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('desktop backend correctly parses fixture scenegraph and runs CSM reducer', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'enterprise_design_system.json');
  assert.ok(fs.existsSync(fixturePath), 'Fixture must exist');
  
  const rawData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.equal(rawData.name, 'Enterprise Design System Core');
  
  const reducer = new ScenegraphReducer();
  const csm = reducer.reduceNode(rawData.document);
  assert.ok(csm, 'CSM document must be created');
  assert.equal(csm.type, 'DOCUMENT');
  assert.ok(csm.children.length > 0, 'Children must exist in CSM');
});

test('desktop backend generates React, Vue, and Svelte code from selected node', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'enterprise_design_system.json');
  const rawData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const targetNode = rawData.document.children[0]?.children?.[0] || rawData.document;
  
  const reactCode = generateCode(targetNode, 'react-tailwind');
  assert.ok(reactCode.includes('import React'), 'Must produce React component');
  
  const vueCode = generateCode(targetNode, 'vue');
  assert.ok(vueCode.includes('<template>'), 'Must produce Vue SFC');
  
  const svelteCode = generateCode(targetNode, 'svelte');
  assert.ok(svelteCode.includes('$props()') || svelteCode.includes('<script>'), 'Must produce Svelte 5 component');
});

test('desktop backend exports tokens in Tailwind v4 and W3C DTCG format', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'enterprise_design_system.json');
  const rawData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  
  const twTokens = exportTokens(rawData.globalVars, 'tailwind-v4');
  assert.ok(twTokens.includes('@theme'), 'Must contain @theme directive');
  assert.ok(twTokens.includes('--color-primary'), 'Must export primary color');
  
  const w3cTokens = exportTokens(rawData.globalVars, 'w3c');
  const parsed = JSON.parse(w3cTokens);
  assert.ok(parsed.color, 'Must contain color category');
});

test('desktop backend runs APCA contrast, prompt injection, and DLP scans', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures', 'enterprise_design_system.json');
  const rawData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  
  const injections = scanPromptInjection(rawData.document);
  assert.equal(injections.length, 0, 'Clean fixture should have 0 prompt injections');
  
  const leaks = scanDlpLeaks(rawData.document);
  assert.equal(leaks.length, 0, 'Clean fixture should have 0 DLP leaks');
});
