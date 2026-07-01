import { useEffect, useState, type ReactNode } from 'react';
import type { Settings as SettingsType } from '@shared/types';
import { Toggle, TextInput, FieldWrap } from '@/components/ui/Inputs';
import { DurationInput } from '@/components/ui/DurationInput';
import { Button } from '@/components/ui/Button';
import { currentMonthStr } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';

const DAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

export function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [dataPath, setDataPath] = useState('');
  const [monthlyOverrideEnabled, setMonthlyOverrideEnabled] = useState(false);
  const [monthlyOverrideHours, setMonthlyOverrideHours] = useState('40');
  const toast = useToast();
  const month = currentMonthStr();

  useEffect(() => {
    window.api.settings.get().then(setSettings);
    window.api.app.getDataPath().then(setDataPath);
    window.api.targets.getMonthly(month).then((minutes) => setMonthlyOverrideHours((minutes / 60).toFixed(1)));
  }, [month]);

  if (!settings) return null;

  const update = (patch: Partial<SettingsType>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    window.api.settings.update(patch).then(() => toast('Settings saved'));
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      <Section title="Working schedule">
        <FieldWrap label="Working days" hint={`${settings.workingDays.length} days a week — used to calculate expected weekly/monthly hours`}>
          <div className="flex gap-2">
            {DAYS.map(({ day, label }) => {
              const selected = settings.workingDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    const next = selected
                      ? settings.workingDays.filter((d) => d !== day)
                      : [...settings.workingDays, day].sort();
                    update({ workingDays: next });
                  }}
                  className={`h-10 w-12 rounded-lg text-sm font-medium transition-colors ${
                    selected ? 'bg-amber text-white' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </FieldWrap>
      </Section>

      <Section title="Targets">
        <FieldWrap label="Default daily target" hint="Applied to every day unless overridden">
          <DurationInput
            minutes={settings.defaultDailyTargetMinutes}
            onChange={(minutes) => update({ defaultDailyTargetMinutes: minutes })}
            maxMinutes={16 * 60}
          />
        </FieldWrap>

        <div>
          <Toggle
            checked={monthlyOverrideEnabled}
            onChange={async (v) => {
              setMonthlyOverrideEnabled(v);
              if (!v) {
                await window.api.targets.setMonthlyOverride(month, null);
                toast('Monthly target reverted to auto-calculated');
              }
            }}
            label="Override this month's target"
          />
          {monthlyOverrideEnabled && (
            <div className="mt-2 flex items-center gap-2">
              <TextInput
                type="number"
                step="0.5"
                value={monthlyOverrideHours}
                onChange={(e) => setMonthlyOverrideHours(e.target.value)}
                className="w-28"
              />
              <span className="text-sm text-slate-500">hours</span>
              <Button
                variant="secondary"
                onClick={async () => {
                  await window.api.targets.setMonthlyOverride(month, parseFloat(monthlyOverrideHours) * 60);
                  toast('Monthly target overridden');
                }}
              >
                Apply
              </Button>
            </div>
          )}
        </div>
      </Section>

      <Section title="Break reminders">
        <FieldWrap label="Break interval">
          <DurationInput
            minutes={settings.breakIntervalMinutes}
            onChange={(minutes) => update({ breakIntervalMinutes: Math.max(15, minutes) })}
            minMinutes={15}
            maxMinutes={4 * 60}
          />
        </FieldWrap>
        <Toggle
          checked={settings.grindMode}
          onChange={(v) => update({ grindMode: v })}
          label={settings.grindMode ? 'Grind mode is ON — break reminders are suppressed' : 'Grind mode'}
        />
      </Section>

      <Section title="Overlay">
        <Toggle checked={settings.overlayAlwaysOnTop} onChange={(v) => update({ overlayAlwaysOnTop: v })} label="Always on top" />
        <Toggle checked={settings.overlayCompact} onChange={(v) => update({ overlayCompact: v })} label="Compact mode" />
      </Section>

      <Section title="Startup">
        <Toggle checked={settings.startWithWindows} onChange={(v) => update({ startWithWindows: v })} label="Start Shelltime with Windows" />
      </Section>

      <Section title="Data">
        <p className="mb-2 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">{dataPath}</p>
        <Button variant="secondary" onClick={() => window.api.app.openDataFolder()}>Open data folder</Button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-base font-bold text-slate-900">{title}</h2>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}
