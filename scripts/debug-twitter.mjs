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

console.log('Page title:', await page.title());

// Type into compose
const composeSelector = '[data-testid="tweetTextarea_0"]';
await page.click(composeSelector);
await page.waitForTimeout(500);
await page.keyboard.type('testing 1 2 3', { delay: 30 });
await page.waitForTimeout(1000);

// Screenshot before clicking post
await page.screenshot({ path: resolve(screenshotDir, 'before-post.png') });
console.log('Before-post screenshot saved');

// Click post
const postBtn = page.getByTestId('tweetButtonInline');
await postBtn.scrollIntoViewIfNeeded();
await postBtn.click({ timeout: 10000 });

// Wait and check
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1000);
  const content = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="tweetTextarea_0"]');
    return el?.textContent?.trim() ?? '';
  });
  console.log(`Check ${i+1}: compose text = "${content}"`);
  if (content === '' || content === 'What is happening?!' || content === "What's happening?") {
    console.log('VERIFIED: compose box cleared — tweet posted!');
    break;
  }
}

await page.screenshot({ path: resolve(screenshotDir, 'after-post.png') });
console.log('After-post screenshot saved');

await page.close();
await ctx.close();
process.exit(0);
