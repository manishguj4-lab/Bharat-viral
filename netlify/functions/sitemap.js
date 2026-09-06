const SUPABASE_URL = process.env.SUPABASE_URL || "https://ocarsylhsyxjqpzidndb.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

const SITE = "https://bharat-viral.netlify.app";

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

  return Number.isNaN(d.getTime())
    ? new Date().toISOString()
    : d.toISOString();
}

exports.handler = async function () {
  try {
    const endpoint =
      SUPABASE_URL +
      "/rest/v1/articles?select=id,slug,created_at,published_at,updated_at" +
      "&status=eq.published&slug=not.is.null&order=published_at.desc";

    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY
      }
    });

    if (!response.ok) {
      throw new Error(
        "Supabase returned HTTP " + response.status
      );
    }

    const articles = await response.json();

    const urls = [
      {
        loc: `${SITE}/`,
        lastmod: new Date().toISOString()
      },
      { loc: `${SITE}/trending.html` },
      { loc: `${SITE}/news.html` },
      { loc: `${SITE}/entertainment.html` },
      { loc: `${SITE}/sports.html` },
      { loc: `${SITE}/tech.html` },
      { loc: `${SITE}/social-media.html` },
      { loc: `${SITE}/india.html` },
      { loc: `${SITE}/explained.html` },
      { loc: `${SITE}/google-trends.html` }
    ];

    for (const article of articles) {
      if (!article.slug) continue;

      urls.push({
        loc:
          `${SITE}/article.html?slug=` +
          encodeURIComponent(article.slug),

        lastmod: isoDate(
          article.updated_at ||
          article.published_at ||
          article.created_at
        )
      });
    }

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',

      ...urls.map(
        (u) =>
          "  <url>" +
          `<loc>${xmlEscape(u.loc)}</loc>` +
          (u.lastmod
            ? `<lastmod>${xmlEscape(u.lastmod)}</lastmod>`
            : "") +
          "</url>"
      ),

      "</urlset>"
    ].join("\n");

    return {
      statusCode: 200,

      headers: {
        "Content-Type": "application/xml; charset=UTF-8",
        "Cache-Control":
          "public, max-age=300, s-maxage=300"
      },

      body
    };

  } catch (error) {

    console.error("Sitemap error:", error);

    const fallback = [
      `${SITE}/`,
      `${SITE}/trending.html`,
      `${SITE}/news.html`,
      `${SITE}/entertainment.html`,
      `${SITE}/sports.html`,
      `${SITE}/tech.html`,
      `${SITE}/social-media.html`,
      `${SITE}/india.html`,
      `${SITE}/explained.html`,
      `${SITE}/google-trends.html`
    ];

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',

      ...fallback.map(
        (url) =>
          `  <url><loc>${xmlEscape(url)}</loc></url>`
      ),

      "</urlset>"
    ].join("\n");

    return {
      statusCode: 200,

      headers: {
        "Content-Type": "application/xml; charset=UTF-8",
        "Cache-Control":
          "public, max-age=60"
      },

      body
    };
  }
};
