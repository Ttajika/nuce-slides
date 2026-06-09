/* ════════════════════════════════════════════════════════════════════════
   slide-sync.js — 講義スライド共通のログイン＋クラウド同期モジュール（Supabase）

   各スライドHTMLからは、以下を読み込んで SlideSync.init(adapter) を呼ぶだけ:

     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="slide-sync.js"></script>
     ...
     SlideSync.init({
       storageKey,            // localStorage と同じ、ページ固有のキー
       getCanvas,             // () => 手書き用 canvas 要素（座標正規化に使用）
       getState,              // () => { notes, strokes, boardStrokes, understanding, bookmarks, lastSlide }
       applyState,            // (state) => 受け取った state を画面の変数に反映（strokes はピクセル座標）
       saveLocal,             // (timestamp?) => localStorage へ保存（timestamp 指定時は再アップロードしない）
       refresh,               // () => メモ欄・スライドを再描画
     });

   ・認証は「ID＋パスワード」方式。実在メールは不要で、ID は内部的に
     "<id>@class.local" 形式へ変換する（個人情報を保存しないため）。
   ・データは行レベルセキュリティ付きの slide_data テーブルに本人分のみ保存。
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── 設定（ここを自分の Supabase プロジェクトの値に書き換える）─────────────
  //   url / anonKey は Supabase ダッシュボード → Settings → API で取得。
  //   anon public キーは公開して問題ないキー（データは RLS で保護される）。
  const CONFIG = {
    url:        'https://YOUR_PROJECT.supabase.co',
    anonKey:    'YOUR_ANON_PUBLIC_KEY',
    idDomain:   'class.local',   // ID をメール形式に変換する際のダミードメイン
  };

  const SS = {};
  let _supabase = null;
  let currentUser = null;
  let remoteSaveTimer = null;
  let syncing = false;
  let adapter = null;

  function isConfigured() {
    return CONFIG.url && CONFIG.anonKey &&
           !CONFIG.url.includes('YOUR_') && !CONFIG.anonKey.includes('YOUR_');
  }

  // 入力された ID をログイン用のメール形式へ変換（既に @ を含むならそのまま）
  function idToEmail(raw) {
    const v = (raw || '').trim();
    return v.includes('@') ? v : (v + '@' + CONFIG.idDomain);
  }

  // ── 手書き座標の正規化（端末ごとの画面差を吸収するため 0–1 で保存）──────────
  function normStrokes(src, cw, ch) {
    const out = {};
    for (const [k, arr] of Object.entries(src || {})) {
      out[k] = arr.map(s => ({ ...s, points: s.points.map(p => ({ x: p.x / cw, y: p.y / ch })) }));
    }
    return out;
  }
  function denormStrokes(src, cw, ch) {
    const out = {};
    for (const [k, arr] of Object.entries(src || {})) {
      out[k] = arr.map(s => ({
        ...s,
        points: s.points.map(p => ({ x: p.x <= 1.5 ? p.x * cw : p.x, y: p.y <= 1.5 ? p.y * ch : p.y })),
      }));
    }
    return out;
  }

  function canvasSize() {
    const c = adapter.getCanvas ? adapter.getCanvas() : null;
    return { cw: c ? c.width : 1, ch: c ? c.height : 1 };
  }

  // ── UI 注入 ────────────────────────────────────────────────────────────
  function injectStyles() {
    const css = `
      #ssSyncStatus { font-size:11px; color:#6b7280; margin:0 2px; white-space:nowrap; }
      #ssSyncStatus.synced { color:#16a34a; }
      #ssSyncStatus.saving { color:#d97706; }
      #ssSyncStatus.error  { color:#dc2626; }
      #ssAuthBtn.logged-in { color:#16a34a; }
      .ss-overlay { display:none; position:fixed; inset:0; z-index:9999;
        background:rgba(0,0,0,0.5); align-items:center; justify-content:center; }
      .ss-overlay.open { display:flex; }
      .ss-modal { background:#fff; color:#1f2937; border-radius:12px; padding:24px;
        width:min(360px,92vw); box-shadow:0 20px 50px rgba(0,0,0,0.3); font-size:14px; line-height:1.6; }
      .ss-modal h3 { margin:0 0 14px; font-size:16px; }
      .ss-modal label { display:block; font-size:12px; color:#6b7280; margin:10px 0 3px; }
      .ss-modal input { width:100%; box-sizing:border-box; padding:9px 11px; font-size:14px;
        border:1px solid #d1d5db; border-radius:8px; }
      .ss-btns { display:flex; gap:8px; margin-top:16px; }
      .ss-modal button { flex:1; padding:9px 12px; font-size:14px; border-radius:8px; cursor:pointer;
        border:1px solid #d1d5db; background:#f3f4f6; color:#1f2937; }
      .ss-modal button.primary { background:#1d4ed8; color:#fff; border-color:#1d4ed8; }
      .ss-msg { margin-top:12px; font-size:12.5px; min-height:1.2em; }
      .ss-msg.err { color:#dc2626; } .ss-msg.ok { color:#16a34a; }
      .ss-close { flex:none; margin-top:14px; width:100%; background:transparent; border:none; color:#6b7280; }
      .ss-note { font-size:11.5px; color:#9ca3af; margin-top:10px; }
      .ss-email { font-weight:600; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function injectButton() {
    const nav = document.querySelector('.topbar-nav');
    if (!nav) return;
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.id = 'ssAuthBtn';
    btn.title = 'ログイン / クラウド同期';
    btn.style.fontSize = '11px';
    btn.textContent = '🔑';
    btn.onclick = SS.openModal;
    const status = document.createElement('span');
    status.id = 'ssSyncStatus';
    status.title = '同期状態';
    nav.appendChild(btn);
    nav.appendChild(status);
  }

  function injectModal() {
    const div = document.createElement('div');
    div.className = 'ss-overlay';
    div.id = 'ssOverlay';
    div.innerHTML = `
      <div class="ss-modal">
        <div id="ssLoginView">
          <h3>🔑 ログイン</h3>
          <div style="font-size:12.5px;color:#6b7280;">ログインすると、メモ・手書き・理解度が他の端末とも同期されます。</div>
          <label for="ssId">ID（例: 学籍番号）</label>
          <input type="text" id="ssId" autocomplete="username" placeholder="a1234567">
          <label for="ssPw">パスワード</label>
          <input type="password" id="ssPw" autocomplete="current-password" placeholder="6文字以上">
          <div class="ss-btns">
            <button class="primary" id="ssLoginBtn">ログイン</button>
            <button id="ssSignupBtn">新規登録</button>
          </div>
          <div class="ss-msg" id="ssMsg"></div>
          <div class="ss-note">※ 氏名・本物のメールアドレスは入力しないでください。ID は自由に決められます。<br>
            ※ パスワードを忘れた場合は教員に連絡してリセットしてもらってください。</div>
          <button class="ss-close" id="ssCloseBtn">閉じる</button>
        </div>
        <div id="ssUserView" style="display:none;">
          <h3>🔑 ログイン中</h3>
          <div>ID: <span class="ss-email" id="ssUserId"></span></div>
          <div class="ss-msg" style="color:#6b7280;">この端末のデータはクラウドと同期されます。</div>
          <div class="ss-btns">
            <button id="ssSyncNowBtn">いま同期する</button>
            <button id="ssLogoutBtn">ログアウト</button>
          </div>
          <button class="ss-close" id="ssCloseBtn2">閉じる</button>
        </div>
      </div>`;
    document.body.appendChild(div);
    div.addEventListener('click', e => { if (e.target === div) SS.closeModal(); });
    document.getElementById('ssLoginBtn').onclick  = SS.login;
    document.getElementById('ssSignupBtn').onclick = SS.signup;
    document.getElementById('ssCloseBtn').onclick  = SS.closeModal;
    document.getElementById('ssCloseBtn2').onclick = SS.closeModal;
    document.getElementById('ssSyncNowBtn').onclick = () => syncFromRemote(true);
    document.getElementById('ssLogoutBtn').onclick  = SS.logout;
  }

  function setSyncStatus(state) {
    const el = document.getElementById('ssSyncStatus');
    if (!el) return;
    el.className = state || '';
    el.textContent = { saving: '同期中…', synced: '✓ 同期済み', error: '⚠ 同期エラー' }[state] || '';
  }
  function setMsg(text, kind) {
    const el = document.getElementById('ssMsg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'ss-msg' + (kind ? ' ' + kind : '');
  }
  function displayId(user) {
    const e = (user && user.email) || '';
    return e.endsWith('@' + CONFIG.idDomain) ? e.slice(0, -('@' + CONFIG.idDomain).length) : e;
  }
  function updateAuthUI() {
    const btn = document.getElementById('ssAuthBtn');
    if (btn) {
      btn.classList.toggle('logged-in', !!currentUser);
      btn.title = currentUser ? ('ログイン中: ' + displayId(currentUser)) : 'ログイン / クラウド同期';
    }
    const login = document.getElementById('ssLoginView');
    const userv = document.getElementById('ssUserView');
    if (login && userv) {
      login.style.display = currentUser ? 'none' : 'block';
      userv.style.display = currentUser ? 'block' : 'none';
      if (currentUser) document.getElementById('ssUserId').textContent = displayId(currentUser);
    }
  }

  // ── 認証アクション ──────────────────────────────────────────────────────
  SS.openModal = function () {
    if (!isConfigured()) {
      alert('クラウド同期はまだ設定されていません。\n\nslide-sync.js 冒頭の CONFIG に、Supabase の URL と anon key を設定してください。');
      return;
    }
    updateAuthUI();
    setMsg('');
    document.getElementById('ssOverlay').classList.add('open');
  };
  SS.closeModal = function () {
    const o = document.getElementById('ssOverlay');
    if (o) o.classList.remove('open');
  };
  SS.login = async function () {
    const id = document.getElementById('ssId').value;
    const pw = document.getElementById('ssPw').value;
    if (!id || !pw) { setMsg('ID とパスワードを入力してください。', 'err'); return; }
    setMsg('ログイン中…');
    const { error } = await _supabase.auth.signInWithPassword({ email: idToEmail(id), password: pw });
    if (error) { setMsg('ログイン失敗: ' + error.message, 'err'); return; }
    setMsg('ログインしました。', 'ok');
    setTimeout(SS.closeModal, 600);
  };
  SS.signup = async function () {
    const id = document.getElementById('ssId').value;
    const pw = document.getElementById('ssPw').value;
    if (!id || !pw) { setMsg('ID とパスワードを入力してください。', 'err'); return; }
    if (pw.length < 6) { setMsg('パスワードは6文字以上にしてください。', 'err'); return; }
    setMsg('登録中…');
    const { data, error } = await _supabase.auth.signUp({ email: idToEmail(id), password: pw });
    if (error) { setMsg('登録失敗: ' + error.message, 'err'); return; }
    if (data.session) { setMsg('登録してログインしました。', 'ok'); setTimeout(SS.closeModal, 600); }
    else { setMsg('登録しました。改めてログインしてください。', 'ok'); }
  };
  SS.logout = async function () {
    await _supabase.auth.signOut();
    setSyncStatus('');
    SS.closeModal();
  };

  // ── 同期コア ────────────────────────────────────────────────────────────
  async function syncFromRemote(force) {
    if (!_supabase || !currentUser || syncing) return;
    syncing = true;
    setSyncStatus('saving');
    try {
      const { data, error } = await _supabase
        .from('slide_data')
        .select('payload')
        .eq('user_id', currentUser.id)
        .eq('page_key', adapter.storageKey)
        .maybeSingle();
      if (error) throw error;

      const localRaw = localStorage.getItem(adapter.storageKey);
      const local = localRaw ? JSON.parse(localRaw) : null;
      const localTime = (local && local.updatedAt) || 0;
      const remote = data ? data.payload : null;
      const remoteTime = (remote && remote.updatedAt) || 0;

      if (remote && (force || remoteTime > localTime)) {
        applyRemote(remote);
        setSyncStatus('synced');
      } else if (local) {
        await pushRemoteNow();
      } else {
        setSyncStatus('synced');
      }
    } catch (e) {
      console.warn('[slide-sync] syncFromRemote', e);
      setSyncStatus('error');
    } finally {
      syncing = false;
    }
  }
  SS.syncFromRemote = syncFromRemote;

  function applyRemote(remote) {
    const { cw, ch } = canvasSize();
    adapter.applyState({
      notes: remote.notes,
      understanding: remote.understanding,
      bookmarks: remote.bookmarks,
      strokes: denormStrokes(remote.strokes, cw, ch),
      boardStrokes: denormStrokes(remote.boardStrokes, cw, ch),
      lastSlide: remote.lastSlide,
    });
    // クラウドの更新時刻で保存 → すぐに再アップロードされないようにする
    adapter.saveLocal(remote.updatedAt || Date.now());
    if (adapter.refresh) adapter.refresh();
  }

  SS.scheduleRemoteSave = function () {
    if (!_supabase || !currentUser) return;
    if (remoteSaveTimer) clearTimeout(remoteSaveTimer);
    remoteSaveTimer = setTimeout(pushRemoteNow, 2000);
  };

  async function pushRemoteNow() {
    if (!_supabase || !currentUser) return;
    setSyncStatus('saving');
    try {
      const { cw, ch } = canvasSize();
      const st = adapter.getState();
      const localRaw = localStorage.getItem(adapter.storageKey);
      const local = localRaw ? JSON.parse(localRaw) : {};
      const payload = {
        notes: st.notes,
        understanding: st.understanding,
        bookmarks: st.bookmarks,
        strokes: normStrokes(st.strokes, cw, ch),
        boardStrokes: normStrokes(st.boardStrokes, cw, ch),
        lastSlide: st.lastSlide,
        updatedAt: local.updatedAt || Date.now(),
      };
      const { error } = await _supabase.from('slide_data').upsert({
        user_id: currentUser.id,
        page_key: adapter.storageKey,
        payload,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,page_key' });
      if (error) throw error;
      setSyncStatus('synced');
    } catch (e) {
      console.warn('[slide-sync] pushRemoteNow', e);
      setSyncStatus('error');
    }
  }

  // ── 初期化 ──────────────────────────────────────────────────────────────
  SS.init = function (adapterArg) {
    adapter = adapterArg;
    injectStyles();
    injectModal();
    injectButton();
    if (!isConfigured() || !window.supabase) return;  // 未設定ならボタンだけ出して終了
    try {
      _supabase = window.supabase.createClient(CONFIG.url, CONFIG.anonKey);
    } catch (e) { console.warn('[slide-sync] init failed', e); return; }
    // 読み込み時(INITIAL_SESSION)とログイン/ログアウトの都度発火
    _supabase.auth.onAuthStateChange((event, session) => {
      currentUser = session ? session.user : null;
      updateAuthUI();
      if (currentUser) syncFromRemote();
      else setSyncStatus('');
    });
  };

  window.SlideSync = SS;
})();
