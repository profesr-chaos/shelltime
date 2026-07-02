import ExcelJS from 'exceljs';
import type { MonthlySummary } from '../shared/types';

const formatMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

// Builds the timesheet as a project-x-day grid workbook, mirroring the PDF report.
export async function buildTimesheetWorkbook(summary: MonthlySummary, userName = 'Shelltime'): Promise<Buffer> {
  const { month } = summary;
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const dateStr = (d: number) => `${month}-${String(d).padStart(2, '0')}`;
  const isWeekend = (d: number) => {
    const wd = new Date(y, m - 1, d).getDay();
    return wd === 0 || wd === 6;
  };
  // Blank rather than 0.00 whenever the value rounds to zero hours (covers tiny sub-rounding minutes too).
  const hours = (minutes: number) => {
    const h = Math.round((minutes / 60) * 100) / 100;
    return h > 0 ? h : null;
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Shelltime';
  const ws = wb.addWorksheet('Timesheet', { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }] });

  ws.mergeCells(1, 1, 1, days.length + 2);
  ws.getCell(1, 1).value = `${userName} - Timesheet - ${formatMonth(month)}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };

  // Header row (row 3): Project | 1..N | Total
  const headerRow = ws.getRow(3);
  headerRow.getCell(1).value = 'Project';
  days.forEach((d, i) => (headerRow.getCell(2 + i).value = d));
  headerRow.getCell(days.length + 2).value = 'Total';
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };
  headerRow.getCell(1).alignment = { horizontal: 'left' };

  // Project rows
  summary.grid.forEach((row) => {
    const r = ws.addRow([
      row.project.code,
      ...days.map((d) => hours(row.minutesByDate[dateStr(d)] ?? 0)),
      hours(row.totalMinutes),
    ]);
    r.getCell(1).value = `${row.project.code} — ${row.project.name}`;
    r.getCell(days.length + 2).font = { bold: true };
  });

  // Totals row
  const totalRow = ws.addRow([
    'Total',
    ...days.map((d) => {
      const mins = summary.grid.reduce((s, row) => s + (row.minutesByDate[dateStr(d)] ?? 0), 0);
      return hours(mins);
    }),
    Math.round((summary.actualMinutes / 60) * 100) / 100,
  ]);
  totalRow.font = { bold: true };
  totalRow.border = { top: { style: 'thin' } };

  // Weekend shading on header + all data rows
  for (let rowIdx = 3; rowIdx <= totalRow.number; rowIdx++) {
    days.forEach((d, i) => {
      if (isWeekend(d)) {
        ws.getCell(rowIdx, 2 + i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
    });
  }

  // Column widths + number format
  ws.getColumn(1).width = 34;
  for (let c = 2; c <= days.length + 2; c++) {
    ws.getColumn(c).width = 5.5;
    ws.getColumn(c).numFmt = '0.00';
  }

  // KPI block below the grid
  ws.addRow([]);
  const kpis: [string, number][] = [
    ['Total hours worked', summary.actualMinutes / 60],
    ['Target hours', summary.targetMinutes / 60],
    ['Overtime (this month)', summary.thisMonthOvertimeMinutes / 60],
    ['Overtime carried over', summary.carriedOverOvertimeMinutes / 60],
    ['Overtime (cumulative)', summary.cumulativeOvertimeMinutes / 60],
  ];
  for (const [label, value] of kpis) {
    const r = ws.addRow([label, Math.round(value * 100) / 100]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).numFmt = '0.00';
  }

  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}
