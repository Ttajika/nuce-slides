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
  // PDF が複数あるときは <meta> を並べ，data-label にボタンの名前を書く（「PDF（ミクロ1）」など）。
  const ICON_DL = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>';
  // 表紙（1 枚目）か：スライドの番号 current があればそれで，なければ not-first-slide クラスで判定
  function onCover() {
    try { return current === 0; }   // eslint-disable-line no-undef
    catch (e) { return !document.body.classList.contains('not-first-slide'); }
  }
  function setupPdfButton() {
    const metas = Array.from(document.querySelectorAll('meta[name="handout-pdf"]')).filter(m => m.content);
    if (!metas.length) return;
    const make = (m, cls) => {
      const a = document.createElement('a');
      const name = m.content.split('/').pop();
      a.className = cls; a.href = encodeURI(m.content); a.download = name;
      a.title = '配布用 PDF（' + name + '）をダウンロード';
      a.innerHTML = ICON_DL + ' PDF' + (m.dataset.label ? '（' + m.dataset.label + '）' : '');
      return a;
    };
    // 表紙の右下（複数あるときは右から並べる）
    const box = document.createElement('div');
    box.className = 'pdf-download-box';
    metas.forEach(m => box.appendChild(make(m, 'pdf-download')));
    document.body.appendChild(box);
    const toggle = document.getElementById('modeToggle');
    const place = () => {
      const slideMode = document.body.classList.contains('slide-mode');
      box.style.display = (slideMode && onCover()) ? '' : 'none';
      const shown = toggle && getComputedStyle(toggle).display !== 'none';
      box.style.right = shown ? (12 + toggle.offsetWidth + 8) + 'px' : '12px';
    };
    place();
    // スライドの切り替えで変わるもの（body のクラス，印刷用表示ボタンの表示）を見て置き直す
    const mo = new MutationObserver(place);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (toggle) mo.observe(toggle, { attributes: true, attributeFilter: ['style', 'class'] });
    const info = document.getElementById('pageInfo');
    if (info) mo.observe(info, { childList: true, characterData: true, subtree: true });
    window.addEventListener('resize', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    // 印刷用表示のヘッダー（enterPrintMode がヘッダーを作るたびに付け直す）
    const orig = window.enterPrintMode;
    if (typeof orig === 'function') {
      window.enterPrintMode = function () {
        const r = orig.apply(this, arguments);
        const head = document.querySelector('.print-header');
        if (head && !head.querySelector('.pdf-download-inline')) {
          const btns = head.querySelectorAll('.page-break-toggle');
          let last = btns.length ? btns[btns.length - 1] : null;
          metas.forEach(m => {
            const a = make(m, 'pdf-download-inline');
            if (last) { last.after(a); last = a; } else head.appendChild(a);
          });
        }
        return r;
      };
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupPdfButton);
  else setupPdfButton();
})();
