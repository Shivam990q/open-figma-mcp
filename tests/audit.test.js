import test from 'node:test';
import assert from 'node:assert';
import { auditColors, wcagContrast, apcaContrast } from '../src/tools/audit.js';

test('contrast audit scores black on white correctly', () => {
  const black = { r: 0, g: 0, b: 1 };
  const white = { r: 1, g: 1, b: 1 };

  const wcag = wcagContrast(black, white);
  assert.ok(wcag >= 8);

  const apca = apcaContrast(black, white);
  assert.ok(Math.abs(apca) >= 60);
});
