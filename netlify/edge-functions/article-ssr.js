import xss from 'xss';

export default async (request, context) => {
  const url = new URL(request.url);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY");

  const site = "https://bharatviralnews.netlify.app";

  const createErrorResponse = (status, title, message) => {
    return new Response(
      `<!DOCTYPE html><html lang="hi"><head><meta charset="utf-8"><title>${title}</title><meta name="robots" content="noindex, follow"></head><body><h1>${title}</h1><p>${message}</p></body></html>`,
      {
        status,
        headers: {
          "content-type": "text/html; charset=UTF-8",
          "cache-control": "no-store, max-age=0, must-revalidate"
        }
      }
    );
  };

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return createErrorResponse(503, "Service Unavailable", "Missing runtime configuration.");
  }

  const slug = url.searchParams.get("slug") || decodeURIComponent(url.pathname.replace(/^\/article\/?/, ""));

  if (!slug || slug === "article.html") {
    return createErrorResponse(404, "Not Found", "Article not found.");
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
      return createErrorResponse(503, "Service Unavailable", "Failed to fetch article data.");
    }

    const rows = await response.json();
    article = rows?.[0];
  } catch {
    return createErrorResponse(503, "Service Unavailable", "Network error.");
  }

  if (!article) {
    return createErrorResponse(404, "Not Found", "Article not found.");
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

  let image = article.image_url || article.image || "";
  // Ensure valid HTTP protocol
  if (image && !/^https?:\/\//i.test(image)) {
    image = "";
  }

  const canonical = `${site}/article/${encodeURIComponent(article.slug || slug)}`;
  const published = article.published_at || article.created_at || null;

  let modified = article.updated_at || article.modified_at || null;
  if (!modified && published) {
      modified = published;
  }

  const category = article.category || article.category_name || "News";
  const author = article.author || article.author_name || "Bharat Viral";
  const isOrganizationAuthor = author.toLowerCase().includes("bharat viral") || author.toLowerCase().includes("editorial");

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

  const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description: description,
    author: {
      "@type": isOrganizationAuthor ? "Organization" : "Person",
      name: author
    },
    publisher: {
      "@type": "Organization",
      name: "Bharat Viral",
      url: `${site}/`,
      logo: {
        "@type": "ImageObject",
        url: `${site}/icon-512.png`
      }
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical
    },
    articleSection: category,
    inLanguage: "hi-IN"
  };

  if (image) {
    schema.image = [image];
  }
  if (published) {
    schema.datePublished = published;
  }
  if (modified) {
    schema.dateModified = modified;
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": `${site}/`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": category,
        "item": `${site}/category.html?category=${encodeURIComponent(category.toLowerCase())}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": title,
        "item": canonical
      }
    ]
  };

  // Safe JSON-LD serialization avoiding breakout sequences
  const safeSchema = JSON.stringify([schema, breadcrumbSchema])
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  // Fetch the actual article.html file to act as the template
  const templateResponse = await fetch(new URL("/article.html", request.url));
  let templateHtml = await templateResponse.text();

  // Very basic string replacements since HTMLRewriter is hard to implement with xss library seamlessly in this mock structure.
  // Real Netlify Edge Functions support HTMLRewriter but we'll use a Regex replacement approach for reliability across environments.

  // Update Meta Tags
  templateHtml = templateHtml.replace(/<title>.*?<\/title>/i, `<title>${esc(title)} | Bharat Viral</title>`);
  templateHtml = templateHtml.replace(/<meta\s+name="description"\s+content="[^"]*"/i, `<meta name="description" content="${esc(description)}"`);
  templateHtml = templateHtml.replace(/<meta\s+name="robots"\s+content="[^"]*"/i, `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"`);
  templateHtml = templateHtml.replace(/<link\s+rel="canonical"\s+id="canonicalUrl"\s+href="[^"]*"/i, `<link rel="canonical" id="canonicalUrl" href="${esc(canonical)}"`);

  // Update OG/Twitter Image dynamically (fallback for meta tags if needed but strictly don't fallback structured data image)
  const metaImage = image || `${site}/icon-512.png`;

  // Update OG Tags
  templateHtml = templateHtml.replace(/<meta\s+property="og:title"\s+content="[^"]*"/i, `<meta property="og:title" content="${esc(title)}"`);
  templateHtml = templateHtml.replace(/<meta\s+property="og:description"\s+content="[^"]*"/i, `<meta property="og:description" content="${esc(description)}"`);
  templateHtml = templateHtml.replace(/<meta\s+property="og:url"\s+id="ogUrl"\s+content="[^"]*"/i, `<meta property="og:url" id="ogUrl" content="${esc(canonical)}"`);
  templateHtml = templateHtml.replace(/<meta\s+property="og:image"\s+id="ogImage"\s+content="[^"]*"/i, `<meta property="og:image" id="ogImage" content="${esc(metaImage)}"`);

  // Update Twitter Tags
  templateHtml = templateHtml.replace(/<meta\s+name="twitter:title"\s+content="[^"]*"/i, `<meta name="twitter:title" content="${esc(title)}"`);
  templateHtml = templateHtml.replace(/<meta\s+name="twitter:description"\s+content="[^"]*"/i, `<meta name="twitter:description" content="${esc(description)}"`);
  templateHtml = templateHtml.replace(/<meta\s+name="twitter:image"\s+id="twitterImage"\s+content="[^"]*"/i, `<meta name="twitter:image" id="twitterImage" content="${esc(metaImage)}"`);

  // Inject JSON-LD Schema before </head>
  templateHtml = templateHtml.replace(/<\/head>/i, `<script type="application/ld+json">${safeSchema}</script></head>`);

  // Render the article content inside <article id="articleBox">
  const articleBoxHtml = `
    ${image ? `<img class="hero" src="${esc(image)}" alt="${esc(title)}" itemprop="image" loading="eager">` : ""}
    <div class="body">
      <a class="back" href="/">← वापस Homepage पर</a>
      <div class="cat">${esc(category)}</div>
      <h1 class="title" itemprop="headline">${esc(title)}</h1>
      <div class="meta">${esc(author)}${published ? ` · <time datetime="${esc(published)}" itemprop="datePublished">${esc(published)}</time>` : ''}</div>
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
