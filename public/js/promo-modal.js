// public/js/promo-modal.js
(function () {
  function init() {
    var modal = document.getElementById('promoModal');
    if (!modal) return;

    var key = (modal.dataset && modal.dataset.key) || 'promo-2025-modal-v1';

    try {
      if (localStorage.getItem(key + '-dismissed') === '1') {
        modal.classList.add('hide');
        return;
      }
    } catch (_) {}

    function open() {
      modal.classList.remove('hide');
      try { document.body.style.overflow = 'hidden'; } catch (_) {}
    }
    function close() {
      modal.classList.add('hide');
      try { document.body.style.overflow = ''; } catch (_) {}
    }
    function dismissAndClose() {
      try { localStorage.setItem(key + '-dismissed', '1'); } catch (_) {}
      close();
    }

    var btns = modal.querySelectorAll('[data-promo-close]');
    for (var i = 0; i < btns.length; i++) btns[i].addEventListener('click', dismissAndClose);

    modal.addEventListener('click', function (e) {
      if (e.target === modal) dismissAndClose();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.classList.contains('hide')) dismissAndClose();
    });

    open();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
