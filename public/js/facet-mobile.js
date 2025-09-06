// public/js/facet-mobile.js
(() => {
  // ----- 유틸 -----
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // 레이아웃 기준 요소
  const header = $('header.main-search-header');
  const main   = $('main.main-content') || document.body;

  // 좌측 패싯 사이드바 찾기 (id 권장: #facetSidebar)
  const sidebar =
    $('#facetSidebar') ||
    $('[data-role="facet-sidebar"]') ||
    $('aside.facet-sidebar') ||
    $('aside.col-md-3, aside.col-lg-3');

  if (!main || !sidebar) return; // 패싯이 없는 페이지면 아무것도 안 함

  sidebar.classList.add('facet-side');

  // ----- 상단 칩 바 + 오프캔버스 DOM 주입 -----
  const bar = document.createElement('div');
  bar.className = 'facet-bar d-md-none';
  bar.innerHTML = `
    <div class="facet-scroll" id="facetChipScroll">
      <button type="button" class="chip chip-ghost" id="facetOpenBtn">Filters</button>
    </div>
  `;
  // 메인 콘텐츠 맨 앞에 삽입
  main.insertBefore(bar, main.firstChild);

  const canvas = document.createElement('div');
  canvas.id = 'facetCanvas';
  canvas.className = 'offcanvas offcanvas-bottom';
  canvas.tabIndex = -1;
  canvas.style.height = '80vh';
  canvas.innerHTML = `
    <div class="offcanvas-header">
      <h5 class="mb-0">Filters</h5>
      <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
    </div>
    <div class="offcanvas-body" id="facetCanvasBody"></div>
  `;
  document.body.appendChild(canvas);

  const chipRow = $('#facetChipScroll', bar);
  const openBtn = $('#facetOpenBtn', bar);
  const body    = $('#facetCanvasBody', canvas);

  // ----- 사이드바 이동/복귀 (단일 DOM을 공유) -----
  const origParent = sidebar.parentNode;
  const origNext   = sidebar.nextSibling;

  function moveToCanvas() {
    if (!body.contains(sidebar)) body.appendChild(sidebar);
  }
  function restoreSidebar() {
    if (origParent && !origParent.contains(sidebar)) {
      origParent.insertBefore(sidebar, origNext);
    }
  }
  const mql = window.matchMedia('(max-width: 767.98px)');
  function onMQ(e) { e.matches ? moveToCanvas() : restoreSidebar(); }
  onMQ(mql);
  mql.addEventListener('change', onMQ);

  // ----- 칩(필터 버튼) 생성 -----
  function textOf(el) {
    const t = (el.getAttribute?.('data-title') || el.textContent || '').trim();
    return t.replace(/\s+/g, ' ');
  }
  function buildChips() {
    if (!chipRow) return;
    // 첫 번째 “Filters” 버튼 제외 모두 삭제
    while (chipRow.children.length > 1) chipRow.removeChild(chipRow.lastChild);

    // 그룹 타이틀 후보: data-title, .facet-group, .facet-title, h5/h6
    const groups = [
      ...$$('[data-facet-group]', sidebar),
      ...$$('.facet-group', sidebar),
      ...$$('.facet-title', sidebar),
      ...$$('h5, h6', sidebar)
    ];

    const seen = new Set();
    groups.forEach((g) => {
      const label = textOf(g);
      if (!label || seen.has(label) || label.length > 28) return;
      seen.add(label);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        const off = bootstrap.Offcanvas.getOrCreateInstance(canvas);
        off.show();
        setTimeout(() => g.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
      });
      chipRow.appendChild(btn);
    });
  }

  buildChips();
  // 사이드바 내용이 동적 변경되어도 칩 갱신
  try {
    const mo = new MutationObserver(buildChips);
    mo.observe(sidebar, { childList: true, subtree: true });
  } catch {}

  // 오프캔버스 열기
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      bootstrap.Offcanvas.getOrCreateInstance(canvas).show();
    });
  }

  // ----- 스타일 인라인 주입 (페이지 한정) -----
  const stickyTop = Math.max(54, header ? header.offsetHeight - 6 : 54);
  const style = document.createElement('style');
  style.textContent = `
    .facet-bar{position:sticky;top:${stickyTop}px;background:#fff;z-index:1040;border-bottom:1px solid #eee;padding:10px 12px}
    @media (min-width:768px){.facet-bar{display:none}}
    .facet-scroll{display:flex;gap:10px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:4px 2px}
    .chip{flex:0 0 auto;border:1px solid #e5e7eb;border-radius:9999px;padding:6px 12px;font-weight:700;background:#111;color:#fff}
    .chip-ghost{background:#fff;color:#111}
    .chip:focus{outline:2px solid #FF7A00}
    .offcanvas .facet-side{height:100%;overflow:auto}
  `;
  document.head.appendChild(style);
})();
