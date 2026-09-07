import { describe, it, expect, vi } from 'vitest';
import { onRequest as handler } from '../../functions/article/[slug].js';

describe('article-seo handler', () => {
  it('returns 404 when the mock fetch returns an empty array', async () => {
    // Mock the global fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    // Assign to globalThis
    vi.stubGlobal('fetch', mockFetch);

    // Create a mock request. Must have a slug in the url to bypass the early 404.
    const req = new Request('https://bharat-viral.pages.dev/article/test-article');

    const context = {
      request: req,
      params: { slug: 'test-article' },
      env: {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_KEY: 'test-key',
        ASSETS: {
          fetch: vi.fn().mockResolvedValue(new Response('Template HTML'))
        }
      }
    };

    const response = await handler(context);

    // Check status
    expect(response.status).toBe(404);

    // Check response body
    const text = await response.text();
    expect(text).toBe('Article not found');

    // Check headers
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=UTF-8');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');

    // Clean up
    vi.unstubAllGlobals();
  });
});
