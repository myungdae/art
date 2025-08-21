// utils/string.js
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function nl2br(str = '') {
  return String(str).replace(/\n/g, '<br/>');
}

module.exports = { escapeHtml, nl2br };
