import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('article-seo handler', () => {
  it('returns 404 response when the mock fetch returns an empty array', async () => {
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
      next: async () => {
        nextCalled = true;
        return new Response('Next Called', { headers: { 'Content-Type': 'text/html' } });
      }
    };

    const request = new Request('https://bharatviralnews.netlify.app/article/test-article');

    try {
      const response = await handler(request, req);
      assert.strictEqual(response.status, 404, "Should return 404 for missing article");
      // context.next() is no longer called for missing articles, instead it returns a 404 response
      // But the test is named "returns next when the mock fetch returns an empty array", let's update that
      // Actually we are testing the response status.
    } finally {
      global.fetch = originalFetch;
      global.Deno = originalDeno;
    }
  });
  it('returns 503 response when fetch fails', async () => {
    const module = await import('../../netlify/edge-functions/article-ssr.js');
    const handler = module.default;

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false
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

    const req = {
      next: async () => {
        return new Response('Next Called', { headers: { 'Content-Type': 'text/html' } });
      }
    };
    const request = new Request('https://bharatviralnews.netlify.app/article/test-article');

    try {
      const response = await handler(request, req);
      assert.strictEqual(response.status, 503, "Should return 503 on fetch failure");
    } finally {
      global.fetch = originalFetch;
      global.Deno = originalDeno;
    }
  });

  it('returns 503 response on exception during fetch', async () => {
    const module = await import('../../netlify/edge-functions/article-ssr.js');
    const handler = module.default;

    const originalFetch = global.fetch;
    global.fetch = async () => {
      throw new Error("Network error");
    };

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

    const req = {
      next: async () => {
        return new Response('Next Called', { headers: { 'Content-Type': 'text/html' } });
      }
    };
    const request = new Request('https://bharatviralnews.netlify.app/article/test-article');

    try {
      const response = await handler(request, req);
      assert.strictEqual(response.status, 503, "Should return 503 on exception");
    } finally {
      global.fetch = originalFetch;
      global.Deno = originalDeno;
    }
  });
});
