import xss from 'xss';

export async function onRequest(context) {
  const SUPABASE_URL = context.env.SUPABASE_URL;
  const SUPABASE_KEY = context.env.SUPABASE_KEY;
  const SITE = "https://bharat-viral.pages.dev";


  function time(v) {
    if (!v) return '';
    const d = new Date(v), m = Math.max(1, Math.floor((Date.now() - d) / 60000));
    if (m < 60) return m + ' मिनट पहले';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' घंटे पहले';
    return Math.floor(h / 24) + ' दिन पहले';
  }

  function decodeHTMLText(raw) {
    let text = String(raw ?? '');
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&#039;': "'"
    };
    return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#039;/g, (match) => entities[match] || match);
  }

  function sanitizeArticleHTML(raw) {
    let source = String(raw ?? '');
    source = decodeHTMLText(source);

    const options = {
      whiteList: {
        ...xss.whiteList,
        p: ['style', 'class'],
        span: ['class'],
        div: ['class', 'id', 'style'],
        img: ['src', 'alt', 'class', 'style', 'loading', 'decoding'],
        a: ['href', 'title', 'target', 'rel', 'class'],
        table: ['class', 'style', 'width', 'border'],
        tr: [],
        td: ['colspan', 'rowspan', 'style'],
        th: ['colspan', 'rowspan', 'style'],
        tbody: [],
        thead: [],
        h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
        strong: [], b: [], em: [], i: [], u: [],
        ul: [], ol: [], li: [], br: [], blockquote: [],
        button: ['type', 'class', 'data-pdf-url', 'data-pdf-name']
      },
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'link', 'meta']
    };
    const filter = new xss.FilterXSS(options);

    // Add target="_blank" to all links
    source = source.replace(/<a\s+([^>]+)>/gi, (match, attr) => {
      if (!attr.includes('target=')) attr += ' target="_blank"';
      if (!attr.includes('rel=')) attr += ' rel="noopener noreferrer"';
      return `<a ${attr}>`;
    });

    return filter.process(source);
  }

  function formatArticleText(text) {
    let value = String(text ?? "").trim();
    const decodedValue = decodeHTMLText(value).trim();
    if (/<\s*(p|div|h[1-6]|strong|b|em|i|u|ul|ol|li|a|br|blockquote|table|img)\b/i.test(decodedValue)) {
      return sanitizeArticleHTML(decodedValue);
    }
    if (/<\s*(p|div|h[1-6]|strong|b|em|i|u|ul|ol|li|a|br|blockquote|table|img)\b/i.test(value)) {
      return sanitizeArticleHTML(value);
    }

    let html = esc(value);
    const links = [];

    function tokenFor(index) {
      let n = index, s = '';
      do {
        s = String.fromCharCode(65 + (n % 26)) + s;
        n = Math.floor(n / 26) - 1;
      } while (n >= 0);
      return '___URLTOKEN' + s + '___';
    }

    html = html.replace(/https?:\/\/[^\s<>"']+/gi, function(url) {
      const token = tokenFor(links.length);
      links.push('<a class="content-link" href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>');
      return token;
    });

    html = html.replace(/([^.!?\n]{2,}\?)/g, '<span class="question-highlight">$1</span>');
    html = html.replace(/(\d+)/g, '<span class="digit-highlight">$1</span>');

    links.forEach(function(link, i) {
      html = html.replace(tokenFor(i), link);
    });

    return html.replace(/\n/g, '<br>');
  }

  function renderArticleContent(raw) {
    const value = String(raw ?? '');
    const tokenRe = /\[\[(IMAGE|PDF)\|([^|\]]+)\|([^\]]*)\]\]/g;
    let html = '', last = 0, match;

    while ((match = tokenRe.exec(value)) !== null) {
      html += formatArticleText(value.slice(last, match.index));

      let url = '', label = '';
      try { url = decodeURIComponent(match[2]); } catch(e) { url = match[2]; }
      try { label = decodeURIComponent(match[3] || ''); } catch(e) { label = match[3] || ''; }

      if (/^https?:\/\//i.test(url)) {
        if (match[1] === 'IMAGE') {
          html += '<img class="inline-article-image" src="' + esc(url) + '" alt="' + esc(label || 'Article image') + '" loading="lazy" decoding="async">';
        } else {
          html += '<div class="inline-article-pdf"><div class="inline-article-pdf-title">📄 ' + esc(label || 'PDF Document') + '</div><div class="inline-article-pdf-actions"><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">📖 PDF देखें</a><button type="button" class="secondary pdf-download-btn" data-pdf-url="' + esc(url) + '" data-pdf-name="' + esc((label || 'PDF Document').replace(/\.pdf$/i, '') + '.pdf') + '">⬇️ Download PDF</button></div></div>';
        }
      }

      last = tokenRe.lastIndex;
    }

    html += formatArticleText(value.slice(last));
    return html;
  }

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

    const image = toAbsoluteUrl(
      article.image_url || article.featured_image || article.image
    );

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

    // Fetch the base article.html template from the static assets
    const url = new URL(context.request.url);
    url.pathname = "/article.html";
    const assetResponse = await context.env.ASSETS.fetch(new Request(url, context.request));

    if (!assetResponse.ok) {
      return new Response("Template not found", { status: 404 });
    }




    const articleCategoryDisplay = (Array.isArray(article.categories) && article.categories[0])
      ? String(article.categories[0]).replace(/-/g, ' ').toUpperCase()
      : String(article.article_type || 'NEWS').replace(/_/g, ' ').toUpperCase();

    const sourceHtml = article.source_url
      ? '<a href="' + esc(article.source_url) + '" target="_blank" rel="noopener noreferrer">' + esc(article.source_name || 'Source') + '</a>'
      : esc(article.source_name || '');

    const heroImageHtml = image && image !== `${SITE}/icon-192.png`
      ? '<img class="hero" src="' + esc(image) + '" alt="' + esc(title) + '" loading="eager">'
      : '';

    const fullArticleHtml = heroImageHtml + '<div class="body">' +
      '<div class="cat">' + esc(articleCategoryDisplay) + '</div>' +
      '<h1 class="title">' + esc(title) + '</h1>' +
      '<div class="meta">' + (article.author_name ? 'By ' + esc(article.author_name) + ' • ' : '') + esc(time(published)) + '</div>' +
      '<div class="views">👁 ' + Number(article.views || 0).toLocaleString('en-IN') + ' views</div>' +
      '<div class="share">' +
        '<button class="wa" onclick="shareWhatsApp()">WhatsApp</button>' +
        '<button class="tg" onclick="shareTelegram()">Telegram</button>' +
        '<button class="ig" onclick="shareInstagram()">Instagram</button>' +
        '<button class="copy" onclick="copyLink()">Copy Link</button>' +
      '</div>' +
      (article.excerpt ? '<div class="excerpt">' + esc(article.excerpt) + '</div>' : '') +
      '<div class="bv-manual-ad-slot" data-ad-slot="article_middle" style="display:none;width:100%;max-width:100%;margin:18px auto;text-align:center;overflow:hidden;"></div>' +
      '<div class="content">' + renderArticleContent(article.content) + '</div>' +
      (sourceHtml ? '<div class="source">Source: ' + sourceHtml + '</div>' : '') +
      '</div>';

    const rewriter = new HTMLRewriter()
      .on('title', {
        element(element) {
          element.setInnerContent(`${title} | Bharat Viral`);
        }
      })
      .on('head', {
        element(element) {
          element.append('<script>window.__SERVER_RENDERED_ARTICLE_ID = "' + esc(article.id) + '"; window.__SERVER_RENDERED_ARTICLE_JSON = ' + jsonLd(article) + ';</script>', { html: true });

          // Remove existing meta tags to avoid duplicates, although we didn't add logic to remove them, it's safer to append new ones.
          // Wait, HTMLRewriter will append them. If base template has them, we should probably remove them, or let it be if it's fine.
          // In the review: "Update the meta tag injection to `.append()` to the `<head>` instead of relying on existing tags to replace"
          // We will just append them. We can also use esc() with { html: true } if we append literal HTML string.

          const headContent = `
            <meta name="description" content="${esc(String(description).slice(0, 160))}">
            <link rel="canonical" href="${esc(canonical)}">
            <meta property="og:title" content="${esc(title)}">
            <meta property="og:description" content="${esc(String(description).slice(0, 160))}">
            <meta property="og:url" content="${esc(canonical)}">
            <meta property="og:image" content="${esc(image)}">
            <meta property="article:published_time" content="${esc(published)}">
            <meta property="article:modified_time" content="${esc(modified)}">
            <meta name="twitter:title" content="${esc(title)}">
            <meta name="twitter:description" content="${esc(String(description).slice(0, 160))}">
            <meta name="twitter:image" content="${esc(image)}">
            ${keywords.length > 0 ? `<meta name="keywords" content="${esc(keywords.join(', '))}"><meta property="article:tag" content="${esc(keywords.join(', '))}"><meta property="article:section" content="${esc(category)}">` : ''}
          `;
          element.append(headContent, { html: true });
        }
      })
      // We will also remove the original meta tags to prevent duplicates.
      .on('meta[name="description"]', { element(el) { el.remove(); } })
      .on('link[rel="canonical"]', { element(el) { el.remove(); } })
      .on('meta[property^="og:"]', { element(el) { if(el.getAttribute('property') !== 'og:type' && el.getAttribute('property') !== 'og:site_name') el.remove(); } })
      .on('meta[property^="article:"]', { element(el) { el.remove(); } })
      .on('meta[name^="twitter:"]', { element(el) { if (el.getAttribute('name') !== 'twitter:card') el.remove(); } })

      .on('article#articleBox', {
        element(element) {
          element.setInnerContent(fullArticleHtml, { html: true });
        }
      })
      .on('script#articleSchema', {

        element(element) {
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

          const schemas = `
            <script type="application/ld+json" id="articleSchema">${jsonLd(newsArticle)}</script>
            <script type="application/ld+json">${jsonLd(breadcrumb)}</script>
          `;
          element.replace(schemas, { html: true });
        }
      });

    return rewriter.transform(assetResponse);

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
