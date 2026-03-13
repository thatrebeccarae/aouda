import { chromium } from 'patchright';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const profileDir = resolve(process.cwd(), 'data', 'browser-profile');
const screenshotDir = resolve(process.cwd(), 'data', 'workspace', 'screenshots');
mkdirSync(screenshotDir, { recursive: true });

const ctx = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  channel: 'chrome',
  viewport: { width: 1280, height: 720 },
  locale: 'en-US',
});

const page = await ctx.newPage();
await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(6000);

console.log('Title:', await page.title());
console.log('URL:', page.url());
const body = await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? '(empty)');
console.log('Body:', body);

await page.screenshot({ path: resolve(screenshotDir, 'session-check.png') });
console.log('Screenshot saved');

await page.close();
await ctx.close();
process.exit(0);
