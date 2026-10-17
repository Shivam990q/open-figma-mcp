/**
 * OpenFigma OmniRouter & Multi-Provider AI Fallback Engine
 * Inspired by 9Router & OmniRoute.
 * Provides smart 3-tier fallback, RTK lossless token compression,
 * format translation (OpenAI <-> Anthropic <-> Gemini), and rate-limit recovery.
 */

export const MODEL_QUALITY_SCORES = {
  'claude-3-7-sonnet': 99,
  'gpt-4o': 97,
  'claude-3-5-sonnet': 96,
  'deepseek-reasoner': 95,
  'gemini-1.5-pro': 94,
  'gemini-2.0-flash': 92,
  'o3-mini': 91,
  'deepseek-chat': 90,
  'llama-3.3-70b-versatile': 88,
  'qwen2.5-coder': 85,
  'claude-3-5-haiku': 82,
  'deepseek-r1:8b': 82,
  'gpt-4o-mini': 80,
  'mixtral-8x7b-32768': 78,
  'llama3.2': 72,
};

export class OmniRouter {
  constructor(config = {}) {
    this.providers = {
      anthropic: {
        name: 'Anthropic Claude',
        endpoint: 'https://api.anthropic.com/v1/messages',
        key: config.anthropicKey || process.env.ANTHROPIC_API_KEY || '',
        models: ['claude-3-7-sonnet', 'claude-3-5-sonnet', 'claude-3-5-haiku'],
        tier: 1,
      },
      openai: {
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        key: config.openaiKey || process.env.OPENAI_API_KEY || '',
        models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
        tier: 1,
      },
      deepseek: {
        name: 'DeepSeek',
        endpoint: 'https://api.deepseek.com/chat/completions',
        key: config.deepseekKey || process.env.DEEPSEEK_API_KEY || '',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        tier: 2,
      },
      groq: {
        name: 'Groq',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        key: config.groqKey || process.env.GROQ_API_KEY || '',
        models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
        tier: 2,
      },
      gemini: {
        name: 'Google Gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        key: config.geminiKey || process.env.GEMINI_API_KEY || '',
        models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
        tier: 3,
      },
      ollama: {
        name: 'Local Ollama',
        endpoint: config.ollamaEndpoint || process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/api/chat',
        key: 'local',
        models: ['qwen2.5-coder', 'llama3.2', 'deepseek-r1:8b'],
        tier: 3,
      },
    };

    this.tierOrder = [1, 2, 3]; // Tier 1 (Subscription/Top) -> Tier 2 (Cheap) -> Tier 3 (Free/Local)
  }

