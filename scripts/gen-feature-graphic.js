// Generates Play Store feature graphic (1024x500) from brand colors.
const { chromium } = require('playwright');
const path = require('path');

const html = `<!DOCTYPE html><html><body style="margin:0">
<canvas id="c" width="1024" height="500"></canvas>
<script>
const c = document.getElementById('c');
const ctx = c.getContext('2d');
const g = ctx.createLinearGradient(0,0,1024,500);
g.addColorStop(0,'#237a3e'); g.addColorStop(1,'#1b5e20');
ctx.fillStyle = g; ctx.fillRect(0,0,1024,500);
ctx.font = 'bold 88px system-ui, sans-serif';
ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
ctx.fillText('GeoGive', 512, 220);
ctx.font = '36px system-ui, sans-serif';
ctx.fillStyle = '#c8e6c9';
ctx.fillText('Give things away. Not throw them away.', 512, 290);
ctx.font = '64px serif';
ctx.fillText('🎁 📍 💬 ⭐', 512, 400);
</script></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 600 } });
  await page.setContent(html);
  await page.waitForTimeout(500);
  const buf = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  require('fs').writeFileSync(path.join(__dirname, '..', 'store', 'feature-graphic.png'), Buffer.from(buf.split(',')[1], 'base64'));
  console.log('feature-graphic.png written');
  await browser.close();
})();
