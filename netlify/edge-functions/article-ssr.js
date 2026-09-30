import xss from 'xss';

export default async (request, context) => {
  const url = new URL(request.url);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY");

  const site = "https://bharatviralnews.netlify.app";
  const DEFAULT_ARTICLE_IMAGE = `${site}/icon-512.png`;

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

  const title = article.seo_title || article.seoTitle || article.title || "Bharat Viral";
  const description = article.seo_description || article.seoDescription || article.meta_description || article.metaDescription || article.excerpt || article.description || article.title || "Bharat Viral पर ताजा खबरें और वायरल समाचार पढ़ें।";

  const originalImage =
  article.image_url ||
  article.image ||
  "";

const hasArticleImage =
  /^https?:\/\//i.test(String(originalImage));

const image = hasArticleImage
  ? String(originalImage)
  : "";

const metaImage =
  image || DEFAULT_ARTICLE_IMAGE;

  const canonical = `${site}/article/${encodeURIComponent(article.slug || slug)}`;
  const published = article.published_at || article.created_at || null;

  let modified = article.updated_at || article.modified_at || null;
  if (!modified && published) {
      modified = published;
  }

  const category = article.category || article.category_name || "News";
  const categorySlug = String(article.category_slug || category).toLowerCase().trim().replace(/[\s_]+/g, '-');
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
        "item": `${site}/category/${encodeURIComponent(categorySlug)}`
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

  // Fetch the actual article-template.html file to act as the template
  const templateResponse = await fetch(new URL("/article-template.html", request.url));

  // Fetch related articles for SSR internal linking
  let relatedHtml = '';
  try {
    const relatedCategory = categorySlug || 'news';
    const relatedEndpoint = `${SUPABASE_URL}/rest/v1/articles?select=id,title,image_url,published_at,created_at,category_slug,slug&status=eq.published&slug=neq.${encodeURIComponent(slug)}&order=published_at.desc&limit=6`;
    const relatedResponse = await fetch(relatedEndpoint, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (relatedResponse.ok) {
      const relatedRows = await relatedResponse.json();
      if (Array.isArray(relatedRows) && relatedRows.length > 0) {
        const cards = relatedRows.map(x => {
          const href = x.slug ? `/article/${encodeURIComponent(x.slug)}` : `article.html?id=${encodeURIComponent(x.id)}`;
          const imgMarkup = x.image_url
            ? `<img src="${esc(x.image_url)}" alt="${esc(x.title)}" loading="lazy" decoding="async">`
            : '';
          const catName = esc(String(x.category_slug || 'NEWS').replace(/-/g, ' ').toUpperCase());
          return `<a class="art-related-card" href="${href}">${imgMarkup}<div class="art-related-card-body"><div class="art-related-card-title">${esc(x.title)}</div><div class="art-related-card-meta">${catName}</div></div></a>`;
        }).join('');

        relatedHtml = `<section class="art-related-news"><h2>Related News</h2><div class="art-related-grid">${cards}</div></section>`;
      }
    }
  } catch {
    relatedHtml = '';
  }

  const articleBoxHtml = `
    ${hasArticleImage
  ? `<img class="art-hero" src="${esc(image)}" alt="${esc(title)}" itemprop="image" loading="eager">`
  : ""
}
    <div class="art-body">
      <a class="art-back" href="/">← वापस Homepage पर</a>
      <div class="art-cat">${esc(category)}</div>
      <h1 class="art-title" itemprop="headline">${esc(title)}</h1>
      <div class="art-meta">${esc(author)}${published ? ` · <time datetime="${esc(published)}" itemprop="datePublished">${esc(published)}</time>` : ''}</div>
      <div class="art-excerpt" itemprop="description">${esc(description)}</div>
      <div class="art-content" itemprop="articleBody">${sanitizedContent}</div>
      ${relatedHtml}
    </div>
  `;

  const rewriter = new HTMLRewriter()
  .on('title', {
    element(el) {
      el.setInnerContent(`${title} | Bharat Viral`);
    }
  })

  .on('meta[name="description"]', {
    element(el) {
      el.setAttribute('content', description);
    }
  })

  .on('meta[name="robots"]', {
    element(el) {
      el.setAttribute(
        'content',
        'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      );
    }
  })

  .on('link[id="canonicalUrl"]', {
    element(el) {
      el.setAttribute('href', canonical);
    }
  })

  .on('meta[property="og:title"]', {
    element(el) {
      el.setAttribute('content', title);
    }
  })

  .on('meta[property="og:description"]', {
    element(el) {
      el.setAttribute('content', description);
    }
  })

  .on('meta[property="og:url"]', {
    element(el) {
      el.setAttribute('content', canonical);
    }
  })

  .on('meta[property="og:image"]', {
    element(el) {
      el.setAttribute('content', metaImage);
    }
  })

  .on('meta[name="twitter:title"]', {
    element(el) {
      el.setAttribute('content', title);
    }
  })

  .on('meta[name="twitter:description"]', {
    element(el) {
      el.setAttribute('content', description);
    }
  })

  .on('meta[name="twitter:image"]', {
    element(el) {
      el.setAttribute('content', metaImage);
    }
  })

  .on('head', {
    element(el) {
      el.append(
        `<script type="application/ld+json">${safeSchema}</script>`,
        { html: true }
      );
    }
  })

  .on('article#articleBox', {
    element(el) {
      el.setAttribute('itemscope', '');
      el.setAttribute(
        'itemtype',
        'https://schema.org/NewsArticle'
      );

      el.setInnerContent(
        articleBoxHtml,
        { html: true }
      );
    }
  });

  const modifiedResponse = rewriter.transform(templateResponse);
  const finalResponse = new Response(modifiedResponse.body, modifiedResponse);

  finalResponse.headers.set('content-type', 'text/html; charset=UTF-8');
  finalResponse.headers.set('cache-control', 'public, max-age=60, s-maxage=300');

  return finalResponse;
};
