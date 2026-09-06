import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import handler from "../netlify/edge-functions/article-seo.ts";

Deno.test("handler gracefully handles Supabase fetch error (e.g., 500)", async () => {
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
    const req = new Request("https://bharat-viral.netlify.app/article/test-slug");
    const response = await handler(req);

    assertEquals(response.status, 500);
    const body = await response.text();
    assertEquals(body, "Internal Server Error");
    assertEquals(response.headers.get("Content-Type"), "text/plain; charset=UTF-8");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