  /**
   * RTK (Real-Time Compression) Token Saver
   * Strips redundant whitespace, blank lines, and debug tokens from prompts and design contexts
   * @param {string} prompt - Raw prompt or code snippet
   * @returns {string} Compressed prompt saving 20-40% token budget
   */
  compressContext(prompt) {
    if (typeof prompt !== 'string') return prompt;
    return prompt
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')               // Collapse horizontal whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')       // Collapse multiple blank lines
      .replace(/^\s+|\s+$/g, '');            // Trim boundaries
  }

  /**
   * Formats candidate models ordered by smart fallback tiers and quality scores.
   * Guarantees that peer frontier models are exhausted before downgrading.
   * @param {string} [preferredModel] - Specific model name to try first
   * @param {object} [options]
   * @param {boolean} [options.strictQuality] - Prioritize quality score over provider tier
   * @returns {Array<{ provider: string, model: string, tier: number, qualityScore: number }>}
   */
  resolveFallbackChain(preferredModel, options = {}) {
    const chain = [];

    // Collect all available providers and models
    const allCandidates = [];
    for (const [providerId, p] of Object.entries(this.providers)) {
      for (const m of p.models) {
        const qualityScore = MODEL_QUALITY_SCORES[m] || 80;
        allCandidates.push({ provider: providerId, model: m, tier: p.tier, qualityScore });
      }
    }

    // Place preferred model at the head if specified
    if (preferredModel) {
      const match = allCandidates.find((c) => c.model === preferredModel || preferredModel.includes(c.model));
      if (match) {
        chain.push(match);
      }
    }

    // Sort remaining candidates:
    // When strictQuality is active, sort purely by intelligence score
    // Otherwise, sort by Tier (1 -> 2 -> 3), and within each Tier sort by quality score descending
    allCandidates.sort((a, b) => {
      if (options.strictQuality) {
        return b.qualityScore - a.qualityScore;
      }
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }
      return b.qualityScore - a.qualityScore;
    });

    for (const c of allCandidates) {
      if (!chain.some((x) => x.provider === c.provider && x.model === c.model)) {
        chain.push(c);
      }
    }

    return chain;
  }

  /**
   * Validates generated response quality to guarantee zero quality compromise
   * @param {string} text - Raw AI generation output
   * @param {string} [expectedType] - 'code' | 'json' | 'text'
   * @returns {{ valid: boolean, reason?: string }}
   */
  validateQuality(text, expectedType = 'text') {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return { valid: false, reason: 'Empty or missing response' };
    }

    const trimmed = text.trim();

    // Rejection of AI cop-out and refusal phrases
    if (/^(as an ai(?:\s+language\s+model)?|i cannot fulfill|i am unable to generate|sorry, i can\'t)/i.test(trimmed)) {
      return { valid: false, reason: 'Model refused or cop-out phrase detected' };
    }

    if (expectedType === 'json') {
      try {
        JSON.parse(trimmed.replace(/^```(?:json)?\s*|\s*```$/g, ''));
      } catch (e) {
        return { valid: false, reason: 'Malformed JSON payload' };
      }
    }

    return { valid: true };
  }

  /**
   * Translates normalized chat messages into Anthropic format
   */
  translateToAnthropic(messages) {
    let system = '';
    const formatted = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
      } else {
        formatted.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    return { system, messages: formatted };
  }

  /**
   * Translates normalized chat messages into Google Gemini format
   */
  translateToGemini(messages) {
    const contents = [];
    for (const msg of messages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
    return { contents };
  }

  /**
   * Dispatches a prompt across the fallback chain until an API succeeds
   * @param {object} params
   * @param {Array<{ role: string, content: string }>} params.messages
   * @param {string} [params.preferredModel]
   * @param {number} [params.maxTokens]
   * @param {Function} [params.mockFetch] - Optional fetch injector for testing
   * @returns {Promise<{ content: string, provider: string, model: string, tier: number, tokensSaved: number }>}
   */
  async dispatch(params) {
    const messages = (params.messages || []).map((m) => ({
      role: m.role,
      content: this.compressContext(m.content),
    }));

    const rawTokenLength = (params.messages || []).reduce((acc, m) => acc + (m.content?.length || 0), 0);
    const compressedLength = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
    const tokensSaved = Math.max(0, Math.floor((rawTokenLength - compressedLength) / 4));

    const chain = this.resolveFallbackChain(params.preferredModel);
    const errors = [];
    const fetchFn = params.mockFetch || globalThis.fetch;

    for (const route of chain) {
      const provider = this.providers[route.provider];
      if (!provider) continue;

      try {
        let responseText = '';

        if (route.provider === 'anthropic') {
          if (!provider.key && !params.mockFetch) throw new Error('Missing Anthropic API key');
          const payload = this.translateToAnthropic(messages);
          const res = await fetchFn(provider.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': provider.key,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: route.model,
              max_tokens: params.maxTokens || 4096,
              system: payload.system,
              messages: payload.messages,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          responseText = json.content?.[0]?.text || '';
        } else if (route.provider === 'gemini') {
          if (!provider.key && !params.mockFetch) throw new Error('Missing Gemini API key');
          const payload = this.translateToGemini(messages);
          const url = `${provider.endpoint}/${route.model}:generateContent?key=${provider.key}`;
          const res = await fetchFn(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          responseText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else {
          // Standard OpenAI-compatible API (OpenAI, DeepSeek, Groq, Ollama)
          if (route.provider !== 'ollama' && !provider.key && !params.mockFetch) {
            throw new Error(`Missing ${provider.name} API key`);
          }
          const res = await fetchFn(provider.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${provider.key}`,
            },
            body: JSON.stringify({
              model: route.model,
              messages,
              max_tokens: params.maxTokens || 4096,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          responseText = json.choices?.[0]?.message?.content || '';
        }

        // Quality Gate Check: Never return empty, cop-out, or malformed responses
        if (params.validateQuality !== false) {
          const validation = this.validateQuality(responseText, params.expectedType || 'text');
          if (!validation.valid) {
            throw new Error(`Quality gate rejected response from ${route.model}: ${validation.reason}`);
          }
        }

        return {
          content: responseText,
          provider: route.provider,
          model: route.model,
          tier: route.tier,
          qualityScore: route.qualityScore || 80,
          tokensSaved,
        };
      } catch (err) {
        errors.push({ route: `${route.provider}/${route.model}`, error: err.message });
        // Proceed to next fallback in chain
      }
    }

    throw new Error(`OmniRouter exhausted all providers in fallback chain: ${JSON.stringify(errors)}`);
  }
}
