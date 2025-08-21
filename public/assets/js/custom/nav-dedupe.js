// public/assets/js/custom/nav-dedupe.js
(function () {
  function normalize(href) {
    return (href || '').replace(/\/+$/, '');
  }

  function dedupe() {
    var nav = document.querySelector('#mainNav .navbar-nav');
    if (!nav) return;
    var keep = new Set();
    var ALLOW = new Set([
      '/',
      '/facet/Job_Vacancies',
      '/facet/Job_Seekers',
      '/facet/Online_Tutors'
    ]);

    Array.from(nav.querySelectorAll('a.nav-link')).forEach(function (a) {
      var href = normalize(a.getAttribute('href'));
      if (!ALLOW.has(href)) return;                // 다른 링크는 건드리지 않음

      if (keep.has(href)) {
        var li = a.closest('li');
        if (li) li.remove();                        // ✅ 중복 제거
      } else {
        keep.add(href);
      }
    });
  }

  // 최초 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', dedupe);
  } else {
    dedupe();
  }

  // 뒤늦게 붙는 항목 대비 (레이스 컨디션 방지)
  setTimeout(dedupe, 200);
  setTimeout(dedupe, 800);

  // 정말 확실히: 메뉴 DOM 변경을 감시해서 즉시 정리
  var nav = document.querySelector('#mainNav .navbar-nav');
  if (nav && window.MutationObserver) {
    var obs = new MutationObserver(dedupe);
    obs.observe(nav, { childList: true, subtree: true });
  }
})();
