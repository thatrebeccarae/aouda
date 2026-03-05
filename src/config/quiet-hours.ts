const start = Number(process.env.QUIET_HOURS_START ?? 22);
const end = Number(process.env.QUIET_HOURS_END ?? 7);

export interface AlertOptions {
  urgent?: boolean;
}

export type AlertFn = (message: string, opts?: AlertOptions) => Promise<void>;

export function isQuietHours(): boolean {
  const hour = new Date().getHours();
  if (start > end) {
    // Overnight window (e.g., 22–7)
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}
