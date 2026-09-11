// netlify/functions/sitemap.js

export const config = {
  path: "/sitemap.xml"
};

const SITE = "https://bharatviralnews.netlify.app";
const DEFAULT_SUPABASE_URL =
  "https://ocarsylhsyxjqpzidndb.supabase.co";

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

async function fetchWithTimeout(
  url,
  options = {},
  timeout = 10000
) {
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

function createSitemapIndex(pages) {
  const sitemapElements = Array.from({ length: pages }, (_, i) => {
    return [
      "  <sitemap>",
      `    <loc>${SITE}/sitemap.xml?page=${i + 1}</loc>`,
      "  </sitemap>"
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapElements,
    "</sitemapindex>"
  ].join("\n");
}

function createXml(urls) {
  const urlElements = urls.map((item) => {
    const lines = [
      "  <url>",
      `    <loc>${xmlEscape(item.loc)}</loc>`
    ];

    if (item.lastmod) {
      lines.push(
        `    <lastmod>${xmlEscape(item.lastmod)}</lastmod>`
      );
    }

    lines.push("  </url>");

    return lines.join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlElements,
    "</urlset>"
  ].join("\n");
}

export default async function sitemap(req) {
  const requestUrl = new URL(req.url);
  const pageParam = requestUrl.searchParams.get("page");
  const isSitemapIndexRequest = !pageParam;
  let targetPage = parseInt(pageParam || "1", 10);
  if (isNaN(targetPage) || targetPage < 1) targetPage = 1;

  const MAX_URLS_PER_SITEMAP = 40000;

  const urls = [];
  const seenUrls = new Set();

  function addUrl(loc, lastmod = null) {
    if (!loc || seenUrls.has(loc)) {
      return;
    }

    seenUrls.add(loc);

    urls.push({
      loc,
      lastmod: isoDate(lastmod)
    });
  }

  try {
    /*
     * ==========================================
     * NETLIFY ENVIRONMENT VARIABLES
     * ==========================================
     */

    const SUPABASE_URL =
      process.env.SUPABASE_URL ||
      DEFAULT_SUPABASE_URL;

    const SUPABASE_KEY =
      process.env.SUPABASE_KEY;

    if (!SUPABASE_KEY) {
      throw new Error(
        "SUPABASE_KEY environment variable is missing"
      );
    }

    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json"
    };

    /*
     * ==========================================
     * GET PUBLISHED ARTICLES COUNT FOR SITEMAP INDEX
     * ==========================================
     */

    let totalArticles = 0;
    const countUrl = `${SUPABASE_URL}/rest/v1/articles?status=eq.published&slug=not.is.null`;

    const countResponse = await fetchWithTimeout(
      countUrl,
      { headers: { ...headers, "Prefer": "count=exact", "Range": "0-0" } },
      10000
    );

    if (countResponse.ok) {
        const contentRange = countResponse.headers.get("Content-Range");
        if (contentRange) {
           const match = contentRange.match(/\/(\d+)$/);
           if (match) {
             totalArticles = parseInt(match[1], 10);
           }
        }
    }

    // Rough estimate of static and category URLs.
    const nonArticleUrlCount = 100;
    const totalUrls = totalArticles + nonArticleUrlCount;

    if (isSitemapIndexRequest && totalUrls > MAX_URLS_PER_SITEMAP) {
       const pages = Math.ceil(totalUrls / MAX_URLS_PER_SITEMAP);
       return new Response(createSitemapIndex(pages), {
         status: 200,
         headers: {
           "Content-Type": "application/xml; charset=UTF-8",
           "Cache-Control": "public, max-age=300, s-maxage=300"
         }
       });
    }

    /*
     * ==========================================
     * HOMEPAGE (Only on page 1)
     * ==========================================
     */

    if (targetPage === 1) {
      addUrl(`${SITE}/`); // No artificial lastmod for homepage
    }

    /*
     * ==========================================
     * GET ACTIVE CATEGORIES (Only on page 1)
     * ==========================================
     */

    if (targetPage === 1) {
      const categoriesUrl =
        `${SUPABASE_URL}/rest/v1/categories` +
        `?select=slug,created_at` +
        `&is_active=eq.true` +
        `&order=sort_order.asc,created_at.asc`;

      const categoriesResponse =
        await fetchWithTimeout(
          categoriesUrl,
          { headers },
          10000
        );

      if (!categoriesResponse.ok) {
        throw new Error(
          `Categories request failed: HTTP ${categoriesResponse.status}`
        );
      }

      const categories =
        await categoriesResponse.json();

      if (!Array.isArray(categories)) {
        throw new Error(
          "Invalid categories response"
        );
      }

      /*
       * ==========================================
       * CATEGORY URLS
       * ==========================================
       */

      for (const category of categories) {
        if (!category?.slug) {
          continue;
        }

        const slug =
          String(category.slug).trim();

        if (!slug) {
          continue;
        }

        const lowerSlug =
          slug.toLowerCase();

        /*
         * Do not include these categories.
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
    }
    /*
     * ==========================================
     * GET PUBLISHED ARTICLES
     * ==========================================
     */

    const limit = 1000;
    let offset = (targetPage - 1) * MAX_URLS_PER_SITEMAP;
    const maxOffsetForPage = targetPage * MAX_URLS_PER_SITEMAP;

    while (offset < maxOffsetForPage) {
      const articlesUrl =
        `${SUPABASE_URL}/rest/v1/articles` +
        `?select=slug,created_at,published_at,updated_at` +
        `&status=eq.published` +
        `&slug=not.is.null` +
        `&order=published_at.desc` +
        `&limit=${limit}` +
        `&offset=${offset}`;

      const articlesResponse =
        await fetchWithTimeout(
          articlesUrl,
          { headers },
          10000
        );

      if (!articlesResponse.ok) {
        throw new Error(
          `Articles request failed: HTTP ${articlesResponse.status}`
        );
      }

      const batch =
        await articlesResponse.json();

      if (!Array.isArray(batch)) {
        throw new Error(
          "Invalid articles response"
        );
      }

      if (batch.length === 0) {
        break;
      }

      /*
       * ========================================
       * ARTICLE URLS
       * ========================================
       */

      for (const article of batch) {
        if (!article?.slug) {
          continue;
        }

        const slug =
          String(article.slug).trim();

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
       * Last page
       */

      if (batch.length < limit) {
        break;
      }

      offset += limit;

      if (urls.length >= MAX_URLS_PER_SITEMAP) {
        break;
      }
    }

    /*
     * ==========================================
     * GENERATE FINAL XML
     * ==========================================
     */

    const body = createXml(urls);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/xml; charset=UTF-8",

        "Cache-Control":
          "public, max-age=300, s-maxage=300"
      }
    });

  } catch (error) {
    /*
     * ==========================================
     * FALLBACK SITEMAP
     * ==========================================
     */

    console.error(
      "Sitemap generation error:",
      error
    );

    /*
     * Always return valid XML.
     */

    const fallbackXml =
      createXml([
        {
          loc: `${SITE}/`
        }
      ]);

    return new Response(
      fallbackXml,
      {
        status: 503,
        headers: {
          "Content-Type":
            "application/xml; charset=UTF-8",

          "Cache-Control":
            "no-cache, no-store, must-revalidate"
        }
      }
    );
  }
}
