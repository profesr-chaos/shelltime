import snailIcon from '@/assets/snail-icon.png';
import { CalendarIcon, GridIcon, ProjectsIcon, SettingsIcon } from './icons';
import type { Page } from '@/App';

const NAV: { page: Page; label: string; icon: typeof CalendarIcon }[] = [
  { page: 'today', label: 'Today', icon: CalendarIcon },
  { page: 'dashboard', label: 'Dashboard', icon: GridIcon },
  { page: 'projects', label: 'Projects', icon: ProjectsIcon },
  { page: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar({ page, onNavigate, projectCount, settingsAlert }: { page: Page; onNavigate: (p: Page) => void; projectCount: number; settingsAlert?: boolean }) {
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-ink-900 px-4 py-6 text-slate-300">
      <div className="mb-8 flex items-center gap-2 px-2">
        <img src={snailIcon} alt="" className="h-8 w-8" />
        <span className="text-lg font-bold text-white">Shelltime</span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ page: p, label, icon: Icon }) => {
          const active = p === page;
          return (
            <button
              key={p}
              onClick={() => onNavigate(p)}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber ${
                active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className={active ? 'text-amber' : 'text-slate-400'} />
                {label}
              </span>
              {p === 'projects' && projectCount > 0 && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{projectCount}</span>
              )}
              {p === 'settings' && settingsAlert && (
                <span title="Set up your working schedule, region and target" className="flex h-5 w-5 items-center justify-center rounded-full bg-amber text-xs font-bold text-white">!</span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
