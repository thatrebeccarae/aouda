import type { Tool } from '../agent/tools.js';
import { getContext, isBrowserConfigured, getBrowserTimeout } from '../browser/manager.js';

/**
 * Twitter post tool — composes and sends a tweet via the browser.
 * Requires an active Twitter session (call twitter_login first if needed).
 */
export function getTwitterPostTool(): Tool | null {
  if (!isBrowserConfigured()) return null;

  return {
    name: 'twitter_post',
    description:
      'Post a tweet on Twitter/X. Requires being logged in (session cookies from twitter_login). ' +
      'Takes the tweet text as input and posts it via the compose box on x.com.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The tweet text to post (max 280 characters)',
        },
      },
      required: ['text'],
    },
    handler: async (input) => {
      const text = input.text as string;
      if (!text.trim()) return 'Error: tweet text cannot be empty';
      if (text.length > 280) return `Error: tweet is ${text.length} chars, max 280`;

      const ctx = await getContext();
      const page = await ctx.newPage();

      try {
        // Go to home (compose is available there)
        await page.goto('https://x.com/home', {
          waitUntil: 'domcontentloaded',
          timeout: getBrowserTimeout(),
        });

        // Wait for compose box
        const composeSelector = 'div[data-testid="tweetTextarea_0"]';
        await page.waitForSelector(composeSelector, { timeout: 15000 });

        // Click into compose and type
        await page.click(composeSelector);
        await page.keyboard.type(text, { delay: 30 });

        // Small pause to let Twitter process the input
        await page.waitForTimeout(1000);

        // Click the Post button — scroll into view first, use force click as backup
        const postBtn = page.getByTestId('tweetButtonInline');
        await postBtn.scrollIntoViewIfNeeded();
        await postBtn.click({ timeout: 10000 });

        // Verify: wait for compose box to clear (indicates tweet was sent)
        let verified = false;
        for (let i = 0; i < 10; i++) {
          await page.waitForTimeout(1000);
          const content = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="tweetTextarea_0"]');
            return el?.textContent?.trim() ?? '';
          });
          if (content === '' || content === 'What is happening?!' || content === "What's happening?") {
            verified = true;
            break;
          }
        }

        if (!verified) {
          // Take a debug screenshot
          const { mkdirSync } = await import('node:fs');
          const { join, resolve } = await import('node:path');
          const ssDir = resolve(process.cwd(), 'data', 'workspace', 'screenshots');
          mkdirSync(ssDir, { recursive: true });
          await page.screenshot({ path: join(ssDir, `tweet-fail-${Date.now()}.png`) });
          return `Tweet may not have posted — compose box did not clear after clicking Post. Debug screenshot saved.`;
        }

        return `Tweet posted and verified: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Failed to post tweet: ${msg}. Make sure you're logged in (call twitter_login first).`;
      } finally {
        await page.close();
      }
    },
  };
}
