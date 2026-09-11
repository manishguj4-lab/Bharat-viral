export default async (req, context) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || "https://ocarsylhsyxjqpzidndb.supabase.co";
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    const SITE = "https://bharatviralnews.netlify.app";

    function xmlEscape(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    function isoDate(value) {
      if (!value) return new Date().toISOString();
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }

    const categoriesEndpoint = SUPABASE_URL +
      "/rest/v1/categories?select=*&is_active=eq.true&order=sort_order.asc,created_at.asc";

    const categoriesRes = await fetch(categoriesEndpoint, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY
        }
    });

    if (!categoriesRes.ok) {
      throw new Error("Supabase categories returned HTTP " + categoriesRes.status);
    }
    const categories = await categoriesRes.json();

    let allArticles = [];
    let start = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const endpoint = SUPABASE_URL +
        "/rest/v1/articles?select=id,slug,created_at,published_at,updated_at" +
        "&status=eq.published&slug=not.is.null&order=published_at.desc" +
        `&limit=${limit}&offset=${start}`;

      const response = await fetch(endpoint, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY
        }
      });

      if (!response.ok) {
        throw new Error("Supabase articles returned HTTP " + response.status);
      }

      const articlesBatch = await response.json();
      allArticles = allArticles.concat(articlesBatch);

      if (articlesBatch.length < limit) {
        hasMore = false;
      } else {
        start += limit;
      }
    }
    const articles = allArticles;

    const urls = [
      { loc: `${SITE}/`, lastmod: new Date().toISOString() }
    ];

    for (const category of categories) {
      if (!category.slug) continue;
      // Trending should not be rendered
      if (category.slug.toLowerCase() === 'trending' || category.slug.toLowerCase() === 'notice') continue;

      urls.push({
        loc: `${SITE}/category.html?category=` + encodeURIComponent(category.slug),
        lastmod: isoDate(category.created_at) // isoDate is defined above
      });
    }

    for (const article of articles) {
      if (!article.slug) continue;
      urls.push({
        loc: `${SITE}/article/` + encodeURIComponent(article.slug),
        lastmod: isoDate(article.updated_at || article.published_at || article.created_at)
      });
    }

    const urlElements = urls.map(u =>
      "  <url>" +
      `<loc>${xmlEscape(u.loc)}</loc>` +
      (u.lastmod ? `<lastmod>${xmlEscape(u.lastmod)}</lastmod>` : "") +
      "</url>"
    );

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urlElements,
      "</urlset>"
    ].join("\n");

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=UTF-8",
        "Cache-Control": "public, max-age=300, s-maxage=300"
      }
    });

  } catch (error) {
    console.error("Sitemap error:", error);
    const SITE = "https://bharatviralnews.netlify.app";

    function xmlEscape(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    const fallback = [
      `${SITE}/`
    ];

    const urlElements = fallback.map(url =>
      `  <url><loc>${xmlEscape(url)}</loc></url>`
    );

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urlElements,
      "</urlset>"
    ].join("\n");

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=UTF-8",
        "Cache-Control": "public, max-age=60"
      }
    });
  }
}
