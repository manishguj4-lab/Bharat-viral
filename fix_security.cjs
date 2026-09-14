const fs = require('fs');
let indexHtml = fs.readFileSync('index.html', 'utf8');

if (!indexHtml.includes('src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.15/purify.min.js"')) {
    indexHtml = indexHtml.replace('</head>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.15/purify.min.js"></script>\n</head>');
}
fs.writeFileSync('index.html', indexHtml);
