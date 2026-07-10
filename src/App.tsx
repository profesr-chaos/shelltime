import { useEffect, useState } from 'react';
import type { Settings as SettingsType } from '@shared/types';
import { Sidebar } from './components/Sidebar';
import { BottomTimerBar } from './components/BottomTimerBar';
import { IdlePromptModal } from './components/IdlePromptModal';
import { ResumePromptModal } from './components/ResumePromptModal';
import { MeetingPromptModal } from './components/MeetingPromptModal';
import { DayReviewModal } from './components/DayReviewModal';
import { ToastProvider } from './components/ui/Toast';
import { useProjects } from './hooks/useProjects';
import { Today } from './pages/Today';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Settings } from './pages/Settings';
import { Welcome } from './pages/Welcome';
import { ExportPreview } from './pages/ExportPreview';
import { currentMonthStr } from './lib/format';

export type Page = 'today' | 'dashboard' | 'projects' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('today');
  const [exportMonth, setExportMonth] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const { projects, refresh } = useProjects(false);

  useEffect(() => {
    window.api.settings.get().then(setSettings);
    return window.api.settings.onChanged(setSettings);
  }, []);

  const needsSetup = settings ? !settings.hasCompletedSetup : false;

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar page={page} onNavigate={setPage} projectCount={projects.length} settingsAlert={needsSetup} />
        <main className="flex-1 overflow-y-auto px-10 py-8 pb-28">
          {page === 'today' && <Today />}
          {page === 'dashboard' && <Dashboard onOpenExport={(m) => setExportMonth(m ?? currentMonthStr())} onOpenSettings={() => setPage('settings')} />}
          {page === 'projects' && <Projects onProjectsChanged={refresh} />}
          {page === 'settings' && <Settings />}
        </main>
        <BottomTimerBar />
      </div>
      <IdlePromptModal />
      <ResumePromptModal />
      <MeetingPromptModal />
      <DayReviewModal />

      {exportMonth && <ExportPreview month={exportMonth} onClose={() => setExportMonth(null)} />}
      {needsSetup && !welcomeDismissed && (
        <Welcome
          onGetStarted={() => { setWelcomeDismissed(true); setPage('settings'); }}
          onSkip={() => { setWelcomeDismissed(true); window.api.settings.update({ hasCompletedSetup: true }); }}
        />
      )}
    </ToastProvider>
  );
}
