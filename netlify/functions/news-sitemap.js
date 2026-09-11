export default async (req, context) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || "https://ocarsylhsyxjqpzidndb.supabase.co";
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    const SITE = "https://bharatviralnews.netlify.app";
    const NEWS_PUBLICATION = "Bharat Viral";
    const LANGUAGE = "hi";
    const NEWS_WINDOW_HOURS = 48;

    function xmlEscape(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    function validDate(value) {
      if (!value) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }

        let allArticles = [];
    let start = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const endpoint = SUPABASE_URL +
        "/rest/v1/articles" +
        "?select=id,slug,title,published_at,updated_at,created_at,status" +
        "&status=eq.published&slug=not.is.null&title=not.is.null" +
        `&order=published_at.desc&limit=${limit}&offset=${start}`;

      const response = await fetch(endpoint, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY
        }
      });

      if (!response.ok) {
        throw new Error("Supabase returned HTTP " + response.status);
      }

      const articles = await response.json();
      allArticles = allArticles.concat(articles);

      if (articles.length < limit) {
        hasMore = false;
      } else {
        const lastArticle = articles[articles.length - 1];
        const lastDate = validDate(lastArticle.published_at) || validDate(lastArticle.created_at);
        if (lastDate) {
          const ageHours = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60);
          if (ageHours > NEWS_WINDOW_HOURS) {
            hasMore = false;
          }
        }
        start += limit;
      }
    }
    const articles = allArticles;
    const now = Date.now();

    const newsArticles = articles.filter(article => {
      const date = validDate(article.published_at) || validDate(article.created_at);
      if (!date) return false;
      const ageHours = (now - date.getTime()) / (1000 * 60 * 60);
      return ageHours >= 0 && ageHours <= NEWS_WINDOW_HOURS;
    });

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset',
      ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
      ...newsArticles.map(article => {
        const date = validDate(article.published_at) || validDate(article.created_at);
        const loc = `${SITE}/article/` + encodeURIComponent(article.slug);
        const title = String(article.title || "").replace(/\s+/g, " ").trim();
        return [
          "  <url>",
          `    <loc>${xmlEscape(loc)}</loc>`,
          "    <news:news>",
          "      <news:publication>",
          `        <news:name>${xmlEscape(NEWS_PUBLICATION)}</news:name>`,
          `        <news:language>${LANGUAGE}</news:language>`,
          "      </news:publication>",
          `      <news:publication_date>${xmlEscape(date.toISOString())}</news:publication_date>`,
          `      <news:title>${xmlEscape(title)}</news:title>`,
          "    </news:news>",
          "  </url>"
        ].join("\n");
      }),
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
    console.error("News Sitemap error:", error);
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset',
      ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
      "</urlset>"
    ].join("\n");

    return new Response(body, {
      status: 503,
      headers: {
        "Content-Type": "application/xml; charset=UTF-8",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });
  }
}
