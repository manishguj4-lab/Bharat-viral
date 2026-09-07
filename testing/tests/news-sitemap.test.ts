import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('news-sitemap handler', () => {
  it('returns valid XML with recent articles', async () => {
    const { onRequest } = await import('../../functions/news-sitemap.xml.js');
    const originalFetch = global.fetch;

    const now = Date.now();
    const recentDate = new Date(now - 1000 * 60 * 60 * 2).toISOString(); // 2 hours ago

    global.fetch = async (url, options) => {
      assert.ok('apikey' in options.headers, 'apikey header should be present');
      assert.ok('Authorization' in options.headers, 'Authorization header should be present');

      return {
        ok: true,
        json: async () => [
          {
            id: 1,
            slug: 'recent-article',
            title: 'Recent Article',
            published_at: recentDate
          }
        ]
      };
    };

    const context = {
      env: {
        SUPABASE_URL: 'http://localhost',
        SUPABASE_KEY: 'test-key'
      }
    };

    try {
      const response = await onRequest(context);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get('Content-Type'), 'application/xml; charset=UTF-8');

      const body = await response.text();
      assert.ok(body.includes('<loc>https://bharat-viral.pages.dev/article/recent-article</loc>'));
      assert.ok(body.includes('<news:title>Recent Article</news:title>'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('filters out articles older than 48 hours', async () => {
    const { onRequest } = await import('../../functions/news-sitemap.xml.js');
    const originalFetch = global.fetch;

    const now = Date.now();
    const oldDate = new Date(now - 1000 * 60 * 60 * 50).toISOString(); // 50 hours ago

    global.fetch = async () => ({
      ok: true,
      json: async () => [
        {
          id: 1,
          slug: 'old-article',
          title: 'Old Article',
          published_at: oldDate
        }
      ]
    });

    const context = { env: { SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' } };

    try {
      const response = await onRequest(context);
      assert.strictEqual(response.status, 200);
      const body = await response.text();
      assert.ok(!body.includes('old-article'), 'Body should not contain old article');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles fetch errors gracefully and returns empty sitemap', async () => {
    const { onRequest } = await import('../../functions/news-sitemap.xml.js');
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;

    global.fetch = async () => ({ ok: false, status: 500 });

    let consoleErrorCalled = false;
    console.error = () => { consoleErrorCalled = true; };

    const context = { env: { SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' } };

    try {
      const response = await onRequest(context);
      assert.strictEqual(consoleErrorCalled, true, 'console.error should have been called');
      assert.strictEqual(response.status, 200);
      const body = await response.text();
      assert.ok(body.includes('<urlset'), 'Body should contain urlset');
      assert.ok(!body.includes('<url>'), 'Body should not contain any urls');
    } finally {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
    }
  });
});
