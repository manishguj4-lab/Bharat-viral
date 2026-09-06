const SUPABASE_URL = "https://ocarsylhsyxjqpzidndb.supabase.co";
const SUPABASE_KEY = "sb_publishable_LTmMKlt5saAsFIlnF87_6A_75FFCvK0";
const SITE = "https://bharat-viral.netlify.app";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function toAbsoluteUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return `${SITE}/icon-192.png`;
  try {
    return new URL(raw, SITE).href;
  } catch {
    return `${SITE}/icon-192.png`;
  }
}

export function toKeywordList(...values: unknown[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const v = String(item ?? "").trim();
        if (v && !result.includes(v)) result.push(v);
      }
    } else {
      const raw = String(value ?? "").trim();
      if (!raw) continue;
      for (const item of raw.split(/[,|]/g)) {
        const v = item.trim();
        if (v && !result.includes(v)) result.push(v);
      }
    }
  }
  return result.slice(0, 30);
}

function getCategoryUrl(category: string, categorySlug: string): string {
  const slug = String(categorySlug || category || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return slug
    ? `${SITE}/category.html?category=${encodeURIComponent(slug)}`
    : `${SITE}/`;
}

function getSlug(req: Request): string {
  const url = new URL(req.url);

  const fromQuery = url.searchParams.get("slug");
  if (fromQuery) return fromQuery.trim();

  const parts = url.pathname.split("/").filter(Boolean);
  const index = parts.indexOf("article");

  if (index !== -1 && parts[index + 1]) {
    return decodeURIComponent(parts[index + 1]).trim();
  }

  return "";
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const slug = getSlug(req);

    if (!slug) {
      return new Response("Article not found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=UTF-8",
          "X-Robots-Tag": "noindex"
        }
      });
    }

    const endpoint =
      SUPABASE_URL +
      "/rest/v1/articles" +
      "?select=*" +
      "&slug=eq." +
      encodeURIComponent(slug) +
      "&status=eq.published" +
      "&limit=1";

    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY
      }
    });

    if (!response.ok) {
      throw new Error(
        "Supabase HTTP " + response.status
      );
    }

    const rows = await response.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response("Article not found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=UTF-8",
          "X-Robots-Tag": "noindex"
        }
      });
    }

    const article = rows[0];

    const title =
      article.seo_title ||
      article.title ||
      "Bharat Viral";

    const description =
      article.seo_description ||
      article.meta_description ||
      article.excerpt ||
      article.description ||
      article.title ||
      "Bharat Viral पर ताजा खबरें पढ़ें।";

    const image = toAbsoluteUrl(
      article.image_url ||
      article.featured_image ||
      article.image
    );

    const category =
      article.category_name ||
      article.category ||
      article.category_slug ||
      "News";

    const categorySlug =
      article.category_slug ||
      article.category_slug_name ||
      "";

    const keywords = toKeywordList(
      article.main_keyword,
      article.related_keywords,
      article.tags,
      article.keywords
    );

    const author =
      article.author_name ||
      article.author ||
      "Bharat Viral";

    const published =
      article.published_at ||
      article.created_at ||
      new Date().toISOString();

    const modified =
      article.updated_at ||
      article.published_at ||
      article.created_at ||
      published;

    const canonical =
      `${SITE}/article/` +
      encodeURIComponent(String(article.slug));

    const content =
      article.content ||
      article.body ||
      article.article_content ||
      "";

    const newsArticle = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: String(title),
      description: String(description).slice(0, 160),
      url: canonical,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonical
      },
      image: [{
        "@type": "ImageObject",
        url: String(image)
      }],
      datePublished: published,
      dateModified: modified,
      articleSection: String(category),
      keywords: keywords,
      author: {
        "@type": "Organization",
        name: String(author)
      },
      publisher: {
        "@type": "Organization",
        name: "Bharat Viral",
        url: `${SITE}/`
      }
    };

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: `${SITE}/`
        },
        {
          "@type": "ListItem",
          position: 2,
          name: String(category),
          item: getCategoryUrl(String(category), String(categorySlug))
        },
        {
          "@type": "ListItem",
          position: 3,
          name: String(title),
          item: canonical
        }
      ]
    };

    const html = `<!doctype html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${esc(title)} | Bharat Viral</title>

<meta name="description" content="${esc(
      String(description).slice(0, 160)
    )}">

<meta name="robots"
content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">

<link rel="canonical" href="${esc(canonical)}">

<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(
      String(description).slice(0, 160)
    )}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">
<meta name="keywords" content="${esc(keywords.join(", "))}">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="article:published_time" content="${esc(published)}">
<meta property="article:modified_time" content="${esc(modified)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(
      String(description).slice(0, 160)
    )}">
<meta name="twitter:image" content="${esc(image)}">

<script type="application/ld+json">${jsonLd(
      newsArticle
    )}</script>

<script type="application/ld+json">${jsonLd(
      breadcrumb
    )}</script>

</head>

<body>

<main>
<article
  itemscope
  itemtype="https://schema.org/NewsArticle"
>

<h1 itemprop="headline">${esc(title)}</h1>

<div class="article-meta">
  <span>${esc(category)}</span>
  <time
    itemprop="datePublished"
    datetime="${esc(published)}"
  >${esc(published)}</time>
  <time
    itemprop="dateModified"
    datetime="${esc(modified)}"
  >${esc(modified)}</time>
</div>

${
  image
    ? `<img
        src="${esc(image)}"
        alt="${esc(title)}"
        itemprop="image"
        loading="eager"
        decoding="async"
      >`
    : ""
}

<div itemprop="articleBody">
${content}
</div>

</article>
</main>

</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control":
          "public, max-age=300, s-maxage=300"
      }
    });

  } catch (error) {
    console.error("Article SEO error:", error);

    return new Response(
      "Internal Server Error",
      {
        status: 500,
        headers: {
          "Content-Type":
            "text/plain; charset=UTF-8"
        }
      }
    );
  }
          }
  
