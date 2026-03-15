---
name: beamer-to-html
description: Convert Beamer LaTeX slides to interactive HTML presentations. Use this skill whenever the user wants to convert LaTeX/Beamer slides to HTML, create an interactive web-based slide viewer from .tex source, or build HTML lecture slides with features like handwriting, notes, math rendering, and print handouts. Also trigger when the user mentions "Beamer to HTML", "LaTeX slides to web", "interactive lecture slides", "HTML slides from tex", or wants to add features like drawing/annotation, QR codes, video embedding, or print handouts to HTML slides. If the user has a .tex file containing \documentclass{beamer} or \begin{frame}, use this skill.
---

# Beamer to HTML Converter

Converts Beamer LaTeX source into a single self-contained interactive HTML file with MathJax math rendering, embedded TikZ figures (as SVG), annotation/drawing tools, note-taking, QR code generation, video embedding, and a print-friendly handout mode.

## Overview

The conversion pipeline has these stages:

1. **Parse** the LaTeX source → extract frames, sections, math, TikZ, links
2. **Compile TikZ** figures to SVG (via `pdflatex` + `pdftocairo`)
3. **Build HTML** with `<template>` elements for each slide (human-editable)
4. **Output** a single `.html` file (no external dependencies except CDN)

## Quick Start

Read this SKILL.md first, then follow the workflow below. For implementation details on each stage, see `references/pipeline.md`.

## Workflow

### Step 1: Parse the LaTeX Source

Read the `.tex` file and understand its structure:

```
- Identify \documentclass, packages, custom macros
- Find \begin{document} ... \end{document}
- Expand custom section macros (e.g., \secttle, \secttlen)
- Strip commented lines (% prefix)
- Split into frames via \begin{frame}...\end{frame}
- Extract \frametitle{}, \section{} for navigation
```

### Step 2: Protect Math, Then Convert

**CRITICAL**: Math regions must be protected BEFORE any text transformation.

1. **Protect** all math regions (replace with placeholders):
   - `\begin{align}...\end{align}` (and align*)
   - `\[...\]` and `$$...$$`
   - Inline `$...$` — use a brace-depth-aware scanner, not regex, to handle `\left\{...\right\}` and `\begin{array}...\end{array}` inside inline math
2. **Apply text transformations** (on non-math text only):
   - `\textcolor{color}{text}` → `<span style="color:...">`
   - `\textbf{}` → `<strong>`, `\emph{}` → `<em>`
   - `\underline{}` → `<u>`
   - `\begin{itemize/enumerate}` → `<ul>/<ol>`
   - `\begin{columns}\begin{column}` → `<div class="columns"><div class="column">`
   - `\\` → `<br>` (line breaks)
   - `\href{url}{text}` → `<a href="url">text</a>`
   - `\url{text}` → `<a href="text">text</a>`
   - Custom macros (e.g., `\tck{}` for keywords, `\ddt` for sub-items)
3. **Restore** math regions from placeholders
4. **Post-process**: Convert `\begin{align}` to `\[\begin{aligned}...\end{aligned}\]` for MathJax

### Step 3: Handle TikZ Figures

Two approaches:
- **A. Compile to SVG (recommended)**: Extract each `\begin{tikzpicture}...\end{tikzpicture}` into a standalone `.tex`, compile with `pdflatex` (or `xelatex` for Japanese text), convert PDF→SVG with `pdftocairo -svg`. Embed the SVG inline.
- **B. Placeholder**: If compilation is not possible, insert a placeholder `<div class="tikz-placeholder">` for the user to replace later.

For approach A, see `scripts/compile_tikz.sh`.

### Step 4: Build the HTML

The output HTML has this structure:

```
<!DOCTYPE html>
<html>
<head>
  MathJax config + CDN
  QR code generator CDN
  <style> ... all CSS ... </style>
</head>
<body>
  Top navigation bar
  Slide display area + drawing canvas
  Notes panel
  Drawing toolbar
  Lightbox (figure zoom)
  Video modal (Vimeo embed)
  
  <script> ... all JS ... </script>
  
  <!-- Slide data as <template> elements (human-editable) -->
  <template class="slide-data" data-title="..." data-section="..." data-note="false">
    ... slide HTML content ...
  </template>
  ...
</body>
</html>
```

