import { test } from 'node:test';
import assert from 'node:assert';
import { metrics } from '../src/tools/metrics.js';

test('metrics registry records requests and formats Prometheus exposition', () => {
  metrics.recordRequest('get_figma_data');
  metrics.recordRequest('get_figma_data');
  metrics.recordRequest('generate_code');
  metrics.recordTokensSaved(12400);
  metrics.recordDlpViolation();
  metrics.recordInjectionBlocked();
  metrics.recordCacheHit();

  const output = metrics.toPrometheus(1);
  assert.ok(output.includes('# TYPE open_figma_requests_total counter'));
  assert.ok(output.includes('open_figma_requests_total{tool="get_figma_data"}'));
  assert.ok(output.includes('open_figma_tokens_saved_total'));
  assert.ok(output.includes('open_figma_dlp_violations_total 1'));
  assert.ok(output.includes('open_figma_prompt_injections_blocked_total 1'));
  assert.ok(output.includes('open_figma_active_bridge_connections 1'));
});
