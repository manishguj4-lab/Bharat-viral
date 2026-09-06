const SUPABASE_URL = "https://ocarsylhsyxjqpzidndb.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const SITE = "https://bharat-viral.netlify.app";
const NEWS_PUBLICATION = "Bharat Viral";
const LANGUAGE = "hi";

// Google News sitemap में सामान्यतः हाल की news entries ही रखी जाती हैं.
// 48 घंटे के अंदर प्रकाशित/अपडेट हुई published articles को लिया जाता है.
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

  return Number.isNaN(d.getTime())
    ? null
    : d;
}

exports.handler = async function () {
  try {
    const endpoint =
      SUPABASE_URL +
      "/rest/v1/articles" +
      "?select=id,slug,title,published_at,updated_at,created_at,status" +
      "&status=eq.published" +
      "&slug=not.is.null" +
      "&title=not.is.null" +
      "&order=published_at.desc" +
      "&limit=100";

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

    const now = Date.now();

    const newsArticles = articles.filter((article) => {
      const date =
        validDate(article.published_at) ||
        validDate(article.created_at);

      if (!date) return false;

      const ageHours =
        (now - date.getTime()) / (1000 * 60 * 60);

      return ageHours >= 0 &&
             ageHours <= NEWS_WINDOW_HOURS;
    });

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',

      '<urlset',
      ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
      
      ...newsArticles.map((article) => {
        const date =
          validDate(article.published_at) ||
          validDate(article.created_at);

        const loc =
          `${SITE}/article/` +
          encodeURIComponent(article.slug);

        const title = String(article.title || "")
          .replace(/\s+/g, " ")
          .trim();

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

    return {
      statusCode: 200,

      headers: {
        "Content-Type": "application/xml; charset=UTF-8",

        // News sitemap को जल्दी refresh कराने के लिए
        "Cache-Control":
          "public, max-age=300, s-maxage=300"
      },

      body
    };

  } catch (error) {

    console.error(
      "News Sitemap error:",
      error
    );

    // Error होने पर भी valid empty News Sitemap लौटाएँ।
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',

      '<urlset',
      ' xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',

      "</urlset>"
    ].join("\n");

    return {
      statusCode: 200,

      headers: {
        "Content-Type":
          "application/xml; charset=UTF-8",

        "Cache-Control":
          "public, max-age=60"
      },

      body
    };
  }
};