**Key design decisions:**
- **`<template>` for slide data**: Slides are stored as `<template class="slide-data">` elements, not JSON. This makes the file readable and directly editable in any text editor. JS reads them via `document.querySelectorAll('template.slide-data')` in `DOMContentLoaded`.
- **Single file**: Everything (CSS, JS, SVGs, slide content) in one `.html` file for easy distribution via GitHub Pages etc.
- **MathJax 3** over KaTeX: Better support for `\textcolor{red!50!black}{}`, mathtools, `\text{}` with CJK, and complex environments.

### Step 5: Escape `<` in Math

**CRITICAL**: When writing math inside `<template>`, bare `<` in expressions like `$a < b$` will break HTML parsing. During build, escape `<` → `&lt;` inside all math regions. The browser decodes `&lt;` back to `<` when reading `innerHTML`, so MathJax receives the correct symbol.

## Feature Reference

### Math (MathJax 3)
- Define custom macros in `window.MathJax.tex.macros`
- Map LaTeX color mixing (`red!50!black`) to hex values in a pre-processing step since MathJax doesn't support LaTeX color mixing syntax
- Use `MathJax.typesetClear([el])` before replacing innerHTML, then `MathJax.typesetPromise([el])` after

### Drawing / Handwriting
- Canvas overlay on the slide area (`pointer-events:none` by default, toggle to `auto`)
- Store strokes per slide index: `strokes[slideIndex] = [{color, size, alpha, points:[{x,y}]}]`
- Tools: pen, highlighter (alpha:0.3, 3x size), eraser (stroke-level)
- Redraw on slide change; disable touch-swipe navigation when drawing is active
- Use getter functions (`getCanvas()`, `getCtx()`) rather than cached references, since canvas may be recreated after print mode

### Board Mode (板書スペース)
- Adds an empty white area below the slide content for free-form writing
- Toggle via 📋 button in draw toolbar or `B` key (while in draw mode)
- Automatically enables drawing mode when activated
- Canvas resizes to cover the board area (`scrollHeight` includes it)
- Height default: 400px (adjustable in `boardHeight` variable)

### Notes Panel
- Right-side textarea, stored per slide in a `notes[slideIndex]` object
- Export all notes as Markdown
- **Default state: collapsed** — the panel starts with CSS class `collapsed` so it is hidden on load. Users toggle it with `N` key or 📝 button

