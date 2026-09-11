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

    const req = {
      next: async () => new Response('Next Called', { headers: { 'Content-Type': 'text/html' } })
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

  it('returns 503 response when backend fetch returns non-ok response', async () => {
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
      next: async () => new Response('Next Called', { headers: { 'Content-Type': 'text/html' } })
    };
    const request = new Request('https://bharatviralnews.netlify.app/article/test-article');

    try {
      const response = await handler(request, req);
      assert.strictEqual(response.status, 503, "Should return 503 on backend fetch failure");
    } finally {
      global.fetch = originalFetch;
      global.Deno = originalDeno;
    }
  });

  it('returns 500 response on exception during fetch', async () => {
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
      next: async () => new Response('Next Called', { headers: { 'Content-Type': 'text/html' } })
    };
    const request = new Request('https://bharatviralnews.netlify.app/article/test-article');

    try {
      const response = await handler(request, req);
      assert.strictEqual(response.status, 500, "Should return 500 on exception during fetch");
    } finally {
      global.fetch = originalFetch;
      global.Deno = originalDeno;
    }
  });

  it('returns 200 with server-rendered content, index robots, self canonical, NewsArticle and BreadcrumbList JSON-LD schemas', async () => {
    const module = await import('../../netlify/edge-functions/article-ssr.js');
    const handler = module.default;

    const sampleArticle = {
      id: "123",
      title: "Test Viral Headline",
      slug: "test-viral-headline",
      excerpt: "Test excerpt for SEO",
      content: "<p>Test article body content</p>",
      image_url: "https://bharatviralnews.netlify.app/test-image.jpg",
      published_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
      categories: ["sports"],
      author_name: "Test Author",
      status: "published"
    };

    const mockTemplate = `<!DOCTYPE html><html><head><title>Old Title</title><meta name="description" id="metaDescription" content="Old desc"><meta name="robots" content="noindex"><link rel="canonical" id="canonicalUrl" href="https://bharatviralnews.netlify.app/"><meta property="og:title" id="ogTitle" content="Old"><meta property="og:description" id="ogDescription" content="Old"><meta property="og:url" id="ogUrl" content="Old"><meta property="og:image" id="ogImage" content="Old"><meta property="article:published_time" id="ogPublishedTime" content=""><meta property="article:modified_time" id="ogModifiedTime" content=""><meta name="twitter:title" id="twitterTitle" content="Old"><meta name="twitter:description" id="twitterDescription" content="Old"><meta name="twitter:image" id="twitterImage" content="Old"><script type="application/ld+json" id="articleSchema">{"@context":"https://schema.org","@type":"NewsArticle"}</script></head><body><article class="article" id="articleBox">Loading...</article></body></html>`;

    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL) => {
      const urlStr = input.toString();
      if (urlStr.includes('/rest/v1/articles')) {
        return {
          ok: true,
          json: async () => [sampleArticle]
        } as Response;
      }
      if (urlStr.includes('/article.html')) {
        return {
          ok: true,
          text: async () => mockTemplate
        } as Response;
      }
      return { ok: false } as Response;
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
      next: async () => new Response('Next Called', { headers: { 'Content-Type': 'text/html' } })
    };
    const request = new Request('https://bharatviralnews.netlify.app/article/test-viral-headline');

    try {
      const response = await handler(request, req);
      assert.strictEqual(response.status, 200);
      const html = await response.text();

      assert.ok(html.includes('<title>Test Viral Headline | Bharat Viral</title>'));
      assert.ok(html.includes('index, follow, max-image-preview:large'));
      assert.ok(html.includes('href="https://bharatviralnews.netlify.app/article/test-viral-headline"'));
      assert.ok(html.includes('NewsArticle'));
      assert.ok(html.includes('BreadcrumbList'));
      assert.ok(!html.includes('id="articleSchema"'), 'Static articleSchema should be removed');
      assert.ok(html.includes('Test article body content'));
    } finally {
      global.fetch = originalFetch;
      global.Deno = originalDeno;
    }
  });
});
