# ライブ配信（presenter / viewer）と PC 録画 — `slide-live.js`

iPad で書きながら、PC（や学生の端末）に同じスライド・手書き・ポインター・板書を
リアルタイムに映す仕組み。PC 側ではスライド内の 🔴 ボタンでそのタブを録画できる。

- 通信は Supabase Realtime の **Broadcast / Presence**（DB 書き込みなし、追加設定なし）。
- `slide-sync.js`（ログイン）が前提。対応ファイル：`2026/micro.html`、`2026/math_econ_2.html`、`2027/math_econ_1.html`、`2027/basicmath_for_KK.html`（2027 は同ディレクトリの `slide-sync.js` / `slide-live.js` のコピーを使う。更新時は両方に反映すること）。

## URL の使い分け

| URL | 用途 | 見えるもの |
|---|---|---|
| `micro.html` | 学生（通常） | 今まで通り。ライブ関連 UI は一切出ない |
| `micro.html?presenter=1` | 自分の iPad | 📡 配信開始／停止（要ログイン）、📱 受信用 URL/QR |
| `micro.html?live=1` | 学生・PC（受信） | 📡 状態バッジ、「追従解除／追従する」ボタン。配信者の手書きは別レイヤーに表示 |
| `micro.html?live=1&rec=1` | 録画用 PC | 受信 ＋ 🔴 録画ボタン |

`live=` の値が「部屋コード」。presenter は `?presenter=1&live=CODE` で部屋を変えられる（省略時 `1`）。
スライド番号は `#12` のハッシュなので、クエリはそのまま保たれる。

## 授業の流れ（推奨構成：プロジェクタは PC）

1. PC の Chrome で `micro.html?live=1&rec=1` を開く → 🔴 録画 →（長時間なら「保存先を指定」）→ ▶ → 「このタブ」を選ぶ
2. iPad で `micro.html?presenter=1` を開く → 📡 配信 → ログイン → ボタンが緑「📡 配信中 (n)」になる
3. 授業。ページ送り・手書き・ポインター・板書がすべて PC に反映される
4. 終わったら iPad で 📡 → 停止。PC 側は「配信が終了しました。120 秒後に録画を停止」のバナーが出て自動停止・保存

録画ダイアログで **🎤 マイクを選択**できる（選択は記憶される）。レベルメーターが動けば音を拾えている。
「マイクなし（タブの音声のみ）」も選べる。マイクが取れない場合はダイアログに原因（権限拒否・未接続・他アプリが占有）が表示される。

止め忘れ保険：配信終了（または iPad がスリープして切断）から 120 秒で自動停止、最長 240 分で自動停止。
タブを閉じようとすると警告。音声は **PC のマイク**で録る（iPad の音声は飛ばさない）。

## 設定（`slide-live.js` 冒頭の `CONFIG`）

| キー | 既定 | 意味 |
|---|---|---|
| `presenterIds` | `[]` | 配信を許可するログイン ID（`@` より前）。**空だとログイン済みなら誰でも配信できるので、必ず自分の ID を入れる** |
| `privateChannel` | `false` | Supabase 側で RLS を設定したら `true`（下記） |
| `tickMs` / `fullEveryMs` | 60 / 8000 | 差分送信間隔／全体スナップショット間隔 (ms) |
| `recBitrate` | 2 Mbps | 録画ビットレート |
| `recMaxMin` / `recAutoStopSec` | 240 / 120 | 録画の最長時間（分）／配信終了後の自動停止までの秒数 |

## なりすまし防止（任意・後付け可）

静的サイトなのでクライアント側の判定は突破できる。学生が勝手に配信できないよう
Supabase の private channel + RLS を使う場合、SQL Editor で：

```sql
create policy "anyone can listen" on realtime.messages
  for select to anon, authenticated using (true);

create policy "only presenter can send" on realtime.messages
  for insert to authenticated
  with check (auth.uid() = '<先生の user_id (auth.users.id)>');
```

その後 `CONFIG.privateChannel = true`。

## プロトコル（メモ）

チャンネル名 `live:<pageKey>:<code>`、イベント名 `m`。座標は canvas サイズで 0–1 に正規化。

| `t` | 内容 |
|---|---|
| `full` | `{i, s:[stroke], bo, b:[stroke], p}` 現在スライドの全状態。スライド切替時・8 秒ごと・`hello` 受信時 |
| `stroke` / `pts` / `list` | 新しいストローク／末尾ストロークへの点追加／全体置換（消去・取消時）。`k:'s'|'b'` で手書き／板書 |
| `ptr` | ポインター位置 `[x,y]` or `null` |
| `board` | 板書ポップアップ開閉 `{on}` |
| `hello` | viewer → presenter：全体を要求 |
| `media` | 動画・埋め込みオーバーレイの開閉 `{u}`（iframe の URL、srcdoc テンプレートは `tpl:ID`、閉じたら `null`） |
| `end` | 配信終了 |

stroke 形式：`{c:色, w:太さ, a:透明度, p:[[x,y],...]}`。
Presence で presenter の在否と viewer 数を把握。

## 動画・GeoGebra などの埋め込みと録画・配信

- **タブ録画はそのタブの中身しか映らない**。新しいタブや別アプリで開いたものは録画に入らない（配信にも流れない）。
- そのため Vimeo・GeoGebra・自サイト（`ttajika.github.io`）へのリンクは**タブ内オーバーレイ（iframe）で開く**ようにしてある。
  `math_econ_2.html` の qr-link もこのルールに変更済み（QR ボタン・QR 画像はそのまま学生向け）。
  それ以外の外部サイトは iframe 拒否の可能性があるので従来どおり新しいタブ。
- presenter がオーバーレイを開く／閉じると viewer も同じものを開く／閉じる（`media` イベント）。
  **iframe の中の操作（動画の再生位置、GeoGebra のスライダー操作）は同期しない**ので、
  動画を流す・GeoGebra を動かすのは録画／投影している PC 側で行うのが確実。
- 録画に動画の音を入れるには「このタブ」選択時に**「タブの音声を共有」**を ON にする。

## 制約

- スライド幅は可変（最大 1100px）なので、端末の画面幅が大きく違うと文章の折り返しが変わり、手書き位置が少しずれる（クラウド同期と同じ制約）。PC と iPad のウィンドウ幅を近づけるとよい。
- 録画は WebM（VP9/Opus）。MP4 が必要なら変換するか、PC の OS 録画／OBS を使う。
- iPad Safari からは録画できない（`getDisplayMedia` 非対応）。

## 他のスライドへの導入

1. `<script src="slide-sync.js">` の直後に `<script src="slide-live.js"></script>`
2. `SlideSync.init({...})` の直後に `micro.html` と同じ `SlideLive.init({...})` を追加（アダプタの変数名は各ファイルに合わせる）
3. 動画モーダルが `#videoOverlay` / `#videoContainer` 以外の構造なら `getMedia` / `setMedia` を渡す（例：`2027/basicmath_for_KK.html` は `#videoModal` / `#videoFrame`）

2026 の `math_econ_1.html`・`basicmath_for_KK.html` は終了済み科目のため未対応（2027 版で対応）。
