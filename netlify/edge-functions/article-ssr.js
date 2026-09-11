export default async (request, context) => {
  const url = new URL(request.url);

  const SUPABASE_URL =
    Deno.env.get("SUPABASE_URL") ||
    Deno.env.get("VITE_SUPABASE_URL");

  const SUPABASE_KEY =
    Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("SUPABASE_KEY") ||
    Deno.env.get("VITE_SUPABASE_ANON_KEY");

  const site = "https://bharat-viral.netlify.app";

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return context.next();
  }

  const slug =
    url.searchParams.get("slug") ||
    decodeURIComponent(
      url.pathname.replace(/^\/article\/?/, "")
    );

  if (!slug || slug === "article.html") {
    return context.next();
  }

  const endpoint =
    `${SUPABASE_URL}/rest/v1/articles` +
    `?select=*` +
    `&slug=eq.${encodeURIComponent(slug)}` +
    `&status=eq.published` +
    `&limit=1`;

  let article;

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) {
      return context.next();
    }

    const rows = await response.json();
    article = rows?.[0];
  } catch {
    return context.next();
  }

  if (!article) {
    return context.next();
  }

  const esc = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const title = article.title || "Bharat Viral";

  const description =
    article.excerpt ||
    article.description ||
    `${title} — Bharat Viral पर पूरी खबर पढ़ें।`;

  const image =
    article.image_url ||
    article.image ||
    `${site}/favicon.ico`;

  const canonical =
    `${site}/article/${encodeURIComponent(
      article.slug || slug
    )}`;

  const published =
    article.published_at ||
    article.created_at ||
    new Date().toISOString();

  const modified =
    article.updated_at ||
    article.modified_at ||
    published;

  const category =
    article.category ||
    article.category_name ||
    "News";

  const author =
    article.author ||
    article.author_name ||
    "Bharat Viral";

  const content =
    article.content ||
    article.body ||
    article.article_content ||
    "";

  const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",

    headline: title,

    description: description,

    image: [image],

    datePublished: published,

    dateModified: modified,

    author: {
      "@type": "Person",
      name: author
    },

    publisher: {
      "@type": "Organization",
      name: "Bharat Viral",
      url: site,

      logo: {
        "@type": "ImageObject",
        url: `${site}/favicon.ico`
      }
    },

    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical
    },

    articleSection: category,

    inLanguage: "hi-IN"
  };

  const html = `<!DOCTYPE html>

<html lang="hi">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<meta
  name="google-adsense-account"
  content="ca-pub-5768457082251884"
>

<title>${esc(title)} | Bharat Viral</title>

<meta
  name="description"
  content="${esc(description)}"
>

<meta
  name="robots"
  content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
>

<link
  rel="canonical"
  href="${esc(canonical)}"
>

<link
  rel="icon"
  href="/favicon.ico"
>

<link
  rel="stylesheet"
  href="/assets/css/global.css"
>

<meta
  property="og:type"
  content="article"
>

<meta
  property="og:site_name"
  content="Bharat Viral"
>

<meta
  property="og:title"
  content="${esc(title)}"
>

<meta
  property="og:description"
  content="${esc(description)}"
>

<meta
  property="og:url"
  content="${esc(canonical)}"
>

<meta
  property="og:image"
  content="${esc(image)}"
>

<meta
  property="article:published_time"
  content="${esc(published)}"
>

<meta
  property="article:modified_time"
  content="${esc(modified)}"
>

<meta
  name="twitter:card"
  content="summary_large_image"
>

<meta
  name="twitter:title"
  content="${esc(title)}"
>

<meta
  name="twitter:description"
  content="${esc(description)}"
>

<meta
  name="twitter:image"
  content="${esc(image)}"
>

<style>

body {
  margin: 0;
  background: #fff;
  color: #171717;
  font-family:
    Arial,
    "Noto Sans Devanagari",
    sans-serif;
}

.top {
  height: 62px;
  background: #df111b;
  color: #fff;

  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 0 6%;

  font-weight: 800;
}

.top a {
  color: #fff;
  text-decoration: none;
}

.wrap {
  width: 100%;
  max-width: 950px;

  margin: 30px auto;

  padding: 0 18px;
}

.article {
  background: #fff;

  border-radius: 14px;

  box-shadow:
    0 3px 18px rgba(0, 0, 0, .08);

  overflow: hidden;
}

.hero {
  width: 100%;
  max-height: 470px;

  object-fit: cover;

  display: block;
}

.body {
  padding: 30px;
}

.cat {
  display: inline-block;

  color: #df111b;

  font-size: 12px;

  font-weight: 900;

  margin-bottom: 10px;
}

.title {
  font-size: 40px;

  line-height: 1.25;

  margin: 0 0 12px;

  color: #00AEEF;

  font-weight: 900;
}

.meta {
  color: #777;

  font-size: 13px;

  margin-bottom: 24px;
}

.excerpt {
  font-size: 18px;

  line-height: 1.6;

  font-weight: 700;

  color: #444;

  border-left:
    4px solid #df111b;

  padding-left: 14px;

  margin-bottom: 25px;
}

.content {
  font-size: 18px;

  line-height: 1.85;
}

.content p {
  margin: 0 0 18px;
}

.content img {
  max-width: 100%;

  height: auto;
}

.back {
  display: inline-block;

  margin-bottom: 18px;

  color: #df111b;

  font-weight: 800;

  text-decoration: none;
}

@media (max-width: 650px) {

  .top {
    height: 52px;

    padding: 0 15px;

    font-size: 13px;
  }

  .wrap {
    margin: 15px auto;

    padding: 0 10px;
  }

  .body {
    padding: 20px;
  }

  .title {
    font-size: 28px;
  }

  .excerpt {
    font-size: 15px;
  }

  .content {
    font-size: 16px;

    line-height: 1.75;

    overflow-wrap: anywhere;
  }

  .hero {
    max-height: 300px;
  }

}

</style>

<script type="application/ld+json">
${JSON.stringify(schema)}
</script>

</head>

<body>

<header class="top">

  <a href="/">
    Bharat Viral
  </a>

  <a href="/">
    ← वापस Homepage
  </a>

</header>

<main class="wrap">

<article
  id="articleBox"
  class="article"
  itemscope
  itemtype="https://schema.org/NewsArticle"
>

${
  image
    ? `
<img
  class="hero"
  src="${esc(image)}"
  alt="${esc(title)}"
  itemprop="image"
  loading="eager"
>
`
    : ""
}

<div class="body">

<a
  class="back"
  href="/"
>
← वापस Homepage पर
</a>

<div class="cat">
${esc(category)}
</div>

<h1
  class="title"
  itemprop="headline"
>
${esc(title)}
</h1>

<div class="meta">

${esc(author)}

·

<time
  datetime="${esc(published)}"
  itemprop="datePublished"
>
${esc(published)}
</time>

</div>

<div
  class="excerpt"
  itemprop="description"
>
${esc(description)}
</div>

<div
  class="content"
  itemprop="articleBody"
>
${content}
</div>

</div>

</article>

</main>

</body>

</html>`;

  return new Response(html, {

    status: 200,

    headers: {

      "content-type":
        "text/html; charset=UTF-8",

      "cache-control":
        "public, max-age=60, s-maxage=300"

    }

  });

};
