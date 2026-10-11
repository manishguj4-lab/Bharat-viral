import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('article-seo handler', () => {
  before(() => {
    // Ensure HTMLRewriter is undefined in runtime environment as per regression requirements
    delete global.HTMLRewriter;
  });

  it('returns 503 response when missing required credentials', async () => {
    const module = await import('../../netlify/edge-functions/article-ssr.js');
    const handler = module.default;

    const originalDeno = global.Deno;
    global.Deno = {
      env: {
        get: () => undefined
      }
    };

    const request = new Request('https://bharatviralnews.netlify.app/article/test-article');

    try {
      const response = await handler(request, {});
      assert.strictEqual(response.status, 503, "Should return 503 for missing credentials");
      assert.strictEqual(response.headers.get("cache-control"), "no-store, max-age=0, must-revalidate", "Should have no-store cache control");
    } finally {
      global.Deno = originalDeno;
    }
  });

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
      assert.strictEqual(response.headers.get("cache-control"), "no-store, max-age=0, must-revalidate");
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
      assert.strictEqual(response.headers.get("cache-control"), "no-store, max-age=0, must-revalidate");
    } finally {
      global.fetch = originalFetch;
      global.Deno = originalDeno;
    }
  });

      it('returns 200 response with correct structured data for valid article', async () => {
    const module = await import('../../netlify/edge-functions/article-ssr.js');
    const handler = module.default;

    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.toString().includes('article-template.html') || url.toString().includes('article.html')) {
        return new Response('<html><head><title>Test</title><script type="application/ld+json">[{"@type":"NewsArticle","headline":"Real Title","author":{"@type":"Organization","name":"Editorial Team"},"image":["https://example.com/image.jpg"],"datePublished":"2024-01-01T00:00:00Z"},{"@type":"BreadcrumbList"}]</script></head><body><article id="articleBox"></article></body></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      return {
        ok: true,
        json: async () => [{
          title: "Real Title",
          slug: "test-article",
          author_name: "Editorial Team",
          image_url: "https://example.com/image.jpg",
          published_at: "2024-01-01T00:00:00Z",
          content: "<p>Hello</p>"
        }]
      };
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

    const request = new Request('https://bharatviralnews.netlify.app/article/test-article');

    try {
      const response = await handler(request, {});
      assert.strictEqual(response.status, 200, "Should return 200");
      const htmlText = await response.text();
      assert.ok(htmlText.includes('Real Title | Bharat Viral'), "Rendered title should match article title");
      assert.ok(htmlText.includes('application/ld+json'), "Should include JSON-LD script");
      assert.ok(htmlText.includes('itemtype="https://schema.org/NewsArticle"'), "Should add schema itemtype to articleBox");
      assert.ok(htmlText.includes('https://example.com/image.jpg'), "Should render article image in content box");
    } finally {
      global.fetch = originalFetch;
      global.Deno = originalDeno;
    }
  });

});