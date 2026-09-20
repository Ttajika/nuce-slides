const { chromium } = require('playwright');
const fs = require('fs');
const SRC = 'file:///Users/tomoyatajika/Documents/GitHub/nuce-slides/2026/micro.html';
const VW = 1440, VH = 810;           // page viewport (16:9)
const SW = 1600, SH = 900;           // screenshot display size in frame
const OX = 160, OY = 0;              // screenshot offset in 1920x1080 frame
const scenes = [];                   // {file, chapter, caption, sub, boxes, dur, card}

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  await pg.goto(SRC);
  await pg.waitForTimeout(4000);
  await pg.evaluate(() => { localStorage.clear(); goSlide(6); });
  await pg.waitForTimeout(1200);

  const box = async (sel) => { const e = await pg.$(sel); if (!e) return null; const bb = await e.boundingBox(); return bb; };
  const boxes = async (sels) => (await Promise.all(sels.map(box))).filter(Boolean);
  let n = 0;
  const shot = async (opts) => {
    const file = `raw/${String(n++).padStart(2,'0')}.png`;
    const bx = await boxes(opts.hl || []);
    await pg.screenshot({ path: file });
    scenes.push({ file, boxes: bx, ...opts });
  };
  const card = (opts) => scenes.push({ card: true, ...opts });

  // ── Title
  card({ title: '講義スライドの使い方', sub: '書く・メモ・保存（ログイン）の3つの機能', dur: 5 });

  // ── Overview
  await shot({ chapter: 'はじめに', caption: 'スライドはブラウザで開きます．上のバーにあるボタンで操作します．',
    sub: '今回説明するのは ✏️ 書く，📝 メモ，🔑 保存（ログイン）の3つです．', hl: ['#drawToggleBtn', 'button[onclick="toggleNotes()"]', '#ssAuthBtn'], dur: 7 });

  // ── 1. Draw
  card({ title: '① 書く機能', sub: 'スライドに直接ペンで書き込む', dur: 3.5 });
  await pg.click('#drawToggleBtn'); await pg.waitForTimeout(500);
  await shot({ chapter: '① 書く機能', caption: '✏️ を押すと書き込みモードになり，ツールバーが出ます．',
    sub: 'キーボードの D でも切り替えられます．もう一度押すと元に戻ります．', hl: ['#drawToggleBtn', '#drawToolbar'], dur: 7 });

  // pen: circle around the frame title & underline
  await pg.evaluate(() => { const s = document.getElementById('sizeSlider'); s.value = 4; s.dispatchEvent(new Event('input')); });
  const t = await pg.evaluate(() => { const el = document.querySelector('#slideContent .frame-title'); const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
  const cx = t.x + t.width / 2, cy = t.y + t.height / 2, rx = t.width / 2 + 24, ry = t.height / 2 + 14;
  await pg.mouse.move(cx + rx, cy); await pg.mouse.down();
  for (let a = 0; a <= 370; a += 6) { const r = a * Math.PI / 180; await pg.mouse.move(cx + rx * Math.cos(r) + (a > 360 ? 6 : 0), cy + ry * Math.sin(r) * 1.05); }
  await pg.mouse.up();
  const lis = await pg.$$('#slideContent li');
  const l1 = await lis[1].boundingBox();
  // wavy underline
  await pg.mouse.move(l1.x, l1.y + l1.height + 2); await pg.mouse.down();
  for (let x = 0; x <= Math.min(l1.width, 420); x += 8) await pg.mouse.move(l1.x + x, l1.y + l1.height + 2 + 3 * Math.sin(x / 10));
  await pg.mouse.up();
  await pg.waitForTimeout(300);
  await shot({ chapter: '① 書く機能', caption: 'ペン ✏️ を選んで，マウスや指でスライドの上に直接書き込めます．',
    sub: '色と太さはツールバーで選べます．', hl: ['#btnPen', '.draw-toolbar .tool-group:nth-child(2)', '.draw-toolbar .tool-group:nth-child(3)'], dur: 7 });

  // highlighter
  await pg.click('#btnHL'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { const s = document.getElementById('sizeSlider'); s.value = 14; s.dispatchEvent(new Event('input')); });
  const l0 = await lis[0].boundingBox();
  await pg.mouse.move(l0.x, l0.y + l0.height / 2); await pg.mouse.down();
  for (let x = 0; x <= Math.min(l0.width, 480); x += 10) await pg.mouse.move(l0.x + x, l0.y + l0.height / 2);
  await pg.mouse.up(); await pg.waitForTimeout(300);
  await shot({ chapter: '① 書く機能', caption: 'ハイライト 🖍️ を選ぶと，大事な部分にマーカーを引けます．',
    sub: 'ハイライトは半透明なので，下の文字が隠れません．', hl: ['#btnHL'], dur: 6 });

  // eraser / undo
  await shot({ chapter: '① 書く機能', caption: '書き間違えたら 🧹 消しゴムでなぞって消せます．',
    sub: '↩️ で1つ前の線を取り消し（Ctrl+Z），🗑️ でこのスライドの書き込みを全部消します．', hl: ['#btnEraser', '.draw-toolbar .tool-group:nth-child(4) .draw-btn:nth-child(1)', '.draw-toolbar .tool-group:nth-child(4) .draw-btn:nth-child(2)'], dur: 7 });

  // board
  await pg.click('#btnBoard'); await pg.waitForTimeout(600);
  const bc = await box('#boardCanvas');
  const draw = async (pts) => { await pg.mouse.move(pts[0][0], pts[0][1]); await pg.mouse.down(); for (const p of pts.slice(1)) await pg.mouse.move(p[0], p[1]); await pg.mouse.up(); };
  const bx0 = bc.x + 80, by0 = bc.y + bc.height - 80;
  // axes
  await draw([[bx0, by0], [bx0 + 420, by0]]);
  await draw([[bx0, by0], [bx0, by0 - 320]]);
  // demand curve
  { const pts = []; for (let i = 0; i <= 40; i++) pts.push([bx0 + 40 + i * 9, by0 - 290 + i * 6.5]); await draw(pts); }
  // supply curve
  { const pts = []; for (let i = 0; i <= 40; i++) pts.push([bx0 + 40 + i * 9, by0 - 30 - i * 6.5]); await draw(pts); }
  // "P" "Q" labels roughly (small strokes)
  await draw([[bx0 - 30, by0 - 300], [bx0 - 30, by0 - 270]]);
  await draw([[bx0 - 30, by0 - 300], [bx0 - 12, by0 - 296], [bx0 - 12, by0 - 286], [bx0 - 30, by0 - 284]]);
  await draw([[bx0 + 430, by0 + 12], [bx0 + 420, by0 + 22], [bx0 + 430, by0 + 36], [bx0 + 444, by0 + 24], [bx0 + 434, by0 + 12]]);
  await draw([[bx0 + 440, by0 + 32], [bx0 + 450, by0 + 40]]);
  await pg.waitForTimeout(300);
  await shot({ chapter: '① 書く機能', caption: '📋 板書スペースを押すと，白紙の画面が開きます．',
    sub: 'スライドに書き切れない計算やグラフはここに．スライドごとに別の白紙が用意されます（B キー）．', hl: ['.board-popup-inner'], dur: 7 });
  await pg.evaluate(() => toggleBoard()); await pg.waitForTimeout(400);

  // saved per slide
  await pg.evaluate(() => nextSlide()); await pg.waitForTimeout(700);
  await shot({ chapter: '① 書く機能', caption: '書き込みはスライドごとに記録されます．',
    sub: '次のページに進むと消えたように見えますが，戻るとちゃんと残っています．', hl: ['#pageInfo'], dur: 6 });
  await pg.evaluate(() => prevSlide()); await pg.waitForTimeout(700);
  await pg.click('#drawToggleBtn'); await pg.waitForTimeout(400);

  // ── 2. Notes
  card({ title: '② メモ機能', sub: 'スライドごとに文字でメモを残す', dur: 3.5 });
  await pg.click('button[onclick="toggleNotes()"]'); await pg.waitForTimeout(500);
  await shot({ chapter: '② メモ機能', caption: '📝 を押すと，右側にメモ欄が開きます．',
    sub: 'キーボードの N でも開閉できます．', hl: ['button[onclick="toggleNotes()"]', '#notesPanel'], dur: 6 });
  await pg.click('#noteArea');
  await pg.type('#noteArea', '・モデル分析 = 現実を単純化して考える\n・「仮定」が何かを必ずメモする\n・小テスト範囲！\n\n質問：均衡はいつも存在する？\n→ 次回オフィスアワーで聞く', { delay: 5 });
  await pg.waitForTimeout(600);
  await shot({ chapter: '② メモ機能', caption: 'メモはスライドごとに別々に保存されます．',
    sub: '上に「メモ（スライド N）」と表示されます．ページを移動すると，そのページのメモに切り替わります．', hl: ['.notes-header'], dur: 7 });

  // ── 3. Save / Login
  card({ title: '③ 保存（ログイン）', sub: 'メモと手書きを失わないために', dur: 3.5 });
  await shot({ chapter: '③ 保存（ログイン）', caption: 'メモと手書きは，何もしなくてもブラウザに自動保存されます．',
    sub: 'ただしブラウザのデータ消去や，別の端末（スマホ⇄PC）では引き継がれません．', hl: ['#notesPanel'], dur: 7 });
  await pg.click('button[onclick="toggleNotes()"]'); await pg.waitForTimeout(300);
  await pg.click('#ssAuthBtn'); await pg.waitForTimeout(500);
  await shot({ chapter: '③ 保存（ログイン）', caption: '🔑 を押すと，ログイン画面が開きます．',
    sub: 'ログインすると，メモ・手書き・理解度チェックがクラウドに保存され，どの端末からでも同じ内容が見られます．', hl: ['#ssAuthBtn', '.ss-modal'], dur: 7 });
  await pg.fill('#ssId', 'a1234567');
  await pg.fill('#ssPw', 'password123');
  await pg.waitForTimeout(300);
  await shot({ chapter: '③ 保存（ログイン）', caption: 'ID とパスワード（6文字以上）を入力し，初回は「新規登録」を押します．',
    sub: 'ID は学籍番号など自由に決めてOK．氏名や本物のメールアドレスは入力しないでください．', hl: ['#ssSignupBtn'], dur: 8 });
  await shot({ chapter: '③ 保存（ログイン）', caption: '2回目以降は，同じ ID とパスワードで「ログイン」を押します．',
    sub: 'パスワードを忘れたときは，教員に連絡すればリセットできます．', hl: ['#ssLoginBtn'], dur: 6 });
  // mock logged-in state (no real account is created)
  await pg.evaluate(() => {
    document.getElementById('ssLoginView').style.display = 'none';
    document.getElementById('ssUserView').style.display = 'block';
    document.getElementById('ssUserId').textContent = 'a1234567';
    document.getElementById('ssAuthBtn').classList.add('logged-in');
    document.getElementById('ssAuthBtn').title = 'ログイン中: a1234567';
    const s = document.getElementById('ssSyncStatus'); s.textContent = '✓ 同期済み'; s.className = 'synced';
  });
  await pg.waitForTimeout(300);
  await shot({ chapter: '③ 保存（ログイン）', caption: 'ログインできると「ログイン中」になり，以後は自動でクラウドと同期されます．',
    sub: '「いま同期する」で手動同期，「ログアウト」で切断できます．', hl: ['.ss-modal'], dur: 7 });
  await pg.click('#ssCloseBtn2'); await pg.waitForTimeout(400);
  await shot({ chapter: '③ 保存（ログイン）', caption: 'ログイン中は 🔑 が緑色になり，横に「✓ 同期済み」と出ます．',
    sub: 'スマホでも同じ ID でログインすれば，PC で書いたメモがそのまま見られます．', hl: ['#ssAuthBtn', '#ssSyncStatus'], dur: 7 });

  // ── Summary
  card({ title: 'まとめ', lines: ['✏️  書く：ペン・ハイライト・板書スペース（D キー）', '📝  メモ：スライドごとにメモを残す（N キー）', '🔑  保存：ログインすればクラウドに保存され，どの端末でも同じ'], dur: 9 });

  fs.writeFileSync('scenes.json', JSON.stringify(scenes, null, 2));
  await b.close();
  console.log('captured', scenes.length, 'scenes');
})().catch(e => { console.error(e); process.exit(1); });
