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
})();
