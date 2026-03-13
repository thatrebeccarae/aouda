import { chromium } from 'patchright';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const profileDir = resolve(process.cwd(), 'data', 'browser-profile');
mkdirSync(profileDir, { recursive: true });

console.log('Launching browser with Aouda profile...');
console.log('Log into Twitter, then close the browser window when done.');

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1280, height: 720 },
  locale: 'en-US',
});

const page = await context.newPage();
await page.goto('https://x.com');

// Wait for user to close the browser
context.on('close', () => {
  console.log('Browser closed. Session cookies saved.');
  process.exit(0);
});
