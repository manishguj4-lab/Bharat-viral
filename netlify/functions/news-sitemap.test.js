const test = require('node:test');
const assert = require('node:assert');
const { handler } = require('./news-sitemap.js');

test('news-sitemap handler', async (t) => {
  const originalFetch = global.fetch;

  t.afterEach(() => {
    global.fetch = originalFetch;
  });

  await t.test('returns valid XML with recent articles', async () => {
    const now = Date.now();
    const recentDate = new Date(now - 1000 * 60 * 60 * 2).toISOString(); // 2 hours ago

    global.fetch = async (url, options) => {
      assert.strictEqual(options.headers.apikey, "sb_publishable_LTmMKlt5saAsFIlnF87_6A_75FFCvK0");
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

    const response = await handler();
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.headers['Content-Type'], 'application/xml; charset=UTF-8');
    assert.ok(response.body.includes('<loc>https://bharat-viral.netlify.app/article/recent-article</loc>'), 'Body should contain correct loc');
    assert.ok(response.body.includes('<news:title>Recent Article</news:title>'), 'Body should contain correct title');
  });

  await t.test('filters out articles older than 48 hours', async () => {
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

    const response = await handler();
    assert.strictEqual(response.statusCode, 200);
    assert.ok(!response.body.includes('old-article'), 'Body should not contain old article');
  });

  await t.test('handles fetch errors gracefully and returns empty sitemap', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 500
    });

    // Suppress console.error for this test
    const originalConsoleError = console.error;
    let consoleErrorCalled = false;
    console.error = () => { consoleErrorCalled = true; };

    const response = await handler();

    console.error = originalConsoleError;

    assert.strictEqual(consoleErrorCalled, true, 'console.error should have been called');
    assert.strictEqual(response.statusCode, 200);
    assert.ok(response.body.includes('<urlset'), 'Body should contain urlset');
    assert.ok(!response.body.includes('<url>'), 'Body should not contain any urls');
  });

  await t.test('escapes XML special characters correctly', async () => {
    const now = Date.now();
    const recentDate = new Date(now - 1000 * 60 * 60 * 2).toISOString(); // 2 hours ago

    global.fetch = async () => ({
      ok: true,
      json: async () => [
        {
          id: 1,
          slug: 'article-&', // encodeURIComponent will make this 'article-%26', which doesn't need xmlEscape
          title: 'Title < > " \' &',
          published_at: recentDate
        }
      ]
    });

    const response = await handler();
    assert.strictEqual(response.statusCode, 200);
    assert.ok(response.body.includes('<loc>https://bharat-viral.netlify.app/article/article-%26</loc>'), 'Body should contain correctly escaped loc');
    assert.ok(response.body.includes('<news:title>Title &lt; &gt; &quot; &apos; &amp;</news:title>'), 'Body should contain correctly escaped title');
  });
});
