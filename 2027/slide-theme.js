/* ═══════════════════════════════════════════════════════════════
   slide-theme.js — スライドの共通デザイン（slide-theme.css と対で使う）
   ・ツールバー等の絵文字ボタンを線画アイコンに差し替える
   ・扉（section-title-big）を紺の全面にし，章番号・章名を添える
   ・ポインターを指差しマークにする
   </body> の直前（各スライドのスクリプトの後）で読み込む。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─── アイコン（Lucide, ISC License） ───
  const SPRITE = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-first" viewBox="0 0 24 24"><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></symbol>
  <symbol id="i-prev" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></symbol>
  <symbol id="i-next" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
  <symbol id="i-last" viewBox="0 0 24 24"><path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/></symbol>
  <symbol id="i-note" viewBox="0 0 24 24"><path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></symbol>
  <symbol id="i-pen" viewBox="0 0 24 24"><path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/></symbol>
  <symbol id="i-trash" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></symbol>
  <symbol id="i-download" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></symbol>
  <symbol id="i-upload" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></symbol>
  <symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></symbol>
  <symbol id="i-filter" viewBox="0 0 24 24"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></symbol>
  <symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></symbol>
  <symbol id="i-key" viewBox="0 0 24 24"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></symbol>
  <symbol id="i-star" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></symbol>
  <symbol id="i-printer" viewBox="0 0 24 24"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></symbol>
  <symbol id="i-monitor" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></symbol>
  <symbol id="i-highlighter" viewBox="0 0 24 24"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></symbol>
  <symbol id="i-pointer" viewBox="0 0 24 24"><path d="M22 14a8 8 0 0 1-8 8"/><path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1"/><path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></symbol>
  <symbol id="i-eraser" viewBox="0 0 24 24"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></symbol>
  <symbol id="i-undo" viewBox="0 0 24 24"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></symbol>
  <symbol id="i-board" viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></symbol>
</svg>`;
  const svg = name => `<svg class="ic"><use href="#i-${name}"/></svg>`;

  // ボタンの文字 → アイコン名
  const EMOJI = {
    '⏮': 'first', '◀': 'prev', '▶': 'next', '⏭': 'last',
    '−': 'minus', '－': 'minus', '-': 'minus', '+': 'plus', '＋': 'plus',
    '📝': 'note', '✏️': 'pen', '✏': 'pen', '🗑️': 'trash', '🗑': 'trash',
    '💾': 'download', '📂': 'upload', '🔍': 'filter', '?': 'help', '🔑': 'key',
    '🖍️': 'highlighter', '🖍': 'highlighter', '🔴': 'pointer', '🧹': 'eraser',
    '↩️': 'undo', '↩': 'undo', '📋': 'board', '⭐': 'star',
  };
  function swapButton(b) {
    const name = EMOJI[b.textContent.trim()];
    if (name) { b.innerHTML = svg(name); return name; }
    return null;
  }

  function decorateChrome() {
    document.body.insertAdjacentHTML('afterbegin', SPRITE);
    // 上部バー：アイコン化し，グループの切れ目に区切り線
    const nav = document.querySelector('.topbar-nav');
    if (nav) {
      const groupStart = { first: 1, minus: 1, note: 1, trash: 1, filter: 1 };
      let sawFirst = false;
      nav.querySelectorAll(':scope > button').forEach(b => {
        const name = swapButton(b);
        if (name === 'first') sawFirst = true;
        if (name && (groupStart[name] || (name === 'prev' && !sawFirst))) {
          const sep = document.createElement('span');
          sep.className = 'nav-sep';
          b.before(sep);
        }
      });
    }
    // 書き込みツール・ペンボタン
    document.querySelectorAll('.draw-toolbar button, #fabPen').forEach(swapButton);
    // メモ欄の見出し・フィルタのチップ
    document.querySelectorAll('.notes-header h3').forEach(h => {
      if (h.firstChild && h.firstChild.nodeType === 3 && h.firstChild.textContent.startsWith('📝')) {
        h.firstChild.textContent = h.firstChild.textContent.replace(/^📝\s*/, ' ');
        h.insertAdjacentHTML('afterbegin', svg('note'));
      }
    });
    document.querySelectorAll('.filter-chip').forEach(c => {
      if (c.textContent.trim().startsWith('⭐')) c.innerHTML = svg('star') + ' ' + c.textContent.replace(/^\s*⭐\s*/, '');
    });
    // 印刷用表示ボタン（文言は各ページの JS が書き換えるので監視する）
    const mt = document.getElementById('modeToggle');
    if (mt) {
      const fix = () => {
        const t = mt.textContent.trim();
        const m = t.match(/^(📄|🖥️?|🖨️?)\s*(.*)$/u);
        if (m) mt.innerHTML = svg(m[1].startsWith('📄') || m[1].startsWith('🖨') ? 'printer' : 'monitor') + ' ' + m[2];
      };
      fix();
      new MutationObserver(fix).observe(mt, { childList: true, characterData: true, subtree: true });
    }
    // slide-sync.js が後から差し込むログインボタン
    let n = 0;
    const t = setInterval(() => {
      const b = document.getElementById('ssAuthBtn');
      if (b) { swapButton(b); clearInterval(t); } else if (++n > 50) clearInterval(t);
    }, 100);
  }

  // ─── 扉：章番号・章名 ───
  const UNNUMBERED = ['はじめに', 'Final Remark'];
  const slidesArr = () => { try { return SLIDES; } catch (e) { return null; } };   // eslint-disable-line no-undef
  const curIdx = () => { try { return current; } catch (e) { return -1; } };       // eslint-disable-line no-undef
  const isDividerSlide = s => s && (s.html.includes('section-title-big') || (s.title && s.title === s.section && !s.html.trim()));
  let chapters = null;   // [{section, slide}]（章の最初の扉）
  function chapterList() {
    if (chapters) return chapters;
    const S = slidesArr() || [];
    const seen = new Set();
    chapters = [];
    S.forEach((s, i) => {
      if (!s.section || seen.has(s.section) || !isDividerSlide(s)) return;
      seen.add(s.section);
      chapters.push({ section: s.section, slide: i });
    });
    return chapters;
  }
  function eyebrowHTML(idx) {
    const S = slidesArr();
    const s = S && S[idx];
    if (!s || !s.section) return '';
    const numbered = chapterList().filter(c => !UNNUMBERED.includes(c.section));
    const k = numbered.findIndex(c => c.section === s.section);
    const isHead = chapterList().some(c => c.slide === idx);
    const num = k >= 0 ? `<span class="num">第${k + 1}章</span>` : '';
    const name = isHead ? '' : `<span>${s.section}</span>`;
    return (num || name) ? `<div class="divider-eyebrow">${num}${name}</div>` : '';
  }

  function decorateSlide() {
    if (document.body.classList.contains('print-mode')) return;
    const area = document.querySelector('.slide-area');
    if (!area) return;
    const card = area.querySelector('.slide-content');
    if (!card) return;
    // ブックマークの星
    card.querySelectorAll('.bookmark-btn').forEach(b => { if (!b.querySelector('svg')) b.innerHTML = svg('star'); });
    // 扉
    const big = card.querySelector('.section-title-big');
    card.classList.toggle('is-divider', !!big);
    const old = card.querySelector('.divider-eyebrow');
    if (!big) { if (old) old.remove(); return; }
    const idx = curIdx();
    const key = String(idx);
    if (old && old.dataset.idx === key) return;
    if (old) old.remove();
    const html = eyebrowHTML(idx);
    if (html) {
      big.insertAdjacentHTML('beforebegin', html);
      const eb = big.previousElementSibling;
      if (eb) eb.dataset.idx = key;
    }
  }

  // ─── ポインター：指差しマーク ───
  const POINTER_PATHS = [
    'M22 14a8 8 0 0 1-8 8',
    'M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2',
    'M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1',
    'M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10',
    'M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
  ].map(d => new Path2D(d));
  const POINTER_FILL = new Path2D('M6 4h4v4h4v1h4v2h4v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L6 14z');
  // 人差し指の先が (x, y) に来る。k は拡大率
  function drawPointerMark(ctx, x, y, k) {
    const s = 1.7 * (k || 1);
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-8, -2);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 4 / s; ctx.shadowOffsetY = 1 / s;
    ctx.fillStyle = '#fff'; ctx.fill(POINTER_FILL);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#e94560'; ctx.lineWidth = 2;
    POINTER_PATHS.forEach(p => ctx.stroke(p));
    ctx.restore();
  }
  window.drawPointerMark = drawPointerMark;

  // 各ページの redrawStrokes は赤い丸を描くので，丸を描かせずに指差しマークを重ねる
  function patchPointer() {
    if (typeof window.redrawStrokes !== 'function') return;
    let hasPos = true;
    try { void pointerPos; } catch (e) { hasPos = false; }                          // eslint-disable-line no-undef
    if (!hasPos) return;
    const orig = window.redrawStrokes;
    const toolIsPointer = () => {
      try { if (typeof currentTool !== 'undefined') return currentTool === 'pointer'; } catch (e) {}   // eslint-disable-line no-undef
      try { if (typeof drawTool !== 'undefined') return drawTool === 'pointer'; } catch (e) {}         // eslint-disable-line no-undef
      return true;
    };
    window.redrawStrokes = function () {
      const p = pointerPos;                                                         // eslint-disable-line no-undef
      const show = !!p && toolIsPointer();
      if (show) pointerPos = null;                                                  // eslint-disable-line no-undef
      try { return orig.apply(this, arguments); }
      finally {
        if (show) {
          pointerPos = p;                                                           // eslint-disable-line no-undef
          const c = document.getElementById('drawCanvas');
          const ctx = c && c.getContext('2d');
          if (ctx) drawPointerMark(ctx, p.x, p.y, 1);
        }
      }
    };
  }

  function init() {
    decorateChrome();
    patchPointer();
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; decorateSlide(); });
    }).observe(document.body, { childList: true, subtree: true });
    decorateSlide();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
