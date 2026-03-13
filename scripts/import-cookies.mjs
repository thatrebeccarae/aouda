#!/usr/bin/env node
/**
 * Import cookies into Aouda's persistent browser profile.
 * Run after export-cookies.mjs.
 * 
 * Usage: node scripts/import-cookies.mjs
 */
import { chromium } from 'playwright-chromium';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const USER_DATA_DIR = resolve(process.cwd(), 'data', 'browser-profile');
const COOKIES_PATH = resolve(process.cwd(), 'data', 'twitter-cookies.json');

mkdirSync(USER_DATA_DIR, { recursive: true });

const cookies = JSON.parse(readFileSync(COOKIES_PATH, 'utf-8'));
console.log(`Loaded ${cookies.length} cookies from ${COOKIES_PATH}`);

const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: true,
  channel: 'chrome',
  viewport: { width: 1280, height: 720 },
  locale: 'en-US',
});

await context.addCookies(cookies);

// Verify by navigating to x.com
const page = await context.newPage();
await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
const title = await page.title();
const text = await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? '');

console.log(`Page title: ${title}`);
console.log(`Content preview: ${text.slice(0, 200)}`);

if (text.includes('Home') || text.includes('post') || text.includes('What')) {
  console.log('\nSuccess — logged in and session saved to persistent profile.');
} else {
  console.log('\nWarning — may not be logged in. Check the content above.');
}

await page.close();
await context.close();
