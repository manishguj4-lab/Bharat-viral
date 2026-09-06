import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../netlify/edge-functions/article-seo';

const originalFetch = global.fetch;

describe('article-seo edge function', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns 404 when no slug is provided', async () => {
    const req = new Request('http://localhost/something-else');
    const res = await handler(req);

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Article not found');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('returns 500 when Supabase returns a non-ok response', async () => {
    const req = new Request('http://localhost/article/my-slug');

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const res = await handler(req);

    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Internal Server Error');
  });

  it('returns 404 when Supabase returns an empty array', async () => {
    const req = new Request('http://localhost/article/my-slug');

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const res = await handler(req);

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Article not found');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('returns 200 and renders HTML when Supabase returns a valid article', async () => {
    const req = new Request('http://localhost/article/my-slug');

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [{
        title: 'Test Title',
        description: 'Test Description',
        category: 'Test Category',
        author: 'Test Author',
        published_at: '2023-01-01T00:00:00.000Z',
        slug: 'my-slug',
        content: '<p>Test Content</p>',
      }],
    } as Response);

    const res = await handler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('<title>Test Title | Bharat Viral</title>');
    expect(html).toContain('<p>Test Content</p>');
    expect(html).toContain('Test Description');
    expect(html).toContain('Test Category');
  });

  it('extracts slug from query parameter', async () => {
    const req = new Request('http://localhost/something?slug=query-slug');

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [{
        title: 'Query Slug Title',
        slug: 'query-slug',
      }],
    } as Response);

    const res = await handler(req);
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain('Query Slug Title');
  });
});
