#!/usr/bin/env node
/**
 * Connect to a running Chrome instance via CDP and export cookies for x.com.
 * 
 * Prerequisites: Chrome must be running with remote debugging enabled.
 * Restart Chrome on TARS with:
 *   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
 * 
 * Then run: node scripts/export-cookies.mjs
 */
import { chromium } from 'playwright-chromium';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CDP_URL = 'http://127.0.0.1:9222';

try {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  
  if (contexts.length === 0) {
    console.error('No browser contexts found.');
    process.exit(1);
  }

  const cookies = await contexts[0].cookies('https://x.com');
  const outPath = resolve(process.cwd(), 'data', 'twitter-cookies.json');
  writeFileSync(outPath, JSON.stringify(cookies, null, 2));
  console.log(`Exported ${cookies.length} cookies to ${outPath}`);
  
  await browser.close();
} catch (err) {
  console.error('Failed to connect. Make sure Chrome is running with --remote-debugging-port=9222');
  console.error(err.message);
  process.exit(1);
}
