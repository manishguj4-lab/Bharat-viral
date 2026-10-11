import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('category-ssr handler', () => {
  before(() => {
    // Ensure HTMLRewriter is undefined in runtime environment as per regression requirements
    delete global.HTMLRewriter;
  });

  it('returns 503 response when missing required credentials', async () => {
    const module = await import('../../netlify/edge-functions/category-ssr.js');
    const handler = module.default;

    const originalDeno = global.Deno;
    global.Deno = {
      env: {
        get: () => undefined
      }
    };

    const request = new Request('https://bharatviralnews.netlify.app/category/news');

    try {
      const response = await handler(request, {});
      assert.strictEqual(response.status, 503);
    } finally {
      global.Deno = originalDeno;
    }
  });

  it('returns 200 response with correct structured data for valid category', async () => {
    const module = await import('../../netlify/edge-functions/category-ssr.js');
    const handler = module.default;

    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.toString().includes('category-template.html')) {
        return new Response('<html><head><title>Test</title></head><body><h2 id="heading"></h2><div id="grid"></div></body></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      if (url.toString().includes('/rest/v1/categories')) {
          return { ok: true, json: async () => [{ name: "News", slug: "news" }] };
      }
      if (url.toString().includes('count=exact')) {
          return { ok: true, headers: { get: () => '0-9/10' } };
      }
      return {
        ok: true,
        json: async () => [{
          title: "Real Title",
          slug: "test-article",
          id: 1,
          image_url: "https://example.com/image.jpg"
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

    const request = new Request('https://bharatviralnews.netlify.app/category/news');

    try {
      const response = await handler(request, {});
      assert.strictEqual(response.status, 200);
      const text = await response.text();
      assert.ok(text.includes('News | Bharat Viral'), "Title should be populated");
      assert.ok(text.includes('Real Title'), "Article title should be in grid");
      assert.ok(text.includes('application/ld+json'), "JSON-LD schema should be injected");
    } finally {
      global.fetch = originalFetch;
      global.Deno = originalDeno;
    }
  });
  it('redirects /category.html to /category/news with 301', async () => {
    const module = await import('../../netlify/edge-functions/category-ssr.js');
    const handler = module.default;

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

    const req = new Request('https://bharatviralnews.netlify.app/category.html');

    try {
      const response = await handler(req, {});
      assert.strictEqual(response.status, 301);
      assert.strictEqual(response.headers.get('Location'), '/category/news');
    } finally {
      global.Deno = originalDeno;
    }
  });

  it('redirects /category.html?category=sports to /category/sports with 301', async () => {
    const module = await import('../../netlify/edge-functions/category-ssr.js');
    const handler = module.default;

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

    const req = new Request('https://bharatviralnews.netlify.app/category.html?category=sports');

    try {
      const response = await handler(req, {});
      assert.strictEqual(response.status, 301);
      assert.strictEqual(response.headers.get('Location'), '/category/sports');
    } finally {
      global.Deno = originalDeno;
    }
  });

});
