const fs = require('fs');

// 1. Revert eager loading on ALL images in index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');
indexHtml = indexHtml.replace(
  /'<div class="news-img"><img src="'\+escLocal\(a.image_url\)\+'" alt="'\+title\+'" loading="eager" fetchpriority="high" decoding="async" width="400" height="225"><\/div>'/g,
  `'<div class="news-img"><img src="'+escLocal(a.image_url)+'" alt="'+title+'" loading="lazy" decoding="async" width="400" height="225"></div>'`
);
// Fix the hero image
indexHtml = indexHtml.replace(
  /'<img class="hero-slide-img" width="800" height="450" decoding="async" src="'\+escapeHtml\(hero.image_url\)\+'" alt="'\+escapeHtml\(title\)\+'">'/g,
  `'<img class="hero-slide-img" width="800" height="450" decoding="async" src="'+escapeHtml(hero.image_url)+'" alt="'+escapeHtml(title)+'" loading="eager" fetchpriority="high">'`
);
fs.writeFileSync('index.html', indexHtml);

// 2. Revert eager loading in category.html
let categoryHtml = fs.readFileSync('category.html', 'utf8');
categoryHtml = categoryHtml.replace(
  /' loading="eager"' \+\n    ' fetchpriority="high"' \+\n    ' decoding="async"'/g,
  `' loading="lazy"' +\n    ' decoding="async"'`
);
fs.writeFileSync('category.html', categoryHtml);
