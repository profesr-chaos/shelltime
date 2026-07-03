# Shelltime — Fix Specifications & Roadmap

Date: 2026-07-03. Covers the five reported issues, plus standout improvements and missing basics.

**Status:** Specs 1–4 implemented 2026-07-03 (v0.3.1) — state machine + tests in `electron/attentionMonitor.ts` / `tests/attentionMonitor.test.mts`, h:mm formatting in `src/lib/format.ts`, `day_meta` table for start/end times, drag-delta label on the snail. Sections 5–6 are still open — pick 2–3 / 2–5 when ready.

---

## 1. Idle / resume / auto-resume / break: one state machine instead of four timers

**Status: ✅ Implemented.** See `electron/attentionMonitor.ts`. One interpretation call worth knowing: the "combined away prompt" (rule 5) is shown only once the user actually returns, not while still away — showing a modal to an empty desk achieves nothing, and this is functionally equivalent to "a single combined prompt" since it's the only prompt shown for that away period.

### Current behaviour (as coded)

- `electron/timer.ts` runs a 15s flush interval and a 1s break-clock interval.
- `electron/main.ts` runs a 30s idle-poll interval, a 2s resume-poll interval, and two `powerMonitor` event handlers (suspend / lock-screen). **Five independent schedulers, five booleans, no shared state — that's why they execute on top of each other.**
- Sleep/lock → silent pause. Plain input-idle ≥ `autoPauseIdleMinutes` → idle prompt **while the timer keeps running and banking time**.
- `idleResumeMode` (auto/prompt) only watches the **paused** state, so it never interacts with plain idle at all.

### Answer to "idle 2h with auto-resume on — is the idle time auto-accepted?"

**Effectively yes.** Plain idle never pauses the timer; the 2 hours are banked while the prompt sits open. Auto-resume never fires because the timer was never paused. Closing the prompt (`onClose`) defaults to **Keep**. There is no timeout and no auto-discard.

### Confirmed defects

| # | Defect | Where |
|---|--------|-------|
| D1 | Screen locks while idle prompt is open → timer pauses but `idlePromptOpen` stays true → resume monitor is gated off **forever**; auto/prompt resume dead until the stale prompt is answered. | `main.ts` `startResumeMonitor` / `pauseTimerForIdle` |
| D2 | Discard after D1 subtracts the whole **wall-clock** window (`Date.now() - idlePromptStartedAt`) even though the timer was paused for part of it → deletes legitimate earlier work (silently, clamped at 0). | `main.ts` `timer:resolveIdle` |
| D3 | `resolveIdle(discard)` unconditionally `resume()`s — even when the user is still away / the timer was deliberately paused. | `main.ts` `timer:resolveIdle` |
| D4 | Break clock accrues during the idle window (status is still 'running') → break prompt fires on top of the idle prompt. | `timer.ts` `tickBreakClock` |
| D5 | Once past the threshold, `onBreakPrompt` fires **every second** (no latch) → IPC/state spam until snoozed. | `timer.ts` `tickBreakClock` |
| D6 | Resume monitor is gated on `idlePromptOpen`, but the idle monitor is **not** gated on `resumePromptOpen` → resume prompt and idle prompt can be open simultaneously with overlapping discard windows. | `main.ts` `startIdleMonitor` |
| D7 | Unbounded banking: an unattended machine (no lock) accrues time forever with the prompt open. | design gap |
| D8 | `autoPauseIdleMinutes` no longer pauses (it prompts); Settings copy and field name disagree with behaviour. | `shared/types.ts`, `Settings.tsx` |
| D9 | Two independent reconstructions of the idle-window start (renderer `idleStartedAt`, main `idlePromptStartedAt`); the renderer's `idleSeconds` param is passed back but mostly ignored. | `useIdlePrompt.ts`, `main.ts` |

### Specification

Replace the five schedulers with **one attention state machine in the main process**, driven by a single 1-second tick reading `powerMonitor.getSystemIdleTime()` plus the suspend/lock events.

States: `ACTIVE`, `IDLE_PROMPT` (prompt open, timer running), `PAUSED_AWAY` (lock/sleep/idle-escalation), `PAUSED_MANUAL`, `STOPPED`.

Rules:

