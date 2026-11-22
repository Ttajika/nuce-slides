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

  window.addEventListener('keydown', e => {
    if (e.key !== 'p' && e.key !== 'P') return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    if (!document.body.classList.contains('slide-mode')) return;   // 印刷用表示ならそのまま印刷
    e.preventDefault();
    e.stopImmediatePropagation();
    printHandout();
  }, true);
})();
