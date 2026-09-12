import fs from 'fs';

let content = fs.readFileSync('testing/tests/article-seo.test.ts', 'utf8');

// I will make it accept BOTH article-template.html and article.html.
content = content.replace(/if \(url\.toString\(\)\.includes\('article-template\.html'\)\) \{/g, `if (url.toString().includes('article-template.html') || url.toString().includes('article.html')) {`);

fs.writeFileSync('testing/tests/article-seo.test.ts', content);
