import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { BottomTimerBar } from './components/BottomTimerBar';
import { ToastProvider } from './components/ui/Toast';
import { useProjects } from './hooks/useProjects';
import { Today } from './pages/Today';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Settings } from './pages/Settings';
import { ExportPreview } from './pages/ExportPreview';
import { currentMonthStr } from './lib/format';

export type Page = 'today' | 'dashboard' | 'projects' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('today');
  const [exportMonth, setExportMonth] = useState<string | null>(null);
  const { projects, refresh } = useProjects(false);

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar page={page} onNavigate={setPage} projectCount={projects.length} />
        <main className="flex-1 overflow-y-auto px-10 py-8 pb-28">
          {page === 'today' && <Today />}
          {page === 'dashboard' && <Dashboard onOpenExport={(m) => setExportMonth(m ?? currentMonthStr())} onOpenSettings={() => setPage('settings')} />}
          {page === 'projects' && <Projects onProjectsChanged={refresh} />}
          {page === 'settings' && <Settings />}
        </main>
        <BottomTimerBar />
      </div>
      {exportMonth && <ExportPreview month={exportMonth} onClose={() => setExportMonth(null)} />}
    </ToastProvider>
  );
}
