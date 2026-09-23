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
      'read_mode': 'Read Mode'
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
      'read_mode': 'Read Mode'
    }
  };

  const texts = dict[lang] || dict['hi'];

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
}

window.addEventListener('DOMContentLoaded', () => {
  if(localStorage.getItem('bvReadMode') === '1') {
    document.body.classList.add('bv-read-mode-active');
    const toggle = document.getElementById('readModeToggle');
    if(toggle) toggle.checked = true;
  }
  setLanguage(localStorage.getItem('bvLang') || 'hi');
});
