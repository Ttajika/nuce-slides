#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════
# 講義スライド（HTML）→ 配布用ハンドアウト PDF 一括生成
#
# 使い方（リポジトリのルートで実行）:
#   tools/gen-pdf.sh 2026                 # 2026 の全スライドを 2026/pdf/ に生成
#   tools/gen-pdf.sh 2026 micro.html      # 指定したファイルだけ
#   tools/gen-pdf.sh 2027 math_econ_1.html basicmath_for_KK.html
#
# 対象を指定しない場合は、印刷モード（enterPrintMode）を持つ HTML を
# 自動検出して全部生成する。出力先は <年度>/pdf/<HTMLの<title>>.pdf。
#
# 必要なもの: Google Chrome / node / python3
#   初回のみ: cd tools && npm i   （puppeteer-core が入る）
# ═══════════════════════════════════════════════════════════════════════
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?使い方: tools/gen-pdf.sh <年度ディレクトリ> [html...]}"
shift || true
PORT=8765

cd "$ROOT"
[ -d "$DIR" ] || { echo "エラー: ディレクトリ $DIR がありません" >&2; exit 1; }

# 依存の自動インストール（初回のみ）
[ -d tools/node_modules ] || (cd tools && npm i --silent)

# 対象ファイル：引数がなければ印刷モードを持つ HTML を自動検出
if [ $# -eq 0 ]; then
  set -- $(cd "$DIR" && grep -l "function enterPrintMode" *.html)
  echo "対象: $*"
fi

mkdir -p "$DIR/pdf"

# ローカルサーバーを起動し、終了時（エラー時含む）に必ず止める
(cd "$DIR" && python3 -m http.server "$PORT" >/dev/null 2>&1) &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 1

node tools/gen-pdf.mjs "$DIR/pdf" "http://localhost:$PORT" "$@"

echo "完了: $DIR/pdf/"
ls -la "$DIR/pdf"
