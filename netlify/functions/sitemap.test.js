const { handler } = require('./sitemap');

describe('sitemap handler', () => {
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;

  beforeEach(() => {
    global.fetch = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  });

  it('should return 200 and XML with static and article URLs when fetch is successful', async () => {
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

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockArticles
    });

    const response = await handler();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('application/xml; charset=UTF-8');
    expect(response.headers['Cache-Control']).toBe('public, max-age=300, s-maxage=300');

    // Check for standard XML and namespaces
    expect(response.body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(response.body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

    // Check for some static URLs
    expect(response.body).toContain('<loc>https://bharat-viral.netlify.app/</loc>');
    expect(response.body).toContain('<loc>https://bharat-viral.netlify.app/trending.html</loc>');
    expect(response.body).toContain('<loc>https://bharat-viral.netlify.app/google-trends.html</loc>');

    // Check for article URLs
    expect(response.body).toContain('<loc>https://bharat-viral.netlify.app/article.html?slug=test-article-1</loc>');
    expect(response.body).toContain('<lastmod>2023-01-03T00:00:00.000Z</lastmod>'); // uses updated_at

    expect(response.body).toContain('<loc>https://bharat-viral.netlify.app/article.html?slug=test-article-2</loc>');
    expect(response.body).toContain('<lastmod>2023-01-05T00:00:00.000Z</lastmod>'); // uses published_at
  });

  it('should return 200 and fallback XML with cache control max-age=60 when fetch fails', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const response = await handler();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('application/xml; charset=UTF-8');
    expect(response.headers['Cache-Control']).toBe('public, max-age=60');

    // Check for standard XML and namespaces
    expect(response.body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(response.body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

    // Check for some fallback URLs
    expect(response.body).toContain('<loc>https://bharat-viral.netlify.app/</loc>');
    expect(response.body).toContain('<loc>https://bharat-viral.netlify.app/trending.html</loc>');
    expect(response.body).toContain('<loc>https://bharat-viral.netlify.app/google-trends.html</loc>');

    // Should not contain article URLs
    expect(response.body).not.toContain('<loc>https://bharat-viral.netlify.app/article.html');

    expect(console.error).toHaveBeenCalledWith('Sitemap error:', expect.any(Error));
  });

  it('should handle fetch response not ok', async () => {
     global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    const response = await handler();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.headers['Cache-Control']).toBe('public, max-age=60');
    expect(console.error).toHaveBeenCalledWith('Sitemap error:', new Error('Supabase returned HTTP 500'));
  });
});
