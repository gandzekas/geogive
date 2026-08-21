// Generates Play Store screenshots (1080x1920) with phone frames.
// Run: node scripts/gen-screenshots.js  (requires playwright chromium)
// CI: runs in the e2e workflow where browsers are installed.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.SITE_URL || 'https://gandzekas.github.io/geogive/';
const OUT = path.join(__dirname, '..', 'store', 'screenshots');
const W = 1080, H = 1920;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });

  // Seed demo data so screenshots look alive
  await page.addInitScript(() => {
    localStorage.setItem('geogive_onboarded', 'true');
    localStorage.setItem('geogive_guidelines_accepted', 'true');
  });

  const shots = [
    { name: '01-browse.png', goto: '/', wait: '.item-card', label: 'Browse nearby giveaways' },
    { name: '02-map.png', goto: '/#browse', wait: '#map', label: 'Map view', mapClick: true },
    { name: '03-post.png', goto: '/#post', wait: '#postForm', label: 'Post in seconds' },
    { name: '04-chat.png', goto: '/#requests', wait: 'main', label: 'Chat & requests' },
    { name: '05-profile.png', goto: '/#profile', wait: 'main', label: 'Profiles & trust' },
  ];

  for (const s of shots) {
    try {
      await page.goto(BASE + s.goto, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector(s.wait, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1500);
      if (s.mapClick) {
        // switch to map view if button exists
        const btn = page.locator('#viewMapBtn');
        if (await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(2500); }
      }
      await page.screenshot({ path: path.join(OUT, s.name), fullPage: false });
      console.log('captured', s.name);
    } catch (e) {
      console.warn('FAILED', s.name, e.message);
    }
  }
  await browser.close();
})();
