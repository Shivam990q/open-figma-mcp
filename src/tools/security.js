/**
 * High-speed prompt-injection defense and text sanitizer
 */

const SUSPICIOUS_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /system\s+prompt\s*:/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /<system>/i,
  /eval\s*\(/i,
  /document\.cookie/i,
  /window\.location/i,
  /curl\s+/i,
  /wget\s+/i,
  /rm\s+-rf/i,
  /drop\s+table/i,
];

/**
 * Strips zero-width characters and bidirectional override control characters
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
    .replace(/[\u202A-\u202E]/g, '');     // Bidi direction overrides
}

/**
 * Scans a scenegraph node recursively for prompt injection attempts
 */
export function scanPromptInjection(node) {
  const findings = [];

  function traverse(n) {
    if (!n) return;

    if (n.name) {
      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(n.name)) {
          findings.push({
            nodeId: n.id,
            nodeName: n.name,
            field: 'name',
            pattern: pattern.toString(),
            severity: 'HIGH',
          });
          break;
        }
      }
    }

    if (n.characters) {
      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(n.characters)) {
          findings.push({
            nodeId: n.id,
            nodeName: n.name,
            field: 'characters',
            pattern: pattern.toString(),
            severity: 'CRITICAL',
          });
          break;
        }
      }
    }

    if (Array.isArray(n.children)) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return findings;
}
