// public/assets/js/custom/nav-hardfix.js
(function () {
  function stripSlash(s) { return (s || '').replace(/\/+$/, ''); }

  function hardFix() {
    var nav = document.querySelector('#mainNav .navbar-nav');
    if (!nav) return;

    // 원하는 메뉴(정확히 4개, 이 순서)
    var items = [
      { text: 'HOME',           href: '/' },
      { text: 'JOB VACANCIES',  href: '/facet/Job_Vacancies' },
      { text: 'JOB SEEKERS',    href: '/facet/Job_Seekers' },
      { text: 'ONLINE TUTORS',  href: '/facet/Online_Tutors' }
    ];

    // 이미 같은지 확인
    var cur = Array.from(nav.querySelectorAll('a.nav-link')).map(a => ({
      text: (a.textContent || '').trim().toUpperCase(),
      href: a.getAttribute('href') || ''
    }));
    var same = cur.length === items.length &&
               items.every((it, i) => it.text === cur[i].text && it.href === cur[i].href);
    if (!same) {
      // 싹 지우고 재구성
      nav.innerHTML = '';
      items.forEach(it => {
        var li = document.createElement('li');
        li.className = 'nav-item text-nowrap';
        var a = document.createElement('a');
        a.className = 'nav-link h5 my-0';
        a.href = it.href;
        a.textContent = it.text;
        li.appendChild(a);
        nav.appendChild(li);
      });
    }

    // 활성화 표시
    var path = stripSlash(location.pathname);
    Array.from(nav.querySelectorAll('a.nav-link')).forEach(a => {
      var href = stripSlash(a.getAttribute('href'));
      if ((path === '' && href === '') || href === path || (path === '' && href === '/')) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
  }

  function run() {
    hardFix();
    // 뒤늦게 메뉴를 또 끼워넣는 스크립트 대비해서 몇 번 더 고정
    setTimeout(hardFix, 100);
    setTimeout(hardFix, 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();

  // nav DOM 변경 감시 → 즉시 재정렬
  var nav = document.querySelector('#mainNav .navbar-nav');
  if (nav && window.MutationObserver) {
    new MutationObserver(hardFix).observe(nav, { childList: true, subtree: true });
  }
})();
