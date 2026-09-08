/* ==========================================================================
   Bharat Viral - Main Application JS (Consolidated Production Module)
   ========================================================================== */

(function () {
  'use strict';

  // --- Supabase Client Initialization ---
  const SUPABASE_URL = 'https://ocarsylhsyxjqpzidndb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_LTmMKlt5saAsFIlnF87_6A_75FFCvK0';

  function initSupabase() {
    if (window.supabase && !window.supabaseClient) {
      window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      window.sb = window.supabaseClient;
      window.dispatchEvent(new Event('supabaseReady'));
    }
  }

  if (window.supabase) {
    initSupabase();
  } else {
    const timer = setInterval(function () {
      if (window.supabase) {
        clearInterval(timer);
        initSupabase();
      }
    }, 50);
  }

  // Safe HTML Escaper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Global Articles Cache
  window.publishedArticles = [];

  // --- UI Components & Handlers ---

  // Search Modal Handler
  const searchBtn = document.getElementById('searchBtn');
  const searchPanel = document.getElementById('searchPanel');
  const searchInput = document.getElementById('searchInput');

  if (searchBtn && searchPanel && searchInput) {
    searchBtn.addEventListener('click', function () {
      searchPanel.classList.toggle('active');
      if (searchPanel.classList.contains('active')) {
        setTimeout(() => searchInput.focus(), 100);
      }
    });

    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') performSearch();
    });
  }

  window.closeSearch = function () {
    if (searchPanel) searchPanel.classList.remove('active');
  };

  window.performSearch = function () {
    if (!searchInput) return;
    const query = searchInput.value.trim().toLowerCase();
    const cards = Array.from(document.querySelectorAll('.news-card, .list-item, .tech-card'));

    if (!query) {
      cards.forEach((x) => {
        x.style.display = '';
        x.style.outline = '';
      });
      searchInput.focus();
      return;
    }

    let firstMatch = null;
    cards.forEach((x) => {
      const match = x.innerText.toLowerCase().includes(query);
      x.style.display = match ? '' : 'none';
      x.style.outline = match ? '2px solid #df0712' : '';
      if (match && !firstMatch) firstMatch = x;
    });

    if (firstMatch) {
      firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      const data = Array.isArray(window.publishedArticles) ? window.publishedArticles : [];
      const article = data.find((a) => {
        const text = (a.title || '') + ' ' + (a.excerpt || a.summary || '') + ' ' + (a.content || '');
        return text.toLowerCase().includes(query);
      });
      if (article && article.id) {
        openArticleById(article.id);
      } else {
        alert('इस keyword से कोई खबर नहीं मिली।');
      }
    }
  };

  // Article Opening Handlers
  window.openArticle = function (title) {
    window.closeSearch();
    const list = Array.isArray(window.publishedArticles) ? window.publishedArticles : [];
    const q = String(title || '').trim().toLowerCase();

    const article = list.find((a) => String(a.title || '').trim().toLowerCase() === q) ||
                    list.find((a) => String(a.title || '').trim().toLowerCase().includes(q));

    if (article && article.id) {
      openArticleById(article.id);
      return;
    }

    if (article && article.slug) {
      window.location.href = '/article/' + encodeURIComponent(article.slug);
    } else {
      window.location.href = '/article.html?title=' + encodeURIComponent(title || '');
    }
  };

  window.openArticleById = function (id) {
    if (!id) {
      alert('इस खबर की ID उपलब्ध नहीं है।');
      return;
    }

    const list = Array.isArray(window.publishedArticles) ? window.publishedArticles : [];
    const article = list.find((a) => String(a.id) === String(id));

    if (article && article.slug) {
      window.location.href = '/article/' + encodeURIComponent(article.slug);
    } else {
      window.location.href = '/article.html?id=' + encodeURIComponent(id);
    }
  };

  window.closeArticleView = function () {
    const view = document.getElementById('articleView');
    if (view) view.style.display = 'none';
  };

  window.scrollToTop = function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll To Top Button Toggle
  const toTopBtn = document.getElementById('toTopBtn');
  if (toTopBtn) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 300) {
        toTopBtn.classList.add('show');
      } else {
        toTopBtn.classList.remove('show');
      }
    });
  }

  // --- Dynamic Data Fetching from Supabase ---

  async function loadHomeArticles() {
    if (!window.supabaseClient) return;

    try {
      const { data, error } = await window.supabaseClient
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.error('Error fetching articles:', error);
        return;
      }

      if (!data || data.length === 0) return;

      window.publishedArticles = data;

      // 1. Render Hero Slider
      renderHeroSlider(data.slice(0, 5));

      // 2. Render Breaking News Ticker
      renderBreakingTicker(data.slice(0, 10));

      // 3. Render Latest News Grid
      renderLatestNewsGrid(data);

      // 4. Render Dynamic Category Lists
      renderCategorySections(data);

    } catch (e) {
      console.error('Exception in loadHomeArticles:', e);
    }
  }

  function renderHeroSlider(heroArticles) {
    const heroImageContainer = document.querySelector('.hero-image');
    if (!heroImageContainer || heroArticles.length === 0) return;

    let currentIndex = 0;
    let autoSlideTimer = null;

    function showSlide(index) {
      if (index >= heroArticles.length) currentIndex = 0;
      else if (index < 0) currentIndex = heroArticles.length - 1;
      else currentIndex = index;

      const art = heroArticles[currentIndex];
      const imgUrl = art.image_url || art.image || 'assets/images/logo.png';
      const title = window.DOMPurify ? window.DOMPurify.sanitize(art.title) : escapeHtml(art.title);

      heroImageContainer.innerHTML =
        '<img src="' + imgUrl + '" class="hero-slide-img" alt="' + escapeHtml(art.title) + '" onclick="openArticleById(\'' + art.id + '\')">' +
        '<div class="hero-slide-overlay" onclick="openArticleById(\'' + art.id + '\')">' + title + '</div>' +
        '<div class="slide-count">' + (currentIndex + 1) + ' / ' + heroArticles.length + '</div>' +
        '<button class="hero-arrow prev" aria-label="Previous Slide">‹</button>' +
        '<button class="hero-arrow next" aria-label="Next Slide">›</button>' +
        '<div class="hero-dots">' +
        heroArticles.map((_, i) => '<button class="hero-dot ' + (i === currentIndex ? 'active' : '') + '" aria-label="Slide ' + (i + 1) + '"></button>').join('') +
        '</div>';

      // Attach arrow handlers
      const prevBtn = heroImageContainer.querySelector('.hero-arrow.prev');
      const nextBtn = heroImageContainer.querySelector('.hero-arrow.next');
      if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showSlide(currentIndex - 1); resetTimer(); });
      if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showSlide(currentIndex + 1); resetTimer(); });

      // Attach dot handlers
      const dots = heroImageContainer.querySelectorAll('.hero-dot');
      dots.forEach((dot, idx) => {
        dot.addEventListener('click', (e) => { e.stopPropagation(); showSlide(idx); resetTimer(); });
      });
    }

    function resetTimer() {
      if (autoSlideTimer) clearInterval(autoSlideTimer);
      autoSlideTimer = setInterval(() => showSlide(currentIndex + 1), 5000);
    }

    showSlide(0);
    resetTimer();
  }

  function renderBreakingTicker(breakingArticles) {
    const breakingTrack = document.getElementById('bvBreakingTrack');
    if (!breakingTrack || breakingArticles.length === 0) return;

    const itemsHtml = breakingArticles.map((a) => {
      const safeTitle = window.DOMPurify ? window.DOMPurify.sanitize(a.title) : escapeHtml(a.title);
      return '<a href="javascript:void(0)" onclick="openArticleById(\'' + a.id + '\')" class="bv-breaking-item">⚡ ' + safeTitle + '</a>';
    }).join('');

    breakingTrack.innerHTML = '<div class="bv-breaking-list" id="bvBreakingList">' + itemsHtml + '</div>';

    // Ticker Auto-Scroll Logic
    const listEl = document.getElementById('bvBreakingList');
    if (listEl) {
      let scrollPos = 0;
      setInterval(() => {
        scrollPos += 1;
        if (scrollPos > listEl.scrollWidth / 2) scrollPos = 0;
        listEl.style.transform = 'translateX(-' + scrollPos + 'px)';
      }, 40);
    }
  }

  function renderLatestNewsGrid(articles) {
    const newsGrid = document.querySelector('.news-grid');
    if (!newsGrid) return;

    const itemsHtml = articles.map((art) => {
      const safeTitle = window.DOMPurify ? window.DOMPurify.sanitize(art.title) : escapeHtml(art.title);
      const safeExcerpt = window.DOMPurify ? window.DOMPurify.sanitize(art.excerpt || art.summary || '') : escapeHtml(art.excerpt || art.summary || '');
      const category = escapeHtml(art.category || 'ताजा खबर');
      const imgUrl = art.image_url || art.image || '';

      const imgBlock = imgUrl ?
        '<img src="' + imgUrl + '" alt="' + safeTitle + '" loading="lazy">' :
        '<span class="news-img-icon">📰</span>';

      return (
        '<div class="news-card" onclick="openArticleById(\'' + art.id + '\')">' +
          '<div class="news-img">' + imgBlock + '</div>' +
          '<div class="news-body">' +
            '<div class="news-category">' + category + '</div>' +
            '<h3>' + safeTitle + '</h3>' +
            '<p>' + safeExcerpt + '</p>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    newsGrid.innerHTML = itemsHtml;
  }

  function renderCategorySections(articles) {
    const categoryContainers = document.querySelectorAll('[data-bv-category]');
    categoryContainers.forEach((container) => {
      const catName = container.getAttribute('data-bv-category');
      if (!catName) return;

      const filtered = articles.filter((a) =>
        String(a.category || '').toLowerCase() === catName.toLowerCase()
      );

      if (filtered.length === 0) {
        container.innerHTML = '<div class="dynamic-empty">इस श्रेणी में अभी कोई खबरें उपलब्ध नहीं हैं।</div>';
        return;
      }

      container.innerHTML = filtered.slice(0, 6).map((art) => {
        const safeTitle = window.DOMPurify ? window.DOMPurify.sanitize(art.title) : escapeHtml(art.title);
        const imgUrl = art.image_url || art.image || '';
        const imgBlock = imgUrl ?
          '<img src="' + imgUrl + '" alt="' + safeTitle + '" loading="lazy">' :
          '<span class="news-img-icon">📰</span>';

        return (
          '<div class="news-card" onclick="openArticleById(\'' + art.id + '\')">' +
            '<div class="news-img">' + imgBlock + '</div>' +
            '<div class="news-body">' +
              '<div class="news-category">' + escapeHtml(art.category || catName) + '</div>' +
              '<h3>' + safeTitle + '</h3>' +
            '</div>' +
          '</div>'
        );
      }).join('');
    });
  }

  // --- Live Site Settings & Notice Box ---

  async function loadLiveSettings() {
    if (!window.supabaseClient) return;

    try {
      const { data, error } = await window.supabaseClient
        .from('site_settings')
        .select('*')
        .single();

      if (error || !data) return;

      // Notice Box
      if (data.notice_enabled && data.notice_text) {
        const noticeContainer = document.getElementById('bvNoticeContainer');
        if (noticeContainer) {
          const safeText = window.DOMPurify ? window.DOMPurify.sanitize(data.notice_text) : escapeHtml(data.notice_text);
          const safeLink = data.notice_link ? escapeHtml(data.notice_link) : '#';
          noticeContainer.innerHTML =
            '<div class="bv-notice-box">' +
              '<span>📢 ' + safeText + ' ' + (data.notice_link ? '<a href="' + safeLink + '" target="_blank">यहां क्लिक करें</a>' : '') + '</span>' +
              '<button class="bv-notice-close" onclick="this.parentElement.remove()" aria-label="Close Notice">✕</button>' +
            '</div>';
        }
      }

      // Site Logo Override
      const logoUrl = data.webLogoUrl || data.logoUrl;
      if (logoUrl) {
        document.querySelectorAll('.logo, .brand img').forEach((img) => {
          img.src = logoUrl;
        });
      }

      // Site Title Override
      if (data.siteTitle) {
        document.title = data.siteTitle;
      }

    } catch (e) {
      console.error('Exception loading live settings:', e);
    }
  }

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('SW registered:', reg.scope))
        .catch((err) => console.log('SW registration failed:', err));
    });
  }

  // --- Initialization Hook ---
  window.addEventListener('supabaseReady', function () {
    loadHomeArticles();
    loadLiveSettings();
  });

  if (window.supabaseClient) {
    loadHomeArticles();
    loadLiveSettings();
  }

})();
