const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const scenes = JSON.parse(fs.readFileSync('scenes.json'));
const VW = 1440, SW = 1600, SH = 900, OX = 160, OY = 24, K = SW / VW;
const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
function html(sc) {
  const base = `<!doctype html><html><head><meta charset="utf-8">
  <style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap');
  html,body{margin:0;width:1920px;height:1080px;overflow:hidden;font-family:'Noto Sans JP',sans-serif;
    background:radial-gradient(1200px 700px at 50% 30%,#1e293b 0%,#0f172a 70%);color:#f8fafc}
  .shot{position:absolute;left:${OX}px;top:${OY}px;width:${SW}px;height:${SH}px;border-radius:10px;
    box-shadow:0 20px 60px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08);overflow:hidden}
  .shot img{width:${SW}px;height:${SH}px;display:block}
  .hl{position:absolute;border:4px solid #f43f5e;border-radius:10px;box-shadow:0 0 0 4px rgba(244,63,94,.25),0 0 24px rgba(244,63,94,.6)}
  .cap{position:absolute;left:0;right:0;top:${OY + SH}px;bottom:0;display:flex;align-items:center;gap:28px;padding:0 160px}
  .chip{flex:none;background:#f43f5e;color:#fff;font-weight:700;font-size:22px;padding:8px 18px;border-radius:999px;letter-spacing:.02em}
  .txt{display:flex;flex-direction:column;gap:6px}
  .main{font-size:33px;font-weight:700;line-height:1.3}
  .sub{font-size:23px;color:#cbd5e1;line-height:1.35}
  .card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center}
  .card h1{font-size:76px;font-weight:900;margin:0;letter-spacing:.02em}
  .card .s{font-size:34px;color:#cbd5e1}
  .card .lines{text-align:left;font-size:40px;line-height:2;font-weight:500}
  .brand{position:absolute;right:48px;bottom:28px;font-size:18px;color:#64748b}
  </style></head><body>`;
  if (sc.card) {
    return base + `<div class="card"><h1>${esc(sc.title)}</h1>${sc.sub ? `<div class="s">${esc(sc.sub)}</div>` : ''}${sc.lines ? `<div class="lines">${sc.lines.map(esc).join('<br>')}</div>` : ''}</div><div class="brand">基礎ミクロ経済学 — 2026年度</div></body></html>`;
  }
  const img = 'data:image/png;base64,' + fs.readFileSync(sc.file).toString('base64');
  const hls = (sc.boxes || []).map(b => `<div class="hl" style="left:${OX + b.x * K - 8}px;top:${OY + b.y * K - 8}px;width:${b.width * K + 8}px;height:${b.height * K + 8}px"></div>`).join('');
  return base + `<div class="shot"><img src="${img}"></div>${hls}
  <div class="cap"><div class="chip">${esc(sc.chapter)}</div><div class="txt"><div class="main">${esc(sc.caption)}</div><div class="sub">${esc(sc.sub)}</div></div></div></body></html>`;
}
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const list = [];
  for (let i = 0; i < scenes.length; i++) {
    await pg.setContent(html(scenes[i]), { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(i === 0 ? 2500 : 300);
    const out = `frames/${String(i).padStart(2, '0')}.png`;
    await pg.screenshot({ path: out });
    list.push({ file: out, dur: scenes[i].dur || 6 });
  }
  fs.writeFileSync('list.json', JSON.stringify(list));
  await b.close();
  console.log('frames', list.length);
})();
