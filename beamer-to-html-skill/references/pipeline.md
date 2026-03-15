# Pipeline Implementation Details

## Table of Contents
1. [LaTeX Parser](#latex-parser)
2. [Math Protection Scanner](#math-protection-scanner)
3. [Text Transformation Rules](#text-transformation-rules)
4. [TikZ Compilation](#tikz-compilation)
5. [HTML Template Structure](#html-template-structure)
6. [MathJax Configuration](#mathjax-configuration)
7. [Drawing System](#drawing-system)
8. [Template Escaping](#template-escaping)

---

## LaTeX Parser

### Frame Extraction

```python
# 1. Strip comment lines
lines = content.split('\n')
for line in lines:
    if line.lstrip().startswith('%'):
        yield ''
    else:
        yield re.sub(r'(?<!\\)%.*', '', line)

# 2. Expand custom section macros BEFORE splitting
#    e.g., \secttle{X} → \section{X} + Note frame + title frame

# 3. Extract body after \begin{document}

# 4. Split by \section{...} to track current section

# 5. Extract \begin{frame}...\end{frame} with re.DOTALL

# 6. For each frame, extract:
#    - Title from \frametitle{...} or \begin{frame}{Title}
#    - is_note flag (title == 'Note' or empty frame)
```

### Custom Macro Expansion

Common Beamer macros to handle:
- `\secttlen{X}` / `\secttle{X}` → section title frames
- `\twocol{A}{B}` → two-column layout (needs brace-matching, not regex)
- `\ddt` → sub-item with arrow prefix
- `\tck{X}` → highlighted keyword
- `\ya`, `\dt`, `\hoshi` → icon/arrow characters

---

## Math Protection Scanner

This is the most critical part. The scanner must run BEFORE any text-to-HTML conversion.

### Order of protection:
1. `\begin{align*?}...\end{align*?}` (re.DOTALL)
2. `\[...\]` (re.DOTALL)
3. `$$...$$` (re.DOTALL)
4. Inline `$...$` — **programmatic scanner, not regex**

### Inline math scanner (Python):

```python
def protect_inline_math(text, math_store):
    result = []
    i = 0
    while i < len(text):
        if text[i] == '$' and (i == 0 or text[i-1] != '\\'):
            if i+1 < len(text) and text[i+1] != '$':
                # Start of inline math
                j = i + 1
                depth = 0
                while j < len(text):
                    c = text[j]
                    prev = text[j-1] if j > 0 else ''
                    if c == '{' and prev != '\\': depth += 1
                    elif c == '}' and prev != '\\': depth -= 1
                    elif c == '$' and prev != '\\' and depth <= 0:
                        # Found closing $
                        math_text = text[i:j+1]
                        idx = len(math_store)
                        math_store.append(math_text)
                        result.append(f'\x00MATH{idx}\x00')
                        i = j + 1
                        break
                    j += 1
                else:
                    result.append(text[i])
                    i += 1
                continue
        result.append(text[i])
        i += 1
    return ''.join(result)
```

**Why not regex?** Inline math can contain `\left\{`, `\begin{array}`, nested braces, and newlines. A regex like `\$[^$]+\$` fails on all of these. The scanner tracks brace depth and skips escaped braces.

### Restoration:

```python
# After all text transformations:
for i, m in enumerate(math_store):
    # Convert align to display math
    am = re.match(r'\\begin\{align\*?\}(.*?)\\end\{align\*?\}', m, re.DOTALL)
    if am:
        math_store[i] = f'<div class="math-display">\\[\\begin{{aligned}}{am.group(1).strip()}\\end{{aligned}}\\]</div>'

text = re.sub(r'\x00MATH(\d+)\x00', lambda m: math_store[int(m.group(1))], text)
```

---

## Text Transformation Rules

Apply these ONLY to non-math text (after math is protected):

| LaTeX | HTML | Notes |
|-------|------|-------|
| `\textbf{X}` | `<strong>X</strong>` | Multiple passes for nesting |
| `\emph{X}` | `<em>X</em>` | |
| `\underline{X}` | `<u>X</u>` | Only outside math! |
| `\textcolor{C}{X}` | `<span style="color:C">X</span>` | Map LaTeX colors to CSS |
| `\href{url}{text}` | `<a href="url">text</a>` | |
| `\url{X}` | `<a href="X">X</a>` | |
| `\qrcode{url}` | `<a class="qr-link" href="url">🔗 QRリンク</a>` | JS generates QR at runtime |
| `\phantom{X}` | `<span class="phantom">X</span>` | Click-to-reveal |
| `\begin{columns}` | `<div class="columns">` | |
| `\begin{column}{W}` | `<div class="column">` | |
| `\begin{itemize}` | `<ul>` | |
| `\begin{enumerate}` | `<ol>` | Handle `[format]` option |
| `\item` | `<li>` | Handle `\item[]`, `\item[label]` |
| `\\` | `<br>` | Only outside math! |
| `\begin{tabular}` | `<table>` | Split on `&` and `\\` |
| `~` | `&nbsp;` | |
| `\vspace`, `\hspace` | (remove) | |

### Color mapping:
```python
color_map = {
    'blue': '#2563eb',
    'red!65!blue': '#9b2d86',
    'red!50!black': '#800000',
    'structure': '#2563eb',  # beamer structure color
    'kyocho': '#dc2626',     # custom emphasis color
}
```

Pre-process LaTeX color mixing to hex BEFORE building HTML, since neither KaTeX nor MathJax supports `red!50!black` syntax.

---

## TikZ Compilation

### Standalone template:
```latex
\documentclass[border=5pt]{standalone}
\usepackage{amsmath,amssymb}
\usepackage{tikz}
\usetikzlibrary{positioning,arrows,intersections,calc,
  decorations.pathreplacing,decorations.markings,patterns}
% Add \usepackage{fontspec}\setmainfont{Noto Sans CJK JP}
% if figure contains Japanese text
\begin{document}
  ... tikzpicture code ...
\end{document}
```

### Compile and convert:
```bash
# Use xelatex for Japanese text, pdflatex otherwise
pdflatex -interaction=nonstopmode tikz_01.tex
# or: xelatex -interaction=nonstopmode tikz_01.tex

# Convert to SVG
pdftocairo -svg tikz_01.pdf tikz_01.svg
```

### Embed in HTML:
```python
svg = open('tikz_01.svg').read()
svg = re.sub(r'<\?xml[^?]*\?>\s*', '', svg)  # remove XML declaration
svg = svg.replace('<svg ', '<svg class="tikz-svg" style="max-width:100%;height:auto;" ', 1)
```

---

## HTML Template Structure

Slides are stored as `<template>` elements for human readability:

```html
<!-- ===== Slide 5: はじめに / 成績評価方法 ===== -->
<template class="slide-data"
  data-title="成績評価方法"
  data-section="はじめに"
  data-note="false">
  <div class="math-display">\[\begin{aligned}...\end{aligned}\]</div>
  <div class="columns">
    <div class="column">
      <ul>
        <li> 期末試験（対面）
        ...
      </ul>
    </div>
  </div>
</template>
```

JS reads them in `DOMContentLoaded`:
```javascript
document.addEventListener('DOMContentLoaded', () => {
  SLIDES = Array.from(document.querySelectorAll('template.slide-data')).map(t => ({
    title: t.dataset.title || '',
    section: t.dataset.section || '',
    html: t.innerHTML,
    is_note: t.dataset.note === 'true',
  }));
  // ... init sections, show first slide
});
```

---

## MathJax Configuration

```javascript
window.MathJax = {
  tex: {
    inlineMath: [['$', '$']],
    displayMath: [['\\[', '\\]'], ['$$', '$$']],
    macros: {
      // Map all custom LaTeX macros here
      R: '\\mathbb{R}',
      P: '\\mathsf{Pr}',
      // For macros with arguments:
      pd: ['\\frac{\\partial #1}{\\partial #2}', 2],
    },
    processEscapes: false,
    tags: 'none',
  },
  options: {
    skipHtmlTags: ['script','noscript','style','textarea','pre','code'],
  },
  startup: { typeset: false }  // We typeset manually per slide
};
```

### Dynamic typesetting:
```javascript
function renderMath(el) {
  if (MathJax.typesetClear) MathJax.typesetClear([el]);
  // innerHTML is already set
  MathJax.typesetPromise([el]);
}
```

---

## Drawing System

### Architecture:
- A `<canvas>` is overlaid on the slide area with `position:absolute; pointer-events:none`
- Toggle `pointer-events:auto` + `cursor:crosshair` when drawing mode is on
- **Use getter functions** (`getCanvas()`, `getCtx()`), not cached references — the canvas DOM element may be recreated (e.g., after returning from print mode)

### Stroke storage:
```javascript
let strokes = {};  // { slideIndex: [stroke, ...] }
// stroke = { color, size, alpha, points: [{x, y}, ...] }
```

### Pointer tool (laser pointer):
- A non-persistent visual indicator — shows a colored dot at cursor position, not saved as a stroke
- `pointerPos` variable holds current position; set to `null` when mouse/touch ends
- In `moveDraw`: update `pointerPos` and call `redrawStrokes()` even without `drawingNow` (pointer follows cursor without clicking)
- In `redrawStrokes`: after drawing all strokes, if `pointerPos` is set, draw a semi-transparent circle (outer ring + inner bright dot)
- CSS: `.draw-canvas.pointer { cursor:none; }` to hide the system cursor
- Keyboard shortcut: `L`

### Touch handling:
- When `drawMode` is ON, prevent touch events from triggering swipe navigation
- Use `{passive: false}` for touch listeners and call `e.preventDefault()`
- **Pinch-to-zoom protection**: Track a `touchIsSingle` flag to prevent pinch gestures from triggering swipe navigation:
```javascript
let touchIsSingle = false;
document.addEventListener('touchstart', e => {
  touchIsSingle = (e.touches.length === 1);
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
});
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) touchIsSingle = false;
}, {passive:true});
document.addEventListener('touchend', e => {
  if (mode !== 'slide' || drawMode || !touchIsSingle) return;
  // ... swipe detection ...
});
```

### Rebinding after print mode:
```javascript
function bindCanvasEvents() {
  const c = getCanvas();
  if (!c) return;
  c.addEventListener('mousedown', startDraw);
  c.addEventListener('mousemove', moveDraw);
  // ... etc
}
// Call after recreating canvas in enterSlideMode()
```

---

## Board Mode (板書スペース)

A toggleable empty area below the slide for free-form writing:

```html
<div class="slide-area" id="slideArea">
  <div class="slide-content" id="slideContent"></div>
  <div class="board-space" id="boardSpace"></div>    <!-- board area -->
  <canvas class="draw-canvas" id="drawCanvas"></canvas>  <!-- covers everything -->
</div>
```

```css
.board-space {
  width:100%; background:#fff;
  border-top:2px dashed var(--border);
  margin-top:16px; display:none;
}
.board-space.show { display:block; }
```

```javascript
function toggleBoard() {
  boardMode = !boardMode;
  const board = document.getElementById('boardSpace');
  board.classList.toggle('show', boardMode);
  board.style.minHeight = boardMode ? boardHeight + 'px' : '0';
  // Auto-enable drawing
  if (boardMode && !drawMode) toggleDraw();
  // Canvas needs to resize to cover board area
  setTimeout(resizeDrawCanvas, 50);
}
```

Key: `resizeDrawCanvas` uses `area.scrollHeight` which automatically includes the board space when visible.

---

## Local Storage

### Storage key:
```javascript
const STORAGE_KEY = 'beamer_' + location.pathname.replace(/[^a-zA-Z0-9]/g, '_');
```
This ensures different HTML files (different lectures) on the same domain don't collide.

### Data structure:
```javascript
{ notes: { 0: "text...", 5: "text..." }, strokes: { 0: [...], 3: [...] }, lastSlide: 42 }
```

### Save/load:
```javascript
function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      notes, strokes, lastSlide: current
    }));
  } catch(e) { /* quota exceeded */ }
}

function loadLocal() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!data) return;
    if (data.notes) notes = data.notes;
    if (data.strokes) strokes = data.strokes;
    if (typeof data.lastSlide === 'number') current = data.lastSlide;
  } catch(e) {}
}
```

### Debounced auto-save:
```javascript
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLocal, 1000);
}
```

### Save points (call `scheduleSave()` at each):
1. `endDraw` — after a stroke is completed
2. `undoStroke` / `clearStrokes`
3. `showSlide` — before switching slides (saves current note)
4. `clearNote`
5. `noteArea` input event
6. `beforeunload` — calls `saveLocal()` directly (no debounce)

### Load point:
- Inside `DOMContentLoaded`, before `showSlide(current)` — restores last position

---

## Print Mode

### Per-slide margin:
Each `<template>` has `data-print-margin="80"` (pixels). Users can edit this in the HTML source to adjust whitespace per slide:
```html
<template class="slide-data" ... data-print-margin="120">
```

JS reads it:
```javascript
printMargin: parseInt(t.dataset.printMargin) || 80,
```

And applies in print mode:
```javascript
html += `<div class="print-note-area" style="min-height:${margin}px"></div>`;
```

### Skipped in print mode:
- **Note frames** (`is_note === true`): `if (s.is_note) return;`
- **Section title slides**: no margin area added

### QR codes auto-expanded:
```css
body.print-mode .qr-link .qr-img { display:block !important; }
```

### SVG ID deduplication in print mode:

All slides are rendered into a single DOM in print mode. TikZ-generated SVGs reuse the same IDs (`glyph-0-0`, `clip-0`, etc.), causing the browser to render only the first definition's glyphs — later SVGs appear blank or corrupted.

**Fix**: After inserting all slides into the DOM, iterate each slide's SVGs and prefix all internal IDs:

```javascript
area.querySelectorAll('.print-slide').forEach((slide, idx) => {
  slide.querySelectorAll('svg').forEach(svg => {
    const prefix = 's' + idx + '-';
    // 1. Rename all IDs
    svg.querySelectorAll('[id]').forEach(el => {
      el.id = prefix + el.id;
    });
    // 2. Update <use> references
    //    IMPORTANT: xlink:href is namespaced — querySelectorAll('[xlink\\:href]')
    //    does NOT work. Select <use> elements directly and use getAttributeNS.
    svg.querySelectorAll('use').forEach(el => {
      const ref = el.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
               || el.getAttribute('href');
      if (ref && ref.startsWith('#')) {
        const newRef = '#' + prefix + ref.slice(1);
        el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', newRef);
        el.setAttribute('href', newRef);
      }
    });
    // 3. Update clip-path="url(#...)" references
    svg.querySelectorAll('[clip-path]').forEach(el => {
      const cp = el.getAttribute('clip-path');
      const m = cp && cp.match(/url\(#(.+?)\)/);
      if (m) {
        el.setAttribute('clip-path', 'url(#' + prefix + m[1] + ')');
      }
    });
  });
});
```

---

## Inline Math Spacing (CJK)

When inline math `$...$` is adjacent to Japanese (CJK) characters with no space, the rendered output looks cramped. Add spaces in the HTML source between `$` and CJK characters, but NOT before punctuation (，。、（）「」).

### Post-processing rule (Python):
```python
import re

cjk = '[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]'

# closing $ followed by CJK char (not $$)
line = re.sub(r'\$(?!\$)(' + cjk + ')', r'$ \1', line)

# CJK char followed by opening $ (not $$)
line = re.sub(r'(' + cjk + r')\$(?!\$)', r'\1 $', line)
```

**Important**: Skip lines inside `<script>` and `<style>` blocks. The regex excludes CJK punctuation by limiting the character range.

---

## Template Escaping

When building the HTML file, `<` inside math will break the `<template>` HTML parser.

### Escape strategy:
1. For display math (`\[...\]`, `$$...$$`): regex replace `<` → `&lt;`
2. For inline math (`$...$`): use the same brace-aware scanner as protection, replacing `<` → `&lt;` within matched regions
3. For data attributes: escape `&`, `"`, `<` in title/section strings

The browser automatically decodes `&lt;` back to `<` when reading `template.innerHTML`, so MathJax receives correct math source.
