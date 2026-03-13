import type { Tool } from '../agent/tools.js';
import type { AgentStore } from '../memory/store.js';

let storeRef: AgentStore | null = null;

/** Inject the store reference at startup. Called from index.ts. */
export function initTwitterTools(store: AgentStore): void {
  storeRef = store;
}

export function getTwitterTools(): Tool[] {
  return [
    {
      name: 'twitter_log_post',
      description:
        'Log a post you made on Twitter/X. Call this AFTER posting via browser_agent ' +
        'so you can track what you posted and review performance later. ' +
        'Include the post URL if you can grab it.',
      input_schema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['original', 'reply', 'thread', 'like', 'repost'],
            description: 'Type of Twitter action',
          },
          content: {
            type: 'string',
            description: 'The text you posted (or a summary for likes/reposts)',
          },
          reply_to_url: {
            type: 'string',
            description: 'URL of the post you replied to (for replies only)',
          },
          topic: {
            type: 'string',
            description: 'Topic tag for categorization (e.g., "tech", "politics", "feminism")',
          },
          url: {
            type: 'string',
            description: 'URL of your post (if available)',
          },
          notes: {
            type: 'string',
            description: 'Any notes about why you posted this or what you were going for',
          },
        },
        required: ['type', 'content'],
      },
      handler: async (input) => {
        if (!storeRef) return 'Error: Twitter tools not initialized.';
        const id = storeRef.logTwitterPost({
          type: input.type as 'original' | 'reply' | 'thread' | 'like' | 'repost',
          content: input.content as string,
          replyToUrl: input.reply_to_url as string | undefined,
          topic: input.topic as string | undefined,
          url: input.url as string | undefined,
          notes: input.notes as string | undefined,
        });
        return `Logged. Post ID: ${id}`;
      },
    },
    {
      name: 'twitter_update_metrics',
      description:
        'Update engagement metrics for a previously logged post. ' +
        'Use this when checking how your posts performed.',
      input_schema: {
        type: 'object',
        properties: {
          post_id: { type: 'number', description: 'Post ID from twitter_log_post' },
          likes: { type: 'number', description: 'Current like count' },
          reposts: { type: 'number', description: 'Current repost count' },
          replies: { type: 'number', description: 'Current reply count' },
          impressions: { type: 'number', description: 'Current impression count' },
        },
        required: ['post_id'],
      },
      handler: async (input) => {
        if (!storeRef) return 'Error: Twitter tools not initialized.';
        storeRef.updateTwitterMetrics(input.post_id as number, {
          likes: input.likes as number | undefined,
          reposts: input.reposts as number | undefined,
          replies: input.replies as number | undefined,
          impressions: input.impressions as number | undefined,
        });
        return `Metrics updated for post ${input.post_id}.`;
      },
    },
    {
      name: 'twitter_review',
      description:
        'Review your recent Twitter/X posts and overall stats. ' +
        'Use this to see what you have been posting and how it performed.',
      input_schema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of recent posts to show (default 20)',
          },
        },
        required: [],
      },
      handler: async (input) => {
        if (!storeRef) return 'Error: Twitter tools not initialized.';
        const stats = storeRef.getTwitterStats();
        const recent = storeRef.getRecentTwitterPosts((input.limit as number) ?? 20) as Array<{
          id: number; posted_at: number; type: string; content: string;
          topic: string | null; url: string | null;
          likes: number; reposts: number; replies: number; impressions: number;
        }>;

        const lines: string[] = [
          `Total posts: ${stats.total}`,
          `By type: ${Object.entries(stats.byType).map(([t, c]) => `${t}: ${c}`).join(', ') || 'none'}`,
          `Avg likes (originals/threads): ${stats.avgLikes.toFixed(1)}`,
          '',
          'Recent posts:',
        ];

        for (const p of recent) {
          const date = new Date(p.posted_at).toISOString().slice(0, 16).replace('T', ' ');
          const metrics = p.likes || p.reposts || p.replies
            ? ` [${p.likes}L ${p.reposts}R ${p.replies}C${p.impressions ? ` ${p.impressions}I` : ''}]`
            : '';
          const topic = p.topic ? ` #${p.topic}` : '';
          lines.push(`[${p.id}] ${date} ${p.type}${topic}${metrics}: ${p.content.slice(0, 120)}`);
        }

        return lines.join('\n');
      },
    },
  ];
}
