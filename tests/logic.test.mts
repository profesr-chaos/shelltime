// Plain assert self-check for the pure time/holiday logic. Run: npm test
// (No framework; Node strips the TS types. DB-backed code needs Electron's better-sqlite3 so isn't covered here.)
import assert from 'node:assert/strict';
import { minutesToHhMm, secondsToHms, signedHoursLabel, shiftMonth, workdayNumberOfYear } from '../src/lib/format.ts';
import { isPublicHoliday } from '../electron/holidays.ts';

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

t('minutesToHhMm', () => {
  assert.equal(minutesToHhMm(0), '0h 0m');
  assert.equal(minutesToHhMm(90), '1h 30m');
  assert.equal(minutesToHhMm(-90), '-1h 30m');
});

t('secondsToHms zero-pads', () => {
  assert.equal(secondsToHms(0), '00:00:00');
  assert.equal(secondsToHms(3661), '01:01:01');
});

t('signedHoursLabel', () => {
  assert.equal(signedHoursLabel(120), '+2.0h');
  assert.equal(signedHoursLabel(-90), '-1.5h');
  assert.equal(signedHoursLabel(0), '0h');
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

console.log(`ok - ${passed} logic tests passed`);
