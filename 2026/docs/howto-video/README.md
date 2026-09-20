# micro_howto.mp4 の作り方

`micro.html` の使い方（書く・メモ・保存/ログイン）を，スクショ＋テロップの動画にするスクリプト．

```sh
mkdir work && cd work && npm init -y && npm i playwright ffmpeg-static
cp ../capture.js ../compose.js ../build.sh . && mkdir raw frames
node capture.js   # Chrome で micro.html を操作してスクショ（raw/）＋ scenes.json
node compose.js   # 1920x1080 のテロップ付きフレーム（frames/）
bash build.sh     # xfade でつないで out.mp4
```

- 各シーンのテロップ・秒数は `capture.js` の `shot({...})` / `card({...})` を編集する．
- ログイン後の画面はモック（実際のアカウントは作らない）．
