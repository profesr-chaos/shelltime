// Plain assert self-check for the idle/resume/break state machine. Run: npm test
// AttentionMonitor has no electron/db imports, so it's fully testable here with fakes.
import assert from 'node:assert/strict';
import {
  AttentionMonitor,
  type TimerEngineLike,
  type TimerStateLike,
  type PowerMonitorLike,
  type AttentionSettingsLike,
} from '../electron/attentionMonitor.ts';

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

class FakeTimer implements TimerEngineLike {
  status: TimerStateLike['status'] = 'running';
  activeProjectId: number | null = 1;
  pauseCalls = 0;
  resumeCalls = 0;
  discarded: { projectId: number; seconds: number }[] = [];
  getState(): TimerStateLike {
    return { status: this.status, activeProjectId: this.activeProjectId };
  }
  pause() {
    this.pauseCalls++;
    if (this.status === 'running') this.status = 'paused';
  }
  resume() {
    this.resumeCalls++;
    if (this.status === 'paused') this.status = 'running';
  }
  discardSeconds(projectId: number, seconds: number) {
    this.discarded.push({ projectId, seconds });
  }
}

class FakePowerMonitor implements PowerMonitorLike {
  idleTime = 0;
  private listeners: Record<'suspend' | 'lock-screen', (() => void)[]> = { suspend: [], 'lock-screen': [] };
  getSystemIdleTime() {
    return this.idleTime;
  }
  on(event: 'suspend' | 'lock-screen', cb: () => void) {
    this.listeners[event].push(cb);
  }
  fire(event: 'suspend' | 'lock-screen') {
    for (const cb of this.listeners[event]) cb();
  }
}

function settings(overrides: Partial<AttentionSettingsLike> = {}): AttentionSettingsLike {
  return { idlePromptMinutes: 10, idleResumeMode: 'auto', breakIntervalMinutes: 60, grindMode: false, ...overrides };
}

interface Harness {
  monitor: AttentionMonitor;
  timer: FakeTimer;
  power: FakePowerMonitor;
  advance: (ms: number) => void;
  openPrompts: () => number;
  maxOpenPrompts: () => number;
  breakFires: () => number;
}

function makeHarness(settingsOverrides: Partial<AttentionSettingsLike> = {}): Harness {
  const timer = new FakeTimer();
  const power = new FakePowerMonitor();
  let clock = 0;
  let open = 0;
  let maxOpen = 0;
  let breakFires = 0;
  const monitor = new AttentionMonitor(
    timer,
    {
      onIdlePrompt: () => {
        open++;
        maxOpen = Math.max(maxOpen, open);
      },
      onIdleResolved: () => {
        open--;
      },
      onResumePrompt: () => {
        open++;
        maxOpen = Math.max(maxOpen, open);
      },
      onResumeResolved: () => {
        open--;
      },
      onBreakPrompt: () => {
        breakFires++;
        open++;
        maxOpen = Math.max(maxOpen, open);
      },
      onBreakDismissed: () => {
        open--;
      },
      onStateChange: () => {},
    },
    { getSettings: () => settings(settingsOverrides), powerMonitor: power, now: () => clock, autoStart: false }
  );
  monitor.notifyManualStart();
  return {
    monitor,
    timer,
    power,
    advance: (ms: number) => {
      clock += ms;
    },
    openPrompts: () => open,
    maxOpenPrompts: () => maxOpen,
    breakFires: () => breakFires,
  };
}

t('idle prompt opens after the threshold, timer keeps running', () => {
  const h = makeHarness({ idlePromptMinutes: 10 });
  h.power.idleTime = 599;
  h.monitor.tick();
  assert.equal(h.monitor.getState(), 'active');
  h.power.idleTime = 600;
  h.monitor.tick();
  assert.equal(h.monitor.getState(), 'idle_prompt');
  assert.equal(h.timer.status, 'running'); // still running while the live prompt is up
  assert.equal(h.openPrompts(), 1);
});

t('lock while an unescalated idle prompt is open freezes and pauses immediately (rule 4)', () => {
  const h = makeHarness({ idlePromptMinutes: 10 });
  h.power.idleTime = 600;
  h.monitor.tick(); // opens the live prompt
  assert.equal(h.openPrompts(), 1);

  h.power.fire('lock-screen');

  assert.equal(h.monitor.getState(), 'paused_away');
  assert.equal(h.timer.status, 'paused');
  // The live prompt was dismissed (nobody's there to see it) — not left open while away.
  assert.equal(h.openPrompts(), 0);
});

t('walk away 2h with a lock at ~10min: at most one prompt on return, banked time bounded, discard removes only the banked window', () => {
  const h = makeHarness({ idlePromptMinutes: 10, idleResumeMode: 'prompt' });
  h.power.idleTime = 600; // 10 min idle
  h.monitor.tick(); // opens the live prompt
  h.power.fire('lock-screen'); // escalates immediately -> paused_away, ~600s banked

  // Away for 2 hours.
  h.advance(2 * 60 * 60 * 1000);

  // Screen unlocked and the user is back: idle spikes briefly then activity resumes.
  h.power.idleTime = 20;
  h.monitor.tick(); // arms
  h.power.idleTime = 0;
  h.monitor.tick(); // fires resume detection

  assert.equal(h.monitor.getState(), 'active');
  assert.equal(h.timer.status, 'running'); // resume happens up front, per rule 5
  assert.equal(h.openPrompts(), 1); // exactly one prompt shown, and only now (on return)
  assert.ok(h.maxOpenPrompts() <= 1, 'never more than one prompt open at once');

  h.monitor.resolveIdle(true); // discard the banked window

  assert.equal(h.timer.discarded.length, 1);
  const { projectId, seconds } = h.timer.discarded[0];
  assert.equal(projectId, 1);
  // Bounded to ~2x the prompt threshold (10 min), never the full 2h away — and never earlier work.
  assert.ok(seconds >= 590 && seconds <= 610, `expected ~600s banked, got ${seconds}`);
  assert.equal(h.openPrompts(), 0);
  assert.equal(h.monitor.getState(), 'active');
});

