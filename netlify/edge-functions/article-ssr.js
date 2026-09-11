import xss from 'xss';

export default async (request, context) => {
  const url = new URL(request.url);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY");

  const site = "https://bharatviralnews.netlify.app";

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return context.next();
  }

  const slug = url.searchParams.get("slug") || decodeURIComponent(url.pathname.replace(/^\/article\/?/, ""));

  if (!slug || slug === "article.html") {
    return context.next();
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/articles?select=*&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`;

  let article;
  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!response.ok) {
      return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "30" } });
    }

    const rows = await response.json();
    article = rows?.[0];
  } catch {
    return new Response("Internal Server Error", { status: 500, headers: { "Retry-After": "30" } });
  }

  if (!article) {
    return new Response("Article Not Found", {
      status: 404,
      headers: { "content-type": "text/html; charset=UTF-8" }
    });
  }

  const esc = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const title = article.title || "Bharat Viral";
  const description = article.excerpt || article.description || `${title} — Bharat Viral पर पूरी खबर पढ़ें।`;
  const image = article.image_url || article.image || `${site}/icon-192.png`;
  const canonical = `${site}/article/${encodeURIComponent(article.slug || slug)}`;
  const published = article.published_at || article.created_at || new Date().toISOString();
  const modified = article.updated_at || article.modified_at || published;
  const rawCat = (Array.isArray(article.categories) && article.categories[0]) || article.category || article.category_name || article.article_type || "News";
  const category = String(rawCat).replace(/-/g, ' ').replace(/_/g, ' ');
  const categorySlug = String(article.category_slug || (Array.isArray(article.categories) && article.categories[0]) || article.article_type || "news").toLowerCase().trim();
  const author = article.author_name || article.author || "Bharat Viral";
  const rawContent = article.content || article.body || article.article_content || "";

  // Sanitize the content server-side
  const sanitizedContent = xss(rawContent, {
    whiteList: {
      p: [], div: ['class', 'id'], h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
      strong: [], b: [], em: [], i: [], u: [], ul: [], ol: [], li: [],
      a: ['href', 'target', 'rel'], br: [], blockquote: [],
      table: [], thead: [], tbody: [], tr: [], th: [], td: [],
      img: ['src', 'alt', 'width', 'height', 'loading'], figure: [], figcaption: [],
      iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'allow'],
      video: ['src', 'controls', 'width', 'height', 'poster', 'autoplay', 'muted', 'loop'],
      source: ['src', 'type']
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
  });

  const newsSchema = {
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
        url: `${site}/icon-192.png`
      }
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical
    },
    articleSection: category,
    inLanguage: "hi-IN"
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: site
      },
      {
        "@type": "ListItem",
        position: 2,
        name: category,
        item: `${site}/category.html?category=${encodeURIComponent(categorySlug)}`
      },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: canonical
      }
    ]
  };

  // Safe JSON-LD serialization avoiding breakout sequences
  const safeNewsJsonLd = JSON.stringify(newsSchema)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  const safeBreadcrumbJsonLd = JSON.stringify(breadcrumbSchema)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  // Fetch the actual article.html file to act as the template
  const templateResponse = await fetch(new URL("/article.html", request.url));
  let templateHtml = await templateResponse.text();

  // Strip static schema to avoid duplicate JSON-LD schemas
  templateHtml = templateHtml.replace(/<script\s+type="application\/ld\+json"\s+id="articleSchema">.*?<\/script>/is, "");

  // Update Meta Tags
  templateHtml = templateHtml.replace(/<title>.*?<\/title>/i, `<title>${esc(title)} | Bharat Viral</title>`);
  templateHtml = templateHtml.replace(/<meta\s+name="description"\s+id="metaDescription"\s+content="[^"]*"/i, `<meta name="description" id="metaDescription" content="${esc(description)}"`);
  templateHtml = templateHtml.replace(/<meta\s+name="robots"\s+content="[^"]*"/i, `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"`);
  templateHtml = templateHtml.replace(/<link\s+rel="canonical"\s+id="canonicalUrl"\s+href="[^"]*"/i, `<link rel="canonical" id="canonicalUrl" href="${esc(canonical)}"`);

  // Update OG Tags
  templateHtml = templateHtml.replace(/<meta\s+property="og:title"\s+id="ogTitle"\s+content="[^"]*"/i, `<meta property="og:title" id="ogTitle" content="${esc(title)}"`);
  templateHtml = templateHtml.replace(/<meta\s+property="og:description"\s+id="ogDescription"\s+content="[^"]*"/i, `<meta property="og:description" id="ogDescription" content="${esc(description)}"`);
  templateHtml = templateHtml.replace(/<meta\s+property="og:url"\s+id="ogUrl"\s+content="[^"]*"/i, `<meta property="og:url" id="ogUrl" content="${esc(canonical)}"`);
  templateHtml = templateHtml.replace(/<meta\s+property="og:image"\s+id="ogImage"\s+content="[^"]*"/i, `<meta property="og:image" id="ogImage" content="${esc(image)}"`);
  templateHtml = templateHtml.replace(/<meta\s+property="article:published_time"\s+id="ogPublishedTime"\s+content="[^"]*"/i, `<meta property="article:published_time" id="ogPublishedTime" content="${esc(published)}"`);
  templateHtml = templateHtml.replace(/<meta\s+property="article:modified_time"\s+id="ogModifiedTime"\s+content="[^"]*"/i, `<meta property="article:modified_time" id="ogModifiedTime" content="${esc(modified)}"`);

  // Inject article:section meta tag if missing
  if (!templateHtml.includes('property="article:section"')) {
    templateHtml = templateHtml.replace(/<\/head>/i, `<meta property="article:section" content="${esc(category)}"></head>`);
  }

  // Update Twitter Tags
  templateHtml = templateHtml.replace(/<meta\s+name="twitter:title"\s+id="twitterTitle"\s+content="[^"]*"/i, `<meta name="twitter:title" id="twitterTitle" content="${esc(title)}"`);
  templateHtml = templateHtml.replace(/<meta\s+name="twitter:description"\s+id="twitterDescription"\s+content="[^"]*"/i, `<meta name="twitter:description" id="twitterDescription" content="${esc(description)}"`);
  templateHtml = templateHtml.replace(/<meta\s+name="twitter:image"\s+id="twitterImage"\s+content="[^"]*"/i, `<meta name="twitter:image" id="twitterImage" content="${esc(image)}"`);

  // Inject JSON-LD Schemas before </head>
  templateHtml = templateHtml.replace(/<\/head>/i, `<script type="application/ld+json">${safeNewsJsonLd}</script><script type="application/ld+json">${safeBreadcrumbJsonLd}</script></head>`);

  // Render the article content inside <article id="articleBox">
  const articleBoxHtml = `
    ${image ? `<img class="hero" src="${esc(image)}" alt="${esc(title)}" itemprop="image" loading="eager">` : ""}
    <div class="body">
      <a class="back" href="/">← वापस Homepage पर</a>
      <div class="cat">${esc(category)}</div>
      <h1 class="title" itemprop="headline">${esc(title)}</h1>
      <div class="meta">${esc(author)} · <time datetime="${esc(published)}" itemprop="datePublished">${esc(published)}</time></div>
      <div class="excerpt" itemprop="description">${esc(description)}</div>
      <div class="content" itemprop="articleBody">${sanitizedContent}</div>
    </div>
  `;

  // Replace the loading state with actual content
  templateHtml = templateHtml.replace(/<article\s+class="article"\s+id="articleBox">.*?<\/article>/is, `<article class="article" id="articleBox" itemscope itemtype="https://schema.org/NewsArticle">${articleBoxHtml}</article>`);

  return new Response(templateHtml, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "public, max-age=60, s-maxage=300"
    }
  });
};
