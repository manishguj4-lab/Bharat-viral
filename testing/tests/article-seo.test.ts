import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('article-seo handler', () => {
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
      if (url.toString().includes('article.html')) {
        return {
          ok: true,
          text: async () => `<html><head><title>Test</title></head><body><article id="articleBox"></article></body></html>`
        };
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

      const text = await response.text();

      // Extract structured data JSON
      const jsonMatch = text.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
      assert.ok(jsonMatch, "Should have JSON-LD script tag");

      const schemas = JSON.parse(jsonMatch[1]);
      const newsArticle = schemas.find(s => s["@type"] === "NewsArticle");
      const breadcrumb = schemas.find(s => s["@type"] === "BreadcrumbList");

      assert.ok(newsArticle, "NewsArticle schema should exist");
      assert.ok(breadcrumb, "BreadcrumbList schema should exist");

      assert.strictEqual(newsArticle.headline, "Real Title");
      assert.strictEqual(newsArticle.author["@type"], "Organization", "Editorial Team should map to Organization");
      assert.deepStrictEqual(newsArticle.image, ["https://example.com/image.jpg"]);
      assert.strictEqual(newsArticle.datePublished, "2024-01-01T00:00:00Z");

    } finally {
      global.fetch = originalFetch;
      global.Deno = originalDeno;
    }
  });

});
