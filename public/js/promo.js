// public/js/promo.js
document.addEventListener('DOMContentLoaded', () => {
  const banner = document.getElementById('promoBanner');
  if (!banner) return;

  const key = banner.dataset.key || 'promo-2025-v1';
  if (localStorage.getItem(key + '-dismissed') === '1') {
    banner.remove();
    return;
  }

  const btn = document.getElementById('promoClose');
  if (btn) {
    btn.addEventListener('click', () => {
      localStorage.setItem(key + '-dismissed', '1');
      banner.remove();
    });
  }
});
