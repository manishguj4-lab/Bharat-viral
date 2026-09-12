import { describe, it } from 'node:test';
import assert from 'node:assert';

const parseUrls = (xml: string) => {
  const matches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
  return Array.from(matches).map(m => m[1]);
};

describe('sitemap pagination mathematically correct', () => {
  const setupMockFetch = (totalArticles: number) => {
    return async (url: string) => {
      if (url.includes('/rest/v1/categories')) {
        return {
          ok: true,
          json: async () => [
            { slug: 'news1' }, { slug: 'news2' }, { slug: 'news3' },
            { slug: 'news4' }, { slug: 'news5' }, { slug: 'trending' }
          ]
        };
      }
      if (url.includes('/rest/v1/articles') && !url.includes('Prefer=count') && !url.includes('Range=0-0')) {
         const limitMatch = url.match(/limit=(\d+)/);
         const limit = limitMatch ? parseInt(limitMatch[1], 10) : 1000;
         const offsetMatch = url.match(/offset=(\d+)/);
         const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;

         if (offset >= totalArticles) {
           return { ok: true, json: async () => [] };
         }

         const count = Math.min(limit, totalArticles - offset);
         const articles = Array.from({ length: count }).map((_, i) => ({
           slug: `art-${offset + i}`
         }));
         return { ok: true, json: async () => articles };
      }
      if (url.includes('Prefer=count') || url.includes('count=exact') || (url.includes('/rest/v1/articles') && url.includes('Range=0-0'))) {
        return {
          ok: true,
          headers: new Headers({ "Content-Range": `0-0/${totalArticles}` }),
          json: async () => []
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };
  };

  const getMockFetch = (totalArticles: number) => {
    const fetcher = setupMockFetch(totalArticles);
    return async (url: string, opts?: any) => {
       const res = await fetcher(url);
       if (!res.headers) {
          res.headers = { get: (name: string) => name.toLowerCase() === 'content-range' ? `0-0/${totalArticles}` : null } as any;
       } else if (res.headers && !(res.headers instanceof Headers) && typeof (res.headers as any).get === 'function') {
          const originalGet = (res.headers as any).get.bind(res.headers);
          (res.headers as any).get = (name: string) => {
            if (name.toLowerCase() === 'content-range') return `0-0/${totalArticles}`;
            return originalGet(name);
          };
       } else if (res.headers instanceof Headers) {
          res.headers.set('Content-Range', `0-0/${totalArticles}`);
       } else {
          (res.headers as any)['Content-Range'] = `0-0/${totalArticles}`;
       }
       return res;
    };
  };

  it('Test 1: Small site exact bounds (100 articles)', async () => {
    const module = await import('../../netlify/functions/sitemap.js');
    const handler = module.default;
    const originalFetch = global.fetch;
    const originalEnv = process.env;

    global.fetch = getMockFetch(100) as any;
    process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

    try {
      const response = await handler(new Request('https://bharatviralnews.netlify.app/sitemap.xml'), {});
      const body = await response.text();
      const urls = parseUrls(body);

      assert.strictEqual(urls.length, 1 + 5 + 100, 'Should contain homepage + 5 categories + 100 articles');
      const uniqueUrls = new Set(urls);
      assert.strictEqual(uniqueUrls.size, urls.length, 'No duplicates');
    } finally {
      global.fetch = originalFetch;
      process.env = originalEnv;
    }
  });

  it('Test 2: Exact page boundary (40,000 URLs)', async () => {
    const module = await import('../../netlify/functions/sitemap.js');
    const handler = module.default;
    const originalFetch = global.fetch;
    const originalEnv = process.env;

    // 40,000 max. Homepage = 1, Categories = 5. Articles = 39,994
    global.fetch = getMockFetch(39994) as any;
    process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

    try {
      const response = await handler(new Request('https://bharatviralnews.netlify.app/sitemap.xml'), {});
      const body = await response.text();
      const urls = parseUrls(body);

      assert.strictEqual(urls.length, 40000, 'Should contain exactly 40,000 URLs');
      assert.ok(body.includes('<urlset'), 'Should not be an index because it fits in one');
    } finally {
      global.fetch = originalFetch;
      process.env = originalEnv;
    }
  });

  it('Test 3: Cross-boundary 40,001 articles (exact validation of both pages)', async () => {
     const module = await import('../../netlify/functions/sitemap.js');
     const handler = module.default;
     const originalFetch = global.fetch;
     const originalEnv = process.env;

     // 40,001 articles. Total URLs = 1 + 5 + 40001 = 40,007 URLs. Should be 2 pages.
     global.fetch = getMockFetch(40001) as any;
     process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

     try {
       // Page 1
       const res1 = await handler(new Request('https://bharatviralnews.netlify.app/sitemap.xml?page=1'), {});
       const body1 = await res1.text();
       const urls1 = parseUrls(body1);
       assert.strictEqual(urls1.length, 40000, 'Page 1 must be exactly 40,000 URLs');

       // Page 2
       const res2 = await handler(new Request('https://bharatviralnews.netlify.app/sitemap.xml?page=2'), {});
       const body2 = await res2.text();
       const urls2 = parseUrls(body2);
       assert.strictEqual(urls2.length, 7, 'Page 2 must have the remaining 7 URLs (40001 - 39994)');

       const combined = [...urls1, ...urls2];
       const uniqueCombined = new Set(combined);
       assert.strictEqual(combined.length, 40007, 'Total URLs should be 40007');
       assert.strictEqual(uniqueCombined.size, combined.length, 'No duplicate articles across pages');

       assert.ok(combined.includes('https://bharatviralnews.netlify.app/article/art-39994'));
       assert.ok(combined.includes('https://bharatviralnews.netlify.app/article/art-40000'));
     } finally {
       global.fetch = originalFetch;
       process.env = originalEnv;
     }
  });

  it('Test 4: Large dataset (80,000+ articles)', async () => {
     const module = await import('../../netlify/functions/sitemap.js');
     const handler = module.default;
     const originalFetch = global.fetch;
     const originalEnv = process.env;

     // 80,005 articles. Total URLs = 80011. Should be 3 pages.
     global.fetch = getMockFetch(80005) as any;
     process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

     try {
       const resIdx = await handler(new Request('https://bharatviralnews.netlify.app/sitemap.xml'), {});
       const idxBody = await resIdx.text();

       assert.ok(idxBody.includes('<sitemapindex'), 'Must return sitemap index');
       assert.ok(idxBody.includes('page=3'), 'Must have 3 pages');
       assert.ok(!idxBody.includes('page=4'), 'Must not have 4 pages');

       const res3 = await handler(new Request('https://bharatviralnews.netlify.app/sitemap.xml?page=3'), {});
       const body3 = await res3.text();
       const urls3 = parseUrls(body3);
       assert.strictEqual(urls3.length, 11, 'Page 3 must have 11 URLs (80011 - 80000)');
     } finally {
       global.fetch = originalFetch;
       process.env = originalEnv;
     }
  });

  it('Test 5: Actual count (Content-Range behavior) yielding multiple pages', async () => {
     const module = await import('../../netlify/functions/sitemap.js');
     const handler = module.default;
     const originalFetch = global.fetch;
     const originalEnv = process.env;

     global.fetch = getMockFetch(40001) as any;
     process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

     try {
       const resIdx = await handler(new Request('https://bharatviralnews.netlify.app/sitemap.xml'), {});
       const idxBody = await resIdx.text();

       assert.ok(idxBody.includes('<sitemapindex'), 'Must return sitemap index for 40,001 count');
       assert.ok(idxBody.includes('page=2'), 'Must have 2 pages');
     } finally {
       global.fetch = originalFetch;
       process.env = originalEnv;
     }
  });

  it('Test 6: Count failure yielding 503 instead of treating as 0 articles', async () => {
    const module = await import('../../netlify/functions/sitemap.js');
    const handler = module.default;
    const originalFetch = global.fetch;
    const originalEnv = process.env;
    const originalConsoleError = console.error;
    console.error = () => {}; // silence error logging

    global.fetch = async (url: string) => {
       if (url.includes('Prefer=count') || url.includes('Range=0-0')) {
          return { ok: false, status: 500, headers: new Headers() } as any;
       }
       if (url.includes('/rest/v1/categories')) {
          return { ok: true, json: async () => [] };
       }
       return { ok: true, json: async () => [] };
    };

    process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

    try {
      const response = await handler(new Request('https://bharatviralnews.netlify.app/sitemap.xml'), {});
      assert.strictEqual(response.status, 503, 'Must return 503 on count failure to prevent empty sitemaps');
      const body = await response.text();
      assert.ok(body.includes('<urlset'), 'Must return fallback XML');
    } finally {
      global.fetch = originalFetch;
      process.env = originalEnv;
      console.error = originalConsoleError;
    }
  });

  it('Test 7: Invalid page bounds return 404 with empty URLset', async () => {
    const module = await import('../../netlify/functions/sitemap.js');
    const handler = module.default;
    const originalFetch = global.fetch;
    const originalEnv = process.env;

    global.fetch = getMockFetch(100) as any; // Max 1 page
    process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

    try {
      const tests = ['abc', '0', '-1', '999999'];
      for (const page of tests) {
        const response = await handler(new Request(`https://bharatviralnews.netlify.app/sitemap.xml?page=${page}`), {});

        if (page === '999999') {
          assert.strictEqual(response.status, 404, `Page ${page} must return 404`);
          const body = await response.text();
          const urls = parseUrls(body);
          assert.strictEqual(urls.length, 0, `Page ${page} must contain 0 URLs`);
        } else {
          // NaN or < 1 becomes page 1 (1 + 5 + 100 = 106)
          assert.strictEqual(response.status, 200, `Page ${page} must return 200 (fallback to page 1)`);
        }
      }
    } finally {
      global.fetch = originalFetch;
      process.env = originalEnv;
    }
  });

  it('Test 8: Deduplicates articles efficiently via Set (duplicate slug returned by DB)', async () => {
     const module = await import('../../netlify/functions/sitemap.js');
     const handler = module.default;
     const originalFetch = global.fetch;
     const originalEnv = process.env;

     const dbFetch = async (url: string) => {
       if (url.includes('/rest/v1/categories')) {
          return { ok: true, json: async () => [] };
       }
       if (url.includes('Prefer=count') || url.includes('count=exact') || url.includes('Range=0-0')) {
          return { ok: true, headers: new Headers({ "Content-Range": "0-0/2" }), json: async () => [] } as any;
       }
       if (url.includes('/rest/v1/articles')) {
          return {
             ok: true,
             json: async () => [
                { slug: 'same-article' },
                { slug: 'same-article' } // duplicate DB row simulated
             ]
          };
       }
       return { ok: true, json: async () => [] };
     };

     global.fetch = async (url, opts) => {
        const res = await dbFetch(url);
        if (!res.headers) res.headers = new Headers({ "Content-Range": "0-0/2" });
        return res as any;
     };

     process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

     try {
       const response = await handler(new Request('https://bharatviralnews.netlify.app/sitemap.xml'), {});
       const body = await response.text();
       const urls = parseUrls(body);

       assert.strictEqual(urls.length, 2, 'Should only contain homepage (1) + deduplicated article (1) = 2 URLs');
     } finally {
       global.fetch = originalFetch;
       process.env = originalEnv;
     }
  });

  it('Test 9: Invalid article data (null, empty, whitespace slug) ignored', async () => {
     const module = await import('../../netlify/functions/sitemap.js');
     const handler = module.default;
     const originalFetch = global.fetch;
     const originalEnv = process.env;

     const dbFetch = async (url: string) => {
       if (url.includes('/rest/v1/categories')) {
          return { ok: true, json: async () => [] };
       }
       if (url.includes('Prefer=count') || url.includes('count=exact') || url.includes('Range=0-0')) {
          return { ok: true, headers: new Headers({ "Content-Range": "0-0/4" }), json: async () => [] } as any;
       }
       if (url.includes('/rest/v1/articles')) {
          return {
             ok: true,
             json: async () => [
                { slug: null },
                { slug: '' },
                { slug: '   ' },
                { slug: 'valid-slug' }
             ]
          };
       }
       return { ok: true, json: async () => [] };
     };
     global.fetch = async (url, opts) => {
        const res = await dbFetch(url);
        if (!res.headers) res.headers = new Headers({ "Content-Range": "0-0/4" });
        return res as any;
     };

     process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

     try {
       const response = await handler(new Request('https://bharatviralnews.netlify.app/sitemap.xml'), {});
       const body = await response.text();
       const urls = parseUrls(body);

       assert.strictEqual(urls.length, 2, 'Should only contain homepage (1) + valid article (1) = 2 URLs');
       assert.ok(urls.includes('https://bharatviralnews.netlify.app/article/valid-slug'));
     } finally {
       global.fetch = originalFetch;
       process.env = originalEnv;
     }
  });

  it('Test 10: XML escaping checks (& < > " \')', async () => {
     const module = await import('../../netlify/functions/sitemap.js');
     const handler = module.default;
     const originalFetch = global.fetch;
     const originalEnv = process.env;

     const dbFetch = async (url: string) => {
       if (url.includes('/rest/v1/categories')) {
          return { ok: true, json: async () => [{ slug: 'news&updates' }] };
       }
       if (url.includes('Prefer=count') || url.includes('count=exact') || url.includes('Range=0-0')) {
          return { ok: true, headers: new Headers({ "Content-Range": "0-0/1" }), json: async () => [] } as any;
       }
       if (url.includes('/rest/v1/articles')) {
          return {
             ok: true,
             json: async () => [{ slug: 'article-with-<tags>-and-"quotes"' }]
          };
       }
       return { ok: true, json: async () => [] };
     };
     global.fetch = async (url, opts) => {
        const res = await dbFetch(url);
        if (!res.headers) res.headers = new Headers({ "Content-Range": "0-0/1" });
        return res as any;
     };

     process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

     try {
       const response = await handler(new Request('https://bharatviralnews.netlify.app/sitemap.xml'), {});
       const body = await response.text();

       assert.ok(body.includes('news%26updates'), 'Category query string ampersand should be percent encoded');
       assert.ok(body.includes('article-with-%3Ctags%3E-and-%22quotes%22'), 'Article URL special chars should be percent encoded in URL representation');

       // Ensure strictly valid XML
       assert.strictEqual(body.includes('<tags>'), false, 'Should not have unescaped angle brackets in loc');
       assert.strictEqual(body.includes('"quotes"'), false, 'Should not have unescaped quotes in loc');
     } finally {
       global.fetch = originalFetch;
       process.env = originalEnv;
     }
  });

  it('Test 11: lastmod precedence verification (updated_at > published_at > created_at)', async () => {
     const module = await import('../../netlify/functions/sitemap.js');
     const handler = module.default;
     const originalFetch = global.fetch;
     const originalEnv = process.env;

     const dbFetch = async (url: string) => {
       if (url.includes('/rest/v1/categories')) {
          return { ok: true, json: async () => [] };
       }
       if (url.includes('Prefer=count') || url.includes('count=exact') || url.includes('Range=0-0')) {
          return { ok: true, headers: new Headers({ "Content-Range": "0-0/3" }), json: async () => [] } as any;
       }
       if (url.includes('/rest/v1/articles')) {
          return {
             ok: true,
             json: async () => [
                { slug: 'a1', updated_at: '2023-01-01T00:00:00.000Z', published_at: '2022-01-01T00:00:00.000Z', created_at: '2021-01-01T00:00:00.000Z' },
                { slug: 'a2', published_at: '2022-01-01T00:00:00.000Z', created_at: '2021-01-01T00:00:00.000Z' },
                { slug: 'a3', created_at: '2021-01-01T00:00:00.000Z' }
             ]
          };
       }
       return { ok: true, json: async () => [] };
     };
     global.fetch = async (url, opts) => {
        const res = await dbFetch(url);
        if (!res.headers) res.headers = new Headers({ "Content-Range": "0-0/3" });
        return res as any;
     };

     process.env = { ...originalEnv, SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'test-key' };

     try {
       const response = await handler(new Request('https://bharatviralnews.netlify.app/sitemap.xml'), {});
       const body = await response.text();

       assert.ok(body.includes('<lastmod>2023-01-01T00:00:00.000Z</lastmod>'), 'a1 uses updated_at');
       assert.ok(body.includes('<lastmod>2022-01-01T00:00:00.000Z</lastmod>'), 'a2 uses published_at');
       assert.ok(body.includes('<lastmod>2021-01-01T00:00:00.000Z</lastmod>'), 'a3 uses created_at');
     } finally {
       global.fetch = originalFetch;
       process.env = originalEnv;
     }
  });

});
