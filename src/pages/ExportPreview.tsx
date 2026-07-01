import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { formatMonth } from '@/lib/format';
import { PrintReport } from './PrintReport';

export function ExportPreview({ month, onClose }: { month: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const exportPdf = async () => {
    setBusy(true);
    const result = await window.api.reportExport.exportPdf(month);
    setBusy(false);
    if (result.ok) toast(`Saved to ${result.filePath}`);
    else if (result.error !== 'Export cancelled') toast(result.error ?? 'Export failed', 'error');
  };

  const print = async () => {
    setBusy(true);
    await window.api.reportExport.print(month);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Monthly Report — {formatMonth(month)}</h1>
          <p className="text-xs text-slate-400">Print preview</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose}>Back to dashboard</Button>
          <Button variant="secondary" onClick={print} disabled={busy}>Print</Button>
          <Button variant="primary" onClick={exportPdf} disabled={busy}>Export PDF</Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto py-8">
        <div className="mx-auto w-[1120px] max-w-full rounded-2xl bg-white shadow-lg">
          <PrintReport month={month} />
        </div>
      </div>
    </div>
  );
}
