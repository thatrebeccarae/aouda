import type { Tool } from '../agent/tools.js';
import { getContext, isBrowserConfigured, getBrowserTimeout } from '../browser/manager.js';

/**
 * Twitter login tool — reads credentials from process.env and
 * logs into x.com using the persistent browser context.
 * Cookies persist across restarts via the browser profile.
 */
export function getTwitterLoginTool(): Tool | null {
  if (!isBrowserConfigured()) return null;

  const username = process.env.TWITTER_USERNAME;
  const password = process.env.TWITTER_PASSWORD;
  if (!username || !password) return null;

  return {
    name: 'twitter_login',
    description:
      'Log into Twitter/X using stored credentials. Call this when you need to ' +
      'authenticate on x.com. No parameters needed — credentials are read from config. ' +
      'After login, session cookies persist so you only need to do this once.',
    input_schema: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const ctx = await getContext();
      const page = await ctx.newPage();

      try {
        // Navigate to login — use domcontentloaded, not networkidle
        // (Twitter's login SPA never stops making requests)
        await page.goto('https://x.com/i/flow/login', {
          waitUntil: 'domcontentloaded',
          timeout: getBrowserTimeout(),
        });

        // Wait for the username field
        await page.waitForSelector('input[autocomplete="username"]', { timeout: 15000 });
        await page.fill('input[autocomplete="username"]', username);

        // Click Next
        const nextBtn = page.getByRole('button', { name: 'Next' });
        await nextBtn.click();

        // Wait for password field
        await page.waitForSelector('input[type="password"]', { timeout: 15000 });
        await page.fill('input[type="password"]', password);

        // Click Log in
        const loginBtn = page.getByRole('button', { name: 'Log in' });
        await loginBtn.click();

        // Wait for navigation to home
        await page.waitForURL('**/home**', { timeout: 30000 });
        const title = await page.title();

        return `Successfully logged into Twitter/X. Page title: ${title}. Session cookies saved — you can now use browser_navigate to interact with x.com.`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Twitter login failed: ${msg}. You may need to handle a CAPTCHA or verification challenge manually.`;
      } finally {
        await page.close();
      }
    },
  };
}
