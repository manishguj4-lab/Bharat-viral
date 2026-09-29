const fs = require('fs');
let code = fs.readFileSync('netlify/edge-functions/category-ssr.js', 'utf8');

code = code.replace(
  '  if (url.pathname === "/category.html" && !slug) {\n      slug = "news"; // Default to news if accessing category.html directly without params\n  }',
  `  if (url.pathname === "/category.html") {
    slug = slug || "news"; // Default to news if accessing category.html directly without params
    return new Response(null, {
      status: 301,
      headers: {
        "Location": \`/category/\${encodeURIComponent(slug)}\`,
        "cache-control": "public, max-age=3600"
      }
    });
  }`
);

fs.writeFileSync('netlify/edge-functions/category-ssr.js', code);
