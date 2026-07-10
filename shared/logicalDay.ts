// The logical day boundary is 04:00, not midnight: work between 00:00 and 04:00 belongs to the
// previous day, so a late night doesn't book time to a calendar day that's about to start.
export function logicalDayStr(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
}
