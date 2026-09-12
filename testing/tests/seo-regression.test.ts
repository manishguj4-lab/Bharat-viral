import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = fs.existsSync(path.resolve(process.cwd(), "category.html"))
  ? process.cwd()
  : path.resolve(process.cwd(), "..");

test("category.html syntax and SEO structure", () => {
  const htmlPath = path.join(rootDir, "category.html");
  assert.ok(fs.existsSync(htmlPath), "category.html must exist");
  const html = fs.readFileSync(htmlPath, "utf-8");

  // Verify no duplicate const canonical declarations exist
  const canonicalConstMatches = html.match(/const\s+canonical\s*=/g) || [];
  assert.equal(canonicalConstMatches.length, 1, "There should be exactly one 'const canonical' declaration in category.html");

  // Verify favicons are linked
  assert.ok(html.includes('href="/favicon.ico"'), "favicon.ico must be present in head");
  assert.ok(html.includes('href="/icon-192.png"'), "icon-192.png must be present in head");

  // Verify pagination canonical function exists
  assert.ok(html.includes("getCategoryCanonicalUrl"), "getCategoryCanonicalUrl function must be present");
});

test("robots.txt configuration", () => {
  const robotsPath = path.join(rootDir, "robots.txt");
  assert.ok(fs.existsSync(robotsPath), "robots.txt must exist");
  const content = fs.readFileSync(robotsPath, "utf-8");

  assert.ok(content.includes("Sitemap: https://bharatviralnews.netlify.app/sitemap.xml"));
  assert.ok(content.includes("Sitemap: https://bharatviralnews.netlify.app/news-sitemap.xml"));
  assert.ok(content.includes("Disallow: /admin.html"));
});

test("static HTML files contain standard favicon tags", () => {
  const files = ["index.html", "article.html", "about.html", "contact.html"];
  for (const file of files) {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      const html = fs.readFileSync(filePath, "utf-8");
      assert.ok(html.includes('href="/favicon.ico"') || html.includes("favicon.ico"), `${file} must reference favicon.ico`);
    }
  }
});

test("Sitemaps handle fetch failures cleanly with 503 HTTP status", async () => {
    // Assert 503 is returned if backend fetch fails
    const module = await import("../../netlify/functions/sitemap.js");
    const sitemapHandler = module.default;
    const req = new Request("https://bharatviralnews.netlify.app/sitemap.xml");
    const originalFetch = global.fetch;

    global.fetch = async () => ({ ok: false, status: 500 });
    const res = await sitemapHandler(req, {});
    assert.equal(res.status, 503, "sitemap.js should return 503 upon fetch error");

    global.fetch = originalFetch;
});

test("News Sitemaps handle fetch failures cleanly with 503 HTTP status", async () => {
    // Assert 503 is returned if backend fetch fails
    const module = await import("../../netlify/functions/news-sitemap.js");
    const newsSitemapHandler = module.default;
    const req = new Request("https://bharatviralnews.netlify.app/news-sitemap.xml");
    const originalFetch = global.fetch;

    global.fetch = async () => ({ ok: false, status: 500 });
    const res = await newsSitemapHandler(req, {});
    assert.equal(res.status, 503, "news-sitemap.js should return 503 upon fetch error");

    global.fetch = originalFetch;
});
