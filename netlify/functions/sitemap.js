// netlify/functions/sitemap.js

export const config = {
  path: "/sitemap.xml"
};

const SITE = "https://bharatviralnews.netlify.app";
const DEFAULT_SUPABASE_URL = "https://ocarsylhsyxjqpzidndb.supabase.co";

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoDate(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function createXml(urls) {
  const urlElements = urls.map((item) => {
    const lastmod = item.lastmod
      ? `    <lastmod>${xmlEscape(item.lastmod)}</lastmod>`
      : "";

    return [
      "  <url>",
      `    <loc>${xmlEscape(item.loc)}</loc>`,
      lastmod,
      "  </url>"
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlElements,
    "</urlset>"
  ].join("\n");
}

export default async function sitemap() {
  try {
    /*
     * Netlify environment variables
     */
    const SUPABASE_URL =
      Netlify.env.get("SUPABASE_URL") ||
      DEFAULT_SUPABASE_URL;

    const SUPABASE_KEY =
      Netlify.env.get("SUPABASE_KEY");

    if (!SUPABASE_KEY) {
      throw new Error("SUPABASE_KEY is missing");
    }

    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json"
    };

    /*
     * ==========================================
     * GET ACTIVE CATEGORIES
     * ==========================================
     */

    const categoriesUrl =
      `${SUPABASE_URL}/rest/v1/categories` +
      `?select=slug,created_at` +
      `&is_active=eq.true` +
      `&order=sort_order.asc,created_at.asc`;

    const categoriesResponse = await fetchWithTimeout(
      categoriesUrl,
      { headers },
      8000
    );

    if (!categoriesResponse.ok) {
      throw new Error(
        `Categories request failed: HTTP ${categoriesResponse.status}`
      );
    }

    const categories = await categoriesResponse.json();

    if (!Array.isArray(categories)) {
      throw new Error("Invalid categories response");
    }

    /*
     * ==========================================
     * GET PUBLISHED ARTICLES
     * ==========================================
     */

    const articles = [];

    const limit = 1000;
    let offset = 0;

    while (true) {
      const articlesUrl =
        `${SUPABASE_URL}/rest/v1/articles` +
        `?select=id,slug,created_at,published_at,updated_at` +
        `&status=eq.published` +
        `&slug=not.is.null` +
        `&order=published_at.desc` +
        `&limit=${limit}` +
        `&offset=${offset}`;

      const articlesResponse = await fetchWithTimeout(
        articlesUrl,
        { headers },
        8000
      );

      if (!articlesResponse.ok) {
        throw new Error(
          `Articles request failed: HTTP ${articlesResponse.status}`
        );
      }

      const batch = await articlesResponse.json();

      if (!Array.isArray(batch)) {
        throw new Error("Invalid articles response");
      }

      if (batch.length === 0) {
        break;
      }

      articles.push(...batch);

      /*
       * Last page reached
       */
      if (batch.length < limit) {
        break;
      }

      offset += limit;

      /*
       * Safety protection against an accidental
       * infinite pagination loop.
       */
      if (offset > 100000) {
        break;
      }
    }

    /*
     * ==========================================
     * BUILD SITEMAP URL LIST
     * ==========================================
     */

    const urls = [];
    const seenUrls = new Set();

    function addUrl(loc, lastmod = null) {
      if (!loc) return;

      if (seenUrls.has(loc)) {
        return;
      }

      seenUrls.add(loc);

      urls.push({
        loc,
        lastmod: lastmod
          ? isoDate(lastmod)
          : null
      });
    }

    /*
     * Homepage
     */
    addUrl(
      `${SITE}/`,
      new Date().toISOString()
    );

    /*
     * ==========================================
     * CATEGORY URLS
     * ==========================================
     */

    for (const category of categories) {
      if (!category || !category.slug) {
        continue;
      }

      const slug = String(category.slug).trim();

      if (!slug) {
        continue;
      }

      const lowerSlug = slug.toLowerCase();

      /*
       * These categories should not be included
       * in the sitemap.
       */
      if (
        lowerSlug === "trending" ||
        lowerSlug === "notice"
      ) {
        continue;
      }

      const categoryUrl =
        `${SITE}/category.html?category=` +
        encodeURIComponent(slug);

      addUrl(
        categoryUrl,
        category.created_at
      );
    }

    /*
     * ==========================================
     * ARTICLE URLS
     * ==========================================
     */

    for (const article of articles) {
      if (!article || !article.slug) {
        continue;
      }

      const slug = String(article.slug).trim();

      if (!slug) {
        continue;
      }

      const articleUrl =
        `${SITE}/article/` +
        encodeURIComponent(slug);

      addUrl(
        articleUrl,
        article.updated_at ||
        article.published_at ||
        article.created_at
      );
    }

    /*
     * ==========================================
     * GENERATE XML
     * ==========================================
     */

    const body = createXml(urls);

    /*
     * ==========================================
     * SUCCESS RESPONSE
     * ==========================================
     */

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=UTF-8",
        "Cache-Control":
          "public, max-age=300, s-maxage=300",
        "X-Robots-Tag":
          "noindex"
      }
    });

  } catch (error) {
    /*
     * ==========================================
     * FALLBACK
     * ==========================================
     *
     * Even if Supabase fails, always return
     * valid XML instead of an HTML error page.
     */

    console.error(
      "Sitemap generation error:",
      error
    );

    const fallbackUrls = [
      {
        loc: `${SITE}/`,
        lastmod: null
      }
    ];

    const fallbackXml = createXml(
      fallbackUrls
    );

    return new Response(fallbackXml, {
      status: 200,
      headers: {
        "Content-Type":
          "application/xml; charset=UTF-8",
        "Cache-Control":
          "public, max-age=60, s-maxage=60",
        "X-Robots-Tag":
          "noindex"
      }
    });
  }
}
