// public/assets/js/custom/nav-prettify.js
(function () {
  // 이 스크립트는 메뉴를 "추가"하지 않습니다. 오직 active 표시만.
  var links = document.querySelectorAll('#mainNav .nav-link');
  var path  = location.pathname.replace(/\/+$/, '');

  links.forEach(function (a) {
    var href = (a.getAttribute('href') || '').replace(/\/+$/, '');
    if (!href) return;
    if (path === href || (href !== '/' && path.indexOf(href) === 0)) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });
})();
