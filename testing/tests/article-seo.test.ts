import { describe, it, expect, vi } from 'vitest';
import handler from '../../netlify/edge-functions/article-seo';

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
    const req = new Request('https://bharat-viral.netlify.app/article/test-article');

    const response = await handler(req);

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
