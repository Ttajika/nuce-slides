/* ════════════════════════════════════════════════════════════════════════
   slide-live.js — ライブ配信（presenter → viewer）＋ PC 側録画モジュール

   Supabase Realtime の Broadcast / Presence を使う（DB 書き込みなし）。
   slide-sync.js（ログイン・Supabase クライアント）を先に読み込んでおくこと。

   URL パラメータで役割を切り替える（付けなければ何も表示されない）:
     ?presenter=1[&live=CODE]   配信側（iPad）。要ログイン。CODE 省略時は "1"
     ?live=CODE                 受信側（学生・PC）。presenter と同じ CODE
     ?live=CODE&rec=1           受信側 ＋ 録画ボタン（PC 用）

   各スライド HTML からは、SlideSync.init の後に SlideLive.init(adapter) を呼ぶ:
     SlideLive.init({
       pageKey,          // ページ固有キー（slide-sync.js の storageKey と同じでよい）
       getCanvas,        // () => 手書き canvas
       getBoardCanvas,   // () => 板書 canvas
       getCurrent,       // () => 現在のスライド番号
       showSlide,        // (i) => スライドを表示
       getStrokes,       // () => 現在スライドの手書きストローク配列（描画中のものを含む）
       getBoardStrokes,  // () => 現在スライドの板書ストローク配列（描画中のものを含む）
       getPointer,       // () => ポインター位置 {x,y} | null
       isBoardOpen,      // () => 板書ポップアップが開いているか
       setBoardOpen,     // (on) => 板書ポップアップを開閉
       getMedia,         // 任意: () => 開いている動画/埋め込みの識別子（URL or 'tpl:ID'）| null
       setMedia,         // 任意: (u) => 同じものを開く / null で閉じる
                         //   省略時は #videoOverlay / #videoContainer iframe を読む既定実装を使う
       hooks,            // 任意: { redraw:'redrawStrokes', redrawBoard:'redrawBoardStrokes' }
     });
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── 設定 ────────────────────────────────────────────────────────────────
  const CONFIG = {
    // 配信を許可するログイン ID（slide-sync.js のログイン ID。@ より前の部分）。
    // 空配列のままだと「ログイン済みなら誰でも配信可」になるので、必ず自分の ID を入れること。
    presenterIds: ['tajika.tomoya'],
    // Supabase 側で realtime.messages に RLS を設定したら true にする（なりすまし防止）
    privateChannel: false,
    tickMs: 60,          // presenter の差分送信間隔
    fullEveryMs: 8000,   // presenter の全体スナップショット送信間隔
    recBitrate: 2000000, // 録画ビットレート (bps)
    recMaxMin: 240,      // 録画の最大時間（分）— 止め忘れ保険
    recAutoStopSec: 120, // 配信終了後、録画を自動停止するまでの秒数
  };

  const SL = {};
  let adapter = null;
  let params = new URLSearchParams(location.search);
  let role = null;          // 'presenter' | 'viewer' | null
  let code = params.get('live') || '1';
  let wantRec = params.has('rec');
  let ch = null;
  let sb = null;
  const myId = Math.random().toString(36).slice(2, 10);

  // ── 共通ユーティリティ ───────────────────────────────────────────────────
  const r4 = v => Math.round(v * 10000) / 10000;
  function normPt(p, c) { return [r4(p.x / c.width), r4(p.y / c.height)]; }
  function normStroke(s, c) {
    return { c: s.color, w: s.size, a: s.alpha || 1, p: s.points.map(pt => normPt(pt, c)) };
  }
  function channelName() { return 'live:' + adapter.pageKey + ':' + code; }
  function send(payload) {
    if (!ch) return;
    try { ch.send({ type: 'broadcast', event: 'm', payload }); } catch (e) { console.warn('[slide-live] send', e); }
  }
  function $(id) { return document.getElementById(id); }

  // ── 動画・埋め込み（video overlay）の既定アダプタ ─────────────────────────
  //   #videoOverlay.open の中の iframe を見る。srcdoc テンプレートは data-tpl で識別。
  function defaultGetMedia() {
    const ov = $('videoOverlay');
    if (!ov || !ov.classList.contains('open')) return null;
    const f = ov.querySelector('iframe');
    if (!f) return null;
    if (f.dataset.tpl) return 'tpl:' + f.dataset.tpl;
    return f.getAttribute('src') || null;
  }
  function defaultSetMedia(u) {
    const ov = $('videoOverlay'), vc = $('videoContainer');
    if (!ov || !vc) return;
    if (!u) {
      if (typeof window.closeVideo === 'function') window.closeVideo();
      else { ov.classList.remove('open'); vc.innerHTML = ''; }
      return;
    }
    if (defaultGetMedia() === u) return;
    vc.innerHTML = '';
    const f = document.createElement('iframe');
    f.setAttribute('allow', 'autoplay; fullscreen'); f.setAttribute('allowfullscreen', '');
    if (u.startsWith('tpl:')) {
      const tpl = $(u.slice(4));
      if (!tpl) return;
      f.srcdoc = tpl.innerHTML; f.dataset.tpl = u.slice(4);
      vc.classList.add('embed');
    } else {
      f.src = u;
      vc.classList.toggle('embed', !/player\.vimeo\.com|youtube\.com\/embed/.test(u));
    }
    vc.appendChild(f);
    ov.classList.add('open');
  }
  function getMedia() { return adapter.getMedia ? adapter.getMedia() : defaultGetMedia(); }
  function setMedia(u) { return adapter.setMedia ? adapter.setMedia(u) : defaultSetMedia(u); }

  function injectStyles() {
    const css = `
      #slBadge { font-size:11px; color:#fde68a; white-space:nowrap; margin:0 2px; }
      #slBadge.on { color:#86efac; }
      #slBadge.off { color:#9ca3af; }
      #slPresBtn.live { background:#16a34a; border-color:#16a34a; }
      #slRecBtn.rec { background:#dc2626; border-color:#dc2626; animation: slBlink 1.2s infinite; }
      @keyframes slBlink { 50% { opacity:.55; } }
      .sl-overlay { display:none; position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.5);
        align-items:center; justify-content:center; }
      .sl-overlay.open { display:flex; }
      .sl-modal { background:#fff; color:#1f2937; border-radius:12px; padding:22px;
        width:min(400px,92vw); box-shadow:0 20px 50px rgba(0,0,0,.3); font-size:14px; line-height:1.6; }
      .sl-modal h3 { margin:0 0 12px; font-size:16px; }
      .sl-modal .url { font-family:monospace; font-size:12px; word-break:break-all; background:#f3f4f6;
        padding:8px; border-radius:6px; user-select:all; }
      .sl-modal .qr { text-align:center; margin:12px 0; }
      .sl-modal .qr img, .sl-modal .qr svg { max-width:100%; height:auto; }
      .sl-btns { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; }
      .sl-modal button { flex:1; padding:9px 12px; font-size:14px; border-radius:8px; cursor:pointer;
        border:1px solid #d1d5db; background:#f3f4f6; color:#1f2937; min-width:120px; }
      .sl-modal button.primary { background:#dc2626; color:#fff; border-color:#dc2626; }
      .sl-modal button.blue { background:#1d4ed8; color:#fff; border-color:#1d4ed8; }
      .sl-note { font-size:11.5px; color:#6b7280; margin-top:8px; }
      .sl-banner { position:fixed; left:50%; top:64px; transform:translateX(-50%); z-index:9998;
        background:#dc2626; color:#fff; padding:12px 18px; border-radius:10px; font-size:14px;
        box-shadow:0 8px 30px rgba(0,0,0,.35); display:none; align-items:center; gap:12px; }
      .sl-banner.show { display:flex; }
      .sl-banner button { padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,.5);
        background:rgba(255,255,255,.15); color:#fff; cursor:pointer; font-size:13px; }
      .sl-meter { height:8px; background:#e5e7eb; border-radius:4px; overflow:hidden; margin:6px 0 2px; }
      .sl-meter div { height:100%; width:0; background:linear-gradient(90deg,#16a34a,#facc15 70%,#dc2626); transition:width .08s; }
      .live-canvas { position:absolute; top:0; left:0; width:100%; height:100%; z-index:11; pointer-events:none; }
    `;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ── 接続（presenter / viewer 共通）──────────────────────────────────────
  let onPresenceCb = null;
  function connect(myRole, onSubscribed) {
    sb = window.SlideSync && SlideSync.client();
    if (!sb) { console.warn('[slide-live] Supabase 未設定'); return false; }
    const cfg = { broadcast: { self: false, ack: false }, presence: { key: myId } };
    if (CONFIG.privateChannel) cfg.private = true;
    ch = sb.channel(channelName(), { config: cfg });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => onMessage(payload));
    ch.on('presence', { event: 'sync' }, () => { if (onPresenceCb) onPresenceCb(presenceSummary()); });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try { await ch.track({ role: myRole }); } catch (e) { console.warn('[slide-live] track', e); }
        if (onSubscribed) onSubscribed();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[slide-live] channel', status);
        if (onPresenceCb) onPresenceCb({ error: status });
      }
    });
    return true;
  }
  function disconnect() {
    if (ch && sb) { try { ch.untrack(); sb.removeChannel(ch); } catch (e) {} }
    ch = null;
  }
  function presenceSummary() {
    const out = { presenter: false, viewers: 0 };
    if (!ch) return out;
    const st = ch.presenceState();
    Object.values(st).forEach(metas => metas.forEach(m => {
      if (m.role === 'presenter') out.presenter = true;
      else if (m.role === 'viewer') out.viewers++;
    }));
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PRESENTER
  // ═══════════════════════════════════════════════════════════════════════
  let live = false;
  let timer = null;
  let pendingStart = false;
  let sent = null;
  let lastHelloFull = 0;

  function resetSent() {
    sent = { i: -1, refs: [], lastLen: 0, brefs: [], blastLen: 0, boardOpen: null, ptr: null, media: null, lastFull: 0 };
  }

  function isAllowed() {
    const id = SlideSync.loginId();
    if (!id) return false;
    return CONFIG.presenterIds.length === 0 || CONFIG.presenterIds.includes(id);
  }

  function presenterStart() {
    if (live) return;
    if (!SlideSync.isConfigured || !SlideSync.isConfigured()) { alert('クラウド同期（Supabase）が設定されていないため配信できません。'); return; }
    if (!SlideSync.user()) { pendingStart = true; SlideSync.openModal(); return; }
    if (!isAllowed()) { alert('このアカウントには配信権限がありません。'); return; }
    resetSent();
    if (!connect('presenter', () => { sendFull(); })) return;
    live = true;
    timer = setInterval(tick, CONFIG.tickMs);
    updatePresBtn();
  }
  function presenterStop() {
    if (!live) return;
    send({ t: 'end' });
    clearInterval(timer); timer = null;
    live = false;
    // 'end' が届くまで少し待ってから切断
    setTimeout(disconnect, 300);
    updatePresBtn();
  }
  SL.presenterStart = presenterStart;
  SL.presenterStop = presenterStop;

  function updatePresBtn(p) {
    const b = $('slPresBtn'); if (!b) return;
    b.classList.toggle('live', live);
    b.textContent = live ? ('📡 配信中' + (p ? ' (' + p.viewers + ')' : '')) : '📡 配信';
    b.title = live ? 'クリックで配信停止' : '配信を開始（要ログイン）';
  }

  function sendFull() {
    const i = adapter.getCurrent();
    const c = adapter.getCanvas();
    const bc = adapter.getBoardCanvas && adapter.getBoardCanvas();
    if (!c || !c.width || !c.height) return;
    const s = adapter.getStrokes() || [];
    const bo = !!(adapter.isBoardOpen && adapter.isBoardOpen());
    const bl = (bo && bc && bc.width) ? (adapter.getBoardStrokes() || []) : [];
    const p = adapter.getPointer();
    const msg = {
      t: 'full', i,
      s: s.map(x => normStroke(x, c)),
      bo,
      b: bl.map(x => normStroke(x, bc)),
      p: p ? normPt(p, c) : null,
      m: getMedia(),
    };
    send(msg);
    sent.i = i;
    sent.refs = s.slice(); sent.lastLen = s.length ? s[s.length - 1].points.length : 0;
    sent.brefs = bl.slice(); sent.blastLen = bl.length ? bl[bl.length - 1].points.length : 0;
    sent.boardOpen = bo;
    sent.ptr = msg.p;
    sent.media = msg.m;
    sent.lastFull = Date.now();
  }

  // list の変化を差分で送る。戻り値は commit 用 {refs,lastLen}
  function diffList(kind, i, list, refs, lastLen, c) {
    const n = list.length;
    if (n === refs.length) {
      let same = true;
      for (let k = 0; k < n; k++) if (list[k] !== refs[k]) { same = false; break; }
      if (same) {
        if (n > 0 && list[n - 1].points.length > lastLen) {
          send({ t: 'pts', k: kind, i, n: n - 1, p: list[n - 1].points.slice(lastLen).map(pt => normPt(pt, c)) });
          return { refs, lastLen: list[n - 1].points.length };
        }
        return null;  // 変化なし
      }
    } else if (n === refs.length + 1) {
      let same = true;
      for (let k = 0; k < n - 1; k++) if (list[k] !== refs[k]) { same = false; break; }
      if (same) {
        send({ t: 'stroke', k: kind, i, s: normStroke(list[n - 1], c) });
        return { refs: list.slice(), lastLen: list[n - 1].points.length };
      }
    }
    // それ以外（消去・取消・全消去など）は全体を送る
    send({ t: 'list', k: kind, i, l: list.map(x => normStroke(x, c)) });
    return { refs: list.slice(), lastLen: n ? list[n - 1].points.length : 0 };
  }

  function tick() {
    if (!live || !ch) return;
    const now = Date.now();
    const i = adapter.getCurrent();
    if (i !== sent.i || now - sent.lastFull > CONFIG.fullEveryMs) { sendFull(); return; }
    const c = adapter.getCanvas();
    if (!c || !c.width) return;

    // 手書き
    let r = diffList('s', i, adapter.getStrokes() || [], sent.refs, sent.lastLen, c);
    if (r) { sent.refs = r.refs; sent.lastLen = r.lastLen; }

    // 板書
    const bo = !!(adapter.isBoardOpen && adapter.isBoardOpen());
    if (bo !== sent.boardOpen) {
      sent.boardOpen = bo;
      send({ t: 'board', on: bo });
      sent.brefs = []; sent.blastLen = 0;
    }
    if (bo) {
      const bc = adapter.getBoardCanvas && adapter.getBoardCanvas();
      if (bc && bc.width) {
        r = diffList('b', i, adapter.getBoardStrokes() || [], sent.brefs, sent.blastLen, bc);
        if (r) { sent.brefs = r.refs; sent.blastLen = r.lastLen; }
      }
    }

    // ポインター
    const p = adapter.getPointer();
    const pn = p ? normPt(p, c) : null;
    const changed = (!!pn !== !!sent.ptr) || (pn && (pn[0] !== sent.ptr[0] || pn[1] !== sent.ptr[1]));
    if (changed) { sent.ptr = pn; send({ t: 'ptr', p: pn }); }

    // 動画・埋め込み
    const m = getMedia();
    if (m !== sent.media) { sent.media = m; send({ t: 'media', u: m }); }
  }

  function injectPresenterUI() {
    const nav = document.querySelector('.topbar-nav');
    if (!nav) return;
    const btn = document.createElement('button');
    btn.className = 'nav-btn'; btn.id = 'slPresBtn'; btn.style.fontSize = '11px';
    btn.onclick = () => {
      if (live) { if (confirm('配信を停止しますか？')) presenterStop(); }
      else presenterStart();
    };
    const qr = document.createElement('button');
    qr.className = 'nav-btn'; qr.id = 'slQrBtn'; qr.style.fontSize = '11px';
    qr.textContent = '📱'; qr.title = '受信用 URL / QR を表示';
    qr.onclick = showViewerUrl;
    nav.appendChild(btn); nav.appendChild(qr);
    updatePresBtn();

    onPresenceCb = (p) => { if (live) updatePresBtn(p); };
    SlideSync.onAuth && SlideSync.onAuth(u => {
      if (u && pendingStart) { pendingStart = false; presenterStart(); }
      if (!u && live) presenterStop();
    });
    window.addEventListener('pagehide', () => { if (live) send({ t: 'end' }); });
  }

  function viewerUrl(withRec) {
    return location.origin + location.pathname + '?live=' + encodeURIComponent(code) + (withRec ? '&rec=1' : '');
  }
  function showViewerUrl() {
    let ov = $('slUrlOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'sl-overlay'; ov.id = 'slUrlOverlay';
      ov.onclick = (e) => { if (e.target === ov) ov.classList.remove('open'); };
      document.body.appendChild(ov);
    }
    const url = viewerUrl(false);
    let qrHtml = '';
    if (typeof qrcode === 'function') {
      try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qrHtml = q.createSvgTag({ cellSize: 4, margin: 2 }); } catch (e) {}
    }
    ov.innerHTML = `
      <div class="sl-modal">
        <h3>📡 受信用 URL（学生・録画 PC 向け）</h3>
        <div class="url">${url}</div>
        <div class="qr">${qrHtml}</div>
        <div class="sl-note">録画 PC では末尾に <code>&amp;rec=1</code> を付けると録画ボタンが出ます。</div>
        <div class="sl-btns"><button onclick="document.getElementById('slUrlOverlay').classList.remove('open')">閉じる</button></div>
      </div>`;
    ov.classList.add('open');
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  VIEWER
  // ═══════════════════════════════════════════════════════════════════════
  const L = { i: -1, s: {}, b: {}, bo: false, p: null, m: null, ended: false, presenter: false };
  let following = true;
  let liveCanvas = null, liveBoardCanvas = null;

  function onMessage(m) {
    if (role === 'presenter') {
      if (m.t === 'hello' && live) {
        const now = Date.now();
        if (now - lastHelloFull > 500) { lastHelloFull = now; sendFull(); }
      }
      return;
    }
    // viewer
    switch (m.t) {
      case 'full':
        L.i = m.i; L.s[m.i] = m.s; L.bo = m.bo; L.b[m.i] = m.b; L.p = m.p; L.ended = false;
        if ('m' in m) L.m = m.m;
        applySlide(); applyBoard(); applyMedia(); redrawLive(); redrawLiveBoard();
        setBadge();
        break;
      case 'list': {
        const store = m.k === 'b' ? L.b : L.s;
        store[m.i] = m.l;
        m.k === 'b' ? redrawLiveBoard() : redrawLive();
        break;
      }
      case 'stroke': {
        const store = m.k === 'b' ? L.b : L.s;
        (store[m.i] = store[m.i] || []).push(m.s);
        m.k === 'b' ? redrawLiveBoard() : redrawLive();
        break;
      }
      case 'pts': {
        const store = m.k === 'b' ? L.b : L.s;
        const arr = store[m.i];
        if (arr && arr[m.n]) { arr[m.n].p.push(...m.p); m.k === 'b' ? redrawLiveBoard() : redrawLive(); }
        else send({ t: 'hello' });   // 取りこぼし → 全体を要求
        break;
      }
      case 'ptr':
        L.p = m.p; redrawLive(); break;
      case 'board':
        L.bo = m.on; applyBoard(); break;
      case 'media':
        L.m = m.u; applyMedia(); break;
      case 'end':
        L.ended = true; L.p = null; redrawLive(); setBadge();
        recOnPresenterGone();
        break;
    }
  }

  function applySlide() {
    if (!following || L.i < 0) return;
    if (adapter.getCurrent() !== L.i) adapter.showSlide(L.i);
  }
  function applyBoard() {
    if (!following || !adapter.setBoardOpen) return;
    adapter.setBoardOpen(!!L.bo);
    setTimeout(redrawLiveBoard, 80);
  }
  function applyMedia() {
    if (!following) return;
    try { setMedia(L.m); } catch (e) { console.warn('[slide-live] setMedia', e); }
  }

  function ensureOverlays() {
    const c = adapter.getCanvas();
    if (c && !liveCanvas) {
      liveCanvas = document.createElement('canvas');
      liveCanvas.className = 'live-canvas'; liveCanvas.id = 'liveCanvas';
      c.parentElement.appendChild(liveCanvas);
    }
    const bc = adapter.getBoardCanvas && adapter.getBoardCanvas();
    if (bc && !liveBoardCanvas) {
      liveBoardCanvas = document.createElement('canvas');
      liveBoardCanvas.className = 'live-canvas'; liveBoardCanvas.id = 'liveBoardCanvas';
      liveBoardCanvas.style.width = '100%'; liveBoardCanvas.style.height = '100%';
      bc.parentElement.appendChild(liveBoardCanvas);
    }
  }

  function drawList(ctx, list, W, H) {
    (list || []).forEach(s => {
      if (!s.p || s.p.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalAlpha = s.a || 1;
      ctx.moveTo(s.p[0][0] * W, s.p[0][1] * H);
      for (let k = 1; k < s.p.length; k++) ctx.lineTo(s.p[k][0] * W, s.p[k][1] * H);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  function redrawLive() {
    if (role !== 'viewer') return;
    ensureOverlays();
    const c = adapter.getCanvas();
    if (!c || !liveCanvas) return;
    if (liveCanvas.width !== c.width || liveCanvas.height !== c.height) {
      liveCanvas.width = c.width; liveCanvas.height = c.height;
    }
    const ctx = liveCanvas.getContext('2d');
    ctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
    const W = liveCanvas.width, H = liveCanvas.height;
    drawList(ctx, L.s[adapter.getCurrent()], W, H);
    if (L.p && adapter.getCurrent() === L.i) {
      const x = L.p[0] * W, y = L.p[1] * H;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fillStyle = 'rgba(233,69,96,0.7)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    }
  }
  function redrawLiveBoard() {
    if (role !== 'viewer') return;
    ensureOverlays();
    const bc = adapter.getBoardCanvas && adapter.getBoardCanvas();
    if (!bc || !liveBoardCanvas || !bc.width) return;
    if (liveBoardCanvas.width !== bc.width || liveBoardCanvas.height !== bc.height) {
      liveBoardCanvas.width = bc.width; liveBoardCanvas.height = bc.height;
    }
    const ctx = liveBoardCanvas.getContext('2d');
    ctx.clearRect(0, 0, liveBoardCanvas.width, liveBoardCanvas.height);
    drawList(ctx, L.b[adapter.getCurrent()], liveBoardCanvas.width, liveBoardCanvas.height);
  }

  // 既存の再描画関数の後に live レイヤーも描き直す（canvas のサイズ変更に追従するため）
  function hookRedraws() {
    const h = Object.assign({ redraw: 'redrawStrokes', redrawBoard: 'redrawBoardStrokes' }, adapter.hooks || {});
    const wrap = (name, after) => {
      const orig = window[name];
      if (typeof orig !== 'function') return;
      window[name] = function () { const r = orig.apply(this, arguments); after(); return r; };
    };
    wrap(h.redraw, redrawLive);
    wrap(h.redrawBoard, redrawLiveBoard);
    window.addEventListener('resize', () => { setTimeout(() => { redrawLive(); redrawLiveBoard(); }, 60); });
  }

  function setBadge(p) {
    const b = $('slBadge'); if (!b) return;
    const f = $('slFollowBtn');
    if (p) L.presenter = p.presenter;
    let text, cls;
    if (p && p.error) { text = '接続エラー'; cls = ''; }
    else if (L.ended || (!L.presenter && L.i < 0)) { text = L.ended ? '配信終了' : '配信待ち'; cls = 'off'; }
    else if (!L.presenter) { text = '配信者オフライン'; cls = 'off'; }
    else { text = following ? '配信中・追従' : '配信中'; cls = 'on'; }
    b.textContent = '📡 ' + text;
    b.className = cls;
    if (f) f.textContent = following ? '追従解除' : '追従する';
  }

  function injectViewerUI() {
    const nav = document.querySelector('.topbar-nav');
    if (!nav) return;
    const b = document.createElement('span'); b.id = 'slBadge';
    const f = document.createElement('button');
    f.className = 'nav-btn'; f.id = 'slFollowBtn'; f.style.fontSize = '11px';
    f.title = '配信者のページ送りに追従する / しない';
    f.onclick = () => {
      following = !following;
      if (following) { applySlide(); applyBoard(); applyMedia(); }
      setBadge();
    };
    nav.appendChild(b); nav.appendChild(f);
    setBadge();
    onPresenceCb = (p) => {
      const was = L.presenter;
      setBadge(p);
      if (was && p && !p.presenter && !p.error) recOnPresenterGone();
      if (!was && p && p.presenter) { recCancelAutoStop(); send({ t: 'hello' }); }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  RECORDER（?rec=1 の viewer のみ）
  // ═══════════════════════════════════════════════════════════════════════
  let rec = null, recChunks = [], recStart = 0, recTimer = null, recWritable = null, recFileHandle = null;
  let recStreams = [], recAudioCtx = null, recAutoTimer = null, recMaxTimer = null, recMicLabel = '';

  function recFileName() {
    const d = new Date();
    const z = n => String(n).padStart(2, '0');
    const base = location.pathname.split('/').pop().replace(/\.html?$/, '') || 'slides';
    return `${base}_${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}.webm`;
  }

  function injectRecUI() {
    const nav = document.querySelector('.topbar-nav');
    if (!nav || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) {
      console.warn('[slide-live] このブラウザは画面録画に対応していません');
      return;
    }
    const btn = document.createElement('button');
    btn.className = 'nav-btn'; btn.id = 'slRecBtn'; btn.style.fontSize = '11px';
    btn.textContent = '🔴 録画'; btn.title = 'このタブを録画（PC 用）';
    btn.onclick = () => { if (rec) { if (confirm('録画を停止して保存しますか？')) recStop(); } else openRecDialog(); };
    nav.appendChild(btn);

    const banner = document.createElement('div');
    banner.className = 'sl-banner'; banner.id = 'slRecBanner';
    document.body.appendChild(banner);

    window.addEventListener('beforeunload', (e) => {
      if (rec) { e.preventDefault(); e.returnValue = '録画中です。このまま閉じると録画が失われます。'; }
    });
  }

  function openRecDialog() {
    let ov = $('slRecOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'sl-overlay'; ov.id = 'slRecOverlay';
      document.body.appendChild(ov);
    }
    const canPick = !!window.showSaveFilePicker;
    ov.innerHTML = `
      <div class="sl-modal">
        <h3>🔴 録画の開始</h3>
        <p style="margin:0 0 6px">次の画面で<strong>「このタブ」</strong>を選んでください（タブの音声共有も ON にすると動画の音が入ります）。マイク音声も同時に録音します。</p>
        <div style="margin:10px 0 4px;font-size:13px">🎤 マイク：
          <select id="slMicSel" style="max-width:100%;font-size:13px;padding:4px 6px;border:1px solid #d1d5db;border-radius:6px"></select>
        </div>
        <div class="sl-meter"><div id="slMicLevel"></div></div>
        <div id="slMicStatus" class="sl-note">マイクを確認中…</div>
        <div id="slRecFileStatus" class="sl-note">${canPick ? '保存先：未選択（終了時にダウンロード。長時間の場合は保存先の指定を推奨）' : '保存先：終了時にダウンロード'}</div>
        <div class="sl-btns">
          ${canPick ? '<button id="slRecPickBtn">📁 保存先を指定</button>' : ''}
          <button class="primary" id="slRecGoBtn">▶ 録画開始</button>
          <button id="slRecCancelBtn">キャンセル</button>
        </div>
        <div class="sl-note">止め忘れ防止：配信が終了すると ${CONFIG.recAutoStopSec} 秒後に自動停止、最長 ${CONFIG.recMaxMin} 分で自動停止します。</div>
      </div>`;
    ov.classList.add('open');
    recFileHandle = null;
    if (canPick) $('slRecPickBtn').onclick = async () => {
      try {
        recFileHandle = await window.showSaveFilePicker({ suggestedName: recFileName(),
          types: [{ description: 'WebM video', accept: { 'video/webm': ['.webm'] } }] });
        $('slRecFileStatus').textContent = '保存先：' + recFileHandle.name + '（録画中に逐次書き込み）';
      } catch (e) { /* キャンセル */ }
    };
    $('slRecCancelBtn').onclick = () => { ov.classList.remove('open'); stopMicPreview(); };
    $('slRecGoBtn').onclick = async () => { ov.classList.remove('open'); stopMicPreview(); await recBegin(); };
    $('slMicSel').onchange = () => { try { localStorage.setItem('slMicId', $('slMicSel').value); } catch (e) {} startMicPreview(); };
    populateMics().then(startMicPreview);
  }

  // ── マイク選択・レベルメーター ───────────────────────────────────────────
  let micPrev = null, micPrevCtx = null, micPrevRaf = null;
  function micConstraint() {
    const sel = $('slMicSel');
    const id = sel ? sel.value : (localStorage.getItem('slMicId') || '');
    if (id === 'none') return null;
    const audio = { echoCancellation: false, noiseSuppression: true };
    if (id && id !== 'default') audio.deviceId = { exact: id };
    return audio;
  }
  async function populateMics() {
    const sel = $('slMicSel'); if (!sel) return;
    let saved = ''; try { saved = localStorage.getItem('slMicId') || ''; } catch (e) {}
    // ラベル取得のため一度権限を要求（拒否されていれば失敗し、下で案内を出す）
    try { const t = await navigator.mediaDevices.getUserMedia({ audio: true }); t.getTracks().forEach(x => x.stop()); }
    catch (e) { micError(e); }
    let devs = [];
    try { devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'); } catch (e) {}
    sel.innerHTML = '';
    const add = (v, label) => { const o = document.createElement('option'); o.value = v; o.textContent = label; sel.appendChild(o); };
    add('default', '既定のマイク（OS の設定）');
    devs.forEach((d, k) => { if (d.deviceId && d.deviceId !== 'default') add(d.deviceId, d.label || ('マイク ' + (k + 1))); });
    add('none', 'マイクなし（タブの音声のみ）');
    if (saved && [...sel.options].some(o => o.value === saved)) sel.value = saved;
  }
  function micError(e) {
    const st = $('slMicStatus'); if (!st) return;
    const n = e && e.name;
    let msg = 'マイクを取得できません（' + (n || e) + '）。';
    if (n === 'NotAllowedError') msg += ' ブラウザのアドレスバー左の 🔒 → マイクを「許可」にし、OS のプライバシー設定でもブラウザにマイクを許可してください。';
    else if (n === 'NotFoundError') msg += ' マイクが見つかりません。接続を確認してください。';
    else if (n === 'NotReadableError') msg += ' 他のアプリ（Zoom 等）がマイクを占有している可能性があります。';
    st.textContent = msg; st.style.color = '#dc2626';
  }
  async function startMicPreview() {
    stopMicPreview();
    const st = $('slMicStatus'), bar = $('slMicLevel');
    const c = micConstraint();
    if (!c) { if (st) { st.textContent = 'マイクなしで録画します（タブの音声のみ）。'; st.style.color = ''; } if (bar) bar.style.width = '0'; return; }
    try {
      micPrev = await navigator.mediaDevices.getUserMedia({ audio: c });
      const label = micPrev.getAudioTracks()[0].label || '';
      if (st) { st.textContent = '使用中：' + label + ' — 話してみて、バーが動けば OK'; st.style.color = '#16a34a'; }
      micPrevCtx = new (window.AudioContext || window.webkitAudioContext)();
      const an = micPrevCtx.createAnalyser(); an.fftSize = 512;
      micPrevCtx.createMediaStreamSource(micPrev).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0; for (let k = 0; k < buf.length; k++) { const v = (buf[k] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        if (bar) bar.style.width = Math.min(100, rms * 400) + '%';
        micPrevRaf = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) { micError(e); }
  }
  function stopMicPreview() {
    if (micPrevRaf) cancelAnimationFrame(micPrevRaf); micPrevRaf = null;
    if (micPrev) micPrev.getTracks().forEach(t => t.stop()); micPrev = null;
    if (micPrevCtx) { try { micPrevCtx.close(); } catch (e) {} micPrevCtx = null; }
  }

  async function recBegin() {
    let display;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 }, audio: true,
        preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'exclude',
      });
    } catch (e) { console.warn('[slide-live] getDisplayMedia', e); return; }
    let mic = null;
    const mc = micConstraint();
    if (mc) {
      try { mic = await navigator.mediaDevices.getUserMedia({ audio: mc }); }
      catch (e) { console.warn('[slide-live] mic', e); showBanner('⚠ マイクを取得できなかったため、マイク音声なしで録画しています。'); }
    }

    const tracks = [display.getVideoTracks()[0]];
    recStreams = [display]; if (mic) recStreams.push(mic);
    try {
      recAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = recAudioCtx.createMediaStreamDestination();
      let has = false;
      if (display.getAudioTracks().length) { recAudioCtx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(dest); has = true; }
      if (mic) { recAudioCtx.createMediaStreamSource(mic).connect(dest); has = true; }
      if (has) tracks.push(dest.stream.getAudioTracks()[0]);
    } catch (e) { console.warn('[slide-live] audio mix', e); if (mic) tracks.push(mic.getAudioTracks()[0]); }
    const stream = new MediaStream(tracks);

    recWritable = null;
    if (recFileHandle) {
      try { recWritable = await recFileHandle.createWritable(); } catch (e) { console.warn('[slide-live] writable', e); recWritable = null; }
    }
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      .find(m => MediaRecorder.isTypeSupported(m)) || '';
    try {
      rec = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: CONFIG.recBitrate }, mime ? { mimeType: mime } : {}));
    } catch (e) { alert('録画を開始できませんでした: ' + e.message); recCleanup(); return; }
    recChunks = [];
    let writeChain = Promise.resolve();
    rec.ondataavailable = (e) => {
      if (!e.data || !e.data.size) return;
      if (recWritable) writeChain = writeChain.then(() => recWritable.write(e.data)).catch(err => console.warn('[slide-live] write', err));
      else recChunks.push(e.data);
    };
    rec.onstop = async () => {
      if (recWritable) {
        try { await writeChain; await recWritable.close(); } catch (e) { console.warn('[slide-live] close', e); }
      } else if (recChunks.length) {
        const blob = new Blob(recChunks, { type: rec.mimeType || 'video/webm' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = recFileName();
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 10000);
      }
      recCleanup();
    };
    display.getVideoTracks()[0].onended = () => { if (rec) recStop(); };  // ブラウザ側の「共有を停止」
    rec.start(1000);
    recMicLabel = mic ? (mic.getAudioTracks()[0].label || 'マイク') : 'マイクなし';
    recStart = Date.now();
    recTimer = setInterval(updateRecBtn, 1000);
    recMaxTimer = setTimeout(() => { if (rec) { showBanner('最長録画時間に達したため停止しました。'); recStop(); } }, CONFIG.recMaxMin * 60000);
    updateRecBtn();
  }

  function recStop() {
    recCancelAutoStop();
    if (rec && rec.state !== 'inactive') rec.stop();
    else recCleanup();
  }
  function recCleanup() {
    recStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
    recStreams = [];
    if (recAudioCtx) { try { recAudioCtx.close(); } catch (e) {} recAudioCtx = null; }
    clearInterval(recTimer); recTimer = null;
    clearTimeout(recMaxTimer); recMaxTimer = null;
    rec = null; recChunks = []; recWritable = null; recFileHandle = null;
    updateRecBtn();
  }
  function updateRecBtn() {
    const b = $('slRecBtn'); if (!b) return;
    if (!rec) { b.textContent = '🔴 録画'; b.classList.remove('rec'); return; }
    const sec = Math.floor((Date.now() - recStart) / 1000);
    const z = n => String(n).padStart(2, '0');
    b.textContent = '⏹ ' + z(Math.floor(sec / 3600)) + ':' + z(Math.floor(sec / 60) % 60) + ':' + z(sec % 60);
    b.title = '録画中（音声：' + recMicLabel + '）— クリックで停止';
    b.classList.add('rec');
  }

  function showBanner(html, withButtons) {
    const bn = $('slRecBanner'); if (!bn) return;
    bn.innerHTML = html + (withButtons ? ' <button id="slRecStopNow">今すぐ停止</button><button id="slRecKeep">録画を続ける</button>' : '');
    bn.classList.add('show');
    if (withButtons) {
      $('slRecStopNow').onclick = () => { hideBanner(); recStop(); };
      $('slRecKeep').onclick = () => { recCancelAutoStop(); };
    } else setTimeout(hideBanner, 6000);
  }
  function hideBanner() { const bn = $('slRecBanner'); if (bn) bn.classList.remove('show'); }

  // 配信者がいなくなった → カウントダウン後に自動停止
  function recOnPresenterGone() {
    if (!rec || recAutoTimer) return;
    let left = CONFIG.recAutoStopSec;
    const render = () => showBanner(`配信が終了しました。<strong>${left} 秒後</strong>に録画を停止して保存します。`, true);
    render();
    recAutoTimer = setInterval(() => {
      left--;
      if (left <= 0) { recCancelAutoStop(); recStop(); return; }
      const bn = $('slRecBanner');
      if (bn && bn.classList.contains('show')) { const s = bn.querySelector('strong'); if (s) s.textContent = left + ' 秒後'; }
    }, 1000);
  }
  function recCancelAutoStop() {
    if (recAutoTimer) { clearInterval(recAutoTimer); recAutoTimer = null; }
    hideBanner();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════════════════
  SL.init = function (adapterArg) {
    adapter = adapterArg;
    if (params.has('presenter')) role = 'presenter';
    else if (params.has('live')) role = 'viewer';
    else return;   // 通常の学生表示：何もしない
    if (!window.SlideSync) { console.warn('[slide-live] slide-sync.js が必要です'); return; }
    injectStyles();
    if (role === 'presenter') {
      injectPresenterUI();
    } else {
      injectViewerUI();
      ensureOverlays();
      hookRedraws();
      if (wantRec) injectRecUI();
      if (!connect('viewer', () => { send({ t: 'hello' }); })) setBadge({ error: 'no-supabase' });
    }
  };
  SL.role = () => role;

  window.SlideLive = SL;
})();
