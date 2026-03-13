import re

# Change 1: Default waitUntil to networkidle in withPage
with open('src/browser/tools.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "waitUntil: options?.waitUntil ?? 'load',",
    "waitUntil: options?.waitUntil ?? 'networkidle',"
)

content = content.replace(
    "const waitFor = (input.wait_for as 'load' | 'domcontentloaded' | 'networkidle') || 'load';",
    "const waitFor = (input.wait_for as 'load' | 'domcontentloaded' | 'networkidle') || 'networkidle';"
)

content = content.replace(
    "'Wait condition (default: \"load\")',",
    "'Wait condition (default: \"networkidle\")',"
)

with open('src/browser/tools.ts', 'w') as f:
    f.write(content)

print('Change 1 done: browser tools defaults to networkidle')

# Change 2: Register browser_agent tool
with open('src/agent/tools.ts', 'r') as f:
    content = f.read()

registration = """
// ── Agent-browser tool (Phase 19 - LLM-optimized browser) ───────────
import { checkAvailability as checkAgentBrowser, executeAgentBrowser } from '../browser/agent-browser.js';
import { wrapAndDetect } from '../security/content-boundary.js';

checkAgentBrowser().then((available) => {
  if (!available) return;

  register({
    name: 'browser_agent',
    description:
      'LLM-optimized browser interaction via agent-browser CLI. Uses semantic locators and ' +
      'persistent sessions for complex web interactions (SPAs, Twitter/X, dynamic pages). ' +
      'Commands: open <url>, snapshot (get annotated screenshot + refs), click <ref>, type <ref> <text>, ' +
      'scroll <direction>, wait <ms>, close. ' +
      'Workflow: open URL -> snapshot -> use refs to interact -> snapshot again to verify.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'agent-browser command: open, snapshot, click, type, scroll, wait, close',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Arguments for the command (e.g., URL for open, ref ID for click, text for type)',
        },
      },
      required: ['command'],
    },
    handler: async (input) => {
      const command = input.command as string;
      const args = (input.args as string[]) || [];

      const result = await executeAgentBrowser(command, args);

      if (!result.success) return result.output;

      const wrapped = wrapAndDetect(result.output, 'agent-browser:' + command);
      return wrapped;
    },
  });
});
"""

marker = "// ── Miniflux RSS tools (conditional on config)"
content = content.replace(marker, registration + "\n" + marker)

with open('src/agent/tools.ts', 'w') as f:
    f.write(content)

print('Change 2 done: browser_agent tool registered')
