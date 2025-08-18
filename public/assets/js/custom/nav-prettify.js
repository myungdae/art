// /public/assets/js/custom/nav-prettify.js
(function () {
  const MAP = {
    'JOB_VACANCIES': 'Job Vacancies',
    'JOB_SEEKERS': 'Job Seekers',
    'ONLINE_TUTORS': 'Online Tutors',
    'MORE': '+ More'
  };

  function toTitleCase(s) {
    return s
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pretty(text) {
    if (!text) return text;
    const t = text.trim();
    if (MAP[t]) return MAP[t];
    if (/^(\+)?\s*MORE$/i.test(t)) return '+ More';
    return toTitleCase(t);
  }

  function isMore(text) {
    return /^(\+)?\s*more$/i.test((text || '').trim());
  }

  function prettifyLinks(root) {
    const links = (root || document).querySelectorAll('nav.main_nav_bar .navbar-nav a.nav-link');
    links.forEach(a => {
      const raw = (a.textContent || '').trim();
      const nice = pretty(raw);
      if (isMore(nice)) {
        // "+ More" 항목은 제거
        const li = a.closest('li'); if (li && li.parentElement) li.parentElement.removeChild(li);
        return;
      }
      if (nice && nice !== raw) a.textContent = nice;
      a.setAttribute('title', a.textContent.trim());
    });
  }

  // 최초 실행
  prettifyLinks();

  // menu.js가 동적으로 메뉴를 추가하므로 감시하여 즉시 정리
  const nav = document.querySelector('nav.main_nav_bar .navbar-nav');
  if (nav && 'MutationObserver' in window) {
    const mo = new MutationObserver(() => prettifyLinks(nav));
    mo.observe(nav, { childList: true, subtree: true, characterData: true });
  }

  // 활성 링크 강조(클라이언트 사이드 보정)
  try {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    document.querySelectorAll('nav.main_nav_bar a.nav-link').forEach(a => {
      const href = (a.getAttribute('href') || '').replace(/\/+$/, '') || '/';
      if (href === path) a.classList.add('active');
    });
  } catch (_) {}
})();
