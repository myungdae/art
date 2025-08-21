// public/assets/js/custom/menu.js
(function () {
  // ✅ 주입 가드: 이미 실행됐다면 종료
  if (window.__MENU_INJECTED__) return;
  window.__MENU_INJECTED__ = true;

  var nav = document.querySelector('#mainNav .navbar-nav');
  if (!nav) return;

  // ✅ 혹시 기존에 우리가 붙인 항목이 있으면 제거 (안전장치)
  nav.querySelectorAll('[data-menu-injected="1"]').forEach(function (n) { n.remove(); });

  var items = [
    { href: '/facet/Job_Vacancies', text: 'JOB VACANCIES' },
    { href: '/facet/Job_Seekers',  text: 'JOB SEEKERS'  },
    { href: '/facet/Online_Tutors', text: 'ONLINE TUTORS' }
  ];

  // ✅ 항목 주입
  items.forEach(function (it) {
    var li = document.createElement('li');
    li.className = 'nav-item text-nowrap';
    li.setAttribute('data-menu-injected', '1');

    var a = document.createElement('a');
    a.className = 'nav-link h5 my-0';
    a.href = it.href;
    a.textContent = it.text;

    li.appendChild(a);
    nav.appendChild(li);
  });

  // ✅ 최종 중복 제거(동일 href가 둘 이상이면 뒤쪽 것을 제거)
  var seen = new Set();
  Array.from(nav.querySelectorAll('.nav-link')).forEach(function (a) {
    var href = a.getAttribute('href') || '';
    if (seen.has(href)) {
      var li = a.closest('li');
      if (li) li.remove();
    } else {
      seen.add(href);
    }
  });
})();