t('discarding the banked prompt never force-resumes or re-pauses (rule 7 / fixes D3)', () => {
  const h = makeHarness({ idlePromptMinutes: 10, idleResumeMode: 'prompt' });
  h.power.idleTime = 600;
  h.monitor.tick();
  h.power.fire('lock-screen'); // -> paused_away, banked ~600s
  h.power.idleTime = 20;
  h.monitor.tick();
  h.power.idleTime = 0;
  h.monitor.tick(); // resumes and shows the combined prompt

  const pauseCallsBefore = h.timer.pauseCalls;
  const resumeCallsBefore = h.timer.resumeCalls;
  h.monitor.resolveIdle(true);
  // resolveIdle for the frozen case must never call pause()/resume() itself.
  assert.equal(h.timer.pauseCalls, pauseCallsBefore);
  assert.equal(h.timer.resumeCalls, resumeCallsBefore);

  // Auto-resume keeps working afterwards (the monitor isn't stuck).
  h.monitor.notifyManualPause();
  assert.equal(h.monitor.getState(), 'paused_manual');
  h.power.idleTime = 20;
  h.monitor.tick();
  h.power.idleTime = 0;
  h.monitor.tick();
  assert.equal(h.monitor.getState(), 'active');
});

t("idleResumeMode 'auto': lock 30 min with no prior idle prompt resumes silently, nothing banked", () => {
  const h = makeHarness({ idlePromptMinutes: 10, idleResumeMode: 'auto' });
  h.power.idleTime = 0;
  h.power.fire('lock-screen'); // plain away, no idle prompt was ever shown

  assert.equal(h.monitor.getState(), 'paused_away');
  assert.equal(h.openPrompts(), 0);

  h.advance(30 * 60 * 1000);
  h.power.idleTime = 20;
  h.monitor.tick();
  h.power.idleTime = 0;
  h.monitor.tick();

  assert.equal(h.monitor.getState(), 'active');
  assert.equal(h.timer.status, 'running');
  assert.equal(h.openPrompts(), 0, 'auto mode resumes silently, no prompt');
  assert.equal(h.timer.discarded.length, 0, 'nothing was ever banked for a plain lock');
});

t('break prompt fires once per threshold crossing (latched), not every tick', () => {
  const h = makeHarness({ idlePromptMinutes: 0, breakIntervalMinutes: 1 }); // idle detection disabled
  h.power.idleTime = 0;
  for (let i = 0; i < 60; i++) h.monitor.tick();
  assert.equal(h.breakFires(), 1);
  for (let i = 0; i < 30; i++) h.monitor.tick();
  assert.equal(h.breakFires(), 1, 'must not refire every second once latched');

  h.monitor.snoozeBreak(); // re-arm
  for (let i = 0; i < 60; i++) h.monitor.tick();
  assert.equal(h.breakFires(), 2);
});

t('break prompt cannot open while an idle/resume prompt is open, and is dismissed by a higher-priority prompt', () => {
  const h = makeHarness({ idlePromptMinutes: 5, breakIntervalMinutes: 1 });
  h.power.idleTime = 0;
  // Cross the break threshold first.
  for (let i = 0; i < 60; i++) h.monitor.tick();
  assert.equal(h.breakFires(), 1);
  assert.equal(h.openPrompts(), 1);

  // Now idle crosses its own threshold — it must dismiss the break prompt (idle > break priority).
  h.power.idleTime = 5 * 60;
  h.monitor.tick();
  assert.equal(h.monitor.getState(), 'idle_prompt');
  assert.equal(h.openPrompts(), 1, 'break prompt was dismissed, idle prompt took over — never both');
});

t('two prompts are never open simultaneously across a mixed sequence', () => {
  const h = makeHarness({ idlePromptMinutes: 2, breakIntervalMinutes: 1, idleResumeMode: 'prompt' });
  h.power.idleTime = 0;
  for (let i = 0; i < 200; i++) {
    // Oscillate idle time to exercise idle-open, escalation, resume-arm/detect, and break ticks.
    h.power.idleTime = i % 40 < 20 ? i % 40 : 0;
    h.monitor.tick();
    if (i === 130) h.power.fire('lock-screen');
    if (h.openPrompts() === 1 && i % 17 === 0) {
      // Periodically resolve whatever's open so the sequence keeps moving.
      h.monitor.resolveIdle(false);
      h.monitor.resolveResume(false);
    }
  }
  assert.ok(h.maxOpenPrompts() <= 1, `expected at most 1 concurrent prompt, saw ${h.maxOpenPrompts()}`);
});

console.log(`ok - ${passed} attention-monitor tests passed`);
