#!/usr/bin/env bash
# make-pdf.sh — 配布用 PDF（印刷用表示・改ページ区切り ON・余白なし・A4）を作り直して pdf/ に置く
#
#   ./make-pdf.sh                 4 つすべて
#   ./make-pdf.sh micro.html      指定したものだけ
#
# 出力先は各 HTML の <meta name="handout-pdf" content="pdf/xxx.pdf">。
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
[ ${#FILES[@]} -eq 0 ] && FILES=(micro.html math_econ_1.html math_econ_2.html basicmath_for_KK.html)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "見つかりません: $f" >&2; exit 1; }
  # 出力先を <meta name="handout-pdf"> から読み，印刷用の一時 HTML を作る
  out="$(python3 - "$f" "$TMP/page.html" <<'PY'
import sys, re, pathlib
src, dst = pathlib.Path(sys.argv[1]).resolve(), sys.argv[2]
t = src.read_text(encoding='utf-8')
m = re.search(r'<meta name="handout-pdf" content="([^"]+)"', t)
if not m:
    sys.exit(f'{src.name}: <meta name="handout-pdf"> がありません')
# 相対パス（CSS・JS・画像）が元の場所を指すように base を付ける
t = t.replace('<head>', f'<head><base href="{src.parent.as_uri()}/">', 1)
# 余白なし。数式の幅を測るときの印刷幅も用紙の幅（210mm）にする
t = t.replace('</head>', '<style>@page{margin:0!important} '
              'body.print-mode.print-measure .print-slide{max-width:210mm!important}</style></head>', 1)
# 印刷用表示 → 改ページ区切り ON → 数式とフォントを待ってから，はみ出す数式を縮小（beforeprint）
js = ('<script>window.addEventListener("load",()=>setTimeout(()=>{enterPrintMode();togglePageBreak();'
      'setTimeout(()=>Promise.resolve(window.MathJax&&MathJax.startup&&MathJax.startup.promise)'
      '.then(()=>document.fonts.ready).then(()=>window.dispatchEvent(new Event("beforeprint"))),3000);},500));</script>')
i = t.rfind('</body>')
t = t[:i] + js + t[i:] if i >= 0 else t + js
pathlib.Path(dst).write_text(t, encoding='utf-8')
print(m.group(1))
PY
)"
  mkdir -p "$(dirname "$out")"
  "$CHROME" --headless=new --disable-gpu --allow-file-access-from-files \
    --virtual-time-budget=40000 --no-pdf-header-footer \
    --print-to-pdf="$TMP/out.pdf" "file://$TMP/page.html" 2>/dev/null
  mv "$TMP/out.pdf" "$out"
  pages="$( (command -v pdfinfo >/dev/null && pdfinfo "$out" | awk '/^Pages/{print $2}') || echo '?')"
  echo "${f} → ${out}（${pages} ページ）"
done
