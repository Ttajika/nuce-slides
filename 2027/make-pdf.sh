#!/usr/bin/env bash
# make-pdf.sh — 配布用 PDF（印刷用表示・改ページ区切り ON・余白なし・A4）を作り直して pdf/ に置く
#
#   ./make-pdf.sh                 handout-pdf の <meta> がある HTML すべて
#   ./make-pdf.sh micro.html      指定したものだけ
#
# 出力先は各 HTML の <meta name="handout-pdf" content="pdf/xxx.pdf">。
# 1 つの HTML から複数の PDF を作るときは <meta> を並べ，data-filter に印刷範囲
# （HTML 側の printFilter の値）を書く。
# Google Chrome（ヘッドレス）と python3 を使う。数式（MathJax）やフォントは CDN から
# 読み込むので，ネットにつながっている必要がある。
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [ ! -x "$CHROME" ]; then
  echo "Chrome が見つかりません。CHROME=/path/to/chrome ./make-pdf.sh のように指定してください" >&2
  exit 1
fi

FILES=("$@")
if [ ${#FILES[@]} -eq 0 ]; then
  while IFS= read -r f; do FILES+=("$f"); done < <(grep -l 'name="handout-pdf"' ./*.html | sed 's|^\./||')
fi
[ ${#FILES[@]} -eq 0 ] && { echo '<meta name="handout-pdf"> のある HTML がありません' >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "見つかりません: $f" >&2; exit 1; }
  # <meta name="handout-pdf"> ごとに印刷用の一時 HTML を作り，「出力先<TAB>一時 HTML」を 1 行ずつ出す
  jobs="$(python3 - "$f" "$TMP" <<'PY'
import sys, re, json, pathlib, html
src, tmp = pathlib.Path(sys.argv[1]).resolve(), pathlib.Path(sys.argv[2])
t = src.read_text(encoding='utf-8')
metas = [m.group(0) for m in re.finditer(r'<meta name="handout-pdf"[^>]*>', t)]
if not metas:
    sys.exit(f'{src.name}: <meta name="handout-pdf"> がありません')
# 相対パス（CSS・JS・画像）が元の場所を指すように base を付ける
base = t.replace('<head>', f'<head><base href="{src.parent.as_uri()}/">', 1)
# 余白なし。数式の幅を測るときの印刷幅も用紙の幅（210mm）にする
base = base.replace('</head>', '<style>@page{margin:0!important} '
                    'body.print-mode.print-measure .print-slide{max-width:210mm!important}</style></head>', 1)
for k, meta in enumerate(metas):
    out = html.unescape(re.search(r'content="([^"]+)"', meta).group(1))
    flt = re.search(r'data-filter="([^"]+)"', meta)
    # 印刷範囲 → 印刷用表示 → 改ページ区切り ON → 数式とフォントを待って，はみ出す数式を縮小（beforeprint）
    set_filter = f'try{{printFilter={json.dumps(flt.group(1))};}}catch(e){{}}' if flt else ''
    js = ('<script>window.addEventListener("load",()=>setTimeout(()=>{' + set_filter +
          'enterPrintMode();if(!document.body.classList.contains("page-break-on"))togglePageBreak();'
          'setTimeout(()=>Promise.resolve(window.MathJax&&MathJax.startup&&MathJax.startup.promise)'
          '.then(()=>document.fonts.ready).then(()=>window.dispatchEvent(new Event("beforeprint"))),3000);},1500));</script>')
    i = base.rfind('</body>')
    page = base[:i] + js + base[i:] if i >= 0 else base + js
    p = tmp / f'page{k}.html'
    p.write_text(page, encoding='utf-8')
    print(f'{out}\t{p}')
PY
)"
  while IFS=$'\t' read -r out page; do
    mkdir -p "$(dirname "$out")"
    "$CHROME" --headless=new --disable-gpu --allow-file-access-from-files \
      --virtual-time-budget=40000 --no-pdf-header-footer \
      --print-to-pdf="$TMP/out.pdf" "file://$page" 2>/dev/null
    mv "$TMP/out.pdf" "$out"
    pages="$( (command -v pdfinfo >/dev/null && pdfinfo "$out" | awk '/^Pages/{print $2}') || echo '?')"
    echo "${f} → ${out}（${pages} ページ）"
  done <<< "$jobs"
done
