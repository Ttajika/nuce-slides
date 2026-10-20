/* ════════════════════════════════════════════════════════════════════════
   slide-board.js — 先生の板書レイヤー ＋ 記録・再生（音声つき／音声なし）

   学生側:
     ・先生の板書をスライドに重ねて表示（👁 / T キー）
     ・スライド単位で板書を書き順どおりに再生（▶✍）
     ・トピック扉スライドの「▶ このトピックを再生」で、音声（または無音の時計）に合わせて
       ページ送り・板書・ポインターを再生。シーク・倍速・「再生位置に戻る」あり
   先生側（URL に ?author=1）:
     ・専用のペン／蛍光ペン／消しゴム／ポインターで板書を書く（学生用の手書きデータには保存しない）
     ・● 記録 / ⏸ / ■ でトピックを記録。🎤 オフなら音声なし（板書・ポインター・ページ送りのみ）
     ・一時停止中に書いた線は再生時に一瞬で現れる（書き写しの時間を飛ばせる）
     ・⬇ で board JSON（＋音声）を書き出し → board/<deck>.board.json と board/<音声> に置く

   各スライド HTML からは、SlideSync.init / SlideLive.init と同じ場所で:
     <script src="slide-board.js"></script>
     ...
     if (window.SlideBoard) SlideBoard.init({
       deck: 'micro_MG',                    // 板書データの名前（board/<deck>.board.json）
       getCanvas: () => getCanvas(),        // 学生用手書き canvas（この上下に板書レイヤーを重ねる）
       getCurrent: () => current,           // 現在のスライド番号（0 始まり）
       showSlide: (i) => showSlide(i),
       getSlideCount: () => SLIDES.length,
       getSlideId: (i) => SLIDES[i].id,     // 任意: スライドの安定 ID。無ければ番号（#1, #2, …）
       getSections: () => SECTIONS,         // 任意: [{title, slide}]（トピック名の既定値に使う）
       // 任意: boardUrl, fixedLayout:true, hooks:{ redraw:'redrawStrokes', show:'showSlide' }
     });

   座標の決まり（slide-live.js と同じ）:
     ・スライド幅を 1100px に固定（body.live-fixed）し、画面に収まらない分は zoom で縮める
     ・座標は「canvas の幅 = 1」とする単位（x も y も幅で割る）
     ・線の太さ・ポインターの大きさは幅 1100px のときの px

   データ形式（version 1）:
     { version:1, deck, unit:'canvas-width', refW:1100,
       slides: { <slideId>: { strokes:[{id,color,size,alpha,t0,pts:[[x,y,dt],…]}],
                              erases:[{t0, ids:[…]}] } },          // t0 = Date.now(), dt = ms
       topics: [{ name, startSlide, audio|null, mime, duration,
                  events:[ {t, type:'slide', id}
                         | {t, type:'stroke', slide, id, instant?}
                         | {t, type:'erase', slide, ids}
                         | {t, type:'pointer', slide, x, y}         // t = 秒, x:null = ポインター消去
                         | {t, type:'anim', slide, fig, action:'play'|'pause'|'seek', at}
                         | {t, type:'reveal', slide, index, on} ] }] }
     anim / reveal はページ側が出す animctrl / phantomctrl イベント（detail: {fig, action, at} /
     {index, revealed}）を記録したもの。再生時は .tikz-figure.anim の fig._anim.show(t) と
     .phantom の revealed クラスで再現する（fig / index はスライド内で何番目か）。
     再生側は知らない type を無視するので、後からイベントを足しても古いデータは壊れない。
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SB = {};
  const REF_W = 1100;            // 固定レイアウトの幅（slide-live.js の FIXED.slideW と同じ）
  const GAP_MAX = 3, GAP_TO = 1; // スライド単位の再生で、3 秒以上の空白は 1 秒に詰める
  const COLORS = ['#e94560', '#2563eb', '#1d2433', '#16a34a'];
  const params = new URLSearchParams(location.search);
  const AUTHOR = params.get('author') === '1';

  let A = null;                  // adapter
  let board = null;
  let showTeacher = true;
  let tCanvas = null, aCanvas = null;   // 先生レイヤー（表示用） / 作成モードの入力レイヤー
  const audioURLs = {}, audioBlobs = {};
  let rec = null, play = null, navByBoard = false, lastIdx = -1;
  let tool = 'pen', color = COLORS[2], livePointer = null, drawing = null, penSeen = false;
  let lastPtrLog = { t: -1, x: null, y: null };
  let redrawQueued = false, seeking = false;

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const $ = id => document.getElementById(id);
  const r4 = v => Math.round(v * 10000) / 10000;
  const fmt = s => { s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
  const newId = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const keyAuthor = () => 'slideboard:' + A.deck + ':author';
  const keyShow = () => 'slideboard:' + A.deck + ':show';
  const emptyBoard = () => ({ version: 1, deck: A.deck, unit: 'canvas-width', refW: REF_W, slides: {}, topics: [] });
  const validBoard = b => b && b.version === 1 && b.slides && typeof b.slides === 'object';

  /* ── スライド ─────────────────────────────────────────────────────────── */
  const count = () => A.getSlideCount();
  const sid = i => (A.getSlideId && A.getSlideId(i)) || ('#' + (i + 1));
  const cur = () => A.getCurrent();
  const curId = () => sid(cur());
  function indexOfId(id) { for (let i = 0; i < count(); i++) if (sid(i) === id) return i; return -1; }
  function sectionTitle(i) {
    let t = '';
    for (const s of (A.getSections ? A.getSections() : []) || []) if (i >= s.slide) t = s.title;
    return t;
  }
  function go(i) { navByBoard = true; try { A.showSlide(i); } finally { navByBoard = false; } }

  /* ── 板書データ ───────────────────────────────────────────────────────── */
  const slideData = id => board.slides[id] || (board.slides[id] = { strokes: [], erases: [] });
  function visibleStrokes(id) {
    const d = board.slides[id]; if (!d) return [];
    const gone = new Set(d.erases.flatMap(e => e.ids));
    return d.strokes.filter(s => !gone.has(s.id));
  }
  const hasAnyBoard = () => board.topics.length > 0 || Object.values(board.slides).some(d => d.strokes.length);
  const saveAuthor = () => { if (AUTHOR) ls.set(keyAuthor(), JSON.stringify(board)); };

  async function loadBoard() {
    if (AUTHOR) {
      try { const b = JSON.parse(ls.get(keyAuthor()) || 'null'); if (validBoard(b)) return [b, 'このブラウザの作成データ']; } catch (e) {}
    }
    const url = A.boardUrl || `board/${A.deck}.board.json`;
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (r.ok) { const b = await r.json(); if (validBoard(b)) return [b, url]; }
    } catch (e) {}
    if (!AUTHOR) {   // 同じブラウザで作成モードを使った場合の確認用
      try { const b = JSON.parse(ls.get(keyAuthor()) || 'null'); if (validBoard(b)) return [b, 'このブラウザの作成データ']; } catch (e) {}
    }
    return [emptyBoard(), ''];
  }

  /* ── 固定レイアウト（slide-live.js と同じ仕組み）────────────────────────── */
  let userZoom = 1;
  function fitLayout() {
    if (!document.body.classList.contains('live-fixed')) return;
    const layer = $('zoomLayer');
    if (layer) {
      const area = layer.parentElement, cs = getComputedStyle(area);
      const avail = area.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const base = Math.max(0.2, Math.min(1, avail / REF_W));
      document.documentElement.style.setProperty('--content-zoom', String(Math.round(base * userZoom * 1000) / 1000));
    }
    if (typeof window.resizeDrawCanvas === 'function') window.resizeDrawCanvas();
  }
  function readUserZoom() {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--content-zoom'));
    if (v > 0) userZoom = v;
  }
  const CONTENT_SEL = /\.slide-content|\.columns|\.frame-title/;
  function dropMobileContentRules() {
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const r of rules) {
        if (!(r instanceof CSSMediaRule) || !/max-width/.test(r.conditionText || r.media.mediaText)) continue;
        for (let i = r.cssRules.length - 1; i >= 0; i--) {
          const s = r.cssRules[i];
          if (s.selectorText && CONTENT_SEL.test(s.selectorText)) r.deleteRule(i);
        }
      }
    }
  }
  function installFixedLayout() {
    if (document.body.classList.contains('live-fixed')) return;   // slide-live.js が固定済み
    document.body.classList.add('live-fixed');
    dropMobileContentRules();
    const orig = window.applyZoom;
    if (typeof orig === 'function') {
      window.applyZoom = function () { const r = orig.apply(this, arguments); readUserZoom(); fitLayout(); return r; };
    }
    window.addEventListener('resize', () => setTimeout(fitLayout, 0));
    readUserZoom(); fitLayout();
  }

  /* ── キャンバス ───────────────────────────────────────────────────────── */
  function ensureCanvases() {
    const c = A.getCanvas();
    if (!c || !c.parentElement || !c.width) return false;
    if (!tCanvas) { tCanvas = document.createElement('canvas'); tCanvas.className = 'sb-teacher'; }
    if (tCanvas.parentElement !== c.parentElement) c.parentElement.insertBefore(tCanvas, c);  // 印刷モード等で作り直されても付け直す
    if (AUTHOR) {
      if (!aCanvas) { aCanvas = document.createElement('canvas'); aCanvas.className = 'sb-author'; bindAuthorInput(); }
      if (aCanvas.parentElement !== c.parentElement) c.parentElement.appendChild(aCanvas);
      aCanvas.classList.toggle('off', tool === 'none');
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.width * dpr), h = Math.round(c.height * dpr);
    for (const x of [tCanvas, aCanvas]) if (x && (x.width !== w || x.height !== h)) { x.width = w; x.height = h; }
    return true;
  }
  function drawStroke(ctx, st, W, uptoMs = Infinity) {
    const p = st.pts; if (!p || !p.length) return;
    ctx.strokeStyle = st.color; ctx.lineWidth = st.size * W / REF_W;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = st.alpha || 1;
    ctx.beginPath(); ctx.moveTo(p[0][0] * W, p[0][1] * W);
    let n = 0;
    for (let i = 1; i < p.length; i++) { if (p[i][2] > uptoMs) break; ctx.lineTo(p[i][0] * W, p[i][1] * W); n++; }
    if (!n) ctx.lineTo(p[0][0] * W + 0.01, p[0][1] * W);
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  function drawDot(ctx, pt, W) {   // 本番のポインターと同じ見た目
    if (!pt) return;
    const k = W / REF_W, x = pt.x * W, y = pt.y * W;
    ctx.beginPath(); ctx.arc(x, y, 12 * k, 0, Math.PI * 2); ctx.fillStyle = 'rgba(233,69,96,0.7)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 5 * k, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
  }
  // items: [{t, stroke, instant} | {t, erase:[ids]}]（t 昇順・秒）を時刻 t の状態で描く
  function renderItems(ctx, items, t, W) {
    const gone = new Set();
    for (const it of items) { if (it.t > t) break; if (it.erase) it.erase.forEach(id => gone.add(id)); }
    for (const it of items) {
      if (it.t > t) break;
      if (it.stroke && !gone.has(it.stroke.id)) drawStroke(ctx, it.stroke, W, it.instant ? Infinity : (t - it.t) * 1000);
    }
  }
  function pointerAt(list, t) {
    if (!list || !list.length || list[0].t > t) return null;
    let lo = 0, hi = list.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (list[m].t <= t) lo = m; else hi = m - 1; }
    const a = list[lo], b = list[lo + 1];
    if (a.x == null) return null;
    if (b && b.x != null && b.t - a.t < 0.3) { const r = (t - a.t) / (b.t - a.t); return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r }; }
    return a;
  }
  function redrawTeacher() {
    if (!board || !ensureCanvases()) return;
    const ctx = tCanvas.getContext('2d'), W = tCanvas.width;
    ctx.clearRect(0, 0, tCanvas.width, tCanvas.height);
    if (play && play.mode === 'topic' && play.follow) {
      const t = play.clock.currentTime;
      renderItems(ctx, play.itemsBySlide[curId()] || [], t, W);
      drawDot(ctx, pointerAt(play.pointerBySlide[curId()], t), W);
      return;
    }
    if (play && play.mode === 'slide' && play.slide === curId()) { renderItems(ctx, play.items, play.t, W); return; }
    if (AUTHOR || showTeacher) visibleStrokes(curId()).forEach(s => drawStroke(ctx, s, W));
    if (AUTHOR) drawDot(ctx, livePointer, W);
  }
  function requestRedraw() {
    if (redrawQueued) return;
    redrawQueued = true;
    requestAnimationFrame(() => { redrawQueued = false; redrawTeacher(); });
  }

  /* ── 作成モードの入力 ─────────────────────────────────────────────────── */
  function toNorm(e) {
    const r = aCanvas.getBoundingClientRect();
    const ar = aCanvas.height / aCanvas.width;
    return { x: r4((e.clientX - r.left) / r.width), y: r4((e.clientY - r.top) / r.height * ar) };
  }
  function setPointer(pt) { livePointer = pt; logPointer(pt); requestRedraw(); }
  function bindAuthorInput() {
    const c = aCanvas;
    c.addEventListener('pointerdown', e => {
      if (e.pointerType === 'pen') penSeen = true;
      if (tool === 'none') return;
      if (e.pointerType === 'touch' && penSeen) return;        // Pencil 使用時は指で書かない（スワイプ用）
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();                  // ページ側の Pencil 自動描画に渡さない
      try { c.setPointerCapture(e.pointerId); } catch (err) {}
      const pt = toNorm(e);
      if (tool === 'pointer') { drawing = { pointer: true }; setPointer(pt); return; }
      if (tool === 'eraser') { drawing = { eraser: true }; eraseAt(pt); return; }
      const hl = tool === 'highlight';
      const st = { id: newId(), color, size: hl ? 9 : 3, alpha: hl ? 0.3 : 1, t0: Date.now(), pts: [[pt.x, pt.y, 0]] };
      drawing = { st, ts0: e.timeStamp };
      slideData(curId()).strokes.push(st);
      logTopic('stroke', { slide: curId(), id: st.id });
      requestRedraw();
    });
    c.addEventListener('pointermove', e => {
      if (tool === 'pointer') {
        if (e.pointerType === 'mouse' || e.pointerType === 'pen' || drawing) { e.stopPropagation(); setPointer(toNorm(e)); }
        return;
      }
      if (!drawing) return;
      e.preventDefault(); e.stopPropagation();
      const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
      for (const ev of (evs.length ? evs : [e])) {
        const pt = toNorm(ev);
        if (drawing.eraser) { eraseAt(pt); continue; }
        const p = drawing.st.pts, last = p[p.length - 1];
        if (Math.hypot(pt.x - last[0], pt.y - last[1]) < 0.0008) continue;
        p.push([pt.x, pt.y, Math.max(0, Math.round(ev.timeStamp - drawing.ts0))]);
      }
      requestRedraw();
    });
    const end = e => {
      if (drawing || tool === 'pointer') e.stopPropagation();
      if (tool === 'pointer' && e.pointerType !== 'mouse') setPointer(null);
      if (drawing && drawing.st) saveAuthor();
      drawing = null; updateUI();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', () => { if (tool === 'pointer' && livePointer) setPointer(null); });
  }
  const hits = (st, pt) => st.pts.some(p => Math.hypot(p[0] - pt.x, p[1] - pt.y) < 0.01);
  function authorErase(ids) {
    if (!ids.length) return;
    slideData(curId()).erases.push({ t0: Date.now(), ids });
    logTopic('erase', { slide: curId(), ids });
    saveAuthor(); requestRedraw(); updateUI();
  }
  const eraseAt = pt => authorErase(visibleStrokes(curId()).filter(s => hits(s, pt)).map(s => s.id));
  function undo() { const v = visibleStrokes(curId()); if (v.length) authorErase([v[v.length - 1].id]); }
  function clearSlide() { authorErase(visibleStrokes(curId()).map(s => s.id)); }
  function setTool(t) {
    if (tool === 'pointer' && t !== 'pointer' && livePointer) setPointer(null);
    tool = t;
    if (aCanvas) aCanvas.classList.toggle('off', t === 'none');
    document.querySelectorAll('#sbAuthor [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  }
  function setColor(c) { color = c; document.querySelectorAll('#sbAuthor .sb-sw').forEach(b => b.classList.toggle('on', b.dataset.c === c)); }

  /* ── 記録（作成モード）─────────────────────────────────────────────────── */
  function recClock() {
    if (!rec) return 0;
    const now = rec.pausedAt != null ? rec.pausedAt : performance.now();
    return (now - rec.startPerf - rec.pausedTotal) / 1000;
  }
  function logTopic(type, obj) {
    if (!rec) return;
    const ev = { t: Math.round(recClock() * 1000) / 1000, type, ...obj };
    if (type === 'stroke' && rec.pausedAt != null) ev.instant = true;   // 一時停止中に書いた線は一瞬で出す
    rec.topic.events.push(ev);
  }
  function logPointer(pt) {   // 約 25fps に間引く。null = ポインターを消した
    if (!rec || rec.pausedAt != null) return;
    const t = recClock();
    if (pt) {
      if (t - lastPtrLog.t < 0.04) return;
      if (lastPtrLog.x != null && Math.hypot(pt.x - lastPtrLog.x, pt.y - lastPtrLog.y) < 0.001) return;
      lastPtrLog = { t, x: pt.x, y: pt.y };
      logTopic('pointer', { slide: curId(), x: pt.x, y: pt.y });
    } else if (lastPtrLog.x != null) {
      lastPtrLog = { t, x: null, y: null };
      logTopic('pointer', { slide: curId(), x: null, y: null });
    }
  }
  async function recStart() {
    if (rec) return;
    stopPlayback();
    const useMic = $('sbMic').checked;
    let stream = null, mr = null, type = null, ext = null;
    if (useMic) {
      if (!navigator.mediaDevices || !window.MediaRecorder) { status('このブラウザは録音できません（🎤をオフにすると音声なしで記録できます）'); return; }
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } }); }
      catch (e) { status('マイクを使えませんでした（許可を確認するか、🎤をオフに）'); return; }
      const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
      mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      type = mr.mimeType || mime || 'audio/webm';
      ext = type.includes('mp4') ? 'm4a' : 'webm';
    }
    const name = $('sbTopicName').value.trim() || sectionTitle(cur()) || 'トピック';
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const safeId = curId().replace(/[^\w-]/g, '_');
    const topic = { name, startSlide: curId(), audio: mr ? `${A.deck}-${safeId}-${stamp}.${ext}` : null, mime: type,
                    duration: 0, events: [{ t: 0, type: 'slide', id: curId() }] };
    rec = { mr, stream, chunks: [], startPerf: performance.now(), pausedAt: null, pausedTotal: 0, topic };
    lastPtrLog = { t: -1, x: null, y: null };
    if (mr) { mr.ondataavailable = e => { if (e.data && e.data.size && rec) rec.chunks.push(e.data); }; mr.start(1000); }
    if (livePointer) logPointer(livePointer);
    status(`記録中：「${name}」` + (mr ? `（音声 ${ext}）` : '（音声なし）'));
    updateUI(); tickRec();
  }
  function recPause() {
    if (!rec) return;
    if (rec.pausedAt == null) {
      if (livePointer) logPointer(null);
      if (rec.mr) rec.mr.pause();
      rec.pausedAt = performance.now();
      status('一時停止中（この間に書いた線は再生時に一瞬で現れます）');
    } else {
      rec.pausedTotal += performance.now() - rec.pausedAt; rec.pausedAt = null;
      if (rec.mr) rec.mr.resume();
      status(`記録中：「${rec.topic.name}」`);
      if (livePointer) logPointer(livePointer);
    }
    updateUI();
  }
  function recStop() {
    if (!rec) return;
    if (livePointer) logPointer(null);
    const r = rec;
    r.topic.duration = Math.round(recClock() * 1000) / 1000;
    rec = null;
    const finish = () => {
      board.topics.push(r.topic); saveAuthor();
      status(`「${r.topic.name}」を保存（${fmt(r.topic.duration)}）` + (r.mr ? '。音声はまだメモリ上だけなので ⬇ で書き出してください' : '（音声なし）'));
      updateUI();
    };
    if (r.mr) {
      r.mr.onstop = () => {
        const blob = new Blob(r.chunks, { type: r.topic.mime });
        audioBlobs[r.topic.audio] = blob;
        audioURLs[r.topic.audio] = URL.createObjectURL(blob);
        r.stream.getTracks().forEach(t => t.stop());
        finish();
      };
      if (r.mr.state === 'paused') r.mr.resume();
      r.mr.stop();
    } else finish();
    updateUI();
  }
  function tickRec() { if (!rec) return; const el = $('sbRecTime'); if (el) el.textContent = fmt(recClock()); setTimeout(tickRec, 250); }

  /* ── 再生 ─────────────────────────────────────────────────────────────── */
  // 音声なしの記録・スライド単位の再生で使う時計（<audio> と同じ使い方）
  class Clock {
    constructor(duration) { this.duration = duration; this._t = 0; this._last = 0; this.paused = true; this.playbackRate = 1; }
    get currentTime() {
      if (!this.paused) {
        const now = performance.now();
        this._t = Math.min(this.duration, this._t + (now - this._last) / 1000 * this.playbackRate); this._last = now;
        if (this._t >= this.duration) this.paused = true;
      }
      return this._t;
    }
    set currentTime(v) { this._t = Math.max(0, Math.min(this.duration, v)); this._last = performance.now(); }
    play() { if (this._t >= this.duration) this._t = 0; this.paused = false; this._last = performance.now(); return Promise.resolve(); }
    pause() { void this.currentTime; this.paused = true; }
    addEventListener() {}
  }
  const speed = () => parseFloat($('sbSpeed').value) || 1;

  function buildSlideItems(id) {
    const d = board.slides[id]; if (!d) return null;
    const raw = [
      ...d.strokes.map(s => ({ real: s.t0, end: s.t0 + (s.pts[s.pts.length - 1][2] || 0), stroke: s })),
      ...d.erases.map(e => ({ real: e.t0, end: e.t0, erase: e.ids })),
    ].sort((a, b) => a.real - b.real);
    if (!raw.length) return null;
    let vEnd = 0.3, prevEnd = raw[0].real; const items = [];
    for (const r of raw) {
      let gap = Math.max(0, (r.real - prevEnd) / 1000);
      if (gap > GAP_MAX) gap = GAP_TO;
      const start = vEnd + gap;
      items.push(r.stroke ? { t: start, stroke: r.stroke } : { t: start, erase: r.erase });
      vEnd = start + (r.end - r.real) / 1000;
      prevEnd = Math.max(prevEnd, r.end);
    }
    return { items, duration: vEnd + 0.5 };
  }
  function playSlide() {
    if (rec) return;
    stopPlayback();
    const b = buildSlideItems(curId());
    if (!b) { status('このスライドには先生の板書がありません'); return; }
    const clock = new Clock(b.duration); clock.playbackRate = speed();
    play = { mode: 'slide', slide: curId(), items: b.items, clock, duration: b.duration, get t() { return this.clock.currentTime; } };
    clock.play(); showPlayer('このスライドの板書'); loop();
  }
  function playTopic(ti) {
    if (rec) return;
    stopPlayback();
    const topic = board.topics[ti];
    const byId = {};
    for (const d of Object.values(board.slides)) for (const s of d.strokes) byId[s.id] = s;
    const itemsBySlide = {}, pointerBySlide = {}, animBySlide = {}, revealBySlide = {};
    const push = (m, k, v) => (m[k] || (m[k] = [])).push(v);
    for (const ev of topic.events) {
      if (ev.type === 'stroke' && byId[ev.id]) push(itemsBySlide, ev.slide, { t: ev.t, stroke: byId[ev.id], instant: !!ev.instant });
      else if (ev.type === 'erase') push(itemsBySlide, ev.slide, { t: ev.t, erase: ev.ids });
      else if (ev.type === 'anim') push(animBySlide, ev.slide, ev);
      else if (ev.type === 'reveal') push(revealBySlide, ev.slide, ev);
      else if (ev.type === 'pointer') push(pointerBySlide, ev.slide, { t: ev.t, x: ev.x, y: ev.y });
      else if (ev.type === 'slide') for (const arr of Object.values(pointerBySlide))   // ページを移ったら前のページのポインターは消す
        if (arr.length && arr[arr.length - 1].x != null) arr.push({ t: ev.t, x: null, y: null });
    }
    let clock;
    if (topic.audio) {
      clock = new Audio(audioURLs[topic.audio] || new URL(topic.audio, new URL(A.boardUrl || `board/${A.deck}.board.json`, location.href)).href);
      clock.addEventListener('loadedmetadata', () => {
        if (isFinite(clock.duration)) { if (play && play.clock === clock) play.duration = clock.duration; }
        else {   // MediaRecorder 製の webm は長さ不明のことがあるので、末尾へシークして確定させる
          clock.currentTime = 1e101;
          clock.addEventListener('timeupdate', function fix() { clock.removeEventListener('timeupdate', fix); clock.currentTime = 0; });
        }
      });
      clock.addEventListener('error', () => status(`音声「${topic.audio}」が見つかりません`));
    } else clock = new Clock(topic.duration);
    clock.playbackRate = speed();
    play = { mode: 'topic', topic, clock, itemsBySlide, pointerBySlide, animBySlide, revealBySlide, follow: true, duration: topic.duration };
    clock.play().catch(() => status('再生を開始できませんでした'));
    showPlayer(topic.name + (topic.audio ? '' : '（音声なし）'));
    loop();
  }
  function slideAtTopic(t) {
    let id = play.topic.startSlide;
    for (const ev of play.topic.events) { if (ev.t > t) break; if (ev.type === 'slide') id = ev.id; }
    return id;
  }
  // 時刻 t の空欄・アニメ図の状態をページに反映（記録で操作したものだけ。毎フレーム呼んでよい）
  function applyPageState(t) {
    const root = A.getSlideRoot ? A.getSlideRoot() : $('slideContent');
    if (!root) return;
    const rv = play.revealBySlide[curId()];
    if (rv) {
      const ph = root.querySelectorAll('.phantom'), on = new Map();
      for (const ev of rv) { if (ev.t > t) break; on.set(ev.index, !!ev.on); }
      for (const i of new Set(rv.map(e => e.index))) if (ph[i]) ph[i].classList.toggle('revealed', !!on.get(i));
    }
    const an = play.animBySlide[curId()];
    if (an) {
      const figs = root.querySelectorAll('.tikz-figure.anim'), last = new Map();
      for (const ev of an) { if (ev.t > t) break; last.set(ev.fig, ev); }
      for (const i of new Set(an.map(e => e.fig))) {
        const f = figs[i]; if (!f || !f._anim) continue;   // SVG の読み込み待ち → 次のフレームで反映
        const ev = last.get(i);
        let x = ev ? ev.at + (ev.action === 'play' ? t - ev.t : 0) : 0;
        if (f._anim.dur) x = f._anim.loop ? x % f._anim.dur : Math.min(x, f._anim.dur);
        f._anim.show(x);
      }
    }
  }
  function bindPageEvents() {   // 記録中のページ操作（アニメ図・空欄）
    document.addEventListener('animctrl', e => {
      const d = e.detail || {};
      if (rec && !navByBoard) logTopic('anim', { slide: curId(), fig: d.fig, action: d.action, at: d.at });
    });
    document.addEventListener('phantomctrl', e => {
      const d = e.detail || {};
      if (rec && !navByBoard) logTopic('reveal', { slide: curId(), index: d.index, on: !!d.revealed });
    });
  }
  function loop() {
    if (!play) return;
    const t = play.clock.currentTime;
    if (play.mode === 'topic' && play.follow) {
      const idx = indexOfId(slideAtTopic(t));
      if (idx >= 0 && idx !== cur()) go(idx);
      applyPageState(t);
    }
    redrawTeacher();
    $('sbPlay').textContent = play.clock.paused ? '▶' : '⏸';
    if (!seeking) $('sbSeek').value = play.duration ? Math.round(t / play.duration * 1000) : 0;
    $('sbTime').textContent = `${fmt(t)} / ${fmt(play.duration)}`;
    play.raf = requestAnimationFrame(loop);
  }
  function showPlayer(title) {
    $('sbTitle').textContent = title; $('sbBack').classList.remove('show'); $('sbPlayer').classList.add('show');
    document.body.classList.add('sb-playing');   // 再生中はトピックボタンを隠す（再生バーと重なるため）
  }
  function stopPlayback() {
    if (!play) return;
    cancelAnimationFrame(play.raf);
    play.clock.pause();
    play = null;
    $('sbPlayer').classList.remove('show');
    document.body.classList.remove('sb-playing');
    redrawTeacher();
  }

  /* ── ページ側との連携 ─────────────────────────────────────────────────── */
  function onSlideShown() {
    const i = cur();
    if (i !== lastIdx) {
      lastIdx = i;
      livePointer = null;
      if (!navByBoard && play) {
        if (play.mode === 'topic') { if (play.follow) { play.clock.pause(); play.follow = false; $('sbBack').classList.add('show'); } }
        else stopPlayback();
      }
      logTopic('slide', { id: curId() });
      if (rec) lastPtrLog = { t: -1, x: null, y: null };
    }
    updateUI(); requestRedraw();
  }
  function hookPage() {
    const h = Object.assign({ redraw: 'redrawStrokes', show: 'showSlide' }, A.hooks || {});
    const wrap = (name, after) => {
      const orig = window[name];
      if (typeof orig !== 'function') { console.warn('[slide-board] ' + name + ' が見つかりません'); return; }
      window[name] = function () { const r = orig.apply(this, arguments); after(); return r; };
    };
    wrap(h.redraw, redrawTeacher);   // canvas のサイズ変更に追従
    wrap(h.show, onSlideShown);
    window.addEventListener('resize', () => setTimeout(redrawTeacher, 80));
  }

  /* ── 書き出し・読み込み ───────────────────────────────────────────────── */
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function exportBoard() {
    download(new Blob([JSON.stringify(board)], { type: 'application/json' }), `${A.deck}.board.json`);
    const names = Object.keys(audioBlobs);
    names.forEach((n, i) => setTimeout(() => download(audioBlobs[n], n), 600 * (i + 1)));
    status(`書き出し：${A.deck}.board.json` + (names.length ? ` ＋ 音声 ${names.length} 件（board/ に置いてください）` : ''));
  }
  async function importFiles(files) {
    let n = 0;
    for (const f of files) {
      if (/\.json$/i.test(f.name) || f.type === 'application/json') {
        try {
          const b = JSON.parse(await f.text());
          if (!validBoard(b)) throw new Error('形式が違います');
          b.topics = b.topics || []; board = b; saveAuthor(); n++;
        } catch (err) { status(`${f.name} を読めませんでした：${err.message}`); return; }
      } else { audioURLs[f.name] = URL.createObjectURL(f); n++; }
    }
    stopPlayback(); updateUI(); redrawTeacher();
    status(`${n} 件を読み込みました`);
  }
  function deleteTopic(i) {
    const tp = board.topics[i];
    if (!confirm(`トピック「${tp.name}」の記録を削除しますか？（板書の線は残ります）`)) return;
    board.topics.splice(i, 1); saveAuthor(); updateUI();
  }

  /* ── UI ───────────────────────────────────────────────────────────────── */
  let toastTimer = null;
  function status(msg) {
    const el = $('sbStatus'); if (el) el.textContent = msg;
    const t = $('sbToast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  }
  function injectStyles() {
    const css = `
      body.live-fixed .zoom-layer { width:${REF_W}px !important; min-width:${REF_W}px; max-width:${REF_W}px !important; }
      .sb-teacher { position:absolute; top:0; left:0; width:100%; height:100%; z-index:9; pointer-events:none; }
      .sb-author { position:absolute; top:0; left:0; width:100%; height:100%; z-index:12; touch-action:none; cursor:crosshair; }
      .sb-author.off { pointer-events:none; }
      #sbShowBtn.on { background:var(--accent, #e94560); color:#fff; }
      #sbTopics { position:fixed; left:16px; bottom:16px; z-index:9000; display:flex; flex-direction:column; gap:6px; max-width:calc(100vw - 100px); }
      #sbTopics .sb-topic { display:flex; gap:4px; }
      body.sb-playing #sbTopics { display:none; }
      #sbTopics button { font:inherit; font-size:14px; padding:9px 14px; border:none; border-radius:10px; cursor:pointer;
        background:var(--accent, #e94560); color:#fff; box-shadow:0 3px 12px rgba(0,0,0,.25); text-align:left; }
      #sbTopics button.del { background:#6b7280; padding:9px 11px; }
      #sbPlayer { position:fixed; left:50%; bottom:16px; transform:translateX(-50%); z-index:9001; display:none;
        align-items:center; gap:8px; background:rgba(26,26,46,.94); color:#fff; border-radius:12px; padding:7px 12px;
        font-size:13px; box-shadow:0 6px 24px rgba(0,0,0,.3); max-width:calc(100vw - 24px); }
      #sbPlayer.show { display:flex; }
      #sbPlayer button, #sbPlayer select { font:inherit; background:transparent; color:#fff; border:1px solid rgba(255,255,255,.35);
        border-radius:6px; padding:3px 9px; cursor:pointer; }
      #sbPlayer select option { color:#000; }
      #sbSeek { width:min(320px, 34vw); accent-color:var(--accent, #e94560); }
      #sbTime { font-variant-numeric:tabular-nums; white-space:nowrap; }
      #sbTitle { max-width:11em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:.85; }
      #sbBack { display:none; background:var(--accent, #e94560) !important; border-color:transparent !important; }
      #sbBack.show { display:inline-block; }
      #sbAuthor { position:fixed; right:12px; z-index:9002; display:flex; flex-wrap:wrap; align-items:center; gap:5px;
        max-width:min(560px, calc(100vw - 24px)); padding:8px 10px; border-radius:12px; font-size:13px;
        background:rgba(26,26,46,.95); color:#fff; box-shadow:0 6px 24px rgba(0,0,0,.3); }
      #sbAuthor button, #sbAuthor label.b, #sbAuthor input[type=text] { font:inherit; background:rgba(255,255,255,.1); color:#fff;
        border:1px solid rgba(255,255,255,.25); border-radius:6px; padding:4px 8px; cursor:pointer; }
      #sbAuthor input[type=text] { width:8.5em; cursor:text; }
      #sbAuthor input[type=text]::placeholder { color:rgba(255,255,255,.5); }
      #sbAuthor button.on { background:#fff; color:#1a1a2e; }
      #sbAuthor button:disabled { opacity:.35; cursor:default; }
      #sbAuthor .sb-sw { width:20px; height:20px; padding:0; border-radius:50%; border:2px solid rgba(255,255,255,.4); }
      #sbAuthor .sb-sw.on { border-color:#fff; outline:2px solid #fff; }
      #sbAuthor .tag { font-weight:700; color:#fca5a5; margin-right:2px; }
      #sbAuthor .sep { width:100%; height:0; }
      #sbRec.rec { background:#dc2626 !important; border-color:#dc2626 !important; animation:sbBlink 1.2s infinite; }
      @keyframes sbBlink { 50% { opacity:.55; } }
      #sbRecTime { font-variant-numeric:tabular-nums; min-width:3.2em; }
      #sbStatus { width:100%; font-size:11.5px; color:#cbd5e1; min-height:1em; }
      #sbAuthor.min > :not(.keep) { display:none !important; }
      #sbToast { position:fixed; left:50%; top:70px; transform:translateX(-50%); z-index:9003; background:rgba(26,26,46,.92); color:#fff;
        padding:8px 14px; border-radius:8px; font-size:13px; opacity:0; pointer-events:none; transition:opacity .2s; max-width:90vw; }
      #sbToast.show { opacity:1; }
      body.print-mode .sb-teacher, body.print-mode .sb-author, body.print-mode #sbTopics, body.print-mode #sbPlayer,
      body.print-mode #sbAuthor, body.print-mode #sbShowBtn, body.print-mode #sbReplayBtn { display:none !important; }
      @media print { .sb-teacher, .sb-author, #sbTopics, #sbPlayer, #sbAuthor, #sbToast { display:none !important; } }
    `;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  }
  function injectUI() {
    const add = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); const el = d.firstChild; document.body.appendChild(el); return el; };
    add('<div id="sbToast"></div>');
    add('<div id="sbTopics"></div>');
    add(`<div id="sbPlayer">
      <button id="sbPlay">⏸</button><span id="sbTitle"></span>
      <input type="range" id="sbSeek" min="0" max="1000" value="0"><span id="sbTime">0:00 / 0:00</span>
      <select id="sbSpeed"><option value="1">1x</option><option value="1.5">1.5x</option><option value="2">2x</option><option value="4">4x</option></select>
      <button id="sbBack" title="再生中の位置（スライド）に戻って再開">⏎ 再生位置に戻る</button>
      <button id="sbClose" title="再生を終了">✕</button></div>`);

    const nav = document.querySelector('.topbar-nav');
    if (nav && !AUTHOR) {
      const b1 = document.createElement('button');
      b1.className = 'nav-btn'; b1.id = 'sbShowBtn'; b1.title = '先生の板書を表示 (T)'; b1.textContent = '👁';
      b1.onclick = toggleShow;
      const b2 = document.createElement('button');
      b2.className = 'nav-btn'; b2.id = 'sbReplayBtn'; b2.title = 'このスライドの板書を書き順どおりに再生'; b2.textContent = '▶✍';
      b2.onclick = playSlide;
      nav.appendChild(b1); nav.appendChild(b2);
    }

    if (AUTHOR) {
      const p = add(`<div id="sbAuthor">
        <span class="tag keep">板書作成</span>
        <button data-tool="pen" title="ペン">✏️</button><button data-tool="highlight" title="蛍光ペン">🖍</button>
        <button data-tool="eraser" title="消しゴム（線ごと）">🧽</button><button data-tool="pointer" title="ポインター（記録中は動きも記録）">🔴</button>
        <button data-tool="none" title="ページ側を操作（先生のペンを止める）">👆</button>
        ${COLORS.map(c => `<button class="sb-sw" data-c="${c}" style="background:${c}"></button>`).join('')}
        <button id="sbUndo" title="取り消し">↶</button><button id="sbClear" title="このスライドの板書を全消去">🗑</button>
        <span class="sep"></span>
        <input type="text" id="sbTopicName" placeholder="トピック名（空ならセクション名）">
        <label class="b" title="オフにすると音声なし（板書・ポインター・ページ送りのみ）"><input type="checkbox" id="sbMic" checked> 🎤</label>
        <button id="sbRec" class="keep" title="このスライドから記録を開始">● 記録</button>
        <button id="sbPause" class="keep" title="一時停止／再開。停止中に書いた線は再生時に一瞬で現れる">⏸</button>
        <button id="sbStop" class="keep" title="記録を停止">■</button>
        <span id="sbRecTime" class="keep">0:00</span>
        <span class="sep"></span>
        <button id="sbReplay" title="このスライドの板書を書き順どおりに再生">▶✍</button>
        <button id="sbExport" title="board JSON と音声を書き出し">⬇ 書き出し</button>
        <label class="b" title="board JSON・音声ファイルを読み込み（複数選択可）">⬆ 読込<input type="file" id="sbImport" multiple accept=".json,application/json,audio/*" hidden></label>
        <button id="sbReset" title="作成中の板書とトピックをすべて消去">リセット</button>
        <button id="sbMin" class="keep" title="パネルを折りたたむ">－</button>
        <div id="sbStatus"></div></div>`);
      p.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
      p.querySelectorAll('.sb-sw').forEach(b => b.onclick = () => setColor(b.dataset.c));
      $('sbUndo').onclick = undo; $('sbClear').onclick = clearSlide;
      $('sbRec').onclick = recStart; $('sbPause').onclick = recPause; $('sbStop').onclick = recStop;
      $('sbReplay').onclick = playSlide; $('sbExport').onclick = exportBoard;
      $('sbImport').onchange = e => { importFiles([...e.target.files]); e.target.value = ''; };
      $('sbReset').onclick = () => {
        if (!confirm('作成中の板書とトピックをすべて消去します。よろしいですか？\n（必要なら先に ⬇ で書き出してください）')) return;
        board = emptyBoard(); ls.del(keyAuthor()); stopPlayback(); updateUI(); redrawTeacher(); status('リセットしました');
      };
      $('sbMin').onclick = () => { const m = p.classList.toggle('min'); $('sbMin').textContent = m ? '＋' : '－'; };
      const place = () => { const tb = document.querySelector('.topbar'); p.style.top = ((tb ? tb.getBoundingClientRect().bottom : 0) + 8) + 'px'; };
      place(); window.addEventListener('resize', place);
      setTool('pen'); setColor(COLORS[2]);
    }

    $('sbPlay').onclick = () => {
      if (!play) return;
      if (play.clock.paused) {
        if (play.mode === 'topic') { play.follow = true; $('sbBack').classList.remove('show'); }
        play.clock.play();
      } else play.clock.pause();
    };
    $('sbBack').onclick = () => { if (!play) return; play.follow = true; $('sbBack').classList.remove('show'); play.clock.play(); };
    $('sbClose').onclick = stopPlayback;
    $('sbSpeed').onchange = () => { if (play) play.clock.playbackRate = speed(); };
    $('sbSeek').addEventListener('input', () => {
      if (!play) return; seeking = true;
      play.clock.currentTime = $('sbSeek').value / 1000 * play.duration;
      if (play.mode === 'topic') { play.follow = true; $('sbBack').classList.remove('show'); }
    });
    $('sbSeek').addEventListener('change', () => { seeking = false; });

    document.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === 't' || e.key === 'T') && !AUTHOR && hasAnyBoard()) toggleShow();
    });
  }
  function toggleShow() { showTeacher = !showTeacher; ls.set(keyShow(), showTeacher ? '1' : '0'); updateUI(); redrawTeacher(); }
  function updateUI() {
    if (!board) return;
    const any = hasAnyBoard();
    const here = !!(board.slides[curId()] && visibleStrokes(curId()).length);
    const b1 = $('sbShowBtn'), b2 = $('sbReplayBtn');
    if (b1) { b1.style.display = any ? '' : 'none'; b1.classList.toggle('on', showTeacher); }
    if (b2) { b2.style.display = any ? '' : 'none'; b2.disabled = !here; b2.style.opacity = here ? '' : '0.35'; }
    if (AUTHOR) {
      $('sbReplay').disabled = !here || !!rec;
      $('sbRec').disabled = !!rec; $('sbRec').classList.toggle('rec', !!rec && rec.pausedAt == null);
      $('sbPause').disabled = !rec; $('sbPause').textContent = rec && rec.pausedAt != null ? '▶' : '⏸';
      $('sbStop').disabled = !rec; $('sbMic').disabled = !!rec;
      if (!rec) $('sbRecTime').textContent = '0:00';
    }
    const box = $('sbTopics'); box.innerHTML = '';
    if (rec) return;
    board.topics.forEach((tp, i) => {
      if (tp.startSlide !== curId()) return;
      const row = document.createElement('div'); row.className = 'sb-topic';
      const b = document.createElement('button');
      b.textContent = `▶ このトピックを再生：${tp.name}（${fmt(tp.duration)}${tp.audio ? '' : '・音声なし'}）`;
      b.onclick = () => playTopic(i);
      row.appendChild(b);
      if (AUTHOR) { const d = document.createElement('button'); d.className = 'del'; d.title = 'この記録を削除'; d.textContent = '✕'; d.onclick = () => deleteTopic(i); row.appendChild(d); }
      box.appendChild(row);
    });
  }

  /* ── 初期化 ───────────────────────────────────────────────────────────── */
  SB.init = async function (adapterArg) {
    A = adapterArg;
    if (!A || !A.getCanvas || !A.getCurrent || !A.showSlide || !A.getSlideCount) { console.warn('[slide-board] adapter が不足しています'); return; }
    A.deck = A.deck || location.pathname.split('/').pop().replace(/\.html?$/, '') || 'deck';
    injectStyles();
    if (A.fixedLayout !== false) installFixedLayout();
    showTeacher = ls.get(keyShow()) !== '0';
    let src;
    [board, src] = await loadBoard();
    board.topics = board.topics || [];
    if (A.getSlideId && count() && !A.getSlideId(0)) console.warn('[slide-board] スライド ID が無いので番号で記録します（スライドの挿入・削除で板書がずれます）');
    injectUI();
    hookPage();
    bindPageEvents();
    lastIdx = cur();
    updateUI(); redrawTeacher();
    if (AUTHOR) status('板書作成モード' + (src ? `（${src} を読み込み）` : '') + '。録音はトピック扉スライドから');
  };
  SB.isAuthor = () => AUTHOR;
  SB.getBoard = () => board;
  SB.stop = stopPlayback;

  window.SlideBoard = SB;
})();
