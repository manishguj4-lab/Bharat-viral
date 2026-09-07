import xss from 'xss';

export async function onRequest(context) {
  const SUPABASE_URL = context.env.SUPABASE_URL;
  const SUPABASE_KEY = context.env.SUPABASE_KEY;
  const SITE = "https://bharat-viral.pages.dev";

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function jsonLd(value) {
    return JSON.stringify(value)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");
  }

  function toAbsoluteUrl(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return `${SITE}/icon-192.png`;
    try {
      return new URL(raw, SITE).href;
    } catch {
      return `${SITE}/icon-192.png`;
    }
  }

  function toKeywordList(...values) {
    const result = [];
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

  function getCategoryUrl(category, categorySlug) {
    const slug = String(categorySlug || category || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    return slug
      ? `${SITE}/category.html?category=${encodeURIComponent(slug)}`
      : `${SITE}/`;
  }

  function renderArticleHtml(raw) {
    let source = String(raw ?? "");
    // Minimal regex replacement for [[IMAGE|url|label]]
    source = source.replace(/\[\[IMAGE\|([^|\]]+)\|([^\]]*)\]\]/g, (match, url, label) => {
      let decodedUrl = url;
      try { decodedUrl = decodeURIComponent(url); } catch(e){}
      let decodedLabel = label;
      try { decodedLabel = decodeURIComponent(label); } catch(e){}
      return `<img class="inline-article-image" src="${esc(decodedUrl)}" alt="${esc(decodedLabel || 'Article image')}">`;
    });

    // Sanitize the HTML server-side using xss library, allowing target attribute for links and classes for images
    return xss(source, {
      whiteList: {
        ...xss.whiteList,
        a: ['href', 'title', 'target', 'rel'],
        img: ['src', 'alt', 'class']
      }
    });
  }

  function formatTime(v) {
    if(!v) return '';
    const d = new Date(v);
    const m = Math.max(1, Math.floor((Date.now() - d.getTime()) / 60000));
    if (m < 60) return m + ' मिनट पहले';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' घंटे पहले';
    return Math.floor(h / 24) + ' दिन पहले';
  }

  try {
    const slug = context.params.slug;

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
      throw new Error("Supabase HTTP " + response.status);
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

    const title = article.seo_title || article.title || "Bharat Viral";
    const description =
      article.seo_description ||
      article.meta_description ||
      article.excerpt ||
      article.description ||
      article.title ||
      "Bharat Viral पर ताजा खबरें पढ़ें।";

    const image = article.image_url || article.featured_image || article.image || "";
    const absoluteImage = toAbsoluteUrl(image);

    const category = article.category_name || article.category || article.category_slug || "News";
    const categorySlug = article.category_slug || article.category_slug_name || "";

    const keywords = toKeywordList(
      article.main_keyword,
      article.related_keywords,
      article.tags,
      article.keywords
    );

    const author = article.author_name || article.author || "Bharat Viral";

    const published = article.published_at || article.created_at || new Date().toISOString();
    const modified = article.updated_at || article.published_at || article.created_at || published;

    const canonical = `${SITE}/article/` + encodeURIComponent(String(article.slug));

    const content = article.content || article.body || article.article_content || "";
    const excerpt = article.excerpt || "";

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
        url: String(absoluteImage)
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

    // Construct the server-rendered HTML for the article body exactly like the client would.
    const heroImageHtml = image ? `<img class="hero" src="${esc(absoluteImage)}" alt="${esc(title)}" loading="eager">` : '';
    const displayCat = (Array.isArray(article.categories) && article.categories[0]) ? String(article.categories[0]).replace(/-/g,' ').toUpperCase() : String(article.article_type || 'NEWS').replace(/_/g,' ').toUpperCase();
    const sourceHtml = article.source_url ? `<a href="${esc(article.source_url)}" target="_blank" rel="noopener noreferrer">${esc(article.source_name||'Source')}</a>` : esc(article.source_name||'');
    const viewsStr = Number(article.views || 0).toLocaleString('en-IN');
    const authorStr = article.author_name ? `By ${esc(article.author_name)} • ` : '';
    const dateStr = formatTime(published);

    const fullArticleHtml = `
      ${heroImageHtml}
      <div class="body">
        <div class="cat">${esc(displayCat)}</div>
        <h1 class="title">${esc(title)}</h1>
        <div class="meta">${authorStr}${esc(dateStr)}</div>
        <div class="views">👁 ${viewsStr} views</div>
        <div class="share">
          <button class="wa" onclick="shareWhatsApp()">WhatsApp</button>
          <button class="tg" onclick="shareTelegram()">Telegram</button>
          <button class="ig" onclick="shareInstagram()">Instagram</button>
          <button class="copy" onclick="copyLink()">Copy Link</button>
        </div>
        ${excerpt ? `<div class="excerpt">${esc(excerpt)}</div>` : ''}
        <div class="bv-manual-ad-slot" data-ad-slot="article_middle" style="display:none;width:100%;max-width:100%;margin:18px auto;text-align:center;overflow:hidden;"></div>
        <div class="content">${renderArticleHtml(content)}</div>
        ${sourceHtml ? `<div class="source">Source: ${sourceHtml}</div>` : ''}
      </div>
    `;


    // Fetch the static article.html template
    const staticRequest = new Request(new URL('/article.html', context.request.url));
    const staticResponse = await context.env.ASSETS.fetch(staticRequest);

    if (!staticResponse.ok) {
      return new Response("Template not found", { status: 500 });
    }

    const rawTitle = String(title);
    const rawDesc = String(description).slice(0, 160);
    const rawImage = absoluteImage;
    const rawUrl = canonical;

    // Use HTMLRewriter to inject SEO metadata and body HTML
    // Note: setAttribute and setInnerContent automatically escape text values,
    // so we pass the raw strings to avoid double-escaping.
    const rewriter = new HTMLRewriter()
      .on('title', {
        element(el) {
          el.setInnerContent(`${rawTitle} | Bharat Viral`);
        }
      })
      .on('meta[name="description"]', {
        element(el) {
          el.setAttribute('content', rawDesc);
        }
      })
      .on('link[rel="canonical"]', {
        element(el) {
          el.setAttribute('href', rawUrl);
        }
      })
      .on('meta[property="og:title"]', {
        element(el) {
          el.setAttribute('content', rawTitle);
        }
      })
      .on('meta[property="og:description"]', {
        element(el) {
          el.setAttribute('content', rawDesc);
        }
      })
      .on('meta[property="og:url"]', {
        element(el) {
          el.setAttribute('content', rawUrl);
        }
      })
      .on('meta[property="og:image"]', {
        element(el) {
          el.setAttribute('content', rawImage);
        }
      })
      .on('meta[name="twitter:title"]', {
        element(el) {
          el.setAttribute('content', rawTitle);
        }
      })
      .on('meta[name="twitter:description"]', {
        element(el) {
          el.setAttribute('content', rawDesc);
        }
      })
      .on('meta[name="twitter:image"]', {
        element(el) {
          el.setAttribute('content', rawImage);
        }
      })
      .on('script#articleSchema', {
        element(el) {
          el.setInnerContent(jsonLd(newsArticle), { html: true });
        }
      })
      .on('head', {
        element(el) {
           el.append(`<script type="application/ld+json">${jsonLd(breadcrumb)}</script>`, { html: true });
           el.append(`<meta name="keywords" content="${esc(keywords.join(", "))}">`, { html: true });
           el.append(`<meta property="og:image:alt" content="${esc(title)}">`, { html: true });
           el.append(`<meta property="article:published_time" content="${esc(published)}">`, { html: true });
           el.append(`<meta property="article:modified_time" content="${esc(modified)}">`, { html: true });
        }
      })
      .on('#articleBox', {
        element(el) {
           el.setInnerContent(fullArticleHtml, { html: true });
        }
      });

    return rewriter.transform(staticResponse);

  } catch (error) {
    console.error("Article SEO error:", error);
    return new Response("Internal Server Error", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=UTF-8"
      }
    });
  }
}
