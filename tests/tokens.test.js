import test from 'node:test';
import assert from 'node:assert';
import { exportTokens } from '../src/tools/tokens.js';

test('exportTokens generates valid Tailwind v4 theme CSS', () => {
  const symbolTable = {
    colorDefs: { $C1: '#3B82F6', $C2: '#1E293B' },
    radiusDefs: { $R1: 8 },
  };

  const tw4 = exportTokens(symbolTable, 'tailwind-v4');
  assert.ok(tw4.includes('@theme'));
  assert.ok(tw4.includes('--color-c1: #3B82F6;'));
  assert.ok(tw4.includes('--radius-r1: 8px;'));
});

test('exportTokens generates valid W3C DTCG format', () => {
  const symbolTable = {
    colorDefs: { $C1: '#EF4444' },
    radiusDefs: { $R1: 12 },
  };

  const w3c = exportTokens(symbolTable, 'w3c');
  const parsed = JSON.parse(w3c);
  assert.strictEqual(parsed.color.c1.$value, '#EF4444');
  assert.strictEqual(parsed.borderRadius.r1.$value, '12px');
});

test('exportTokens generates valid TypeScript constants', () => {
  const symbolTable = {
    colorDefs: { $C1: '#10B981' },
    radiusDefs: { $R1: 4 },
  };

  const ts = exportTokens(symbolTable, 'typescript');
  assert.ok(ts.includes("export const tokens = {"));
  assert.ok(ts.includes("'c1': '#10B981'"));
});
