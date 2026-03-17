# HTML Slide Layout Template

This is the canonical layout for all generated HTML slide files. When building a new slide HTML, use this exact structure. Replace `{{TITLE}}`, `{{SECTIONS_JSON}}`, `{{MATHJAX_MACROS}}`, and `{{SLIDE_TEMPLATES}}` with lecture-specific content.

## Full HTML Skeleton

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>{{TITLE}}</title>
<script>
window.MathJax = {
  tex: {
    inlineMath: [['$', '$']],
    displayMath: [['\\[', '\\]'], ['$$', '$$']],
    macros: {
      {{MATHJAX_MACROS}}
    },
    processEscapes: false,
    tags: 'none',
    packages: {'[+]': ['mathtools']},
  },
  loader: {
    load: ['[tex]/mathtools'],
  },
  options: {
    skipHtmlTags: ['script','noscript','style','textarea','pre','code'],
  },
  startup: { typeset: false }
};
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js" async></script>
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
<style>
{{CSS — see CSS section below}}
</style>
</head>
<body class="slide-mode">

{{BODY — see Body Structure section below}}

<script>
{{JS — see JavaScript section below}}
</script>

{{SLIDE_TEMPLATES}}

</body>
</html>
```

---

## CSS

Use these exact CSS variables and styles. Do not change the design system.

```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Noto+Serif+JP:wght@400;700&family=JetBrains+Mono:wght@400&display=swap');

* { margin:0; padding:0; box-sizing:border-box; }

:root {
  --bg: #fafaf8;
  --surface: #ffffff;
  --border: #e2e2e0;
  --text: #1a1a1a;
  --text-dim: #6b7280;
  --accent: #1d4ed8;
  --accent-light: #eff6ff;
  --keyword: #dc2626;
  --keyword-bg: #fef2f2;
  --note-bg: #fffbeb;
  --note-border: #fbbf24;
  --phantom-bg: #e0e7ff;
  --tikz-bg: #f0fdf4;
  --tikz-border: #86efac;
  --header-bg: #1e293b;
}

body {
  font-family: 'Noto Sans JP', sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  line-height: 1.7;
}

/* ═══ SLIDE VIEW MODE ═══ */
body.slide-mode { height:100vh; overflow:hidden; display:flex; flex-direction:column; }

