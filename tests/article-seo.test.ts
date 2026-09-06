import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import handler from "../netlify/edge-functions/article-seo.ts";

Deno.test("handler gracefully handles Supabase fetch error (e.g., 500)", async () => {
  // Store the original fetch
  const originalFetch = globalThis.fetch;

  // Mock global fetch to simulate a 500 Internal Server Error
  globalThis.fetch = () => {
    return Promise.resolve(
      new Response("Internal Server Error from Supabase", {
        status: 500,
        statusText: "Internal Server Error",
      })
    );
  };

  try {
    // Create a mock request for an article that would normally trigger a fetch
    const req = new Request("https://bharat-viral.netlify.app/article/test-slug");

    // Call the handler
    const response = await handler(req);

    // Verify it handles the error gracefully and returns a 500 with 'Internal Server Error'
    assertEquals(response.status, 500);
    const body = await response.text();
    assertEquals(body, "Internal Server Error");
    assertEquals(response.headers.get("Content-Type"), "text/plain; charset=UTF-8");
  } finally {
    // Always restore the original fetch
    globalThis.fetch = originalFetch;
  }
});
