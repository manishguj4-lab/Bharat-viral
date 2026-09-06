import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.200.0/assert/mod.ts";
import handler from "../netlify/edge-functions/article-seo.ts";

const originalFetch = globalThis.fetch;

Deno.test({
  name: "article-seo returns 404 when no slug is provided",
  async fn() {
    const req = new Request("http://localhost/something-else");
    const res = await handler(req);

    assertEquals(res.status, 404);
    assertEquals(await res.text(), "Article not found");
    assertEquals(res.headers.get("X-Robots-Tag"), "noindex");
  },
});

Deno.test({
  name: "article-seo returns 500 when Supabase returns a non-ok response",
  async fn() {
    globalThis.fetch = () => Promise.resolve(new Response(null, { status: 500 }));

    const req = new Request("http://localhost/article/my-slug");
    const res = await handler(req);

    assertEquals(res.status, 500);
    assertEquals(await res.text(), "Internal Server Error");

    globalThis.fetch = originalFetch;
  },
});

Deno.test({
  name: "article-seo returns 404 when Supabase returns an empty array",
  async fn() {
    globalThis.fetch = () => Promise.resolve(new Response("[]"));

    const req = new Request("http://localhost/article/my-slug");
    const res = await handler(req);

    assertEquals(res.status, 404);
    assertEquals(await res.text(), "Article not found");
    assertEquals(res.headers.get("X-Robots-Tag"), "noindex");

    globalThis.fetch = originalFetch;
  },
});

Deno.test({
  name: "article-seo returns 200 and renders HTML when Supabase returns a valid article",
  async fn() {
    const mockArticle = [{
      title: "Test Title",
      description: "Test Description",
      category: "Test Category",
      author: "Test Author",
      published_at: "2023-01-01T00:00:00.000Z",
      slug: "my-slug",
      content: "<p>Test Content</p>",
    }];

    globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockArticle)));

    const req = new Request("http://localhost/article/my-slug");
    const res = await handler(req);

    assertEquals(res.status, 200);
    assertStringIncludes(res.headers.get("Content-Type") || "", "text/html");

    const html = await res.text();
    assertStringIncludes(html, "<title>Test Title | Bharat Viral</title>");
    assertStringIncludes(html, "<p>Test Content</p>");
    assertStringIncludes(html, "Test Description");
    assertStringIncludes(html, "Test Category");

    globalThis.fetch = originalFetch;
  },
});

Deno.test({
  name: "article-seo extracts slug from query parameter",
  async fn() {
    const mockArticle = [{
      title: "Query Slug Title",
      slug: "query-slug",
    }];

    globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(mockArticle)));

    const req = new Request("http://localhost/something?slug=query-slug");
    const res = await handler(req);

    assertEquals(res.status, 200);

    const html = await res.text();
    assertStringIncludes(html, "Query Slug Title");

    globalThis.fetch = originalFetch;
  },
});