1. **Break clock accrues only in `ACTIVE`.** It freezes in `IDLE_PROMPT` and all paused states. The break prompt fires **once** (latched) and cannot open while any other prompt is open.
2. **One prompt at a time.** Priority: idle > resume > break. Opening a higher-priority prompt dismisses the lower one (break prompt simply re-arms).
3. **Idle escalation (fixes D7):** if the idle prompt stays unanswered for another `autoPauseIdleMinutes`, auto-pause the timer, discard nothing yet, and record the idle-window start. State → `PAUSED_AWAY`.
4. **Lock/sleep during `IDLE_PROMPT` (fixes D1/D2):** treat as escalation immediately — pause the timer, freeze the discardable window at `[idleStart, pauseTime]`, state → `PAUSED_AWAY`. The prompt clock freezes; it must never show more than what was actually banked.
5. **Return from `PAUSED_AWAY`:** on fresh input, apply `idleResumeMode` uniformly — regardless of *how* the pause happened (lock, sleep, or idle escalation). `auto` = resume silently; `prompt` = resume and show a single combined prompt: "Away for h:mm — keep the h:mm banked before pausing, or discard it?" Keep/discard applies only to the frozen banked window.
6. **Discard maths (fixes D2):** the discardable amount is seconds the timer was actually *running* inside the idle window, computed and frozen by the state machine — never wall-clock in the renderer. The renderer only displays what main sends (fixes D9).
7. **Discard never force-resumes (fixes D3):** after discard, the timer returns to whatever state it was in when the prompt opened (`IDLE_PROMPT` → keep running; `PAUSED_AWAY` → stay paused).
8. Rename `autoPauseIdleMinutes` → `idlePromptMinutes` (migrate the settings row) and update the Settings copy (fixes D8).

### Success criteria

- [x] Grep check: exactly one `setInterval` drives idle/resume/break decisions in `main.ts`/`timer.ts` (flush interval may remain separate). — `AttentionMonitor`'s own tick interval; `TimerEngine` keeps only its flush interval.
- [x] Scenario: timer running, walk away 2h, screen locks after 10 min → on return, at most **one** prompt; banked time beyond the prompt threshold ≤ `2 × idlePromptMinutes`; discard removes exactly the banked idle window, never earlier work (assert day total unchanged from pre-idle value). — covered by `tests/attentionMonitor.test.mts`.
- [x] Scenario: idle prompt open, lock, unlock, answer "discard" → timer does **not** resume if it was in `PAUSED_AWAY`; auto-resume works again afterwards. — covered by test.
- [x] Scenario: `idleResumeMode: auto`, lock 30 min, return → timer resumed silently, no prompt, no time banked for the locked window. — covered by test.
- [x] Break prompt fires exactly once per threshold crossing (unit test on the latch) and never while another prompt is open. — covered by test.
- [x] Impossible to have two prompts open at once (state machine test enumerating transitions). — covered by test (`maxOpenPrompts` assertion across a mixed sequence).
- [x] Unit tests for the state machine live in `tests/` and pass via `npm test`. — `tests/attentionMonitor.test.mts`, 8 tests.

---

## 2. Time formatting: always minutes, always h:mm

**Status: ✅ Implemented**, with one deliberate exception: the XLSX export's hour columns stay as decimal numbers (not h:mm strings), because they're real spreadsheet numerics summed by formulas — converting to text would break that arithmetic. Everything else (UI screens, PDF/print report) now renders h:mm.

### Current behaviour

`minutesToHoursLabel` / `signedHoursLabel` (`src/lib/format.ts`) render decimal hours ("0.9h", "+1.3h") and are used on Dashboard, Projects, PrintReport, BarChart tooltips, and DistributeDeltaModal. `minutesToHhMm` renders "7h 30m".

### Specification

