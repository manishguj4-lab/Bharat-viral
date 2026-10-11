function toggleBurgerMenu(e) {
  if(e) e.stopPropagation();
  const d = document.getElementById('burgerDropdown');
  if(d) d.hidden = !d.hidden;
  const langD = document.getElementById('langDropdown');
  if(langD) langD.hidden = true;
}
function toggleLangMenu(e) {
  if(e) e.stopPropagation();
  const d = document.getElementById('langDropdown');
  if(d) d.hidden = !d.hidden;
  const burgD = document.getElementById('burgerDropdown');
  if(burgD) burgD.hidden = true;
}
function closeDropdowns() {
  const burgerDropdown = document.getElementById('burgerDropdown');
  const langDropdown = document.getElementById('langDropdown');
  if(burgerDropdown) burgerDropdown.hidden = true;
  if(langDropdown) langDropdown.hidden = true;
}
document.addEventListener('click', function(e) {
  const burgerDropdown = document.getElementById('burgerDropdown');
  const langDropdown = document.getElementById('langDropdown');
  if (burgerDropdown && !burgerDropdown.hidden && !burgerDropdown.contains(e.target) && e.target.id !== 'burgerBtn') {
    burgerDropdown.hidden = true;
  }
  if (langDropdown && !langDropdown.hidden && !langDropdown.contains(e.target) && e.target.id !== 'langBtn') {
    langDropdown.hidden = true;
  }
});
function toggleReadMode() {
  const isChecked = document.getElementById('readModeToggle').checked;
  if(isChecked) { document.body.classList.add('bv-read-mode-active'); localStorage.setItem('bvReadMode', '1'); }
  else { document.body.classList.remove('bv-read-mode-active'); localStorage.setItem('bvReadMode', '0'); }
}
function setLanguage(lang) {
  const hiStatus = document.getElementById('hiStatus');
  const enStatus = document.getElementById('enStatus');
  if(lang === 'hi') {
    if(hiStatus) hiStatus.innerText = 'ON';
    if(enStatus) enStatus.innerText = 'OFF';
    localStorage.setItem('bvLang', 'hi');
    document.documentElement.lang = 'hi';
  }
  else {
    if(hiStatus) hiStatus.innerText = 'OFF';
    if(enStatus) enStatus.innerText = 'ON';
    localStorage.setItem('bvLang', 'en');
    document.documentElement.lang = 'en';
  }
  translateUI(lang);
  closeDropdowns();
}

function translateUI(lang) {
  const dict = {
    'en': {
      'brand_p': 'True information of what is viral',
      'search_placeholder': 'Search news, education, tech...',
      'popular_keywords': '🔍 Popular Keywords',
      'breaking_label': '📌 BREAKING NEWS',
      'breaking_empty': 'Loading latest news...',
      'home': 'Home',
      'all_categories': 'All Categories',
      'about_us': 'About Us',
      'contact_us': 'Contact Us',
      'settings': 'Settings',
      'read_mode': 'Read Mode',
      'read_more': 'Read More',
      'see_all': 'See All →',
      'category_empty': 'No published articles in this category today.'
    },
    'hi': {
      'brand_p': 'जो वायरल है, उसकी सच्ची जानकारी',
      'search_placeholder': 'खबर, शिक्षा, टेक्नोलॉजी खोजें...',
      'popular_keywords': '🔍 Popular Keywords',
      'breaking_label': '📌 BREAKING NEWS',
      'breaking_empty': 'ताज़ा खबरें लोड हो रही हैं...',
      'home': 'Home',
      'all_categories': 'All Categories',
      'about_us': 'About Us',
      'contact_us': 'Contact Us',
      'settings': 'Settings',
      'read_mode': 'Read Mode',
      'read_more': 'Read More',
      'see_all': 'सभी देखें →',
      'category_empty': 'इस category में आज कोई प्रकाशित खबर नहीं है।'
    }
  };

  const categoryNames = {
    'en': {
      'news': 'News',
      'fact-check': 'Fact Check',
      'tech-education': 'Tech & Education',
      'rashifal': 'Horoscope',
      'viral-news': 'Viral News',
      'trending': 'Trending',
      'jobs': 'Jobs',
      'entertainment': 'Entertainment',
      'sports': 'Sports'
    },
    'hi': {
      'news': 'न्यूज़',
      'fact-check': 'फैक्ट चेक',
      'tech-education': 'टेक और शिक्षा',
      'rashifal': 'राशिफल',
      'viral-news': 'वायरल न्यूज़',
      'trending': 'ट्रेंडिंग',
      'jobs': 'सरकारी नौकरी',
      'entertainment': 'मनोरंजन',
      'sports': 'खेल'
    }
  };

  const texts = dict[lang] || dict['hi'];
  const catDict = categoryNames[lang] || categoryNames['hi'];

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (texts[key]) {
      if (el.tagName === 'INPUT' && el.type === 'text') {
        el.placeholder = texts[key];
      } else if (el.childNodes.length > 0 && el.childNodes[0].nodeType === 3) {
        el.childNodes[0].nodeValue = texts[key] + (el.childNodes[0].nodeValue.endsWith(' ') ? ' ' : '');
      } else {
        el.innerText = texts[key];
      }
    }
  });

  document.querySelectorAll('[data-i18n-cat-name]').forEach(el => {
    const slug = (el.getAttribute('data-i18n-cat-name') || '').toLowerCase();
    if (catDict[slug]) {
      el.innerText = catDict[slug];
    }
  });

  document.querySelectorAll('[data-i18n-cat]').forEach(el => {
    const slug = (el.getAttribute('data-i18n-cat') || '').toLowerCase();
    if (catDict[slug]) {
      el.innerText = catDict[slug];
    }
  });

  try {
    window.dispatchEvent(new CustomEvent('bv:languageChanged', { detail: { lang } }));
  } catch (e) {}
}

window.addEventListener('DOMContentLoaded', () => {
  if(localStorage.getItem('bvReadMode') === '1') {
    document.body.classList.add('bv-read-mode-active');
    const toggle = document.getElementById('readModeToggle');
    if(toggle) toggle.checked = true;
  }
  setLanguage(localStorage.getItem('bvLang') || 'hi');
});
