/* ═══════════════════════════════════════════════════════════════
   slide-print.js — 印刷用表示（ハンドアウト）の共通処理
   スライド表示のまま Ctrl+P / ⌘P を押したら，印刷用表示に切り替え，
   数式・画像の描画を待ってから印刷ダイアログを開く。
   （メニューから印刷した場合は slide-print.css が案内を出す）
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const wait = ms => new Promise(r => setTimeout(r, ms));

  function imagesLoaded(root) {
    const imgs = Array.from(root.querySelectorAll('img')).filter(img => !img.complete);
    return Promise.all(imgs.map(img => new Promise(r => {
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', r, { once: true });
    })));
  }

  async function printHandout() {
    if (typeof window.enterPrintMode !== 'function') { window.print(); return; }
    window.enterPrintMode();
    // 各ファイルの enterPrintMode は数式の組版を setTimeout や非同期で始めるので，
    // 少し待ってから MathJax の処理がすべて終わるのを待つ
    await wait(300);
    const ready = (async () => {
      const MJ = window.MathJax;
      if (MJ && MJ.startup && MJ.startup.promise) { try { await MJ.startup.promise; } catch (e) {} }
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
      await imagesLoaded(document);
    })();
    await Promise.race([ready, wait(8000)]);   // 何かが終わらなくても 8 秒で印刷に進む
    await wait(100);
    window.print();
  }

  // ─── 幅の広い数式を印刷幅に収める ───
  // .math-display は overflow-x:auto なので，紙でははみ出した部分が切れる。
  // 印刷の直前に，印刷幅（A4 から左右の余白を引いた 186mm）で並べ直して測り，
  // はみ出す数式だけを zoom で縮小する。印刷が終わったら元に戻す。
  const MATH_SEL = '.print-slide .math-display, .print-slide mjx-container[display="true"]';
  function fitWideMath() {
    if (!document.body.classList.contains('print-mode')) return;
    document.body.classList.add('print-measure');
    const els = Array.from(document.querySelectorAll(MATH_SEL))
      .filter(el => !(el.tagName === 'MJX-CONTAINER' && el.closest('.math-display')));
    els.forEach(el => { el.style.zoom = ''; });
    // 先にすべて測ってから書き換える（測る・書くを交互にすると毎回レイアウトし直しになる）
    const zooms = els.map(el => {
      const avail = el.clientWidth, need = el.scrollWidth;
      return (avail > 0 && need > avail + 1) ? Math.max(0.5, avail / need * 0.98) : 0;
    });
    els.forEach((el, i) => { if (zooms[i]) { el.style.zoom = zooms[i]; el.dataset.printZoom = '1'; } });
    document.body.classList.remove('print-measure');
  }
  function unfitWideMath() {
    document.querySelectorAll('[data-print-zoom]').forEach(el => { el.style.zoom = ''; delete el.dataset.printZoom; });
  }
  window.addEventListener('beforeprint', fitWideMath);
  window.addEventListener('afterprint', unfitWideMath);

  window.addEventListener('keydown', e => {
    if (e.key !== 'p' && e.key !== 'P') return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    if (!document.body.classList.contains('slide-mode')) return;   // 印刷用表示ならそのまま印刷
    e.preventDefault();
    e.stopImmediatePropagation();
    printHandout();
  }, true);

  // ─── 配布用 PDF のダウンロードボタン ───
  // <meta name="handout-pdf" content="pdf/xxx.pdf"> があれば，
  //   ・表紙（1 枚目）の右下，「印刷用表示」ボタンの左（スマートフォンでは右下）
  //   ・印刷用表示のヘッダー（改ページ区切りボタンの横）
  // に「PDF」ボタンを出す。PDF の作り直しは make-pdf.sh
  const ICON_DL = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>';
  function setupPdfButton() {
    const meta = document.querySelector('meta[name="handout-pdf"]');
    if (!meta || !meta.content) return;
    const href = encodeURI(meta.content);
    const name = meta.content.split('/').pop();
    const make = cls => {
      const a = document.createElement('a');
      a.className = cls; a.href = href; a.download = name;
      a.title = '配布用 PDF（' + name + '）をダウンロード';
      a.innerHTML = ICON_DL + ' PDF';
      return a;
    };
    // 表紙の右下
    const fixed = make('pdf-download');
    document.body.appendChild(fixed);
    const toggle = document.getElementById('modeToggle');
    const place = () => {
      const shown = toggle && getComputedStyle(toggle).display !== 'none';
      fixed.style.right = shown ? (12 + toggle.offsetWidth + 8) + 'px' : '12px';
    };
    place();
    new MutationObserver(place).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    // 印刷用表示のヘッダー（enterPrintMode がヘッダーを作るたびに付け直す）
    const orig = window.enterPrintMode;
    if (typeof orig === 'function') {
      window.enterPrintMode = function () {
        const r = orig.apply(this, arguments);
        const btn = document.querySelector('.print-header .page-break-toggle');
        if (btn && !btn.parentNode.querySelector('.pdf-download-inline')) btn.after(make('pdf-download-inline'));
        return r;
      };
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupPdfButton);
  else setupPdfButton();
})();
