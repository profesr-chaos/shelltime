# Shelltime — Fix Specifications v0.5

Date: 2026-07-10. Fifteen items: two foundations, four window/lifecycle bugs, six UI fixes, three features. Implement in the order below — later items depend on earlier ones where marked.

## Instructions for the implementer

- **Read the file before modifying it.** Match existing style (comment density, naming, the `handle()` IPC wrapper in `electron/main.ts`, the `broadcast()` helper, the preload `api` object pattern).
- **Schema changes** go through the migration pattern in `electron/db.ts`: bump `SCHEMA_VERSION`, append a `migrations[n]` entry. Never mutate the baseline `CREATE TABLE` block for existing tables (new tables may be added there with `IF NOT EXISTS` *and* a matching migration entry is not needed for pure `CREATE TABLE IF NOT EXISTS`).
- **Tests**: pure logic gets a test in `tests/` (plain Node asserts, see `tests/logic.test.mts` / `tests/attentionMonitor.test.mts` — no frameworks; note the dependency-interface pattern `TimerEngineLike` etc. used so tests don't load Electron/better-sqlite3). Run `npm test` and `npm run build` (tsc + vite) before each commit; both must pass.
- **Commits**: one commit per numbered item (or per phase for the one-liners), descriptive message describing the change itself. Commit as you go, not one big commit at the end.
- **Types**: shared renderer/main types live in `shared/types.ts`. New IPC channels get: a `handle()` registration in `main.ts`, a preload wrapper in `electron/preload.ts`, and (if it's a push) a `broadcast()` + `on*` subscription helper.
- Where a spec says "ponytail:" it marks a deliberate simplification — implement it as stated, don't gold-plate.

---

# Phase A — Foundations

## 1. Session-level data: `sessions` table + time reallocation

**Problem.** Only daily totals exist (`daily_project_time`). The app can't answer "when did I work?", can't power a day timeline, can't honestly audit idle discards, and items 13/14 below need it.

### Specification

New table (add to `initDb`, bump `SCHEMA_VERSION` with a no-op migration entry so the version counter stays in sync):

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,               -- logical day (YYYY-MM-DD, see item 2)
  project_id INTEGER NOT NULL REFERENCES projects(id),
  started_at TEXT NOT NULL,         -- ISO timestamp
  ended_at TEXT NOT NULL            -- ISO timestamp, kept fresh while running
);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
```

**Write model (crash-safe, in `TimerEngine`):**

- `start(projectId)` / `switchProject(projectId)` / `resume()` → insert a new session row with `started_at = ended_at = now`. Keep the new row's id as `this.openSessionId`.
- The existing 15s `flush()` (and `commitElapsed()`) → `UPDATE sessions SET ended_at = now WHERE id = openSessionId`. A crash therefore loses ≤ 15 s of session tail — same guarantee daily totals already have.
- `pause()` / `stop()` / project-deleted stop / day rollover → final `ended_at` update, then `openSessionId = null`. On day rollover, close the old session at the boundary and open a new one on the new date if still running.
- `discardSeconds(projectId, seconds)` (idle discard) → also trim sessions: walk that project's sessions for the current date newest-first, shortening `ended_at` (deleting rows that shrink to ≤ 0) until `seconds` is consumed. ponytail: tail-trim is an approximation of where the idle actually was; it's the right answer in practice because idle windows end at the moment of discard.
- Sessions are **informational**: `daily_project_time` remains the source of truth for totals. Never derive totals from sessions. State this in a comment on the table DDL.
- Drop nothing: `day_meta` stays as-is (item 8 removes its UI use only).

**Reallocation function** (`electron/db.ts`):

```ts
// Move the [start, end] slice of a session to another project, splitting the
// session if the slice is interior, and move the corresponding minutes in
// daily_project_time from the old project to the new one.
export function reallocateSessionSlice(sessionId: number, startIso: string, endIso: string, toProjectId: number): void
```

Rules: clamp `[start, end]` to the session's own bounds; a slice covering the whole session just retags `project_id`; a prefix/suffix slice splits into two rows; an interior slice splits into three. Wrap the whole thing in a transaction (`db.transaction`). Moving minutes uses `addTimeToProject(date, from, -mins, 'manual')` + `addTimeToProject(date, to, +mins, 'manual')`. If the reallocated session belongs to the running timer's active project today, call `timer.flushActive()` before and `timer.resyncProjectTotal()` after (mirror the `entries:applyDelta` handler).

**IPC + UI:**

- `sessions:list(date)` → `Session[]` (with joined project code/color), `sessions:reallocate(sessionId, startIso, endIso, toProjectId)`.
- New shared type `Session { id, date, projectId, startedAt, endedAt, project }`.
- Today page: under the Projects list, a **Timeline** section listing the day's sessions chronologically: `08:00–08:45 · PROJA · 0:45` with a per-row "Reassign" action opening a small modal: project dropdown + editable start/end time fields (prefilled with the session's own, so partial reallocation is possible). ponytail: a list, not a graphical timeline — the graphical version is a later iteration.

### Success criteria

- [ ] Start → work 1 min → switch project → work 1 min → pause produces exactly 2 session rows whose durations sum to ~2 min and whose boundaries touch.
- [ ] Kill the app mid-session; on restart the last session's `ended_at` is at most ~15 s before the kill.
- [ ] Idle discard of N seconds shortens session rows by exactly N seconds total (unit test with a fake db per the `*Like` interface pattern, or a direct db test if simpler).
- [ ] Reallocating 08:00–08:45 of an 08:00–10:00 PROJA session to PROJB yields PROJB 08:00–08:45 + PROJA 08:45–10:00, and daily totals move 45 min from A to B (transaction unit test).
- [ ] Reassigning a slice never changes the day's total tracked minutes.
- [ ] Timeline section shows the sessions with real clock times; a day with no sessions shows nothing (no crash on past days pre-dating the table).

## 2. Logical day boundary at 04:00 + auto-advance

**Problem.** Day rollover happens at midnight (`todayStr()` in `timer.ts`/`main.ts`, `todayIso()` in `src/lib/format.ts`), so working at 1 a.m. books time to the calendar new day, and the Today page never advances on its own — the user has to navigate manually.

### Specification

- Define the **logical day**: the calendar date of `now − 4 h`. Work between midnight and 04:00 belongs to the previous day.
- Implement once in `shared/logicalDay.ts`: `logicalDayStr(d = new Date()): string`. Replace the bodies of `todayStr()` (electron/main.ts, electron/timer.ts) and `todayIso()` (src/lib/format.ts) with calls to it — keep the existing function names so call sites don't churn.
- `TimerEngine.rolloverDayIfNeeded()` already compares against `todayStr()` — it now rolls at 04:00 automatically. Verify `clearFinishedIfNewWorkday` still keys off the logical date.
- Today page auto-advance: `Today.tsx` holds `date` in state seeded once. Add a 60 s interval that checks `todayIso()`; when the logical day changes **and** the user is currently viewing what was "today", advance `date` to the new today. If they're viewing a past day, leave them alone.
- Dashboard/overlay need no change (they re-derive from broadcasts), but check any other `new Date()`-based date-string construction in pages for consistency (`shiftDay`/`shiftMonth` are date-string arithmetic and are fine).

### Success criteria

- [ ] Unit tests: `logicalDayStr` at 2026-07-10 03:59 → `2026-07-09`; at 04:00 → `2026-07-10`; midnight → previous day.
- [ ] Timer running across 04:00: seconds before the boundary land on the old date, after on the new (existing rollover test pattern, now at the 04:00 boundary).
- [ ] Today page left open past 04:00 advances to the new day within a minute, without user input; viewing a past day does not jump.
- [ ] "Finished for today" set on Friday still clears on the next working day (existing behaviour preserved — `npm test` regression).

---

# Phase B — Window & app lifecycle bugs

## 3. Single instance

**Problem.** Two Shelltimes can run at once — two timers, two SQLite writers.

### Specification

Top of `electron/main.ts`, before `app.whenReady()`:

```ts
if (!app.requestSingleInstanceLock()) app.quit();
else app.on('second-instance', () => { /* show + focus mainWindow, restore if minimized */ });
```

In the handler: `if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }`.

### Success criteria

- [ ] Launching a second instance (packaged or `npm run dev` double-launch) exits immediately and brings the first instance's main window to the foreground.

## 4. Overlay window grows while being dragged

**Problem.** Holding/dragging the pop-out makes it get bigger and bigger. Root cause: the custom drag calls `overlay:setPosition` per mousemove; on Windows with non-100 % display scaling (or mixed-DPI monitors), `setPosition` on a frameless non-resizable window triggers Electron's known DPI rounding drift — each call re-derives size and inflates it (electron/electron#10862 family).

### Specification

- Make main the single source of truth for the overlay's intended size: keep a module-level `overlayExpectedSize = { width, height }` in `main.ts`, updated by `resizeOverlayWindow()` (which is already the only sizing path — `setCompact`, `setHeight`, `overlay:show` all go through it or should).
- Change the `overlay:setPosition` handler to `overlayWindow.setBounds({ x, y, ...overlayExpectedSize })` instead of `setPosition(x, y)` — passing the size explicitly on every move pins it against DPI drift.
- `overlay:show`'s recenter branch: same, use `setBounds`.

### Success criteria

- [ ] Drag the overlay continuously for ~20 s on a display with 125 %/150 % scaling: `getSize()` before and after are identical (log-verify during dev).
- [ ] Drag across two monitors with different scale factors: no size change, no visual jump in widget scale.
- [ ] Compact/expanded toggle and prompt-driven `setHeight` still resize correctly afterwards.

## 5. Overlay window rendered black

**Problem.** The pop-out has been seen going fully black. The overlay is a `transparent: true` frameless window — the classic causes on Windows are (a) the renderer process crashing (nothing repaints a transparent window, so it shows black), and (b) the compositor dropping the transparent surface after sleep/resume or a GPU reset.

### Specification (defensive fixes, all three)

1. In `createOverlayWindow`, add `backgroundColor: '#00000000'` (explicit fully-transparent) to the `BrowserWindow` options.
2. On `overlayWindow.webContents.on('render-process-gone')` → `overlayWindow.webContents.reload()`. Same for the main window (log + reload) while you're there.
3. On `powerMonitor.on('resume', ...)` in `main.ts`: if the overlay is visible, nudge the compositor — re-apply `setOpacity(getSettings().overlayOpacity)` and call `overlayWindow.invalidate?.()` / fallback `webContents.invalidate()`.

ponytail: we can't reliably reproduce the black window, so this is belt-and-braces hardening of every known cause rather than a single verified fix. If it recurs after this, the next step is logging `child-process-gone` events to a file.

### Success criteria

- [ ] Kill the overlay's renderer process from Task Manager (or `overlayWindow.webContents.forcefullyCrashRenderer()` in a dev console) → overlay repaints itself within ~1 s instead of staying black.
- [ ] Sleep/resume with the overlay visible → overlay still paints.
- [ ] No regression: opacity slider, transparency, and click-through-free dragging still work.

## 6. Closing the main window closes the application

**Problem.** The main window's close button currently hides to tray (`mainWindow.on('close')` preventDefault + hide); users expect close = quit.

### Specification

- Replace the main window `close` handler body: instead of hiding, set `(app as any).isQuitting = true` and `app.quit()`. (Keep the handler so item 13's review-card interception has a hook; see below — item 13 modifies this flow, implement the plain version here first.)
- The overlay window's hide-on-close behaviour stays (it's a widget).
- Tray stays: it's still useful for pause/resume/overlay while the app runs. Its "Quit Shelltime" entry keeps working.
- `before-quit` already flushes the timer; nothing else needed.

### Success criteria

- [ ] Clicking ✕ on the main window exits the process entirely (tray icon disappears, overlay closes, no orphan in Task Manager).
- [ ] In-flight timer seconds survive: start timer, wait ~20 s, close via ✕, relaunch → tracked time includes the final partial minute (flush on quit).

---

# Phase C — UI fixes

## 7. Expanded overlay: click the project to switch

**Problem.** In the expanded pop-out, switching projects requires the Switch icon button; in compact mode you can click the project chip itself. Make expanded consistent.

### Specification

In `src/overlay/OverlayApp.tsx`, expanded branch: the active-project badge (`<span className="rounded-md bg-amber ...">{project.code}</span>`, ~line 264) becomes a `<button className="no-drag ...">` that toggles the existing `switchOpen` state (same state the Switch icon uses — one menu, two triggers). Anchor the `QuickSwitchMenu` appropriately for the badge trigger (`anchorClassName="top-8 left-0"` on a relative wrapper around the badge is fine; reusing the existing bottom-anchored menu instance is also fine if it stays visible — pick whichever renders fully inside the 240 px window). Add a hover affordance (e.g. `hover:bg-orange-600 cursor-pointer`) so it reads as clickable.

### Success criteria

- [ ] Expanded overlay: clicking the project code opens the project menu; selecting switches the timer (same behaviour as the Switch button).
- [ ] The menu is fully visible (not clipped by the window edge).
- [ ] Dragging the overlay by the badge area still works for drags > 4 px; a clean click opens the menu (the existing `useOverlayDrag` click/drag discrimination handles this — verify, don't rebuild).
- [ ] Compact-mode behaviour unchanged.

## 8. Remove start/end times under the progress bar

**Problem.** The Today progress bar shows the day's first start time and projected end time at its ends once timing starts. Remove them.

### Specification

- `src/pages/Today.tsx`: delete `startLabel`/`endLabel` computation and props, the `firstStartedAt` state + `day.getFirstStart` load.
- `src/components/ui/ProgressBar.tsx`: remove the `startLabel`/`endLabel` props and the label row (no other caller uses them).
- Keep `day_meta`, `recordDayFirstStartIfNeeded`, and the `day:getFirstStart` IPC in place — the data is still recorded and harmless. ponytail: dead-ish IPC kept to avoid a schema/API churn; delete it in a later cleanup if nothing readopts it.

### Success criteria

- [ ] No clock times render under the bar in any state (before first start, while running, on past days).
- [ ] `npm run build` passes (no unused-prop type errors).

## 9. Snail drag: live +/- delta on the Tracked and Remaining KPI cards

**Problem.** While dragging the snail you only see a small delta chip under it. The Tracked and Remaining stat cards should live-update with the projected values and a signed delta so the user sees exactly what releasing will do.

### Specification

- `ProgressBar` gains `onDragChange?: (fraction: number | null) => void` — called with the live fraction on every pointer move while dragging, and `null` on release/end. (The existing `dragLabel` chip stays.)
- `Today.tsx`: hold `dragFraction` state fed by `onDragChange`. While non-null, compute `delta = snappedDeltaMinutes(dragFraction)` (the existing shared snap helper — the cards must agree with the chip and with what release does) and render:
  - **Tracked** card: value = `minutesToHhMm(trackedMinutes + delta)`, delta chip = `signedMinutesToHhMm(delta)` (tone: good for +, bad for −), replacing the yesterday-% chip for the duration of the drag.
  - **Remaining** card: value = `minutesToHhMm(max(0, targetMinutes − (trackedMinutes + delta)))`, delta chip = `signedMinutesToHhMm(−delta)`.
- On release (`null`), cards revert to their normal values (the DistributeDeltaModal flow then applies the change as today).

### Success criteria

- [ ] Dragging right: Tracked value counts up and shows `+h:mm`; Remaining counts down and shows `-h:mm`; both agree exactly with the snail chip (same snap function).
- [ ] Dragging left mirrors the signs.
- [ ] Releasing restores the cards; cancelling the distribute modal leaves stored values untouched.
- [ ] No re-render jank: card updates are pure derived state from `dragFraction` (no IPC during drag).

## 10. Non-working day: no target progress bar

**Problem.** On a day outside `workingDays` (or a bank holiday when `skipBankHolidays` is on), the Today page still shows the target progress bar — but everything tracked is out-of-hours; a target/remaining framing is wrong.

### Specification

- Expose `db.isWorkingDay` to the renderer: `handle('day:isWorkingDay', (_e, date) => db.isWorkingDay(date))` + preload `day.isWorkingDay(date)`.
- `Today.tsx`: load `isWorkingDay` alongside the other per-date fetches. When false:
  - Hide the ProgressBar block and the "x / y · % · remaining" header line.
  - The stat row shows **Tracked** as normal; **Daily Target** and **Remaining** are replaced by a single card or note reading "Out of hours — non-working day" (keep it simple: swap the Target card's value for "—" with label "Non-working day", drop the Remaining card, or collapse to two cards — implementer's choice, minimal diff).
- Timing itself still works (people do work weekends; it just isn't measured against a target).
- Dashboard/monthly maths unchanged (working-day targets already exclude these days).

### Success criteria

- [ ] Navigate to a Saturday (default settings): no progress bar, no Remaining, tracked time still listed and editable, timer still startable.
- [ ] A bank holiday with `skipBankHolidays: true` behaves the same.
- [ ] A normal weekday is unchanged.
- [ ] A date with a daily target override but on a non-working weekday still counts as non-working (matches `isWorkingDay` semantics).

## 11. Dashboard: grey bands for weekends/off days

**Problem.** The Daily Totals bar chart only renders working days (`dailyTotals` is built from `workingDaysInMonth`), so the month's shape is distorted and weekends are invisible.

### Specification

- `db.getMonthlySummary`: build `dailyTotals` over **all** days of the month, adding `isWorkingDay: boolean` to `MonthlyDailyTotal` (shared/types.ts). For non-working days: `targetMinutes: 0`, `status: 'met'` unless tracked > 0 (existing `dayStatus` already returns 'over' for tracked>0/target 0 — fine).
- **Insights and averages must not change**: `averageMinutesPerWorkingDay`, busiest/quietest, and the under/met/over statuses must keep operating on working days (filter where needed). Add a regression assertion in tests if summary maths are already covered; otherwise verify by hand against a seeded month.
- `BarChart.tsx`: non-working days render as a full-height light band (`bg-slate-100`, no rounded top, not clickable unless they have tracked minutes — if tracked > 0, draw the amber bar on top of the band so weekend work is still visible and clickable).
- `EditTimingsModal` opening via bar click must keep working for working days.

### Success criteria

- [ ] July 2026 shows 31 columns; Sat/Sun columns are grey bands; the target dash line spans as before.
- [ ] A weekend with tracked time shows its bar inside the grey band and is clickable.
- [ ] Monthly target, efficiency %, and average-per-working-day figures are identical before/after the change for the same data.
- [ ] Custom `workingDays` settings (e.g. Sun–Thu) grey out the right days.

## 12. Dashboard: holiday bars blue, sick bars red

**Problem.** Leave days are booked at target under the HOLIDAY/SICK pseudo-projects and render as ordinary amber bars.

### Specification

- `MonthlyDailyTotal.projectCodes` already carries the day's project codes. In `BarChart.tsx`: if codes include `'SICK'` → bar color `#F43F5E` (rose, matches the SICK project color); else if `'HOLIDAY'` → `#0EA5E9` (sky, matches HOLIDAY). Sick wins over holiday; leave coloring wins over the under-target red/amber logic (a booked leave day is "met" by construction anyway). Use inline `style={{ background }}` or Tailwind arbitrary values — match whichever the file already uses (it uses classes; arbitrary color classes `bg-[#0EA5E9]` are fine).
- Tooltip (`title`) unchanged.
- Half-day leave mixed with work: leave color still wins for the whole bar. ponytail: no stacked/segmented bars in v1; segmenting is the upgrade if mixed days matter.