### Local Storage (ローカル保存)
- Saves notes, strokes, and last viewed slide position to `localStorage`
- Storage key: `'beamer_' + location.pathname` (unique per file/URL, so multiple slide sets don't conflict)
- Auto-saves 1 second after each change (debounced via `scheduleSave`)
- Also saves on `beforeunload` (page close/refresh)
- Restores on page load: notes, strokes, and last slide position
- Clear button (🗑️) in topbar with confirmation dialog
- Hook `scheduleSave()` into: endDraw, undoStroke, clearStrokes, showSlide, clearNote, note input

### Print / Handout Mode
- Renders all slides sequentially with adjustable margin below each
- **Note frames (空白ページ) are skipped** in print mode
- **Section title slides have no margin** below them
- **QR codes are always expanded** (CSS: `body.print-mode .qr-link .qr-img { display:block !important }`)
- **Per-slide margin control**: each `<template>` has `data-print-margin="80"` — edit the value to adjust whitespace per slide. Use `data-print-margin="0"` for title/intro slides that don't need note space
- `page-break-inside:avoid` per slide
- MathJax: use `MathJax.typesetPromise([container])` once for the whole page
- **SVG ID deduplication**: In print mode all slides are rendered in a single DOM, so SVG glyph/clip IDs (e.g., `glyph-0-0`, `clip-0`) from different TikZ figures collide. Must prefix each SVG's internal IDs with a unique per-slide prefix (e.g., `s0-`, `s1-`) and update all references:
  1. `[id]` attributes → prefix the ID
  2. `<use>` elements → update via `getAttributeNS('http://www.w3.org/1999/xlink', 'href')` and `getAttribute('href')` (both must be set; `querySelectorAll('[xlink\\:href]')` does NOT work for namespaced attributes)
  3. `clip-path="url(#...)"` → update the URL fragment

### QR Codes
- CDN: `qrcode-generator@1.4.4` (generates SVG)
- Applied to `.qr-link` elements: click toggles QR display inline

### Video Embedding (Vimeo)
- Parse Vimeo URLs including private hash: `vimeo.com/ID/HASH`
- Embed URL: `https://player.vimeo.com/video/ID?autoplay=1&h=HASH`
- Open in modal overlay; fallback to `window.open()` if not Vimeo

### Figure Zoom (Lightbox)
- Click `.tikz-figure` → clone SVG into lightbox overlay
- Remove max-height constraint for expanded view

### Phantom / Fill-in-the-blank
- `\phantom{answer}` → `<span class="phantom">answer</span>`
- CSS: transparent text, dashed border; click to reveal
- `R` key to toggle all phantoms

## CDN Dependencies

```
MathJax 3:     https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js
QR Generator:  https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ← → | Slide navigation |
| D | Toggle drawing mode |
| P / H / E | Pen / Highlighter / Eraser (in draw mode) |
| B | Toggle board space (in draw mode) |
| N | Toggle notes panel |
| R | Reveal/hide all phantom blanks |
| Ctrl+Z | Undo last stroke |
| Esc | Close lightbox/video modal |

## Common Pitfalls

1. **Math inside `<template>` breaks on `<`**: Always escape `<` to `&lt;` inside math during build
2. **`\underline` in math becomes `<u>`**: Must protect math regions before text transformations
3. **`\\` in `aligned`/`array` becomes `<br>`**: Same cause — protect math first
4. **`\textcolor{red!50!black}{}` fails in MathJax**: Pre-convert LaTeX color mixing to hex
5. **Canvas lost after print mode**: Don't cache canvas/context references; use getter functions and rebind events
6. **SLIDES array empty**: `<script>` runs before `<template>` elements exist; read templates inside `DOMContentLoaded`
7. **TikZ with `\left\{` breaks inline math scanner**: Use brace-depth aware scanner, skip escaped braces (`\{`)
8. **localStorage quota**: Strokes can get large; wrap `setItem` in try-catch. If quota is exceeded, data from the current session is still in memory
9. **Multiple HTML files on same origin**: Use pathname-based storage key to prevent data collision
10. **SVG glyphs disappear in print mode**: All slides share the DOM, so duplicate SVG `id` attributes (e.g., `glyph-0-0`) cause the browser to render only the first definition. Prefix each SVG's IDs with a unique per-slide string
11. **`xlink:href` is a namespaced attribute**: `querySelectorAll('[xlink\\:href]')` does NOT match. Instead, select `<use>` elements directly and read/write with `getAttributeNS('http://www.w3.org/1999/xlink', 'href')`. Also set `el.setAttribute('href', ...)` for modern browsers
12. **Inline math `$...$` touching Japanese text**: Add a space between closing `$` and CJK characters, and between CJK characters and opening `$`. Do NOT add space before punctuation (，。、（）「」). Use a post-processing script that matches CJK Unicode ranges `[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]` adjacent to `$`

## Deployment (GitHub Pages)

The output is a single self-contained HTML file. The simplest deployment:

### Quick setup
```bash
# 1. Create a repo (or use existing)
git init math-econ-slides && cd math-econ-slides

# 2. Put the HTML file in the repo
cp math_econ_slides_v2.html index.html

# 3. Push to GitHub
git add . && git commit -m "Add slides"
git remote add origin https://github.com/USERNAME/math-econ-slides.git
git push -u origin main

# 4. Enable GitHub Pages
#    Settings → Pages → Source: "Deploy from a branch" → Branch: main → / (root) → Save
```

### Access URL
`https://USERNAME.github.io/math-econ-slides/`

### Notes
- **File size**: ~280KB is well within GitHub Pages limits (repo < 1GB, individual files < 100MB)
- **CDN dependencies**: MathJax and qrcode-generator are loaded from jsdelivr CDN — requires internet
- **localStorage**: Works on GitHub Pages (same-origin). Each URL path gets its own storage key, so multiple slide sets won't conflict
- **Updating**: Just edit the HTML, commit and push. GitHub Pages updates within a few minutes
- **Multiple lectures**: Put each lecture's HTML as a separate file (`lecture1.html`, `lecture2.html`), or use subdirectories. Add a simple `index.html` as a table of contents if desired
- **Custom domain**: Optional — configure in Settings → Pages → Custom domain
- **Private repo**: GitHub Pages on private repos requires GitHub Pro/Team/Enterprise
