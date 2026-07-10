// Plain assert self-check for the pure time/holiday logic. Run: npm test
// (No framework; Node strips the TS types. DB-backed code needs Electron's better-sqlite3 so isn't covered here.)
import assert from 'node:assert/strict';
import { minutesToHhMm, signedMinutesToHhMm, secondsToHms, shiftMonth, workdayNumberOfYear } from '../src/lib/format.ts';
import { isPublicHoliday } from '../electron/holidays.ts';
import { logicalDayStr } from '../shared/logicalDay.ts';

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

t('minutesToHhMm always shows minutes, never a decimal-hour fraction', () => {
  assert.equal(minutesToHhMm(0), '0:00');
  assert.equal(minutesToHhMm(54), '0:54');
  assert.equal(minutesToHhMm(450), '7:30');
  assert.equal(minutesToHhMm(-65), '-1:05');
  assert.equal(minutesToHhMm(168.5 * 60), '168:30'); // hours don't wrap at 24
  assert.equal(minutesToHhMm(89.6), '1:30'); // rounds fractional minutes
});

t('secondsToHms zero-pads', () => {
  assert.equal(secondsToHms(0), '00:00:00');
  assert.equal(secondsToHms(3661), '01:01:01');
});

t('signedMinutesToHhMm', () => {
  assert.equal(signedMinutesToHhMm(120), '+2:00');
  assert.equal(signedMinutesToHhMm(-90), '-1:30');
  assert.equal(signedMinutesToHhMm(0), '0:00');
  assert.equal(signedMinutesToHhMm(-65), '-1:05');
});

t('shiftMonth wraps the year', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});

t('workdayNumberOfYear', () => {
  assert.equal(workdayNumberOfYear('2026-01-01'), 1); // Thursday
});

// Region matters: England has the Summer bank holiday (last Mon of Aug); Scotland does not.
t('England Summer bank holiday', () => assert.equal(isPublicHoliday('2026-08-31', 'GB-ENG'), true));
t('Scotland lacks England Summer bank holiday', () => assert.equal(isPublicHoliday('2026-08-31', 'GB-SCT'), false));
t('Christmas is a public holiday', () => assert.equal(isPublicHoliday('2026-12-25', 'GB-ENG'), true));
t('plain weekday is not a holiday', () => assert.equal(isPublicHoliday('2026-07-07', 'GB-ENG'), false));

t('logicalDayStr: the logical day rolls at 04:00, not midnight', () => {
  assert.equal(logicalDayStr(new Date('2026-07-10T03:59:00')), '2026-07-09');
  assert.equal(logicalDayStr(new Date('2026-07-10T04:00:00')), '2026-07-10');
  assert.equal(logicalDayStr(new Date('2026-07-10T00:00:00')), '2026-07-09');
});

console.log(`ok - ${passed} logic tests passed`);
