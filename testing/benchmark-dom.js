const { performance } = require('perf_hooks');

// Simulates the DOM Element and its properties to run the benchmark
class MockElement {
  constructor() {
    this.html = '';
  }
  insertAdjacentHTML(position, text) {
    // In a real DOM, this triggers HTML parsing and DOM tree construction incrementally, which is costly
    this.html += text;
  }
  set innerHTML(text) {
    // In a real DOM, this replaces the HTML in a single pass
    this.html = text;
  }
}

function bench() {
  const iterations = 100000;

  // 1. insertAdjacentHTML approach
  let start1 = performance.now();
  for (let iter = 0; iter < iterations; iter++) {
    const m = new MockElement();
    const y = new MockElement();
    const nowYear = 2024;
    for(let i=1;i<=12;i++) m.insertAdjacentHTML('beforeend','<option value="'+String(i).padStart(2,'0')+'">'+i+'</option>');
    for(let i=nowYear;i>=nowYear-10;i--) y.insertAdjacentHTML('beforeend','<option value="'+i+'">'+i+'</option>');
  }
  let end1 = performance.now();

  // 2. String concatenation approach
  let start2 = performance.now();
  for (let iter = 0; iter < iterations; iter++) {
    const m = new MockElement();
    const y = new MockElement();
    const nowYear = 2024;
    let mh='',yh='';
    for(let i=1;i<=12;i++) mh+='<option value="'+String(i).padStart(2,'0')+'">'+i+'</option>';
    for(let i=nowYear;i>=nowYear-10;i--) yh+='<option value="'+i+'">'+i+'</option>';
    m.innerHTML = mh;
    y.innerHTML = yh;
  }
  let end2 = performance.now();

  // 3. Array join approach
  let start3 = performance.now();
  for (let iter = 0; iter < iterations; iter++) {
    const m = new MockElement();
    const y = new MockElement();
    const nowYear = 2024;
    let mh=[],yh=[];
    for(let i=1;i<=12;i++) mh.push('<option value="'+String(i).padStart(2,'0')+'">'+i+'</option>');
    for(let i=nowYear;i>=nowYear-10;i--) yh.push('<option value="'+i+'">'+i+'</option>');
    m.innerHTML = mh.join('');
    y.innerHTML = yh.join('');
  }
  let end3 = performance.now();

  console.log(`insertAdjacentHTML (simulated): ${(end1 - start1).toFixed(2)} ms`);
  console.log(`String concat                 : ${(end2 - start2).toFixed(2)} ms`);
  console.log(`Array join                    : ${(end3 - start3).toFixed(2)} ms`);
}

bench();
