import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('article-seo handler', () => {
  it('returns next when the mock fetch returns an empty array', async () => {
    const module = await import('../../netlify/edge-functions/article-ssr.js');
    const handler = module.default;

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => [],
      text: async () => '[]'
    });

    const originalDeno = global.Deno;
    global.Deno = {
      env: {
        get: (key) => {
          if (key === 'SUPABASE_URL') return 'http://localhost';
          if (key === 'SUPABASE_KEY' || key === 'SUPABASE_ANON_KEY') return 'test-key';
          return undefined;
        }
      }
    };

    let nextCalled = false;
    const req = {
      next: () => {
        nextCalled = true;
        return new Response('Next Called');
      }
    };

    const request = new Request('https://bharat-viral.netlify.app/article/test-article');

    try {
      await handler(request, req);
      assert.strictEqual(nextCalled, true, "context.next() should have been called");
    } finally {
      global.fetch = originalFetch;
      global.Deno = originalDeno;
    }
  });
});
