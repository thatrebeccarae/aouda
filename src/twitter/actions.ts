import type { Tool } from '../agent/tools.js';
import { getContext, isBrowserConfigured, getBrowserTimeout } from '../browser/manager.js';
import { wrapAndDetect } from '../security/content-boundary.js';

const MAX_TEXT = 3000;

/** Shared helper — opens a new page, navigates, runs fn, closes page. */
async function withTwitterPage<T>(
  url: string,
  fn: (page: import('patchright').Page) => Promise<T>,
): Promise<T> {
  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: getBrowserTimeout() });
    await page.waitForTimeout(3000); // let SPA render
    return await fn(page);
  } finally {
    await page.close();
  }
}

/**
 * All browser-based Twitter action tools.
 * These share the patchright persistent context (same cookies as twitter_post).
 */
export function getTwitterActionTools(): Tool[] {
  if (!isBrowserConfigured()) return [];

  return [
    // ── twitter_browse ─────────────────────────────────────────────────
    {
      name: 'twitter_browse',
      description:
        'Browse any page on x.com using your authenticated session. Returns page text content ' +
        'and any tweet text visible on the page. Use this to view profiles, search results, ' +
        'trending topics, notifications, or any x.com URL.',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Full x.com URL to browse (e.g., "https://x.com/justaouda", "https://x.com/search?q=AI")',
          },
        },
        required: ['url'],
      },
      handler: async (input) => {
        const url = input.url as string;
        if (!url.includes('x.com') && !url.includes('twitter.com')) {
          return 'Error: twitter_browse only works on x.com/twitter.com URLs. Use browser_navigate for other sites.';
        }

        return withTwitterPage(url, async (page) => {
          const title = await page.title();

          // Extract tweets on the page
          const tweets = await page.evaluate((max: number) => {
            const tweetEls = document.querySelectorAll('[data-testid="tweetText"]');
            return Array.from(tweetEls).slice(0, 20).map((el, i) => {
              const text = (el as HTMLElement).innerText?.trim().slice(0, 500) ?? '';
              // Try to find the author
              const article = el.closest('article');
              const userEl = article?.querySelector('[data-testid="User-Name"]');
              const user = userEl ? (userEl as HTMLElement).innerText?.split('\n')[0]?.trim() ?? '' : '';
              return `[${i + 1}] ${user}: ${text}`;
            });
          }, MAX_TEXT);

          // Also get general page text
          let pageText = await page.evaluate((max: number) =>
            document.body?.innerText?.slice(0, max) ?? '', MAX_TEXT);

          pageText = wrapAndDetect(pageText, `twitter:${url}`);

          const parts = [`URL: ${url}`, `Title: ${title}`];
          if (tweets.length > 0) {
            parts.push(`\nTweets on page (${tweets.length}):\n${tweets.join('\n')}`);
          }
          parts.push(`\nPage text (first ${MAX_TEXT} chars):\n${pageText}`);

          return parts.join('\n');
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return `Error browsing ${url}: ${msg}`;
        });
      },
    },

    // ── twitter_follow ─────────────────────────────────────────────────
    {
      name: 'twitter_follow',
      description:
        'Follow a Twitter/X account. Navigate to their profile and click Follow.',
      input_schema: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'Username to follow (without @, e.g., "justaouda")',
          },
        },
        required: ['username'],
      },
      handler: async (input) => {
        const username = (input.username as string).replace(/^@/, '');

        return withTwitterPage(`https://x.com/${username}`, async (page) => {
          // Check if profile exists
          const title = await page.title();
          if (title.includes("doesn't exist") || title.includes('This account')) {
            return `Account @${username} not found.`;
          }

          // Look for Follow button (not Following, not Follow back — just Follow)
          const followBtn = page.locator('[data-testid$="-follow"]').first();
          const isVisible = await followBtn.isVisible({ timeout: 5000 }).catch(() => false);

          if (!isVisible) {
            // Check if already following
            const followingBtn = page.locator('[data-testid$="-unfollow"]').first();
            const alreadyFollowing = await followingBtn.isVisible({ timeout: 3000 }).catch(() => false);
            if (alreadyFollowing) return `Already following @${username}.`;
            return `Could not find Follow button for @${username}. May already be following or account is private.`;
          }

          await followBtn.click();
          await page.waitForTimeout(1500);

          return `Now following @${username}.`;
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return `Error following @${username}: ${msg}`;
        });
      },
    },

    // ── twitter_unfollow ──────────────────────────────────────────────
    {
      name: 'twitter_unfollow',
      description:
        'Unfollow a Twitter/X account. Navigate to their profile and click Following to unfollow.',
      input_schema: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'Username to unfollow (without @, e.g., "justaouda")',
          },
        },
        required: ['username'],
      },
      handler: async (input) => {
        const username = (input.username as string).replace(/^@/, '');

        return withTwitterPage(`https://x.com/${username}`, async (page) => {
          const title = await page.title();
          if (title.includes("doesn't exist") || title.includes('This account')) {
            return `Account @${username} not found.`;
          }

          // Look for the Following/Unfollow button
          const unfollowBtn = page.locator('[data-testid$="-unfollow"]').first();
          const isVisible = await unfollowBtn.isVisible({ timeout: 5000 }).catch(() => false);

          if (!isVisible) {
            return `Not following @${username} — nothing to unfollow.`;
          }

          await unfollowBtn.click();
          await page.waitForTimeout(1000);

          // Confirm unfollow in the dialog
          const confirmBtn = page.getByTestId('confirmationSheetConfirm');
          await confirmBtn.click({ timeout: 5000 });
          await page.waitForTimeout(1500);

          return `Unfollowed @${username}.`;
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return `Error unfollowing @${username}: ${msg}`;
        });
      },
    },

    // ── twitter_like ───────────────────────────────────────────────────
    {
      name: 'twitter_like',
      description:
        'Like a specific tweet by URL. Navigate to the tweet and click the like button.',
      input_schema: {
        type: 'object',
        properties: {
          tweet_url: {
            type: 'string',
            description: 'Full URL of the tweet to like (e.g., "https://x.com/user/status/123456")',
          },
        },
        required: ['tweet_url'],
      },
      handler: async (input) => {
        const url = input.tweet_url as string;

        return withTwitterPage(url, async (page) => {
          const likeBtn = page.locator('[data-testid="like"]').first();
          const isVisible = await likeBtn.isVisible({ timeout: 5000 }).catch(() => false);

          if (!isVisible) {
            // Check if already liked
            const unlikeBtn = page.locator('[data-testid="unlike"]').first();
            const alreadyLiked = await unlikeBtn.isVisible({ timeout: 3000 }).catch(() => false);
            if (alreadyLiked) return `Already liked this tweet.`;
            return `Could not find like button. Tweet may not exist or page didn't load.`;
          }

          await likeBtn.click();
          await page.waitForTimeout(1000);

          return `Liked tweet: ${url}`;
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return `Error liking tweet: ${msg}`;
        });
      },
    },

    // ── twitter_reply ──────────────────────────────────────────────────
    {
      name: 'twitter_reply',
      description:
        'Reply to a specific tweet by URL. Navigate to the tweet, click reply, type your response, and post it.',
      input_schema: {
        type: 'object',
        properties: {
          tweet_url: {
            type: 'string',
            description: 'Full URL of the tweet to reply to',
          },
          text: {
            type: 'string',
            description: 'Your reply text (max 280 characters)',
          },
        },
        required: ['tweet_url', 'text'],
      },
      handler: async (input) => {
        const url = input.tweet_url as string;
        const text = input.text as string;
        if (text.length > 280) return `Error: reply is ${text.length} chars, max 280`;

        return withTwitterPage(url, async (page) => {
          // Click the reply button on the tweet
          const replyBtn = page.locator('[data-testid="reply"]').first();
          await replyBtn.click({ timeout: 10000 });

          // Wait for reply compose box
          await page.waitForTimeout(1500);
          const replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
          await replyBox.click({ timeout: 10000 });

          await page.keyboard.type(text, { delay: 30 });
          await page.waitForTimeout(1000);

          // Click Reply/Post button in the reply dialog
          const postBtn = page.getByTestId('tweetButton');
          await postBtn.click({ timeout: 10000 });

          await page.waitForTimeout(3000);

          return `Replied to ${url}: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`;
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return `Error replying to tweet: ${msg}`;
        });
      },
    },

    // ── twitter_repost ─────────────────────────────────────────────────
    {
      name: 'twitter_repost',
      description:
        'Repost (retweet) a specific tweet by URL.',
      input_schema: {
        type: 'object',
        properties: {
          tweet_url: {
            type: 'string',
            description: 'Full URL of the tweet to repost',
          },
        },
        required: ['tweet_url'],
      },
      handler: async (input) => {
        const url = input.tweet_url as string;

        return withTwitterPage(url, async (page) => {
          const retweetBtn = page.locator('[data-testid="retweet"]').first();
          await retweetBtn.click({ timeout: 5000 });

          // Wait for the menu and click "Repost"
          await page.waitForTimeout(1000);
          const repostOption = page.getByTestId('retweetConfirm');
          await repostOption.click({ timeout: 5000 });

          await page.waitForTimeout(1500);

          return `Reposted: ${url}`;
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return `Error reposting tweet: ${msg}`;
        });
      },
    },

    // ── twitter_delete ─────────────────────────────────────────────────
    {
      name: 'twitter_delete',
      description:
        'Delete one of your own tweets by URL. Navigate to the tweet, click the menu, and select Delete.',
      input_schema: {
        type: 'object',
        properties: {
          tweet_url: {
            type: 'string',
            description: 'Full URL of your tweet to delete',
          },
        },
        required: ['tweet_url'],
      },
      handler: async (input) => {
        const url = input.tweet_url as string;

        return withTwitterPage(url, async (page) => {
          // Click the "..." menu on the tweet
          const caretBtn = page.locator('[data-testid="caret"]').first();
          await caretBtn.click({ timeout: 5000 });

          await page.waitForTimeout(1000);

          // Look for Delete option in the menu
          const deleteOption = page.locator('[role="menuitem"]').filter({ hasText: 'Delete' }).first();
          await deleteOption.click({ timeout: 5000 });

          await page.waitForTimeout(1000);

          // Confirm deletion in the dialog
          const confirmBtn = page.getByTestId('confirmationSheetConfirm');
          await confirmBtn.click({ timeout: 5000 });

          await page.waitForTimeout(2000);

          return `Deleted tweet: ${url}`;
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return `Error deleting tweet: ${msg}`;
        });
      },
    },

    // ── twitter_search ─────────────────────────────────────────────────
    {
      name: 'twitter_search',
      description:
        'Search Twitter/X for tweets matching a query. Returns the top results with author and text.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (same syntax as x.com search bar)',
          },
          tab: {
            type: 'string',
            enum: ['top', 'latest', 'people'],
            description: 'Search tab to use (default: "top")',
          },
        },
        required: ['query'],
      },
      handler: async (input) => {
        const query = input.query as string;
        const tab = (input.tab as string) || 'top';
        const tabPath = tab === 'top' ? '' : tab === 'latest' ? '&f=live' : '&f=user';
        const url = `https://x.com/search?q=${encodeURIComponent(query)}${tabPath}`;

        return withTwitterPage(url, async (page) => {
          // Wait a bit longer for search results
          await page.waitForTimeout(3000);

          const tweets = await page.evaluate(() => {
            const tweetEls = document.querySelectorAll('[data-testid="tweetText"]');
            return Array.from(tweetEls).slice(0, 15).map((el, i) => {
              const text = (el as HTMLElement).innerText?.trim().slice(0, 300) ?? '';
              const article = el.closest('article');
              const userEl = article?.querySelector('[data-testid="User-Name"]');
              const user = userEl ? (userEl as HTMLElement).innerText?.split('\n')[0]?.trim() ?? '' : '';
              // Try to get tweet link
              const timeEl = article?.querySelector('time');
              const linkEl = timeEl?.closest('a');
              const href = linkEl?.getAttribute('href') ?? '';
              return `[${i + 1}] ${user}${href ? ` (x.com${href})` : ''}: ${text}`;
            });
          });

          if (tweets.length === 0) {
            return `No results found for "${query}" (tab: ${tab}).`;
          }

          let result = `Search: "${query}" (${tab})\nFound ${tweets.length} results:\n\n${tweets.join('\n\n')}`;
          result = wrapAndDetect(result, `twitter:search:${query}`);
          return result;
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return `Error searching Twitter: ${msg}`;
        });
      },
    },

    // ── twitter_notifications ──────────────────────────────────────────
    {
      name: 'twitter_notifications',
      description:
        'Check your Twitter/X notifications. Returns recent notifications including mentions, likes, follows, and replies.',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        return withTwitterPage('https://x.com/notifications', async (page) => {
          await page.waitForTimeout(3000);

          let content = await page.evaluate((max: number) =>
            document.body?.innerText?.slice(0, max) ?? '', MAX_TEXT);

          content = wrapAndDetect(content, 'twitter:notifications');

          return `Notifications:\n${content}`;
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          return `Error checking notifications: ${msg}`;
        });
      },
    },
  ];
}
