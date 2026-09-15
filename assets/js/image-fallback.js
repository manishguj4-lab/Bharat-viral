(function() {
  "use strict";
  function applyImageFallback(img) {
    if (!img || img.dataset.fallbackApplied === "1") return;

    // Check if the image has already failed to load before this script ran
    if (img.complete && img.naturalWidth === 0 && img.src && img.src !== "javascript:void(0)") {
      img.dataset.fallbackApplied = "1";
      img.src = "/icon-192.png";
      return;
    }

    img.addEventListener("error", function () {
      if (img.dataset.fallbackApplied === "1") return;
      img.dataset.fallbackApplied = "1";
      img.onerror = null;
      img.src = "/icon-192.png";
      // ensure we don't mess up layout, optionally add a class
      if (!img.alt) img.alt = "Image unavailable";
    }, { once: true });
  }

  document.querySelectorAll("img").forEach(applyImageFallback);

  const imgObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          if (node.tagName === "IMG") applyImageFallback(node);
          // Optimization: Only query selector if the node might contain images
          if (node.querySelectorAll) {
             node.querySelectorAll("img").forEach(applyImageFallback);
          }
        }
      });
    });
  });
  // Observe only what's necessary
  if (document.body) {
      imgObserver.observe(document.body, { childList: true, subtree: true });
  }
})();
