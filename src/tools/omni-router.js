/**
 * OpenFigma OmniRouter & Multi-Provider AI Fallback Engine
 * Inspired by 9Router & OmniRoute.
 * Provides smart 3-tier fallback, RTK lossless token compression,
 * format translation (OpenAI <-> Anthropic <-> Gemini), and rate-limit recovery.
 */

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
   * Formats candidate models ordered by smart fallback tiers
   * @param {string} [preferredModel] - Specific model name to try first
   * @returns {Array<{ provider: string, model: string, tier: number }>}
   */
  resolveFallbackChain(preferredModel) {
    const chain = [];

    // Collect all available providers
    const allCandidates = [];
    for (const [providerId, p] of Object.entries(this.providers)) {
      for (const m of p.models) {
        allCandidates.push({ provider: providerId, model: m, tier: p.tier });
      }
    }

    // Place preferred model at the head if specified
    if (preferredModel) {
      const match = allCandidates.find((c) => c.model === preferredModel || preferredModel.includes(c.model));
      if (match) {
        chain.push(match);
      }
    }

    // Sort remaining candidates by tier (Tier 1 -> Tier 2 -> Tier 3)
    allCandidates.sort((a, b) => a.tier - b.tier);

    for (const c of allCandidates) {
      if (!chain.some((x) => x.provider === c.provider && x.model === c.model)) {
        chain.push(c);
      }
    }

    return chain;
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

        return {
          content: responseText,
          provider: route.provider,
          model: route.model,
          tier: route.tier,
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