### Success criteria

- [ ] Book a holiday range → those working-day bars render blue; a sick day renders rose; both at target height.
- [ ] A half-day holiday plus tracked work renders one blue bar of combined height.
- [ ] Regular days keep the amber/red under-target logic.

---

# Phase D — Features

## 13. End-of-day review card

**Problem.** Finishing the day gives no summary. Wanted: when the user clicks "Finished for today", or when the app is quitting, show a summary of the day's hours — in the main window **and**, if visible, the pop-out. Closing one closes both.

### Specification

**Payload** (built in main, `shared/types.ts`):

```ts
interface DayReview {
  date: string;
  totalMinutes: number;
  targetMinutes: number;         // that day's target (0 on non-working days)
  byProject: { code: string; name: string; color: string; minutes: number }[]; // desc, leave projects included
  quitting: boolean;             // true when shown as part of the quit flow
}
```

Built from `db.getDailyEntries(logical today)` + `getDailyTargetStatus`.

**Triggers** (main process):

1. `timer:stop` handler (the "Finished for today" path): after stopping, `broadcast('review:show', buildDayReview(false))`. Also call `showOverlayForPrompt()`-style logic **only if the overlay is already visible** — do not force windows open; each window that is open shows its own card.
2. Quit flow: introduce `requestQuit()` in `main.ts` used by (a) the tray Quit item and (b) the main-window ✕ handler from item 6. If today's total tracked minutes > 0 **and** a review isn't already open, `broadcast('review:show', buildDayReview(true))` and **defer** the quit; a module-level `pendingQuit = true`. If total is 0, quit immediately.
3. `review:dismiss` IPC (invoked by whichever window's card the user closes): `broadcast('review:dismissed')` (closes the card in *both* windows), and if `pendingQuit`, proceed with `(app as any).isQuitting = true; app.quit()`.

**Renderer:**

- Main window: a modal card (reuse `src/components/ui/Modal.tsx`) — heading "Today · {h:mm} tracked", target vs tracked line (`signedMinutesToHhMm` delta), per-project rows with `ColorDot` + `h:mm`, and one primary button: "Close" (label "Quit Shelltime" when `quitting`). Subscribes to `review:show`/`review:dismissed` in `App.tsx` level so it shows regardless of the current page.
- Overlay: same data as a compact card layout in `OverlayApp.tsx` (a new top-priority branch like the idle/resume prompts; give it `overlay.setHeight` room like the others, ~300 px). Only rendered if the overlay window is visible — it naturally is, since hidden windows don't paint.
- Dismissing from either window calls `window.api.review.dismiss()`; both close via the broadcast. Preload additions: `review: { dismiss, onShow, onDismissed }`.

**Edge rules:**

- Toggling Finished off (resuming) while a card is open → treat as dismissal (broadcast).
- The card never blocks the timer engine; it's informational.
- During quit-review, a second ✕ click or tray-quit while the card is open quits immediately (don't stack).

### Success criteria

- [ ] Clicking "Finished for today" (main window or overlay) shows the summary in every visible Shelltime window; totals and per-project h:mm match the Today page.
- [ ] Closing the card in the overlay also closes it in the main window, and vice versa.
- [ ] ✕ on the main window with tracked time today: review card appears with "Quit Shelltime"; confirming quits fully (item 6 behaviour). With zero tracked time, quits straight away.
- [ ] Tray Quit follows the same flow.
- [ ] No card is forced open on a hidden window (overlay hidden stays hidden).

## 14. Calendar-aware idle resolution (ICS busy feed)

**Problem.** Meetings look like idleness: no keyboard/mouse → idle prompt → the user has to babysit the timer during calls. A published ICS URL (Outlook/Google "publish busy") tells us **when the user is busy — not which meeting** (busy-only feeds carry no titles). Use it to (a) not go idle during meetings, and (b) suggest a project switch when a meeting starts, if the user hasn't switched recently.

Depends on item 1 (sessions provide "when did the user last switch").

### Specification

**Settings** (`shared/types.ts`, defaults in `db.ts`, editable in `Settings.tsx` under a "Calendar" section):

- `calendarIcsUrl: string` (default `''` = feature off). Copy under the field: "Paste a published calendar URL (ICS). Only busy/free times are read — Shelltime never sees meeting titles."
- `meetingSwitchSuggestMinutes: number` (default 30) — suppress the switch suggestion if the user started/switched a project within this window. ponytail: exposed as a setting because 30 is a guess; no other knobs.

**New module `electron/calendarMonitor.ts`:**

- Dependency: add `node-ical` (handles RRULE recurrence + VTIMEZONE correctly; hand-rolling recurrence expansion is the kind of code that's wrong at 3 a.m. — this passes the "already-solved problem" bar for a new dependency).
- Fetch the ICS every 5 minutes (`net`/`https` in main; on failure keep the last good parse and retry next tick — never crash or prompt on network errors; log once per failure streak).
- Expand events (including recurrences) over a window of [today − 1 day, today + 1 day] and reduce to sorted, merged busy intervals `{ startMs, endMs }[]`. Treat `TRANSP:TRANSPARENT` events as free if present; all-day events (`DTSTART;VALUE=DATE`) are **ignored** (an all-day "busy" would kill idle detection for the whole day).
- Public surface (mirroring the `*Like` interface pattern so it's unit-testable with a canned ICS string): `isBusy(atMs): boolean`, `currentBusyBlock(atMs): {startMs,endMs} | null`, `refresh(): Promise<void>`.

**Integration in `AttentionMonitor`** (inject as an optional dep `calendar?: { isBusy(at:number): boolean; currentBusyBlock(...): ... }` — keep the class Electron-free for tests):

1. **Idle suppression:** in `tick()`, `active` state — before `openLiveIdlePrompt`, if `calendar?.isBusy(now)` → do not open the prompt; keep timing. The break clock also keeps accruing (a meeting is work, not a break — but do not fire the break prompt mid-meeting: gate `onBreakPrompt` on `!isBusy` too, letting it fire after the meeting ends).
2. **Lock/sleep during a meeting:** unchanged (still pauses via `handleAway`) — locking the laptop and walking to a meeting room is genuinely away from *this* machine; on return, the normal resume flow applies. However, if the frozen banked window from an away period overlaps a busy block, the banked idle prompt copy should say so: add `duringMeeting: boolean` to `IdlePromptPayload`, set when the banked window's midpoint falls in a busy block; renderer copy becomes "You were in a meeting — keep the time?" with **Keep** as the primary.
3. **Meeting-start switch suggestion:** on a not-busy → busy transition while the timer is `running`: query the last session start for today (`SELECT MAX(started_at) FROM sessions WHERE date = ?`); if it's older than `meetingSwitchSuggestMinutes`, broadcast a new prompt `meeting:prompt { projectId }`. Renderer (both windows, styled like the resume prompt): "In a meeting — still working on {CODE}?" with buttons **Yes** (dismiss) and a project quick-switch list (**switching resolves it**). Fire at most once per busy block; dismiss automatically when the busy block ends or on any timer action (switch/pause/stop) — reuse the existing prompt-priority rule: idle > resume > meeting > break.

**Renderer:** `useMeetingPrompt` hook + prompt UI in `OverlayApp.tsx` and the main window (mirror the resume-prompt wiring: broadcast, `meeting:resolve` IPC, preload wrappers).

### Success criteria

- [ ] Unit test: canned ICS with one 10:00–11:00 event (plus a weekly RRULE case) → `isBusy` true inside, false outside; merged overlapping events; all-day event ignored.
- [ ] AttentionMonitor test: idle threshold crossed at a busy time → no idle prompt, timer keeps running; same crossing outside busy → prompt as before.
- [ ] Break prompt never fires mid-busy-block; fires after it ends if the threshold was crossed.
- [ ] Switch suggestion appears when a busy block starts and the last project start/switch is > 30 min old; does **not** appear if the user switched 10 min ago; appears at most once per block.
- [ ] Empty `calendarIcsUrl` → zero behaviour change (no fetches, no prompts) — the default path.
- [ ] Unreachable URL → app keeps working on last-known data; no user-facing error spam.

---

## 15. (Housekeeping) pending version bump

The working tree has an uncommitted `package.json` version bump 0.3.1 → 0.4.0. Commit it on its own first ("bump version to 0.4.0"). When this spec is fully implemented, bump to 0.5.0 as the final commit.

---

# Implementation order & dependencies

```
1 sessions ──► 14 calendar (last-switch query)
2 logical day ──► (all date handling; do before 13's "today" payloads)
6 close-quits ──► 13 review card (quit interception)
3, 4, 5, 7, 8, 9, 10, 11, 12 — independent
```

Suggested commit sequence: 2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 — foundations first, bug fixes next (small, high-confidence), features last.

# Definition of done (whole spec)

- [ ] `npm test` passes with new tests for items 1, 2, 14 (and any other pure logic touched).
- [ ] `npm run build` passes (tsc strict + vite).
- [ ] Manual smoke: start/pause/switch/stop, overlay compact/expanded, drag overlay on a scaled display, snail drag, finish-for-today review in both windows, close-✕ quits.
- [ ] Every deliberate shortcut is marked with a `ponytail:` comment naming its ceiling.
