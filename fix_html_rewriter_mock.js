const fs = require('fs');
let code = fs.readFileSync('testing/tests/article-seo.test.ts', 'utf8');
let lines = code.split('\n');

const correctMock = `
  before(() => {
    global.HTMLRewriter = class HTMLRewriter {
      constructor() { this.handlers = []; }
      on(selector, handler) { this.handlers.push({ selector, handler }); return this; }
      transform(response) {
        let appendedHead = '';
        this.handlers.forEach(h => {
          if (h.selector === 'head' && h.handler.element) {
            h.handler.element({
               append: (content) => { appendedHead += content; }
            });
          }
        });
        return new Response(
           response.text().then(text => {
             return text.replace('</head>', appendedHead + '</head>');
           }),
           response
        );
      }
    };
  });
`;

let describeIdx = lines.findIndex(l => l.includes("global.HTMLRewriter = class"));
if (describeIdx !== -1) {
    let oldMockEnd = lines.findIndex((l, i) => i > describeIdx && l.includes("});"));
    lines.splice(describeIdx - 1, oldMockEnd - describeIdx + 2, correctMock.trim());

    // The issue might just be the assertion. It expects `schemas.find` but it might be parsing `safeSchema` which is wrapped differently or we're not appending it correctly in the mock.
    // The previous mock without the JSON-LD appending passed all but ONE assertion (`Should have JSON-LD script tag`).
    // When we added the appending logic, we got an esbuild TransformError. This usually implies invalid JS syntax.
    // Notice how \` \` characters might not have been correctly escaped during `append` or string matching if it was injected directly into code.

    // We're just going to rewrite the exact test that checks JSON-LD to manually check the response text without parsing it, if the parser is what's failing. No, the build is failing before tests run!
    // It's the `appendedHead += content;` inside the template literal. Let's see if we can just do a very simple mock string replacement.
}

// Just replace the whole file from a clean state to be absolutely certain of syntax.
let cleanCode = fs.readFileSync('.git/index', 'utf8'); // Just kidding, let's fetch it from a recent clean commit if we had one.
