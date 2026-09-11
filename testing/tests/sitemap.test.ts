import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('sitemap handler', () => {
  it('returns valid XML with static, category, and article URLs when fetch is successful', async () => {
    const module = await import('../../netlify/functions/sitemap.js');
    const handler = module.default;
    const originalFetch = global.fetch;

    global.fetch = async (url, options) => {
      assert.ok('apikey' in options.headers, 'apikey header should be present');
      assert.ok('Authorization' in options.headers, 'Authorization header should be present');

      if (url.includes('/rest/v1/articles')) {
        return {
          ok: true,
          json: async () => [
            { slug: 'test-article-1', updated_at: '2024-01-01T12:00:00Z' },
            { slug: 'test-article-2', published_at: '2024-01-02T12:00:00Z' },
            { id: 'no-slug', created_at: '2024-01-03T12:00:00Z' } // Should be skipped
          ]
        };
      } else if (url.includes('/rest/v1/categories')) {
        return {
          ok: true,
          json: async () => [
            { slug: 'news', created_at: '2023-01-01T00:00:00Z' },
            { slug: 'trending', created_at: '2023-01-02T00:00:00Z' }, // Should be skipped
            { id: 'no-slug' } // Should be skipped
          ]
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

    try {
      const req = new Request('https://bharat-viral.netlify.app/sitemap.xml');
      const response = await handler(req, {});

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get('Content-Type'), 'application/xml; charset=UTF-8');
      assert.strictEqual(response.headers.get('Cache-Control'), 'public, max-age=300, s-maxage=300');

      const body = await response.text();

      // Check static URLs
      assert.ok(body.includes('<loc>https://bharat-viral.netlify.app/</loc>'));

      // Check category URLs
      assert.ok(body.includes('<loc>https://bharat-viral.netlify.app/category.html?category=news</loc>'));
      assert.ok(!body.includes('<loc>https://bharat-viral.netlify.app/category.html?category=trending</loc>')); // Filtered out

      // Check article URLs
      assert.ok(body.includes('<loc>https://bharat-viral.netlify.app/article/test-article-1</loc>'));
      assert.ok(body.includes('<lastmod>2024-01-01T12:00:00.000Z</lastmod>'));

      assert.ok(body.includes('<loc>https://bharat-viral.netlify.app/article/test-article-2</loc>'));
      assert.ok(body.includes('<lastmod>2024-01-02T12:00:00.000Z</lastmod>'));

      // Ensure item without slug is skipped
      assert.ok(!body.includes('no-slug'));

    } finally {
      global.fetch = originalFetch;
      process.env = originalEnv;
    }
  });

  it('returns fallback XML with max-age=60 when fetch fails', async () => {
    const module = await import('../../netlify/functions/sitemap.js');
    const handler = module.default;
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;

    global.fetch = async () => ({ ok: false, status: 500 });

    let consoleErrorCalled = false;
    console.error = () => { consoleErrorCalled = true; };

    const originalEnv = process.env;
    process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

    try {
      const req = new Request('https://bharat-viral.netlify.app/sitemap.xml');
      const response = await handler(req, {});

      assert.strictEqual(consoleErrorCalled, true, 'console.error should have been called');
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get('Content-Type'), 'application/xml; charset=UTF-8');
      assert.strictEqual(response.headers.get('Cache-Control'), 'public, max-age=60');

      const body = await response.text();
      assert.ok(body.includes('<urlset'), 'Body should contain urlset');
      assert.ok(body.includes('<loc>https://bharat-viral.netlify.app/</loc>')); // Static fallback URL
    } finally {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
      process.env = originalEnv;
    }
  });
});
