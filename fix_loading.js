const fs = require('fs');
let indexHtml = fs.readFileSync('index.html', 'utf8');

// The hero image injection
indexHtml = indexHtml.replace(
  /'<img class="hero-slide-img" width="800" height="450" decoding="async" src="'\+escapeHtml\(hero.image_url\)\+'" alt="'\+escapeHtml\(title\)\+'">'/g,
  `'<img class="hero-slide-img" width="800" height="450" decoding="async" src="'+escapeHtml(hero.image_url)+'" alt="'+escapeHtml(title)+'" loading="eager" fetchpriority="high">'`
);
fs.writeFileSync('index.html', indexHtml);

let categoryHtml = fs.readFileSync('category.html', 'utf8');
// Assuming we want to eager load the FIRST image only
// Note that the current imageMarkup applies it to ALL images, we should rethink if needed.
