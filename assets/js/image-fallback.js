(function() {
  "use strict";
  function applyImageFallback(img) {
    if (!img || img.dataset.fallbackApplied === "1") return;

    // Check if the image has already failed to load before this script ran
    if (img.complete && img.naturalWidth === 0 && img.src && img.src !== "javascript:void(0)" && !img.src.includes("data:image")) {
      img.dataset.fallbackApplied = "1";
      img.src = "/icon-192.png";
      return;
    }

    img.addEventListener("error", function () {
      if (img.dataset.fallbackApplied === "1") return;
      img.dataset.fallbackApplied = "1";
      img.onerror = null;
      img.src = "/icon-192.png";
      if (!img.alt) img.alt = "Image unavailable";
    }, { once: true });
  }

  document.querySelectorAll("img").forEach(applyImageFallback);

  const imgObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          if (node.tagName === "IMG") applyImageFallback(node);
          if (node.querySelectorAll) {
             node.querySelectorAll("img").forEach(applyImageFallback);
          }
        }
      });
    });
  });
  if (document.body) {
      imgObserver.observe(document.body, { childList: true, subtree: true });
  }
})();
