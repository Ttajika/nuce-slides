# tools

## PDF 一括生成（配布用ハンドアウト）

スライド HTML の「印刷用表示」をヘッドレス Chrome で開き、A4 の PDF を書き出す。

```bash
# リポジトリのルートで
tools/gen-pdf.sh 2026                 # 2026 の全スライド → 2026/pdf/
tools/gen-pdf.sh 2026 micro.html      # 指定ファイルだけ
tools/gen-pdf.sh 2027                 # 2027 版も同じ
```

- 出力ファイル名は HTML の `<title>`（例：`基礎ミクロ経済学 — 2026年度.pdf`）
- 対象を省略すると `enterPrintMode` を持つ HTML を自動検出
- ローカルサーバー（ポート 8765）の起動・停止はスクリプトが行う
- 初回のみ `cd tools && npm i`（`gen-pdf.sh` が自動でやるので通常は不要）
- 必要環境：Google Chrome、node、python3

### 仕組み・調整箇所（`gen-pdf.mjs`）

1. ページを開いて MathJax の読み込みを待つ
2. `enterPrintMode()` ＋ 改ページ区切り ON
3. MathJax の組版完了を待つ
4. 固定 UI（モード切替ボタン等）を非表示に
5. `page.pdf()`：A4、`scale: 0.8`、余白 上下 10mm・左右 8mm

`scale: 0.8` は重要。等倍だと A4 幅がモバイル用メディアクエリ（768px 以下）に
かかって 2 段組みが崩れる。レイアウトがおかしい時はまずここを疑う。

Chrome のパスは `gen-pdf.mjs` 冒頭の `CHROME` 定数（macOS 標準の場所を指定済み）。
