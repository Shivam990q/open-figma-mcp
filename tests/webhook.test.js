import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { verifyFigmaWebhookSignature, processFigmaWebhook } from '../src/tools/webhook.js';

test('verifyFigmaWebhookSignature validates authentic HMAC signature', () => {
  const secret = 'super-secret-passcode-1234';
  const payload = JSON.stringify({ event_type: 'FILE_UPDATE', file_key: 'abc123xyz' });

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const validSignature = hmac.digest('hex');

  const isValid = verifyFigmaWebhookSignature(payload, validSignature, secret);
  assert.strictEqual(isValid, true);
});

test('verifyFigmaWebhookSignature rejects tampered or fraudulent signature', () => {
  const secret = 'super-secret-passcode-1234';
  const payload = JSON.stringify({ event_type: 'FILE_UPDATE', file_key: 'abc123xyz' });
  const fraudulentSig = 'deadbeefcafebabe0123456789abcdefdeadbeefcafebabe0123456789abcdef';

  const isValid = verifyFigmaWebhookSignature(payload, fraudulentSig, secret);
  assert.strictEqual(isValid, false);
});

test('processFigmaWebhook handles FILE_UPDATE and invalidates target cache', () => {
  let invalidatedKey = null;
  const mockCache = {
    invalidate: (k) => { invalidatedKey = k; },
  };

  const event = {
    event_type: 'FILE_UPDATE',
    file_key: 'figma_file_999',
    timestamp: '2026-10-17T05:30:00Z',
  };

  const result = processFigmaWebhook(event, mockCache);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.actionTaken, 'CACHE_INVALIDATED');
  assert.strictEqual(invalidatedKey, 'figma_file_999');
});

test('processFigmaWebhook handles LIBRARY_PUBLISH and invalidates all cache', () => {
  let allInvalidated = false;
  const mockCache = {
    invalidateAll: () => { allInvalidated = true; },
  };

  const event = {
    event_type: 'LIBRARY_PUBLISH',
    file_key: 'shared_lib_001',
  };

  const result = processFigmaWebhook(event, mockCache);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.actionTaken, 'FULL_CACHE_INVALIDATED');
  assert.strictEqual(allInvalidated, true);
});