/* Top bar — dark header */
.topbar {
  display:flex; align-items:center; justify-content:space-between;
  padding:6px 16px;
  background: var(--header-bg); color:#fff;
  flex-shrink:0; z-index:100;
}
.topbar-title { font-weight:700; font-size:14px; letter-spacing:0.3px; }
.topbar-nav { display:flex; align-items:center; gap:6px; }
.nav-btn {
  background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);
  color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer;
  font-size:13px; font-family:inherit; transition:all 0.15s;
}
.nav-btn:hover { background:rgba(255,255,255,0.25); }
.page-info {
  font-size:13px; color:rgba(255,255,255,0.7);
  font-family:'JetBrains Mono',monospace; min-width:70px; text-align:center;
}
.section-select {
  background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);
  color:#fff; padding:4px 8px; border-radius:4px; font-size:12px;
  font-family:inherit; cursor:pointer; max-width:200px;
}
.section-select option { background:#1e293b; color:#fff; }

/* Main layout — slide + notes side by side */
.main { display:flex; flex:1; overflow:hidden; }

.slide-area {
  flex:1; display:flex; align-items:stretch; justify-content:center;
  overflow:auto; background:var(--bg); padding:24px 32px;
  position:relative;
}

/* Card-style slide content */
.slide-content {
  max-width:860px; width:100%;
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:8px;
  padding:28px 36px;
  box-shadow:0 1px 3px rgba(0,0,0,0.05);
  overflow:auto;
}
.slide-content .frame-title {
  font-size:20px; font-weight:700; color:var(--accent);
  border-bottom:2px solid var(--accent);
  padding-bottom:8px; margin-bottom:16px;
}
.slide-content .section-badge {
  font-size:11px; color:var(--text-dim); margin-bottom:4px;
  text-transform:uppercase; letter-spacing:0.5px;
}

/* Notes panel — warm yellow */
.notes-panel {
  width:300px; background:var(--note-bg);
  border-left:3px solid var(--note-border);
  display:flex; flex-direction:column; flex-shrink:0;
  transition:width 0.2s;
}
.notes-panel.collapsed { width:0; overflow:hidden; border-left:none; }
.notes-header {
  padding:8px 12px; background:rgba(251,191,36,0.15);
  border-bottom:1px solid var(--note-border);
  display:flex; align-items:center; justify-content:space-between;
}
.notes-header h3 { font-size:13px; font-weight:500; color:#92400e; }
.notes-textarea {
  flex:1; background:transparent; border:none; color:var(--text);
  font-family:'Noto Sans JP',sans-serif; font-size:14px; line-height:1.8;
  padding:12px; resize:none; outline:none;
}
.notes-textarea::placeholder { color:#d4a017; opacity:0.6; }

/* ═══ CONTENT STYLES ═══ */
.columns { display:flex; gap:24px; }
.column { flex:1; min-width:0; }

ul, ol { padding-left:1.5em; margin:0.3em 0; }
li { margin:0.4em 0; }
li.sub-item { list-style:none; margin-left:0.5em; color:var(--text); }
li.sub-item::before { content:''; }
li.spacer { list-style:none; height:0.8em; }
li.jarm-item { list-style:none; border-left:3px solid var(--accent); padding-left:8px; margin:8px 0; }
li.custom-label { list-style:none; }
li.custom-label .label { font-weight:500; margin-right:4px; }
ol.custom-enum { padding-left:1.5em; }

.keyword {
  color:var(--keyword); background:var(--keyword-bg);
  padding:1px 4px; border-radius:3px; font-weight:700;
}
.accent { color:var(--accent); }
.red { color:#9b2d86; }
strong.keyword { font-weight:700; }

a { color:var(--accent); text-decoration:underline; }
a:hover { color:#1e40af; }

/* QR links — tag-style buttons */
.qr-link {
  display:inline-flex; align-items:center; flex-wrap:wrap; gap:4px;
  background:var(--accent-light); padding:4px 10px; border-radius:4px;
  text-decoration:none; margin:4px 0; font-size:13px; cursor:pointer;
  color:var(--accent);
}
.qr-link:hover { background:#dbeafe; }
.qr-link .qr-img {
  display:none; width:100%; margin-top:6px; padding:4px;
  background:#fff; border-radius:4px;
}
.qr-link.qr-open .qr-img { display:block; }
.qr-link.qr-open { flex-direction:column; }

/* Video modal */
.video-overlay {
  display:none; position:fixed; inset:0; z-index:1000;
  background:rgba(0,0,0,0.9); align-items:center; justify-content:center;
  cursor:pointer;
}
.video-overlay.open { display:flex; }
.video-container { width:min(80vw, 800px); aspect-ratio:16/9; cursor:default; }
.video-container iframe { width:100%; height:100%; border:none; border-radius:8px; }
.video-close {
  position:fixed; top:16px; right:20px; z-index:1001;
  background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3);
  color:#fff; width:36px; height:36px; border-radius:50%;
  font-size:18px; cursor:pointer; display:none;
  align-items:center; justify-content:center;
}
.video-overlay.open ~ .video-close { display:flex; }

/* Phantom — fill-in-the-blank */
.phantom {
  background:var(--phantom-bg); color:transparent;
  padding:2px 8px; border-radius:3px; border:1px dashed #818cf8;
  user-select:none; cursor:pointer; transition:color 0.3s;
}
.phantom.revealed { color:var(--accent); background:#c7d2fe; }

/* TikZ figures */
.tikz-placeholder {
  background:var(--tikz-bg); border:2px dashed var(--tikz-border);
  border-radius:8px; padding:20px; text-align:center;
  margin:12px 0; color:#166534; font-size:14px;
}
.tikz-figure {
  margin:10px 0; text-align:center; cursor:zoom-in;
  transition:opacity 0.15s;
}
.tikz-figure:hover { opacity:0.85; }
.tikz-figure svg { max-height:260px; }

/* Lightbox */
.lightbox {
  display:none; position:fixed; inset:0; z-index:1000;
  background:rgba(0,0,0,0.85);
  align-items:center; justify-content:center; cursor:zoom-out;
}
.lightbox.open { display:flex; }
.lightbox-inner {
  background:#fff; border-radius:8px; padding:20px;
  max-width:90vw; max-height:90vh; overflow:auto;
  box-shadow:0 8px 40px rgba(0,0,0,0.4); cursor:default;
}
.lightbox-inner svg { width:100%; height:auto; max-height:80vh; display:block; }
.lightbox-close {
  position:fixed; top:16px; right:20px; z-index:1001;
  background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3);
  color:#fff; width:36px; height:36px; border-radius:50%;
  font-size:18px; cursor:pointer; display:none;
  align-items:center; justify-content:center;
}
.lightbox.open + .lightbox-close { display:flex; }

.math-display { margin:10px 0; overflow-x:auto; }

/* Section title — large serif */
.section-title-big {
  text-align:center; font-size:36px; font-weight:700;
  color:var(--accent);
  font-family:'Noto Serif JP',serif;
}

.slide-table { border-collapse:collapse; margin:8px auto; }
.slide-table td { border:1px solid var(--border); padding:4px 12px; text-align:center; }

.multicols { column-count:2; column-gap:24px; }

.note-frame {
  display:flex; align-items:center; justify-content:center;
  min-height:200px; color:var(--text-dim); font-size:16px;
}
.note-frame::before { content:'📝 ノート用スペース'; }

.framed { border:1px solid var(--border); padding:8px; border-radius:4px; margin:8px 0; }

/* Code blocks with copy button */
pre {
  background:#f3f4f6; padding:12px 16px; border-radius:6px;
  overflow-x:auto; font-size:0.85em; margin:10px 0; position:relative;
}
pre .copy-btn {
  position:absolute; top:6px; right:6px;
  background:rgba(255,255,255,.85); border:1px solid var(--border);
  border-radius:4px; padding:3px 10px; font-size:12px;
  cursor:pointer; color:var(--text); transition:background .15s;
}
pre .copy-btn:hover { background:var(--accent-light); }
pre .copy-btn.copied { background:#d1fae5; border-color:#6ee7b7; }
code { font-family:'JetBrains Mono',"SF Mono","Fira Code",monospace; }

/* ═══ PRINT / HANDOUT MODE ═══ */
body.print-mode { background:#fff; }
body.print-mode .topbar,
body.print-mode .notes-panel,
body.print-mode .nav-btn,
body.print-mode .topbar-nav,
body.print-mode .draw-toolbar,
body.print-mode .hints { display:none !important; }
body.print-mode .main { display:block; overflow:visible; }
body.print-mode .slide-area { display:block; overflow:visible; padding:0; }

.print-slide {
  page-break-inside:avoid; border:1px solid #ccc;
  padding:20px 28px; margin:12px auto; max-width:780px;
  background:#fff; position:relative; overflow:visible;
}
.print-slide .slide-number {
  position:absolute; top:8px; right:12px;
  font-size:11px; color:#999; font-family:'JetBrains Mono',monospace;
}
.print-slide .frame-title {
  font-size:16px; font-weight:700; color:var(--accent);
  border-bottom:1.5px solid var(--accent);
  padding-bottom:4px; margin-bottom:10px;
}
.print-slide .section-badge { font-size:10px; color:#999; margin-bottom:2px; }
body.print-mode .qr-link .qr-img { display:block !important; }
body.print-mode .qr-link { flex-direction:column; }
body.print-mode .tikz-figure svg { max-height:180px; }
body.print-mode .tikz-figure { cursor:default; }

.print-header {
  text-align:center; padding:20px 0 10px;
  border-bottom:2px solid var(--accent);
  margin:0 auto 20px; max-width:780px;
}
.print-header h1 { font-size:22px; color:var(--accent); }
.print-header p { font-size:12px; color:#666; }

@media print {
  body.print-mode .print-slide { border:0.5pt solid #ccc; box-shadow:none; }
  .print-note-area { min-height:60px; }
}

/* Keyboard hints */
.hints {
  position:fixed; bottom:12px; left:50%; transform:translateX(-50%);
  background:rgba(0,0,0,0.85); padding:8px 16px; border-radius:6px;
  font-size:11px; color:#ccc; display:none; z-index:200; white-space:nowrap;
}
.hints.show { display:block; }
kbd {
  background:#374151; padding:1px 5px; border-radius:3px;
  border:1px solid #4b5563; font-family:'JetBrains Mono',monospace; font-size:11px;
}

/* Mode toggle button */
.mode-toggle {
  position:fixed; bottom:12px; right:12px; z-index:200;
  background:var(--header-bg); color:#fff;
  padding:8px 16px; border-radius:6px; cursor:pointer;
  font-size:13px; font-family:inherit; border:none;
  box-shadow:0 2px 8px rgba(0,0,0,0.2);
}

/* Drawing */
.draw-canvas {
  position:absolute; top:0; left:0; width:100%; height:100%;
  z-index:10; pointer-events:none;
}
.draw-canvas.active { pointer-events:auto; cursor:crosshair; }
.draw-canvas.eraser { cursor:cell; }
.draw-canvas.pointer { cursor:none; }

.board-space {
  width:100%; background:#fff;
  border-top:2px dashed var(--border);
  margin-top:16px; display:none;
}
.board-space.show { display:block; }

.draw-toolbar {
  display:none; align-items:center; gap:6px;
  padding:5px 12px;
  background:var(--header-bg); color:#fff;
  flex-shrink:0; z-index:100;
}
.draw-toolbar.show { display:flex; }

.tool-group {
  display:flex; align-items:center; gap:4px;
  padding-right:10px; border-right:1px solid rgba(255,255,255,0.15);
  margin-right:4px;
}
.tool-group:last-child { border-right:none; }

.draw-btn {
  width:30px; height:30px; border-radius:4px;
  border:1px solid rgba(255,255,255,0.2);
  background:rgba(255,255,255,0.1); color:#fff;
  cursor:pointer; display:flex; align-items:center;
  justify-content:center; font-size:14px; transition:all 0.15s;
}
.draw-btn:hover { background:rgba(255,255,255,0.25); }
.draw-btn.active { background:var(--accent); border-color:var(--accent); }

.color-dot {
  width:20px; height:20px; border-radius:50%;
  border:2px solid rgba(255,255,255,0.3); cursor:pointer;
  transition:transform 0.1s;
}
.color-dot:hover { transform:scale(1.2); }
.color-dot.active { border-color:#fff; transform:scale(1.2); }

.size-range { width:70px; accent-color:var(--accent); }
.tool-label { font-size:11px; color:rgba(255,255,255,0.6); margin-right:4px; }

/* ═══ UNDERSTANDING BAR ═══ */
.understanding-bar { display:flex; gap:6px; justify-content:center; padding:8px 0; border-top:1px solid var(--border); position:sticky; bottom:0; background:var(--surface); z-index:4; }
.understanding-btn { padding:5px 14px; border-radius:16px; border:1.5px solid var(--border); background:var(--surface); cursor:pointer; font-size:13px; font-family:inherit; transition:all 0.15s; color:var(--text-dim); }
.understanding-btn:hover { background:var(--accent-light); }
.understanding-btn.active-ok { background:#d1fae5; border-color:#6ee7b7; color:#065f46; }
.understanding-btn.active-unsure { background:#fef3c7; border-color:#fbbf24; color:#92400e; }
.understanding-btn.active-ng { background:#fee2e2; border-color:#fca5a5; color:#991b1b; }

/* ═══ BOOKMARK ═══ */
.bookmark-btn { position:absolute; top:8px; right:8px; background:none; border:none; font-size:20px; cursor:pointer; opacity:0.3; transition:opacity 0.15s, transform 0.15s; z-index:5; padding:4px; }
.bookmark-btn:hover { opacity:0.7; transform:scale(1.15); }
.bookmark-btn.active { opacity:1; color:#f59e0b; }
.slide-content { position:relative; }

/* ═══ STATUS BADGE (topbar) ═══ */
.status-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-left:6px; vertical-align:middle; }
.status-dot.ok { background:#10b981; }
.status-dot.unsure { background:#f59e0b; }
.status-dot.ng { background:#ef4444; }

/* ═══ FILTER BAR ═══ */
.filter-bar { display:none; align-items:center; gap:6px; padding:4px 16px; background:#f1f5f9; border-bottom:1px solid var(--border); flex-shrink:0; font-size:12px; }
.filter-bar.show { display:flex; }
.filter-chip { padding:3px 10px; border-radius:12px; border:1px solid var(--border); background:#fff; cursor:pointer; font-size:12px; font-family:inherit; transition:all 0.15s; }
.filter-chip:hover { background:var(--accent-light); }
.filter-chip.active { background:var(--accent); color:#fff; border-color:var(--accent); }
.filter-count { color:var(--text-dim); margin-left:auto; font-size:11px; }

/* hide in print */
body.print-mode .understanding-bar, body.print-mode .bookmark-btn, body.print-mode .filter-bar { display:none !important; }
```

---

## Body Structure

```html
<body class="slide-mode">

<!-- Top bar -->
<div class="topbar" id="topbar">
  <div class="topbar-title">{{TITLE}}</div>
  <div class="topbar-nav">
    <select class="section-select" id="sectionSelect" onchange="goToSection(this.value)">
      <option value="">— セクション —</option>
    </select>
    <button class="nav-btn" onclick="goSlide(0)">⏮</button>
    <button class="nav-btn" onclick="prevSlide()">◀</button>
    <span class="page-info" id="pageInfo">1 / ?</span>
    <button class="nav-btn" onclick="nextSlide()">▶</button>
    <button class="nav-btn" onclick="goSlide(SLIDES.length-1)">⏭</button>
    <button class="nav-btn" onclick="toggleNotes()">📝</button>
    <button class="nav-btn" id="drawToggleBtn" onclick="toggleDraw()">✏️</button>
    <button class="nav-btn" onclick="clearLocal()" title="メモ・手書きの保存データをすべて消去" style="font-size:11px">🗑️</button>
    <button class="nav-btn" onclick="exportData()" title="学習データを書き出し" style="font-size:11px">💾</button>
    <button class="nav-btn" onclick="document.getElementById('importFile').click()" title="学習データを読み込み" style="font-size:11px">📂</button>
    <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(event)">
    <button class="nav-btn" onclick="toggleFilter()" title="フィルタ表示" style="font-size:11px">🔍</button>
    <button class="nav-btn" onclick="toggleHints()">?</button>
  </div>
</div>

<!-- Filter bar -->
<div class="filter-bar" id="filterBar">
  <span style="font-weight:500;color:var(--text-dim);">フィルタ:</span>
  <button class="filter-chip" onclick="setFilter('all',this)">すべて</button>
  <button class="filter-chip" onclick="setFilter('bookmark',this)">⭐ ブックマーク</button>
  <button class="filter-chip" onclick="setFilter('ok',this)">✅ わかった</button>
  <button class="filter-chip" onclick="setFilter('unsure',this)">🤔 あやしい</button>
  <button class="filter-chip" onclick="setFilter('ng',this)">❌ わからない</button>
  <button class="filter-chip" onclick="setFilter('unmarked',this)">⬜ 未チェック</button>
  <span class="filter-count" id="filterCount"></span>
</div>

<!-- Draw toolbar — bar style, below topbar/filter -->
<div class="draw-toolbar" id="drawToolbar">
  <div class="tool-group">
    <span class="tool-label">ツール:</span>
    <button class="draw-btn active" id="btnPen" onclick="setDrawTool('pen')" title="ペン (P)">✏️</button>
    <button class="draw-btn" id="btnHL" onclick="setDrawTool('highlight')" title="ハイライト (H)">🖍️</button>
    <button class="draw-btn" id="btnPointer" onclick="setDrawTool('pointer')" title="ポインター (L)">🔴</button>
    <button class="draw-btn" id="btnEraser" onclick="setDrawTool('eraser')" title="消しゴム (E)">🧹</button>
  </div>
  <div class="tool-group">
    <span class="tool-label">色:</span>
    <div class="color-dot active" style="background:#e94560" onclick="setDrawColor('#e94560',this)"></div>
    <div class="color-dot" style="background:#4cc9f0" onclick="setDrawColor('#4cc9f0',this)"></div>
    <div class="color-dot" style="background:#f9c74f" onclick="setDrawColor('#f9c74f',this)"></div>
    <div class="color-dot" style="background:#333" onclick="setDrawColor('#333',this)"></div>
    <div class="color-dot" style="background:#1d4ed8" onclick="setDrawColor('#1d4ed8',this)"></div>
  </div>
  <div class="tool-group">
    <span class="tool-label">太さ:</span>
    <input type="range" class="size-range" min="1" max="16" value="3" id="sizeSlider">
  </div>
  <div class="tool-group">
    <button class="draw-btn" onclick="undoStroke()" title="取消 (Ctrl+Z)">↩️</button>
    <button class="draw-btn" onclick="clearStrokes()" title="全消去">🗑️</button>
    <button class="draw-btn" id="btnBoard" onclick="toggleBoard()" title="板書スペース (B)">📋</button>
  </div>
</div>

<!-- Main layout: slide area + notes panel side by side -->
<div class="main" id="mainArea">
  <div class="slide-area" id="slideArea">
    <div class="slide-content" id="slideContent"></div>
    <div class="board-space" id="boardSpace"></div>
    <canvas class="draw-canvas" id="drawCanvas"></canvas>
  </div>
  <div class="notes-panel collapsed" id="notesPanel">
    <div class="notes-header">
      <h3>📝 メモ（スライド <span id="noteSlideNum">1</span>）</h3>
      <button class="nav-btn" onclick="clearNote()" style="font-size:11px;padding:2px 6px;background:rgba(0,0,0,0.1);color:#92400e;border-color:rgba(0,0,0,0.1);">クリア</button>
    </div>
    <textarea class="notes-textarea" id="noteArea" placeholder="ここにメモを書き込めます..."></textarea>
  </div>
</div>

<!-- Keyboard hints -->
<div class="hints" id="hints">
  <kbd>←</kbd><kbd>→</kbd> スライド移動 &nbsp;
  <kbd>D</kbd> 書き込みモード &nbsp;
  <kbd>P</kbd> ペン &nbsp;
  <kbd>H</kbd> ハイライト &nbsp;
  <kbd>E</kbd> 消しゴム &nbsp;
  <kbd>B</kbd> 板書スペース &nbsp;
  <kbd>N</kbd> メモ欄 &nbsp;
  <kbd>R</kbd> 空欄を表示 &nbsp;
  <kbd>Ctrl+Z</kbd> 取り消し
</div>

<!-- Mode toggle -->
<button class="mode-toggle" id="modeToggle" onclick="toggleMode()">📄 印刷用表示</button>

<!-- Lightbox (figure zoom) -->
<div class="lightbox" id="lightbox" onclick="closeLightbox(event)">
  <div class="lightbox-inner" id="lightboxInner"></div>
</div>
<button class="lightbox-close" onclick="closeLightbox()">✕</button>

<!-- Video modal -->
<div class="video-overlay" id="videoOverlay" onclick="closeVideo(event)">
  <div class="video-container" id="videoContainer"></div>
</div>
<button class="video-close" onclick="closeVideo()">✕</button>
```

---

## JavaScript

The JS has these sections. See `math_econ_1.html` for the full working implementation. Key points:

### SECTIONS array (dynamic — do NOT hardcode)
```javascript
// SECTIONS is built dynamically at runtime from slide data-section attributes.
// Do NOT hardcode page numbers — they go stale when slides are added/removed.
let SECTIONS = [];

// In DOMContentLoaded, after building SLIDES:
let lastSection = '';
SLIDES.forEach((s, i) => {
  if (s.section && s.section !== lastSection) {
    SECTIONS.push({ title: s.section, slide: i });
    lastSection = s.section;
  }
});
```

### State variables
```javascript
let understanding = {};  // slideIndex -> 'ok' | 'unsure' | 'ng'
let bookmarks = {};      // slideIndex -> true
let activeFilter = 'all';
let filteredIndices = null; // null = no filter active
```

### renderSlide
Adds bookmark button, section-badge, frame-title, and understanding bar:
```javascript
function renderSlide(idx) {
  const s = SLIDES[idx];
  const el = document.getElementById('slideContent');
  if (typeof MathJax !== 'undefined' && MathJax.typesetClear) MathJax.typesetClear([el]);
  let html = '';
  // Bookmark button
  const isBM = bookmarks[idx];
  html += '<button class="bookmark-btn' + (isBM ? ' active' : '') + '" onclick="toggleBookmark(' + idx + ')" title="ブックマーク">⭐</button>';
  if (s.section) html += '<div class="section-badge">' + s.section + '</div>';
  if (s.title && s.title !== 'Note') html += '<div class="frame-title">' + s.title + '</div>';
  if (s.is_note) html += '<div class="note-frame"></div>';
  else html += s.html;
  // Understanding bar
  const u = understanding[idx] || '';
  html += '<div class="understanding-bar">';
  html += '<button class="understanding-btn' + (u==='ok'?' active-ok':'') + '" onclick="setUnderstanding(' + idx + ',\'ok\')">✅ わかった</button>';
  html += '<button class="understanding-btn' + (u==='unsure'?' active-unsure':'') + '" onclick="setUnderstanding(' + idx + ',\'unsure\')">🤔 あやしい</button>';
  html += '<button class="understanding-btn' + (u==='ng'?' active-ng':'') + '" onclick="setUnderstanding(' + idx + ',\'ng\')">❌ わからない</button>';
  html += '</div>';
  el.innerHTML = html;
  renderMath(el);
  setupPhantoms(el);
  setupFigureZoom(el);
  setupLinks(el);
  updateStatusDot(idx);
  // Add copy buttons to <pre> blocks
  el.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.onclick = () => {
      const code = pre.querySelector('code') || pre;
      navigator.clipboard.writeText(code.textContent.trim()).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
      });
    };
    pre.appendChild(btn);
  });
}
```

### Key design patterns
- **Getter functions** for canvas: `getCanvas()`, `getCtx()` — never cache DOM references
- **Draw color/size from UI**: `drawColor` variable + `sizeSlider` input range
- **Dynamic SECTIONS**: built at runtime from `data-section` attributes — never hardcode slide numbers
- **Section select dropdown**: populated from dynamically built SECTIONS array
- **Auto-save**: debounced 1s after each change via `scheduleSave()`
- **localStorage includes**: notes, strokes, boardStrokes, understanding, bookmarks, lastSlide
- **Filter navigation**: when `filteredIndices` is active, ◀/▶ skip to next/prev matching slide
- **Export/Import**: JSON with normalized stroke coordinates (0–1 range) for portability across screen sizes
- **Keyboard**: Escape handled before textarea check (so it works from notes); Space = next slide
- **Last updated date**: auto-fill via `document.lastModified`
- **Print mode**: renders all slides sequentially, skips note frames, SVG ID dedup; hides understanding/bookmark/filter

### Links
- Text links: plain `<a href="...">text</a>` — normal style
- QR links: `<a class="qr-link" href="...">🔗 QRリンク</a>` — tag-style with QR toggle
- Do NOT put `qr-link` class on text links. Keep text links and QR links separate.

---

## Slide Data Format

```html
<!-- ===== Slide N: Section / Title ===== -->
<template class="slide-data" data-title="Title" data-section="Section" data-note="false" data-print-margin="80">
  ... slide HTML content ...
</template>
```

- `data-print-margin`: pixels of note space below slide in print mode (default 80, use 0 for title slides)
- `data-note="true"`: marks a note frame (skipped in print mode)
- Section title slides: content is `<div class="section-title-big">Section Name</div>`
- Title slide (slide 1): centered div, no section-badge or frame-title
