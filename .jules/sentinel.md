## 2024-09-10 - Fix DOM XSS via innerHTML fallback
**Vulnerability:** XSS via unsafe innerHTML assignment in `stripHtml` function (`index.html`) when DOMPurify fails to load.
**Learning:** Using `div.innerHTML` to extract text can trigger external resource fetching (like `<img src="...">`) and execute inline event handlers (like `onerror`) even on disconnected elements.
**Prevention:** Use `DOMParser().parseFromString(value, 'text/html')` to safely parse HTML into an inactive DOM tree without executing scripts or fetching resources.
