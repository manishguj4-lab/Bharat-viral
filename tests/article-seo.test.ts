import { test } from 'node:test';
import * as assert from 'node:assert';
const handler = async (req) => {
  const url = new URL(req.url);
  let slug = url.pathname.split('/article/')[1];
  if(!slug) slug = url.searchParams.get('slug');
  const context = { params: { slug }, env: { SUPABASE_URL: 'mock_url', SUPABASE_KEY: 'mock_key' } };
  const { onRequest } = await import('../functions/article/[slug].js');
  return onRequest(context);
};

test("handler gracefully handles Supabase fetch error (e.g., 500)", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = () => {
    return Promise.resolve(
      new Response("Internal Server Error from Supabase", {
        status: 500,
        statusText: "Internal Server Error",
      })
    );
  };

  try {
    const req = new Request("https://bharat-viral.pages.dev/article/test-slug");
    const response = await handler(req);

    assert.strictEqual(response.status, 500);
    const body = await response.text();
    assert.strictEqual(body, "Internal Server Error");
    assert.strictEqual(response.headers.get("Content-Type"), "text/plain; charset=UTF-8");
  } finally {
    globalThis.fetch = originalFetch;
  }
});