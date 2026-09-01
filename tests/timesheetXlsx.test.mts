import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildTimesheetWorkbook } from '../electron/timesheetXlsx.ts';

// ponytail: one smoke check for the column layout; extend if the grid shape changes again.
const summary: any = {
  month: '2026-09',
  actualMinutes: 90, targetMinutes: 0, thisMonthOvertimeMinutes: 90,
  carriedOverOvertimeMinutes: 0, cumulativeOvertimeMinutes: 90,
  byProject: [], dailyTotals: [], insights: {},
  grid: [{ project: { id: 1, code: 'ACME-01', name: 'Acme', color: '#000' }, minutesByDate: { '2026-09-01': 90 }, totalMinutes: 90 }],
};
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(await buildTimesheetWorkbook(summary));
const ws = wb.getWorksheet('Timesheet')!;
assert.deepEqual([ws.getCell(3, 1).value, ws.getCell(3, 2).value, ws.getCell(3, 3).value], ['Code', 'Project', 1]);
assert.deepEqual([ws.getCell(4, 1).value, ws.getCell(4, 2).value], ['ACME-01', 'Acme']);
// [h]:mm cells load back as Date objects; 90 minutes = 01:30 on the 1899 epoch.
const asMinutes = (v: unknown) => (v as Date).getUTCHours() * 60 + (v as Date).getUTCMinutes();
assert.equal(asMinutes(ws.getCell(4, 3).value), 90);
assert.equal(asMinutes(ws.getCell(4, 33).value), 90, 'Total column sits after 30 day columns');
ws.eachRow((row) => row.eachCell((cell) => {
  assert.notEqual((cell.fill as any)?.pattern, 'solid', `no fill on ${cell.address}`);
  assert.ok(!String(cell.value).includes('—'), `no em dash in ${cell.address}`);
}));
console.log('timesheetXlsx ok');
