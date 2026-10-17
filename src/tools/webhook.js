/**
 * OpenFigma Webhook Ingestion Engine
 * Handles enterprise Figma Cloud Webhooks (FILE_UPDATE, LIBRARY_PUBLISH, etc.)
 * with cryptographic HMAC-SHA256 signature validation and cache invalidation.
 */

import crypto from 'node:crypto';

/**
 * Validates a Figma Webhook payload against its HMAC-SHA256 signature
 * @param {string} payload - Raw request body string
 * @param {string} signature - Hex signature from X-Figma-Signature or X-Figma-Signature-256 header
 * @param {string} secret - Shared webhook passcode / secret key
 * @returns {boolean} True if signature is cryptographically valid
 */
export function verifyFigmaWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    const digest = hmac.digest('hex');

    // Use constant-time comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature, 'hex');
    const digestBuf = Buffer.from(digest, 'hex');

    if (sigBuf.length !== digestBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, digestBuf);
  } catch {
    return false;
  }
}

/**
 * Processes an incoming validated Figma webhook event
 * @param {object} event - Parsed JSON webhook event from Figma
 * @param {object} [cacheService] - Optional cache service to invalidate entries
 * @returns {object} Processing result with event type and status
 */
export function processFigmaWebhook(event, cacheService) {
  const eventType = event.event_type || event.type || 'UNKNOWN';
  const fileKey = event.file_key || event.key || event.file?.key;
  const timestamp = event.timestamp || new Date().toISOString();

  let actionTaken = 'LOGGED';

  switch (eventType) {
    case 'FILE_UPDATE':
    case 'FILE_VERSION_UPDATE':
      if (fileKey && cacheService?.invalidate) {
        cacheService.invalidate(fileKey);
        actionTaken = 'CACHE_INVALIDATED';
      }
      break;

    case 'LIBRARY_PUBLISH':
      if (cacheService?.invalidateAll) {
        cacheService.invalidateAll();
        actionTaken = 'FULL_CACHE_INVALIDATED';
      }
      break;

    case 'FILE_COMMENT':
      actionTaken = 'COMMENT_NOTED';
      break;

    default:
      actionTaken = 'IGNORED';
  }

  return {
    success: true,
    eventType,
    fileKey: fileKey || null,
    actionTaken,
    timestamp,
  };
}
