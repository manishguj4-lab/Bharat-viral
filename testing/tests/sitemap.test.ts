import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('sitemap handler', () => {
  it('returns valid XML with static and article URLs when fetch is successful', async () => {
    const { onRequest } = await import('../../functions/sitemap.xml.js');
    const originalFetch = global.fetch;
    const mockArticles = [
      {
        id: 1,
        slug: 'test-article-1',
        created_at: '2023-01-01T00:00:00.000Z',
        published_at: '2023-01-02T00:00:00.000Z',
        updated_at: '2023-01-03T00:00:00.000Z'
      },
      {
        id: 2,
        slug: 'test-article-2',
        created_at: '2023-01-04T00:00:00.000Z',
        published_at: '2023-01-05T00:00:00.000Z',
        updated_at: null
      },
      {
        id: 3,
        slug: null, // Should be ignored
        created_at: '2023-01-06T00:00:00.000Z',
        published_at: '2023-01-07T00:00:00.000Z',
        updated_at: null
      }
    ];

    global.fetch = async () => ({
      ok: true,
      json: async () => mockArticles
    });

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
      assert.strictEqual(response.headers.get('Cache-Control'), 'public, max-age=300, s-maxage=300');

      const body = await response.text();
      assert.ok(body.includes('<?xml version="1.0" encoding="UTF-8"?>'));
      assert.ok(body.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));

      assert.ok(body.includes('<loc>https://bharat-viral.pages.dev/</loc>'));
      assert.ok(body.includes('<loc>https://bharat-viral.pages.dev/trending.html</loc>'));

      assert.ok(body.includes('<loc>https://bharat-viral.pages.dev/article/test-article-1</loc>'));
      assert.ok(body.includes('<lastmod>2023-01-03T00:00:00.000Z</lastmod>'));

      assert.ok(body.includes('<loc>https://bharat-viral.pages.dev/article/test-article-2</loc>'));
      assert.ok(body.includes('<lastmod>2023-01-05T00:00:00.000Z</lastmod>'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('returns fallback XML with max-age=60 when fetch fails', async () => {
    const { onRequest } = await import('../../functions/sitemap.xml.js');
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;

    global.fetch = async () => { throw new Error('Network error'); };

    let consoleErrorCalled = false;
    console.error = () => { consoleErrorCalled = true; };

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
      assert.strictEqual(response.headers.get('Cache-Control'), 'public, max-age=60');

      const body = await response.text();
      assert.ok(body.includes('<?xml version="1.0" encoding="UTF-8"?>'));
      assert.ok(body.includes('<loc>https://bharat-viral.pages.dev/</loc>'));
      assert.ok(!body.includes('/article/test-article')); // no articles

      assert.ok(consoleErrorCalled);
    } finally {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
    }
  });
});