- One duration formatter: `h:mm` (e.g. `7:30`, `0:54`, `168:30` for monthly totals — hours don't wrap at 24). Signed variant: `+0:45`, `-1:05`.
- Replace **all** UI uses of `minutesToHoursLabel`, `signedHoursLabel`, and inline `(minutes / 60).toFixed(1)` (Dashboard, Projects, PrintReport, BarChart, DistributeDeltaModal, Settings monthly override display).
- Live ticking clocks keep `hh:mm:ss` (`secondsToHms`).
- **Open question (decide before implementing):** the XLSX/PDF timesheet exports may need decimal hours for payroll conventions. Default: exports switch to `h:mm` too, unless Adam says timesheets must stay decimal.

### Success criteria

- [x] `grep -r "toFixed(1)" src/` returns no duration-formatting hits; `minutesToHoursLabel`/`signedHoursLabel` deleted.
- [x] Every duration in Today, Dashboard, Projects, overlay, and modals renders as `h:mm` (or `hh:mm:ss` for live clocks); no `0.9h` anywhere in the UI.
- [x] Signed values render `+h:mm` / `-h:mm`; zero renders `0:00`.
- [x] Unit tests: 54 → `0:54`, 450 → `7:30`, −65 → `-1:05`, rounding of fractional minutes. — `tests/logic.test.mts`.

---

## 3. Progress bar anchored to real start/end times

**Status: ✅ Implemented.** New `day_meta` table (`date` PK, `first_started_at`), written by `TimerEngine.start`/`switchProject` via `db.recordDayFirstStartIfNeeded`.

### Current behaviour

The Today progress bar shows only a fraction of target. Nothing records *when* work started; the DB stores daily totals per project only.

### Specification

- Record the first timer start of each day: `day_meta(date PRIMARY KEY, first_started_at)` written by `TimerEngine.start`/`switchProject` when no row exists for today.
- Below the bar's left edge show the start time (`09:12`); below the right edge show the projected end (`start + targetMinutes`, e.g. `17:12`). Format `HH:mm`.
- No timer started yet today → show `--:--` at both ends.
- Viewing a past day → show that day's recorded start (if any) and `start + that day's target`.
- Deliberately naive: end time ignores breaks/pauses (it answers "when could I be done if I keep going"). Refinement (end = start + target + paused time) is a later iteration if the naive version feels wrong in use.

### Success criteria

- [x] Start the timer for the first time today at T → bar shows T at the left and T+target at the right; restarting the app does not change them (persisted).
- [x] Pausing/switching projects never changes `first_started_at`. — `pause()` never calls the recorder; `switchProject`/`start` use `INSERT OR IGNORE`.
- [x] Day rollover (midnight) resets: next day's first start writes a new row. — new `date` PK, keyed off `TimerEngine.currentDate` after rollover.
- [x] Fresh day before any timer: `--:--` shown, no crash.

---

## 4. Snail drag: live delta label

**Status: ✅ Implemented.** `ProgressBar` takes a `dragLabel(fraction)` callback; `Today.tsx` shares the same 5-minute-snap helper between the live label and the release handler.

### Current behaviour

Dragging the snail (`ProgressBar.tsx` → `Today.tsx handleSeek`) gives no feedback until release, when the DistributeDeltaModal appears.

### Specification

- While dragging, render a small label below the snail: the signed time delta between the drag position and the current tracked total, snapped to 5 minutes exactly as `handleSeek` will compute it (`+0:35` / `-0:15` / `±0:00`), using the shared signed `h:mm` formatter from spec 2.
- Implementation: `ProgressBar` gains an optional `dragLabel?: (fraction: number) => string` prop; `Today.tsx` supplies the conversion (it owns `targetMinutes`/`trackedMinutes`). Label positioned at the snail's `left: pct%`, below the track.

### Success criteria

- [x] During drag the label tracks the snail and always equals the delta the DistributeDeltaModal will show on release (same snapping).
- [x] Label hidden when not dragging; drag released at ±0:00 shows no modal (existing behaviour) and no stale label.
- [x] Label stays readable at the 0% and 100% extremes (doesn't clip outside the container). — clamped to 8–92%.

---

## 5. Standout improvements (pick 2–3)

**Status: ⬜ Not started** — awaiting selection. (answer: i choose 1 and 5)

1. **Calendar-aware idle resolution.** Let the user point Shelltime at an ICS URL / Outlook calendar (read-only). When an idle window overlaps a calendar event, the prompt becomes "Looks like *Sprint Review* (10:00–11:00) — keep as MEETINGS project?" This dissolves the app's central ambiguity (meeting vs walked-away) and no lightweight tracker does it well.
2. **End-of-day review card.** At the configured end of day (or on quit), one card: today's per-project totals, idle windows kept/discarded, target delta — with one-click fixups (move 0:30 between projects, tag an untracked gap). Turns retro-fixing from modal-hunting into a 20-second ritual.
3. **"Leave at" flex readout.** You already compute cumulative overtime. Surface it on Today next to the progress-bar end time: "Target end 17:12 · with your +3:40 flex you could leave at 13:32." Makes the overtime ledger actionable instead of a dashboard stat.
4. **Global hotkeys + instant switch.** `Ctrl+Alt+S` opens the quick-switch anywhere, `Ctrl+Alt+P` pause/resume. Electron `globalShortcut`, ~30 lines. Low-friction tracking is the product promise; leaving the current window breaks it.
5. **Idle time reassignment.** Idle prompt gets a third option: "Assign to…" (Lunch/Break/other project) instead of the binary keep/discard. Cheap once spec 1's state machine exists, and it matches reality (idle ≠ always waste).

## 6. Missing basics (2–5)

**Status: ⬜ Not started** — awaiting selection.

1. **Session-level data.** Only daily totals exist — the app can't answer "when did I work?". A `sessions(start, end, project_id)` table (written on pause/switch/flush) unlocks spec 3 properly, a day timeline, and honest audit of idle discards. Biggest structural gap; everything above gets easier with it.
2. **Restore from backup.** `backup:database` exists; there is no import/restore path. A backup you can't restore in-app is a promise, not a feature.
3. **Undo for destructive actions.** Discarding idle time, deleting entries, and snail-drag redistribution are irreversible. A 10-second undo toast (keep the previous values in memory) covers 90% of it.
4. **Week view.** Today and Month exist; the natural "how's my week going" unit is missing (Mon–Fri columns × projects, weekly target = 5 × daily).
5. **CSV export.** PDF and XLSX are presentation formats; a plain CSV of date/project/minutes is the interop basic for payroll tools and spreadsheets.
