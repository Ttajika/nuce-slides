# `micro-notes.html` 機能一覧

## 構成

- **サイドバー目次（TOC）**：固定表示。`.chapter` / `.section` から自動生成。
- **スクロール連動ハイライト**：現在表示中の章・節を TOC 上で強調（IntersectionObserver）。
- **モバイル対応**：画面幅 ≤768px でサイドバーを非表示、本文のみ表示。
- **自動採番**：CSS counter により「第 N 章」「N.M 節」および定理・定義等を章・節ごとに採番。

## 数式

- **MathJax 3**（CHTML）。
- インライン `$ ... $`、ディスプレイ `\[ ... \]` または `$$ ... $$`。
- **カスタムマクロ**：`\R`（$\mathbb{R}$）、`\P`（$\mathsf{Pr}$）、`\condi`、`\pd{f}{x}`（偏微分）、`\dd{f}{x}`（常微分）、`\eqdef`、`\uu`、`\ou`、`\d`（積分の微小量用の空き付き `d`）。

## ボックス（ラベル・採番付き）

| クラス | ラベル | 採番 | 用途 |
|---|---|---|---|
| `.def` | 定義 | 章.節.番号 | 用語定義 |
| `.thm` | 定理 | 章.節.番号 | 主要な結果 |
| `.prop` | 命題 | 章.節.番号 | 二次的な結果 |
| `.lem` | 補題 | 章.節.番号 | 踏み台となる結果 |
| `.cor` | 系 | 章.節.番号 | 定理から直接従う結果 |
| `.rmk` | 注 | （なし） | 補足 |
| `.ex` | 例 | 章.節.番号 | 例示 |
| `.exercise` | 練習問題 | 章.節.番号 | 演習 |

**共通構造：**
```html
<div class="thm">
  <div class="box-label"><span class="box-title">任意のタイトル</span></div>
  <div class="box-body"><p>本文…</p></div>
</div>
```
- `.box-title` は省略可。付与すると「定理 X.Y.Z（タイトル）」と表示。

## 折りたたみ証明（QED 付き）

```html
<details class="proof">
  <summary>証明</summary>
  <div class="proof-body">
    <p>…</p>
    <div class="qed"></div>
  </div>
</details>
```
- 初期状態は閉じた状態。クリックで展開。
- `.qed` が右寄せで `□` を表示。

## 練習問題の解答トグル

```html
<button class="reveal-btn">答えを表示</button>
<div class="reveal-answer"><p>…</p></div>
```
- ボタンをクリックで解答部分がアニメーション展開。

## ステップ・バイ・ステップ表示

```html
<div class="steps">
  <div class="steps-header">…<span class="step-counter"></span></div>
  <div class="step">ステップ1</div>
  <div class="step">ステップ2</div>
  <div class="steps-controls">
    <button class="step-prev">戻る</button>
    <button class="step-next">次へ</button>
    <button class="step-all">全部表示</button>
  </div>
</div>
```
- 「次へ／戻る／全部」で段階的に表示。カウンタ（`n / 総数`）あり。

## 用語ポップアップ（グロッサリー）

```html
<span class="term" data-term="効用">効用</span>
```
- `GLOSSARY` オブジェクト（`<script>` 内）に登録された用語をクリックでダーク背景のポップアップ表示。
- 再クリック・外側クリック・`Esc` で閉じる。

## 脚注ポップアップ

```html
本文<span class="fn">脚注の内容．$x^2$ などの数式も可．</span>続き
```
- 本文中に `[1]` 風の上付き番号が自動挿入され、クリックでポップアップ表示。
- **章ごとに 1 から採番**（章外なら通し番号）。
- MathJax の再 typeset によって脚注内の数式も正しく描画。

## 発展（★）コンテンツの表示/非表示

```html
<section class="section" data-level="advanced">…</section>
<div class="thm" data-level="advanced">…</div>
```
- `data-level="advanced"` を付けた要素は「★」マーク付きで表示され、枠線が破線に。
- サイドバー下部の「★ 発展を隠す／表示」ボタンでまとめて非表示に切替可能。
- `localStorage` に状態を保存（リロード後も維持）。

## 図版

```html
<figure>
  <img src="…" alt="…">
  <figcaption>図のキャプション</figcaption>
</figure>
```
- 中央寄せ、画像は `max-width:100%`、キャプションは小さめサンセリフ。

## その他の装飾

- `.small`：小さめテキスト（0.88em）。
- `.text-dim`：薄い文字色。
- `<strong>`：Noto Sans JP の太字。
- 本文書体は Noto Serif JP、UI は Noto Sans JP、等幅は JetBrains Mono。
