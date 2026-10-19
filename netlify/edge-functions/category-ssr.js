import { parse } from 'node-html-parser';

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

  let slug = url.searchParams.get("category");
  let page = parseInt(url.searchParams.get("page") || "1", 10);
  if (isNaN(page) || page < 1) page = 1;

  if (!slug) {
    const match = url.pathname.match(/^\/category\/([^\/]+)/);
    if (match) {
      slug = match[1];
    }
  }

  if (url.pathname === "/category.html" && !slug) {
      slug = "news"; // Default to news if accessing category.html directly without params
  }

  if (!slug) {
    return createErrorResponse(404, "Not Found", "Category not found.");
  }

  slug = slug.toLowerCase().trim();

  // Fetch category metadata
  let categoryData;
  try {
    const catResponse = await fetch(`${SUPABASE_URL}/rest/v1/categories?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=*&limit=1`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!catResponse.ok) {
      return createErrorResponse(503, "Service Unavailable", "Failed to fetch category data.");
    }

    const catRows = await catResponse.json();
    categoryData = catRows?.[0];
  } catch {
    return createErrorResponse(503, "Service Unavailable", "Network error.");
  }

  if (!categoryData) {
    return createErrorResponse(404, "Not Found", "Category not found.");
  }

  const categoryName = categoryData.name || slug;
  const categoryDescription = categoryData.description || categoryName;
  const categoryIcon = categoryData.icon || '📰';

  const title = `${categoryName} | Bharat Viral`;
  const canonical = page > 1 ? `${site}/category/${encodeURIComponent(slug)}?page=${page}` : `${site}/category/${encodeURIComponent(slug)}`;

  // Fetch total count for pagination
  let totalArticles = 0;
  const PAGE_SIZE = 15;
  try {
      const countRes = await fetch(`${SUPABASE_URL}/rest/v1/articles?category_slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=id`, {
          method: 'HEAD',
          headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Prefer': 'count=exact'
          }
      });
      if (countRes.ok) {
          const contentRange = countRes.headers.get('content-range');
          if (contentRange) {
              const match = contentRange.match(/\/(.*)$/);
              if (match) {
                  totalArticles = parseInt(match[1], 10);
              }
          }
      }
  } catch (e) {
      // Ignore count errors
  }

  const totalPages = Math.max(1, Math.ceil(totalArticles / PAGE_SIZE));
  if (page > totalPages && totalPages > 0) {
      page = totalPages;
  }

  // Fetch articles
  let articles = [];
  try {
      const limit = PAGE_SIZE;
      const offset = (page - 1) * PAGE_SIZE;

      const articlesResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_category_articles`, {
          method: 'POST',
          headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              p_category: slug,
              p_limit: limit,
              p_offset: offset
          })
      });

      if (articlesResponse.ok) {
          articles = await articlesResponse.json();
      }
  } catch (e) {
      // Ignore fetch errors, grid will just be empty
  }

  if (!Array.isArray(articles)) articles = [];

  const esc = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // Build grid HTML
  let gridHtml = '';
  if (articles.length === 0) {
      gridHtml = `<div class="cat-empty">इस category में अभी कोई प्रकाशित खबर उपलब्ध नहीं है।</div>`;
  } else {
      gridHtml = articles.map(a => {
          const label = esc(`${categoryIcon} ${categoryName}`);
          const artTitle = esc(a.title || 'बड़ी खबर');
          const articleUrl = a.slug ? `/article/${encodeURIComponent(a.slug)}` : `/article.html?id=${encodeURIComponent(a.id)}`;

          let imgHtml = '';
          const url = String(a.image_url || '').trim();
          if (url) {
              imgHtml = `<div class="cat-img"><img src="${esc(url)}" alt="${artTitle}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`;
          }

          return `<article class="cat-card">` +
            `<a class="cat-card-link" href="${articleUrl}" aria-label="${artTitle}">` +
            imgHtml +
            `<div class="cat-body">` +
            `<span class="cat-cat">${label}</span>` +
            `<h3>${artTitle}</h3>` +
            `<p>${esc(a.excerpt || 'पूरी खबर पढ़ें')}</p>` +
            `<span class="cat-read">पूरी खबर पढ़ें</span>` +
            `</div>` +
            `</a>` +
            `</article>`;
      }).join('');
  }

  // Build pagination HTML
  let paginationHtml = '';
  if (totalArticles > PAGE_SIZE) {
      const pages = totalPages;
      let from = Math.max(1, page - 2);
      let to = Math.min(pages, from + 4);
      if (to - from + 1 < 5) {
          from = Math.max(1, to - 4);
      }

      const make = (p, label, c = '') => `<a class="${c}" href="/category/${encodeURIComponent(slug)}${p > 1 ? '?page=' + p : ''}">${label}</a>`;

      if (page > 1) paginationHtml += make(page - 1, '‹ पिछला', 'next');
      if (from > 1) paginationHtml += make(1, '1');
      if (from > 2) paginationHtml += '<span aria-hidden="true">…</span>';

      for (let p = from; p <= to; p++) {
          if (p === page) {
              paginationHtml += `<span class="active" aria-current="page">${p}</span>`;
          } else {
              paginationHtml += make(p, p);
          }
      }

      if (to < pages - 1) paginationHtml += '<span aria-hidden="true">…</span>';
      if (to < pages) paginationHtml += make(pages, pages);
      if (page < pages) paginationHtml += make(page + 1, 'अगला ›', 'next');

      paginationHtml += `<div class="cat-page-note" style="flex-basis:100%">पेज ${page} / ${pages}</div>`;
  }

  // Structured Data
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": title,
    "description": categoryDescription,
    "url": canonical
  };

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
        "name": categoryName,
        "item": `${site}/category/${encodeURIComponent(slug)}`
      }
    ]
  };

  const itemListSchema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": articles.map((a, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "url": a.slug ? `${site}/article/${encodeURIComponent(a.slug)}` : `${site}/article.html?id=${encodeURIComponent(a.id)}`
      }))
  };

  const safeSchema = JSON.stringify([schema, breadcrumbSchema, itemListSchema])
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  let templateResponse;
  try {
    templateResponse = await fetch(new URL("/category-template.html", request.url));
    if (!templateResponse.ok) {
      return createErrorResponse(503, "Service Unavailable", "Failed to load template.");
    }
  } catch {
    return createErrorResponse(503, "Service Unavailable", "Network error loading template.");
  }

  const templateText = await templateResponse.text();
  const root = parse(templateText);

  const titleEl = root.querySelector('title');
  if (titleEl) titleEl.set_content(title);

  const descEl = root.querySelector('meta[name="description"]');
  if (descEl) descEl.setAttribute('content', categoryDescription);

  const canonicalEl = root.querySelector('link[rel="canonical"]') || root.querySelector('link[id="canonical"]');
  if (canonicalEl) canonicalEl.setAttribute('href', canonical);

  const ogTitle = root.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', title);

  const ogDesc = root.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', categoryDescription);

  const ogUrl = root.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', canonical);

  const twTitle = root.querySelector('meta[name="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', title);

  const twDesc = root.querySelector('meta[name="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', categoryDescription);

  const headEl = root.querySelector('head');
  if (headEl) {
    headEl.appendChild(parse(`<script type="application/ld+json">${safeSchema}</script>`));
    if (page > 1) {
      headEl.appendChild(parse(`<link rel="prev" href="${site}/category/${encodeURIComponent(slug)}${page - 1 > 1 ? '?page=' + (page - 1) : ''}">`));
    }
    if (page < totalPages) {
      headEl.appendChild(parse(`<link rel="next" href="${site}/category/${encodeURIComponent(slug)}?page=${page + 1}">`));
    }
  }

  const headingEl = root.querySelector('#heading');
  if (headingEl) headingEl.set_content(`${categoryIcon} ${categoryName}`);

  const subEl = root.querySelector('#sub');
  if (subEl) subEl.set_content(categoryDescription);

  const gridEl = root.querySelector('#grid');
  if (gridEl) gridEl.set_content(gridHtml);

  const paginationEl = root.querySelector('#pagination');
  if (paginationEl) paginationEl.set_content(paginationHtml);

  return new Response(root.toString(), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'public, max-age=60, s-maxage=300'
    }
  });
};
