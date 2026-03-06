interface ServiceEndpoint {
  name: string;
  url: string;
  acceptStatus: number[];
}

type ServiceState = 'up' | 'down' | 'unknown';

/**
 * Parse DOCKER_SERVICES env var: "Name=url,Name2=url2" format.
 * Falls back to empty list if not configured.
 */
function parseServicesFromEnv(): ServiceEndpoint[] {
  const raw = process.env.DOCKER_SERVICES;
  if (!raw) return [];
  return raw.split(',').map((entry) => {
    const [name, ...urlParts] = entry.trim().split('=');
    return { name: name.trim(), url: urlParts.join('=').trim(), acceptStatus: [200, 302] };
  }).filter((s) => s.name && s.url);
}

const SERVICES: ServiceEndpoint[] = parseServicesFromEnv();

const CHECK_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export class DockerMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastState = new Map<string, ServiceState>();
  private sendAlert: (message: string, opts?: { urgent?: boolean }) => Promise<void>;
  private lastCheckAt: Date | null = null;

  constructor(sendAlert: (message: string, opts?: { urgent?: boolean }) => Promise<void>) {
    this.sendAlert = sendAlert;
  }

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => void this.checkHealth(), POLL_INTERVAL_MS);
    // Run first check after a short delay to let services settle on startup
    setTimeout(() => void this.checkHealth(), 10_000);
    console.log(`[docker] Monitor started (poll: 15min)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[docker] Monitor stopped');
  }

  getLastCheckTime(): Date | null {
    return this.lastCheckAt;
  }

  async checkHealth(): Promise<void> {
    this.lastCheckAt = new Date();
    const results = await Promise.all(
      SERVICES.map(async (svc) => {
        const state = await this.checkService(svc);
        return { name: svc.name, state };
      }),
    );

    const alerts: string[] = [];

    for (const { name, state } of results) {
      const prev = this.lastState.get(name) ?? 'unknown';

      // Alert only on state transitions
      if (prev !== 'unknown' && prev !== state) {
        if (state === 'down') {
          alerts.push(`${name} is DOWN`);
        } else {
          alerts.push(`${name} recovered (UP)`);
        }
      }

      this.lastState.set(name, state);
    }

    if (alerts.length > 0) {
      const healthy = results.filter((r) => r.state === 'up').map((r) => r.name);
      const lines = [...alerts];
      if (healthy.length > 0) {
        lines.push(`OK: ${healthy.join(', ')}`);
      }
      const message = `🐳 Docker Health\n${lines.join('\n')}`;

      try {
        await this.sendAlert(message, { urgent: true });
      } catch (err) {
        console.error('[docker] Failed to send health alert:', err);
      }
    }
  }

  private async checkService(svc: ServiceEndpoint): Promise<ServiceState> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

      const res = await fetch(svc.url, {
        signal: controller.signal,
        redirect: 'manual', // don't follow redirects — check status directly
      });
      clearTimeout(timeout);

      return svc.acceptStatus.includes(res.status) ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
