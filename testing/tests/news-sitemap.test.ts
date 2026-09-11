import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('news-sitemap handler', () => {
  it('returns valid XML with recent articles', async () => {
    const module = await import('../../netlify/functions/news-sitemap.js');
    const handler = module.default;
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

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

    try {
      const req = new Request('https://bharat-viral.netlify.app/news-sitemap.xml');
      const response = await handler(req, {});

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get('Content-Type'), 'application/xml; charset=UTF-8');

      const body = await response.text();
      assert.ok(body.includes('<loc>https://bharat-viral.netlify.app/article/recent-article</loc>'));
      assert.ok(body.includes('<news:title>Recent Article</news:title>'));
    } finally {
      global.fetch = originalFetch;
      process.env = originalEnv;
    }
  });

  it('filters out articles older than 48 hours', async () => {
    const module = await import('../../netlify/functions/news-sitemap.js');
    const handler = module.default;
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

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

    try {
      const req = new Request('https://bharat-viral.netlify.app/news-sitemap.xml');
      const response = await handler(req, {});
      assert.strictEqual(response.status, 200);
      const body = await response.text();
      assert.ok(!body.includes('old-article'), 'Body should not contain old article');
    } finally {
      global.fetch = originalFetch;
      process.env = originalEnv;
    }
  });

  it('handles fetch errors gracefully and returns empty sitemap', async () => {
    const module = await import('../../netlify/functions/news-sitemap.js');
    const handler = module.default;
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;

    global.fetch = async () => ({ ok: false, status: 500 });

    let consoleErrorCalled = false;
    console.error = () => { consoleErrorCalled = true; };

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

    try {
      const req = new Request('https://bharat-viral.netlify.app/news-sitemap.xml');
      const response = await handler(req, {});
      assert.strictEqual(consoleErrorCalled, true, 'console.error should have been called');
      assert.strictEqual(response.status, 200);
      const body = await response.text();
      assert.ok(body.includes('<urlset'), 'Body should contain urlset');
      assert.ok(!body.includes('<url>'), 'Body should not contain any urls');
    } finally {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
      process.env = originalEnv;
    }
  });
  it('paginates over 100 articles', async () => {
    const module = await import('../../netlify/functions/news-sitemap.js');
    const handler = module.default;

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

    let callCount = 0;
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      callCount++;
      if (callCount === 1) {
        // Return 1000 items on first call
        return {
          ok: true,
          json: async () => Array.from({ length: 1000 }).map((_, i) => ({
            id: i,
            slug: `article-${i}`,
            title: `Article ${i}`,
            published_at: new Date().toISOString()
          }))
        };
      }
      // Return 50 items on second call
      return {
        ok: true,
        json: async () => Array.from({ length: 50 }).map((_, i) => ({
          id: 1000 + i,
          slug: `article-${1000 + i}`,
          title: `Article ${1000 + i}`,
          published_at: new Date().toISOString()
        }))
      };
    };

    try {
      const req = new Request('https://bharat-viral.netlify.app/news-sitemap.xml');
      const response = await handler(req, {});
      assert.strictEqual(response.status, 200);
      const body = await response.text();
      assert.ok(body.includes('<loc>https://bharat-viral.netlify.app/article/article-0</loc>'));
      assert.ok(body.includes('<loc>https://bharat-viral.netlify.app/article/article-999</loc>'));
      assert.ok(body.includes('<loc>https://bharat-viral.netlify.app/article/article-1049</loc>'));
    } finally {
      process.env = originalEnv;
      global.fetch = originalFetch;
    }
  });
});
