import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

// Playwright types — patchright is API-compatible
type Browser = import('patchright').Browser;
type BrowserContext = import('patchright').BrowserContext;

// ── Patchright availability ────────────────────────────────────────

let _patchrightAvailable: boolean | null = null;

/** Check if patchright is installed. Caches the result. */
export async function isPlaywrightAvailable(): Promise<boolean> {
  if (_patchrightAvailable !== null) return _patchrightAvailable;
  try {
    await import('patchright');
    _patchrightAvailable = true;
  } catch {
    _patchrightAvailable = false;
  }
  return _patchrightAvailable;
}

/**
 * Synchronous check — returns cached result or attempts require.resolve.
 * Use in contexts where async isn't possible (e.g. tool registration).
 */
export function isPlaywrightAvailableSync(): boolean {
  if (_patchrightAvailable !== null) return _patchrightAvailable;
  try {
    const require = createRequire(import.meta.url);
    require.resolve('patchright');
    _patchrightAvailable = true;
  } catch {
    _patchrightAvailable = false;
  }
  return _patchrightAvailable;
}

// ── Browser config ──────────────────────────────────────────────────

export function isBrowserConfigured(): boolean {
  if (process.env.BROWSER_ENABLED === 'false') return false;
  return isPlaywrightAvailableSync();
}

export function getBrowserTimeout(): number {
  return Number(process.env.BROWSER_TIMEOUT_MS) || 30_000;
}

export function getAllowedDomains(): string[] | null {
  const raw = process.env.BROWSER_ALLOWED_DOMAINS;
  if (!raw) return null; // null = all domains allowed
  return raw.split(',').map((d) => d.trim()).filter(Boolean);
}

// ── Persistent browser context ──────────────────────────────────────

const USER_DATA_DIR = resolve(process.cwd(), 'data', 'browser-profile');

let _context: BrowserContext | null = null;

/**
 * Get or create a persistent browser context.
 * Uses patchright (undetected Playwright fork) with real Chrome and a
 * user data directory so cookies, localStorage, and sessions survive
 * across tool calls and restarts.
 */
export async function getContext(): Promise<BrowserContext> {
  if (_context) return _context;

  mkdirSync(USER_DATA_DIR, { recursive: true });

  const { chromium } = await import('patchright');
  _context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: process.env.BROWSER_HEADLESS !== 'false',
    channel: 'chrome',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  });

  return _context;
}

/** @deprecated Use getContext() instead — kept for backward compat. */
export async function createContext(): Promise<BrowserContext> {
  return getContext();
}

export async function closeBrowser(): Promise<void> {
  if (_context) {
    await _context.close();
    _context = null;
  }
}
