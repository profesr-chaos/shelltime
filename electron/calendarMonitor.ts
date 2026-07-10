import * as icalNs from 'node-ical';
import https from 'node:https';
import type { VEvent, CalendarResponse } from 'node-ical';

// node-ical is CJS; under a bundler (the real Electron build) the namespace import already carries
// its exports, but under Node's native CJS→ESM interop (used to run tests directly) only `default`
// does — pick whichever actually has them so this works in both.
const ical: typeof icalNs = (icalNs as any).sync ? icalNs : (icalNs as any).default;

export interface BusyInterval {
  startMs: number;
  endMs: number;
}

// Expand `icsText` over [windowStart, windowEnd] (ms, inclusive) into sorted, merged busy
// intervals. Exported standalone so it's unit-testable without a network fetch.
// - TRANSP:TRANSPARENT events are treated as free.
// - All-day events (DTSTART;VALUE=DATE) are ignored — an all-day "busy" would kill idle detection
//   for the whole day.
export function computeBusyIntervals(icsText: string, windowStart: number, windowEnd: number): BusyInterval[] {
  const parsed: CalendarResponse = ical.sync.parseICS(icsText);
  const raw: BusyInterval[] = [];
  const from = new Date(windowStart);
  const to = new Date(windowEnd);

  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (!item || item.type !== 'VEVENT') continue;
    const event = item as VEvent;
    if (event.transparency === 'TRANSPARENT') continue;
    if (event.datetype === 'date') continue;

    if (event.rrule) {
      for (const inst of ical.expandRecurringEvent(event, { from, to })) {
        if (inst.isFullDay) continue;
        raw.push({ startMs: inst.start.getTime(), endMs: inst.end.getTime() });
      }
    } else if (event.start && event.end) {
      const startMs = event.start.getTime();
      const endMs = event.end.getTime();
      if (endMs >= windowStart && startMs <= windowEnd) raw.push({ startMs, endMs });
    }
  }

  raw.sort((a, b) => a.startMs - b.startMs);
  const merged: BusyInterval[] = [];
  for (const iv of raw) {
    const last = merged[merged.length - 1];
    if (last && iv.startMs <= last.endMs) last.endMs = Math.max(last.endMs, iv.endMs);
    else merged.push({ ...iv });
  }
  return merged;
}

function fetchIcsOverHttps(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          reject(new Error(`ICS fetch failed: HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const WINDOW_MS = 24 * 60 * 60 * 1000; // ±1 day around now

export interface CalendarMonitorDeps {
  fetchIcs?: (url: string) => Promise<string>;
  now?: () => number;
  onFetchError?: (err: unknown) => void;
}

// Fetches a published busy/free ICS feed every 5 minutes and answers isBusy/currentBusyBlock from
// the last good parse. Network failures never throw or prompt — they just keep the last-known
// state and log once per failure streak.
export class CalendarMonitor {
  private busy: BusyInterval[] = [];
  private failing = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly getUrl: () => string;
  private readonly now: () => number;
  private readonly fetchIcs: (url: string) => Promise<string>;
  private readonly onFetchError: (err: unknown) => void;

  constructor(getUrl: () => string, deps: CalendarMonitorDeps = {}) {
    this.getUrl = getUrl;
    this.now = deps.now ?? Date.now;
    this.fetchIcs = deps.fetchIcs ?? fetchIcsOverHttps;
    this.onFetchError = deps.onFetchError ?? ((err) => console.error('Calendar ICS fetch failed:', err));
  }

  start() {
    this.refresh();
    this.refreshTimer = setInterval(() => this.refresh(), REFRESH_INTERVAL_MS);
  }

  dispose() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  async refresh(): Promise<void> {
    const url = this.getUrl();
    if (!url) {
      this.busy = [];
      return;
    }
    try {
      const text = await this.fetchIcs(url);
      const nowMs = this.now();
      this.busy = computeBusyIntervals(text, nowMs - WINDOW_MS, nowMs + WINDOW_MS);
      this.failing = false;
    } catch (err) {
      if (!this.failing) {
        this.failing = true;
        this.onFetchError(err);
      }
      // keep the last good parse — never crash or prompt on network errors
    }
  }

  isBusy(atMs: number): boolean {
    return this.currentBusyBlock(atMs) !== null;
  }

  currentBusyBlock(atMs: number): BusyInterval | null {
    return this.busy.find((b) => atMs >= b.startMs && atMs < b.endMs) ?? null;
  }
}
