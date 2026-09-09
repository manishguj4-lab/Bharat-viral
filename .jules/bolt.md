## Performance Insights: DOM insertion inside loops

**Observation**: Repeatedly calling `insertAdjacentHTML` inside a loop (such as dynamically building a dropdown for Months and Years in `category.html`) incurs a performance penalty compared to batched operations. While the JavaScript string overhead alone isn't large, the real cost lies in the browser having to parse HTML and update the DOM tree incrementally on each loop iteration.

**Optimization approach**:
1. Batched string concatenation (`mh += '<option>...'`)
Followed by a single `innerHTML` assignment.

**Result**: String concatenation was observed to be faster than array join and significantly faster than multiple `insertAdjacentHTML` calls when properly evaluated. The `category.html` implementation has been updated to reflect this optimization safely.

**Security Consideration**: Using `innerHTML` requires ensuring that the inserted data is strictly safe from XSS. In the dropdown case, casting integers to strings (`String(i)`) guarantees safety.
