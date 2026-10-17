import test from 'node:test';
import assert from 'node:assert';
import { OmniRouter } from '../src/tools/omni-router.js';

test('OmniRouter RTK token compression collapses excess whitespace', () => {
  const router = new OmniRouter();
  const raw = '  function   renderButton(  )   {\r\n\r\n\r\n    return `<button>Click</button>`;\n\n\n}  ';
  const compressed = router.compressContext(raw);
  assert.strictEqual(compressed, 'function renderButton( ) {\n\n return `<button>Click</button>`;\n\n}');
});

test('OmniRouter resolves fallback chain correctly by tiers', () => {
  const router = new OmniRouter();
  const chain = router.resolveFallbackChain();
  assert.ok(chain.length > 5);
  // Ensure Tier 1 candidates come before Tier 2 and Tier 3
  const tier1Index = chain.findIndex((c) => c.tier === 1);
  const tier2Index = chain.findIndex((c) => c.tier === 2);
  const tier3Index = chain.findIndex((c) => c.tier === 3);
  assert.ok(tier1Index < tier2Index);
  assert.ok(tier2Index < tier3Index);
});

test('OmniRouter places preferred model at head of fallback chain', () => {
  const router = new OmniRouter();
  const chain = router.resolveFallbackChain('deepseek-chat');
  assert.strictEqual(chain[0].model, 'deepseek-chat');
  assert.strictEqual(chain[0].provider, 'deepseek');
});

test('OmniRouter formats Anthropic and Gemini schemas correctly', () => {
  const router = new OmniRouter();
  const messages = [
    { role: 'system', content: 'You are a design engine.' },
    { role: 'user', content: 'Generate a glassmorphic card.' },
    { role: 'assistant', content: 'Here is the card.' },
  ];

  const anthropic = router.translateToAnthropic(messages);
  assert.strictEqual(anthropic.system, 'You are a design engine.');
  assert.strictEqual(anthropic.messages.length, 2);
  assert.strictEqual(anthropic.messages[0].role, 'user');
  assert.strictEqual(anthropic.messages[1].role, 'assistant');

  const gemini = router.translateToGemini(messages);
  assert.strictEqual(gemini.contents.length, 3);
  assert.strictEqual(gemini.contents[0].role, 'user');
  assert.strictEqual(gemini.contents[2].role, 'model');
});

test('OmniRouter executes automatic fallback when primary provider fails', async () => {
  const router = new OmniRouter();
  let callCount = 0;

  // Mock fetch: Anthropic endpoints fail with 429 rate limit, OpenAI succeeds
  const mockFetch = async (url, options) => {
    callCount++;
    if (url.includes('anthropic.com')) {
      return {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: { type: 'rate_limit_error', message: 'Quota exceeded' } }),
      };
    }

    // Fallback succeeds on OpenAI endpoint
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: 'SUCCESSFUL_FALLBACK_GENERATION' } },
        ],
      }),
    };
  };

  const result = await router.dispatch({
    messages: [
      { role: 'user', content: 'Create a responsive navigation bar' },
    ],
    preferredModel: 'claude-3-7-sonnet',
    mockFetch,
  });

  assert.strictEqual(result.content, 'SUCCESSFUL_FALLBACK_GENERATION');
  assert.ok(callCount >= 2);
  assert.ok(result.provider);
  assert.ok(result.model);
});

test('OmniRouter handles Gemini response format cleanly', async () => {
  const router = new OmniRouter();

  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text: 'GEMINI_AST_PAYLOAD' }],
          },
        },
      ],
    }),
  });

  const result = await router.dispatch({
    messages: [{ role: 'user', content: 'Generate button' }],
    preferredModel: 'gemini-2.0-flash',
    mockFetch,
  });

  assert.strictEqual(result.content, 'GEMINI_AST_PAYLOAD');
  assert.strictEqual(result.provider, 'gemini');
});
