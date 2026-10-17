/**
 * OpenFigma Enterprise Prometheus Metrics Registry
 * Tracks request latencies, token savings, DLP violations, and security events.
 */

class MetricsRegistry {
  constructor() {
    this.requests = new Map(); // key: toolName, val: count
    this.errors = new Map(); // key: toolName, val: count
    this.webhooks = new Map(); // key: eventType, val: count
    this.tokensSavedTotal = 0;
    this.dlpViolationsTotal = 0;
    this.injectionsBlockedTotal = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.startTime = Date.now();
  }

  recordRequest(toolName) {
    const current = this.requests.get(toolName) || 0;
    this.requests.set(toolName, current + 1);
  }

  recordError(toolName) {
    const current = this.errors.get(toolName) || 0;
    this.errors.set(toolName, current + 1);
  }

  recordWebhook(eventType) {
    const current = this.webhooks.get(eventType) || 0;
    this.webhooks.set(eventType, current + 1);
  }

  recordTokensSaved(count) {
    if (typeof count === 'number' && count > 0) {
      this.tokensSavedTotal += count;
    }
  }

  recordDlpViolation() {
    this.dlpViolationsTotal++;
  }

  recordInjectionBlocked() {
    this.injectionsBlockedTotal++;
  }

  recordCacheHit() {
    this.cacheHits++;
  }

  recordCacheMiss() {
    this.cacheMisses++;
  }

  /**
   * Generates Prometheus-compatible exposition format (text/plain; version=0.0.4)
   * @param {number} activeBridgeConnections - Current live WebSocket connections
   * @returns {string} Prometheus formatted metrics string
   */
  toPrometheus(activeBridgeConnections = 0) {
    const lines = [];

    lines.push('# HELP open_figma_uptime_seconds OpenFigma daemon uptime in seconds');
    lines.push('# TYPE open_figma_uptime_seconds gauge');
    lines.push(`open_figma_uptime_seconds ${Math.floor((Date.now() - this.startTime) / 1000)}`);

    lines.push('# HELP open_figma_requests_total Total number of MCP requests by tool');
    lines.push('# TYPE open_figma_requests_total counter');
    if (this.requests.size === 0) {
      lines.push('open_figma_requests_total{tool="none"} 0');
    } else {
      for (const [tool, count] of this.requests.entries()) {
        lines.push(`open_figma_requests_total{tool="${tool}"} ${count}`);
      }
    }

    lines.push('# HELP open_figma_errors_total Total number of failed MCP requests by tool');
    lines.push('# TYPE open_figma_errors_total counter');
    if (this.errors.size === 0) {
      lines.push('open_figma_errors_total{tool="none"} 0');
    } else {
      for (const [tool, count] of this.errors.entries()) {
        lines.push(`open_figma_errors_total{tool="${tool}"} ${count}`);
      }
    }

    lines.push('# HELP open_figma_tokens_saved_total Total LLM tokens saved via Canonical Semantic Model pruning');
    lines.push('# TYPE open_figma_tokens_saved_total counter');
    lines.push(`open_figma_tokens_saved_total ${this.tokensSavedTotal}`);

    lines.push('# HELP open_figma_dlp_violations_total Total design secrets (API keys) caught and redacted');
    lines.push('# TYPE open_figma_dlp_violations_total counter');
    lines.push(`open_figma_dlp_violations_total ${this.dlpViolationsTotal}`);

    lines.push('# HELP open_figma_prompt_injections_blocked_total Total prompt injection attempts neutralized');
    lines.push('# TYPE open_figma_prompt_injections_blocked_total counter');
    lines.push(`open_figma_prompt_injections_blocked_total ${this.injectionsBlockedTotal}`);

    lines.push('# HELP open_figma_cache_hits_total Total L1/L2 cache hits');
    lines.push('# TYPE open_figma_cache_hits_total counter');
    lines.push(`open_figma_cache_hits_total ${this.cacheHits}`);

    lines.push('# HELP open_figma_cache_misses_total Total L1/L2 cache misses');
    lines.push('# TYPE open_figma_cache_misses_total counter');
    lines.push(`open_figma_cache_misses_total ${this.cacheMisses}`);

    lines.push('# HELP open_figma_active_bridge_connections Currently active desktop companion plugin connections');
    lines.push('# TYPE open_figma_active_bridge_connections gauge');
    lines.push(`open_figma_active_bridge_connections ${activeBridgeConnections}`);

    lines.push('# HELP open_figma_webhooks_received_total Total Figma webhooks processed by event type');
    lines.push('# TYPE open_figma_webhooks_received_total counter');
    if (this.webhooks.size === 0) {
      lines.push('open_figma_webhooks_received_total{event="none"} 0');
    } else {
      for (const [evt, count] of this.webhooks.entries()) {
        lines.push(`open_figma_webhooks_received_total{event="${evt}"} ${count}`);
      }
    }

    return lines.join('\n') + '\n';
  }
}

export const metrics = new MetricsRegistry();
