export async function onRequest(context) {
  const SUPABASE_URL = context.env.SUPABASE_URL;
  const SUPABASE_KEY = context.env.SUPABASE_KEY;
  const SITE = "https://bharat-viral.pages.dev";

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

    function esc(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    const rewriter = new HTMLRewriter()
      .on('title', {
        element(element) {
          element.setInnerContent(`${title} | Bharat Viral`);
        }
      })
      .on('head', {
        element(element) {
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
      .on('script#articleSchema', {
        element(element) {
          const authorType = String(author) !== "Bharat Viral" && String(author) ? "Person" : "Organization";
          const graphSchema = {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": `${SITE}/#organization`,
                "name": "Bharat Viral",
                "url": `${SITE}/`,
                "logo": {
                  "@type": "ImageObject",
                  "url": `${SITE}/icon-512.png`
                }
              },
              {
                "@type": "WebSite",
                "@id": `${SITE}/#website`,
                "url": `${SITE}/`,
                "name": "Bharat Viral",
                "publisher": {
                  "@id": `${SITE}/#organization`
                }
              },
              {
                "@type": "WebPage",
                "@id": `${canonical}#webpage`,
                "url": canonical,
                "name": String(title),
                "isPartOf": {
                  "@id": `${SITE}/#website`
                }
              },
              {
                "@type": "NewsArticle",
                "@id": `${canonical}#article`,
                "headline": String(title),
                "description": String(description).slice(0, 160),
                "url": canonical,
                "mainEntityOfPage": {
                  "@id": `${canonical}#webpage`
                },
                "image": [{
                  "@type": "ImageObject",
                  "url": String(image)
                }],
                "datePublished": published,
                "dateModified": modified,
                "articleSection": String(category),
                "keywords": keywords,
                "author": {
                  "@type": authorType,
                  "@id": `${SITE}/#/schema/${authorType.toLowerCase()}/${encodeURIComponent(String(author))}`,
                  "name": String(author)
                },
                "publisher": {
                  "@id": `${SITE}/#organization`
                }
              }
            ]
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
            <script type="application/ld+json" id="articleSchema">${jsonLd(graphSchema)}</script>
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
