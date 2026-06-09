# 講義スライド：ログイン＋クラウド同期 方針メモ

最終更新: 2026-06-02 / 状態: **設計・実装済みだが休眠中（学期途中のため未有効化）**

## 目的

学生が自分のメモ・手書き・板書・理解度・ブックマークを、**端末をまたいで同期**できるようにする。
現状は `localStorage` のみで、同じブラウザでしか保存が残らない。

## 構成

- 静的HTML（GitHub Pages 等）のまま、バックエンドは **Supabase**（無料枠、自前サーバー不要）。
- HTML 単体では DB 接続・認証ができないため、認証＋DB は Supabase に委ねる。
- **オフラインファースト**：`localStorage` 保存は従来通り維持。
- 同期は**更新時刻の後勝ち（last-write-wins）**。`payload.updatedAt`（ミリ秒）で新しい方を採用。
- 手書き座標は端末ごとの画面サイズ差を吸収するため、**0–1 に正規化**して保存・復元（JSON 書き出し機能と同じ方式）。

## 認証方式：ID 形式（個人情報を保存しない）

- 仕組みはメール＋パスワードだが、**実在メールは使わない**。
- 学生が入力した ID（例：学籍番号・ニックネーム）を内部で `"<id>@class.local"` に変換してログインに使う。
- サーバーに残るのは **本人が決めた ID ＋ ハッシュ化パスワードのみ**。氏名・実メールは保持しない。
- ログイン画面に「**氏名・本物のメールは入力しないこと**」を明示。
- Supabase の Authentication で **確認メールを OFF** にして即ログイン可能にする。

### パスワード忘れ対策

- 自己リセット（メールリンク）は使えないが、データ自体は消えない（サーバー＆ローカルに残る）。
- **教員が Supabase ダッシュボード（Authentication → Users）からリセット**できる運用とする。
- 画面の注意書きに「パスワードを忘れたら教員に連絡」と記載済み。
- （将来オプション）登録時にリカバリーコードを表示する方式も追加可能。

## 実装ファイル

- `slide-sync.js` … 共通モジュール。設定・UI（🔑ボタン/モーダル/CSS）注入・認証・同期をすべて内包。
  各スライドHTMLからは `SlideSync.init(adapter)` を呼ぶだけ。
- `math_econ_1.html` … 上記を読み込む `<script>` 2行と、`SlideSync.init({...})` のアダプタ呼び出し、
  `saveLocal` のフック（`window.SlideSync && SlideSync.scheduleRemoteSave()`）を実装済み。
  **現在は `<script>` 2行をコメントアウトして休眠中。**

### アダプタが渡すもの（host → slide-sync）

| 項目 | 内容 |
|---|---|
| `storageKey` | localStorage と同じページ固有キー（= 同期の `page_key`） |
| `getCanvas` | 手書き canvas（座標正規化用） |
| `getState` | `{ notes, strokes, boardStrokes, understanding, bookmarks, lastSlide }` を返す |
| `applyState` | 受け取った state を画面変数へ反映（strokes はピクセル座標で渡される） |
| `saveLocal(ts?)` | localStorage 保存。`ts` 指定時は再アップロードしない |
| `refresh` | メモ欄・スライドを再描画 |

## 有効化手順（次の長期休みに実施）

1. **Supabase プロジェクト作成**（https://supabase.com）。
2. **SQL Editor で `slide_data` テーブル＋行レベルセキュリティを作成**：

   ```sql
   create table public.slide_data (
     user_id    uuid not null references auth.users(id) on delete cascade,
     page_key   text not null,
     payload    jsonb not null,
     updated_at timestamptz not null default now(),
     primary key (user_id, page_key)
   );

   alter table public.slide_data enable row level security;

   create policy "users manage own rows"
     on public.slide_data
     for all
     using  (auth.uid() = user_id)
     with check (auth.uid() = user_id);
   ```

3. **`slide-sync.js` 冒頭の `CONFIG`** に `url`（Project URL）と `anonKey`（anon public key）を設定。
   - キーは Settings → API で取得。anon public キーは公開して問題ない（データは RLS で保護）。
4. **Authentication → Providers → Email で「Confirm email」を OFF**。
5. **`math_econ_1.html` の `<script>` 2行のコメントを外す**（休眠解除）。
6. ホスティングURL（`file://` 不可）で開いて動作確認：
   新規登録 → メモ記入 → 別端末で同一URL・同一IDでログイン → 同期されることを確認。

## 横展開（他スライド）

`math_econ_2.html` / `micro.html` 等も同じデータモデル（notes / strokes / boardStrokes / understanding /
bookmarks、`STORAGE_KEY`、`getCanvas`、`showSlide`、`saveLocal`）なので、各HTMLに

- `<script>` 2行（supabase CDN ＋ `slide-sync.js`）
- 初期化部の `SlideSync.init({...})` アダプタ呼び出し
- `saveLocal` のフック

を同様に追加すれば再利用できる。`slide-sync.js` 自体は共通なので 1 箇所の設定で済む。

## 注意

- 同期キー `page_key` は URL パス由来。**同じホスティングURLで開く限り**端末間で一致する（`file://` 直開きは不一致）。
- データ量：手書きが多いと payload が大きくなる。無料枠でも通常は問題ないが、極端なら容量に注意。
