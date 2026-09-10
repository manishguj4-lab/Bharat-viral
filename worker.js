import { onRequest as articleRequest } from "./functions/article/[slug].js";
import { onRequest as sitemapRequest } from "./functions/sitemap.xml.js";
import { onRequest as newsSitemapRequest } from "./functions/news-sitemap.xml.js";
import { onRequest as telegramPublishRequest } from "./functions/api/telegram-publish.js";

function workerContext(request, env, params = {}) {
  return {
    request,
    env,
    params,
    waitUntil: (promise) => promise,
    next: async () => env.ASSETS.fetch(request),
    functionPath: new URL(request.url).pathname
  };
}

function notFound(message = "Not Found") {
  return new Response(message, {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      "X-Robots-Tag": "noindex"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // ==========================================
      // ARTICLE ROUTES
      // ==========================================
      if (pathname === "/article" || pathname.startsWith("/article/")) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          return new Response("Method Not Allowed", {
            status: 405,
            headers: {
              Allow: "GET, HEAD"
            }
          });
        }

        const rawSlug = pathname
          .slice("/article/".length)
          .replace(/\/+$/, "");

        if (!rawSlug) {
          return notFound("Article not found");
        }

        let slug;

        try {
          slug = decodeURIComponent(rawSlug);
        } catch {
          return notFound("Article not found");
        }

        const response = await articleRequest(
          workerContext(request, env, { slug })
        );

        // Do NOT read, clone or buffer the response.
        // Preserve HTMLRewriter streaming.
        return response;
      }

      // ==========================================
      // XML SITEMAP
      // ==========================================
      if (pathname === "/sitemap.xml") {
        return await sitemapRequest(
          workerContext(request, env)
        );
      }

      // ==========================================
      // GOOGLE NEWS SITEMAP
      // ==========================================
      if (pathname === "/news-sitemap.xml") {
        return await newsSitemapRequest(
          workerContext(request, env)
        );
      }

      // ==========================================
      // TELEGRAM PUBLISH API
      // ==========================================
      if (pathname === "/api/telegram-publish") {
        return await telegramPublishRequest(
          workerContext(request, env)
        );
      }

      // ==========================================
      // UNKNOWN API ROUTES
      // ==========================================
      if (pathname.startsWith("/api/")) {
        return notFound("API endpoint not found");
      }

      // ==========================================
      // STATIC WEBSITE
      // ==========================================
      return await env.ASSETS.fetch(request);

    } catch (error) {
      console.error("Worker request error:", error);

      return new Response("Internal Server Error", {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=UTF-8"
        }
      });
    }
  }
};
