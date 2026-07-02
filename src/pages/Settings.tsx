import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Settings as SettingsType } from '@shared/types';
import { OVERLAY_OPACITY_FLOOR } from '@shared/types';
import { Toggle, TextInput, Select, FieldWrap } from '@/components/ui/Inputs';
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
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [states, setStates] = useState<{ code: string; name: string }[]>([]);
  const toast = useToast();
  const month = currentMonthStr();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.api.settings.get().then(setSettings);
    window.api.app.getDataPath().then(setDataPath);
    window.api.targets.getMonthly(month).then((minutes) => setMonthlyOverrideHours((minutes / 60).toFixed(1)));
  }, [month]);

  useEffect(() => {
    window.api.holidays.countries().then(setCountries);
  }, []);

  // Load the sub-regions (states/provinces) for the selected country.
  const holidayCountry = settings?.holidayRegion.split('-')[0] ?? '';
  useEffect(() => {
    if (holidayCountry) window.api.holidays.states(holidayCountry).then(setStates);
  }, [holidayCountry]);

  if (!settings) return null;

  const update = (patch: Partial<SettingsType>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    window.api.settings.update(patch).then(() => toast('Settings saved'));
  };

  // Changing an essential setting also marks setup complete, clearing the "!" prompts.
  const updateEssential = (patch: Partial<SettingsType>) => update({ ...patch, hasCompletedSetup: true });
  const needsSetup = !settings.hasCompletedSetup;

  const updateDebounced = (patch: Partial<SettingsType>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      window.api.settings.update(patch).then(() => toast('Settings saved'));
    }, 500);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      <Section title="Working schedule">
        <FieldWrap label="Working days" alert={needsSetup} tooltip="Used to calculate your expected weekly and monthly hours.">
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
                    updateEssential({ workingDays: next });
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

        <div>
          <Toggle
            checked={settings.skipBankHolidays}
            onChange={(v) => update({ skipBankHolidays: v })}
            label="Skip public holidays"
          />
          {settings.skipBankHolidays && (
            <FieldWrap label="Holiday region" alert={needsSetup} tooltip="Public holidays for this region are skipped when calculating targets.">
              <div className="flex flex-wrap gap-2">
                <Select
                  value={holidayCountry}
                  onChange={(e) => updateEssential({ holidayRegion: e.target.value })}
                  className="max-w-xs"
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </Select>
                {states.length > 0 && (
                  <Select
                    value={settings.holidayRegion.includes('-') ? settings.holidayRegion.slice(holidayCountry.length + 1) : ''}
                    onChange={(e) => updateEssential({ holidayRegion: e.target.value ? `${holidayCountry}-${e.target.value}` : holidayCountry })}
                    className="max-w-xs"
                  >
                    <option value="">Whole country</option>
                    {states.map((s) => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </Select>
                )}
              </div>
            </FieldWrap>
          )}
        </div>
      </Section>

      <Section title="Targets">
        <FieldWrap label="Default daily target" alert={needsSetup} tooltip="Applied to every working day unless a specific day is overridden.">
          <DurationInput
            minutes={settings.defaultDailyTargetMinutes}
            onChange={(minutes) => updateEssential({ defaultDailyTargetMinutes: minutes })}
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
          label={settings.grindMode ? 'Grind mode is ON - break reminders are suppressed' : 'Grind mode'}
        />
        <FieldWrap label="Auto-pause when idle" tooltip="Pauses a running timer after this much inactivity, or on sleep/lock. Set to 0 to disable.">
          <DurationInput
            minutes={settings.autoPauseIdleMinutes}
            onChange={(minutes) => update({ autoPauseIdleMinutes: Math.max(0, minutes) })}
            minMinutes={0}
            maxMinutes={2 * 60}
          />
        </FieldWrap>
      </Section>

      <Section title="Overlay">
        <Toggle checked={settings.overlayAlwaysOnTop} onChange={(v) => update({ overlayAlwaysOnTop: v })} label="Always on top" />
        <Toggle checked={settings.overlayCompact} onChange={(v) => update({ overlayCompact: v })} label="Compact mode" />
        <FieldWrap label="Overlay opacity" tooltip={`Can't go below ${Math.round(OVERLAY_OPACITY_FLOOR * 100)}% so it never disappears entirely.`}>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={Math.round(OVERLAY_OPACITY_FLOOR * 100)}
              max={100}
              step={5}
              value={Math.round(settings.overlayOpacity * 100)}
              onChange={(e) => updateDebounced({ overlayOpacity: Number(e.target.value) / 100 })}
              className="h-2 flex-1 accent-amber-500"
            />
            <span className="w-12 text-right text-sm font-medium text-slate-700">{Math.round(settings.overlayOpacity * 100)}%</span>
          </div>
        </FieldWrap>
        <FieldWrap label="Overlay colour" tooltip="Background colour of the pop-out widget.">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.overlayColor}
              onChange={(e) => updateDebounced({ overlayColor: e.target.value })}
              className="h-9 w-14 cursor-pointer rounded border border-slate-200 bg-white"
            />
            <span className="font-mono text-sm text-slate-500">{settings.overlayColor}</span>
          </div>
        </FieldWrap>
      </Section>

      <Section title="Startup">
        <Toggle checked={settings.startWithWindows} onChange={(v) => update({ startWithWindows: v })} label="Start Shelltime with Windows" />
      </Section>

      <Section title="Data">
        <p className="mb-2 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">{dataPath}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => window.api.app.openDataFolder()}>Open data folder</Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const res = await window.api.app.backupDatabase();
              if (res.ok) toast(`Backed up to ${res.filePath}`);
              else if (res.error !== 'Backup cancelled') toast(res.error ?? 'Backup failed', 'error');
            }}
          >
            Back up database
          </Button>
        </div>
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
