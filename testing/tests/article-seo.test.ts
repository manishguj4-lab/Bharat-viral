import { describe, it } from 'node:test';
import assert from 'node:assert';
import { onRequest } from '../../functions/article/[slug].js';

describe('article-seo handler', () => {
  it('returns 404 when the mock fetch returns an empty array', async () => {
    // Mock the global fetch
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => [],
      text: async () => '[]'
    });

    // Mock HTMLRewriter since it is a Cloudflare global, not present in Node
    class MockHTMLRewriter {
      on() {
        return this; // Chainable mock
      }
      transform(response) {
        return response; // Just return original response for testing purposes
      }
    }
    global.HTMLRewriter = MockHTMLRewriter;

    const context = {
      params: { slug: 'test-article' },
      env: {
        SUPABASE_URL: 'http://localhost',
        SUPABASE_KEY: 'test-key',
        ASSETS: {
          fetch: async () => new Response("Template content")
        }
      },
      request: new Request('https://bharat-viral.pages.dev/article/test-article')
    };

    const response = await onRequest(context);

    // Check status
    assert.strictEqual(response.status, 404);

    // Check response body
    const text = await response.text();
    assert.strictEqual(text, 'Article not found');

    // Check headers
    assert.strictEqual(response.headers.get('Content-Type'), 'text/plain; charset=UTF-8');
    assert.strictEqual(response.headers.get('X-Robots-Tag'), 'noindex');

    // Clean up
    global.fetch = originalFetch;
    delete global.HTMLRewriter;
  });
});
