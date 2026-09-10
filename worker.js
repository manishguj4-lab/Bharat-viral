import { onRequest as articleRequest } from "./functions/article/[slug].js";
import { onRequest as sitemapRequest } from "./functions/sitemap.xml.js";
import { onRequest as newsSitemapRequest } from "./functions/news-sitemap.xml.js";
import { onRequest as telegramPublishRequest } from "./functions/api/telegram-publish.js";

const LEGACY_SITE = "https://bharat-viral.pages.dev";

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

async function rewriteLegacyProductionUrls(response, origin) {
  if (!response || response.status === 204) return response;

  const contentType = response.headers.get("content-type") || "";

  if (!/(text\/html|application\/xml|text\/xml)/i.test(contentType)) {
    return response;
  }

  const body = await response.text();

  if (!body.includes(LEGACY_SITE)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(
    body.split(LEGACY_SITE).join(origin),
    {
      status: response.status,
      statusText: response.statusText,
      headers
    }
  );
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
      // Dynamic article route
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

        return rewriteLegacyProductionUrls(response, url.origin);
      }

      // Sitemap
      if (pathname === "/sitemap.xml") {
        const response = await sitemapRequest(
          workerContext(request, env)
        );

        return rewriteLegacyProductionUrls(response, url.origin);
      }

      // Google News sitemap
      if (pathname === "/news-sitemap.xml") {
        const response = await newsSitemapRequest(
          workerContext(request, env)
        );

        return rewriteLegacyProductionUrls(response, url.origin);
      }

      // Existing Telegram API
      if (pathname === "/api/telegram-publish") {
        return telegramPublishRequest(
          workerContext(request, env)
        );
      }

      // Unknown API routes
      if (pathname.startsWith("/api/")) {
        return notFound("API endpoint not found");
      }

      // Normal static website
      return env.ASSETS.fetch(request);

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
