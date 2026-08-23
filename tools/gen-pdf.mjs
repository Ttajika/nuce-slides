import puppeteer from 'puppeteer-core';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 使い方: node tools/gen-pdf.mjs <出力ディレクトリ> <ベースURL> <html...>
//   例: cd 2026 && python3 -m http.server 8765 &
//       node ../tools/gen-pdf.mjs pdf http://localhost:8765 micro.html math_econ_1.html
//   依存: npm i puppeteer-core （Google Chrome がインストールされていること）
const [,, outDir, base, ...files] = process.argv;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
for (const f of files) {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 1000, height: 1400 });
  await page.goto(base.replace(/\/$/, '') + '/' + f, { waitUntil: 'networkidle2', timeout: 120000 });
  await page.waitForFunction(() => typeof MathJax !== 'undefined' && MathJax.typesetPromise && document.querySelectorAll('template.slide-data').length > 0, { timeout: 60000 });
  await sleep(1000);
  const title = await page.evaluate(() => document.title);
  await page.evaluate(() => { enterPrintMode(); if (!document.body.classList.contains('page-break-on')) togglePageBreak(); });
  // wait for MathJax to finish typesetting the print view
  await page.waitForFunction(() => !document.querySelector('mjx-container') || true, { timeout: 5000 });
  await page.evaluate(async () => { await MathJax.typesetPromise(); });
  await sleep(1500);
  // hide fixed UI that would repeat on every page
  await page.addStyleTag({ content: '.mode-toggle,.page-break-toggle,.fab-pen,.hints,#ssOverlay,.sl-overlay,.topbar,.filter-bar,.draw-toolbar{display:none!important} html,body,.main,.slide-area,.print-slide{background:#fff!important}' });
  await page.emulateMediaType('print');
  const out = `${outDir}/${title.replace(/[\/\\:]/g, '-')}.pdf`;
  await page.pdf({ path: out, format: 'A4', printBackground: true, scale: 0.8, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' }, preferCSSPageSize: false });
  console.log('wrote', out, 'errors:', errs.join('|') || 'none');
  await page.close();
}
await browser.close();
