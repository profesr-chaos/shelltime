// Plain assert self-check for the ICS busy/free parsing (item 14). Run: npm test
// node-ical is pure JS (no native deps), so this runs directly under Node like the other tests.
import assert from 'node:assert/strict';
import { computeBusyIntervals, CalendarMonitor } from '../electron/calendarMonitor.ts';

let passed = 0;
const t = (name: string, fn: () => void) => {
  try {
    fn();
  } catch (e) {
    console.error('FAIL:', name);
    throw e;
  }
  passed++;
};

const ISO = (s: string) => new Date(s).getTime();

const CANNED_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:evt1@test
DTSTAMP:20260701T000000Z
DTSTART:20260710T100000Z
DTEND:20260710T110000Z
SUMMARY:Meeting 1
END:VEVENT
BEGIN:VEVENT
UID:evt2@test
DTSTAMP:20260701T000000Z
DTSTART:20260710T103000Z
DTEND:20260710T120000Z
SUMMARY:Overlapping meeting
END:VEVENT
BEGIN:VEVENT
UID:evt3@test
DTSTAMP:20260701T000000Z
DTSTART;VALUE=DATE:20260710
DTEND;VALUE=DATE:20260711
SUMMARY:All day event
END:VEVENT
BEGIN:VEVENT
UID:evt4@test
DTSTAMP:20260701T000000Z
DTSTART:20260710T140000Z
DTEND:20260710T150000Z
TRANSP:TRANSPARENT
SUMMARY:Free block
END:VEVENT
BEGIN:VEVENT
UID:evt5@test
DTSTAMP:20260701T000000Z
DTSTART:20260706T090000Z
DTEND:20260706T093000Z
RRULE:FREQ=WEEKLY;BYDAY=MO
SUMMARY:Weekly standup
END:VEVENT
END:VCALENDAR`;

const windowStart = ISO('2026-07-01T00:00:00Z');
const windowEnd = ISO('2026-07-20T00:00:00Z');
const busy = computeBusyIntervals(CANNED_ICS, windowStart, windowEnd);

t('overlapping events merge into one interval', () => {
  const merged = busy.find((b) => b.startMs === ISO('2026-07-10T10:00:00Z'));
  assert.ok(merged, 'expected a merged 10:00-12:00 interval');
  assert.equal(merged!.endMs, ISO('2026-07-10T12:00:00Z'));
});

t('all-day event is ignored', () => {
  // The all-day event spans all of 2026-07-10; if it weren't ignored the whole day would read busy.
  assert.ok(!busy.some((b) => b.startMs <= ISO('2026-07-10T00:00:00Z') && b.endMs >= ISO('2026-07-11T00:00:00Z')));
});

t('TRANSP:TRANSPARENT event is treated as free', () => {
  const freeMoment = ISO('2026-07-10T14:30:00Z');
  assert.ok(!busy.some((b) => freeMoment >= b.startMs && freeMoment < b.endMs));
});

t('weekly RRULE expands into recurring instances inside the window', () => {
  const first = ISO('2026-07-06T09:15:00Z'); // first Monday standup
  const second = ISO('2026-07-13T09:15:00Z'); // recurrence a week later
  assert.ok(busy.some((b) => first >= b.startMs && first < b.endMs));
  assert.ok(busy.some((b) => second >= b.startMs && second < b.endMs));
});

t('isBusy true inside a busy interval, false outside', () => {
  assert.equal(busy.some((b) => ISO('2026-07-10T10:30:00Z') >= b.startMs && ISO('2026-07-10T10:30:00Z') < b.endMs), true);
  assert.equal(busy.some((b) => ISO('2026-07-10T13:00:00Z') >= b.startMs && ISO('2026-07-10T13:00:00Z') < b.endMs), false);
});

t('CalendarMonitor.isBusy/currentBusyBlock reflect the last successful refresh', async () => {
  const monitor = new CalendarMonitor(() => 'https://example.test/calendar.ics', {
    fetchIcs: async () => CANNED_ICS,
    now: () => ISO('2026-07-10T10:30:00Z'),
  });
  await monitor.refresh();
  assert.equal(monitor.isBusy(ISO('2026-07-10T10:30:00Z')), true);
  assert.equal(monitor.isBusy(ISO('2026-07-10T13:00:00Z')), false);
  assert.ok(monitor.currentBusyBlock(ISO('2026-07-10T10:30:00Z')) !== null);
});

t('CalendarMonitor keeps last-known state on a failed refresh, no throw', async () => {
  let fail = false;
  const monitor = new CalendarMonitor(() => 'https://example.test/calendar.ics', {
    fetchIcs: async () => {
      if (fail) throw new Error('network down');
      return CANNED_ICS;
    },
    now: () => ISO('2026-07-10T10:30:00Z'),
    onFetchError: () => {},
  });
  await monitor.refresh();
  assert.equal(monitor.isBusy(ISO('2026-07-10T10:30:00Z')), true);
  fail = true;
  await monitor.refresh(); // must not throw
  assert.equal(monitor.isBusy(ISO('2026-07-10T10:30:00Z')), true); // unchanged from last good parse
});

t('empty URL means no fetch and never busy', async () => {
  let fetchCalls = 0;
  const monitor = new CalendarMonitor(() => '', {
    fetchIcs: async () => {
      fetchCalls++;
      return CANNED_ICS;
    },
  });
  await monitor.refresh();
  assert.equal(fetchCalls, 0);
  assert.equal(monitor.isBusy(Date.now()), false);
});

console.log(`ok - ${passed} calendarMonitor tests passed`);
