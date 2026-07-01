# Time Tracking — Product Requirements Specification

## 1. Product summary

**Time Tracking** is a Windows-first desktop app for tracking time across projects with minimal friction. It helps Adam quickly start, pause, switch, edit, and report time without needing to remember exact working intervals.

The app is designed around a lightweight always-on-top overlay widget that shows the active project and elapsed time, plus a fuller desktop app for project management, manual editing, dashboard insights, targets, break reminders, and monthly export.

Version 1 is local-only and does not include voice recording, cloud sync, team accounts, billing, or integration with external project systems.

---

## 2. Goals

### 2.1 Primary goals

1. Make time tracking fast enough that it becomes a habit.
2. Allow time to be recorded against user-defined project codes.
3. Provide an always-visible overlay for pause/switch actions without opening the main app.
4. Support daily targets and quick correction when the user knows they worked but did not track everything.
5. Provide a useful monthly dashboard showing how time was distributed.
6. Produce a printable/PDF monthly export of hours and projects.
7. Allow notes to be added to recorded time for context.
8. Clearly show monthly target hours, actual hours, and overtime difference.
9. Show both current-month overtime difference and previous-month overtime difference in the dashboard and monthly export.
10. Keep all data local for V1.

### 2.2 Non-goals for V1

The following are explicitly out of scope for the first version:

- Voice recording or speech-to-text notes.
- Cloud sync.
- User accounts or login.
- Team/admin features.
- Mobile app.
- Browser extension.
- External integrations with calendars, accounting tools, project management tools, or ERP systems.
- Automatic classification of work by app/window/activity.
- Exact timeline reconstruction of every work session.
- Invoicing.

---

## 3. Target user

### 3.1 Primary user

A project-based professional who works across multiple internal or client projects and needs a low-friction way to record how many hours were spent against each project code.

### 3.2 Key user needs

- “I need to quickly start timing when I begin work.”
- “I need to switch projects without breaking concentration.”
- “I need to add a short note about what I did.”
- “I need to correct my hours if I forgot to track something.”
- “I need to know if I hit my daily target.”
- “At month-end, I need a clean summary I can print or export.”

---

## 4. Platform and deployment

### 4.1 Version 1 platform

- Windows desktop app.
- Local-only data storage.
- No login required.

### 4.2 Recommended technical direction

The recommended V1 stack is:

- Electron desktop app.
- React + TypeScript frontend.
- SQLite local database.
- `better-sqlite3` or equivalent for local persistence.
- Electron window APIs for always-on-top overlay.
- Electron PDF/print capability for monthly export.

---

## 5. Core concepts

### 5.1 Project

A project represents a code or work category that time can be recorded against.

Each project should include:

- Project code.
- Project name or description.
- Active/inactive status.
- Optional colour for quick recognition.
- Optional notes/metadata.

### 5.2 Time entry

A time entry records a quantity of time against a project on a specific date.

For V1, the app does **not** need to preserve exact start/end times for every work block. The core requirement is total time by project by day.

Each time entry should include:

- Date.
- Project.
- Duration.
- Source: timer, manual edit, fill-rest-of-day.
- Optional notes.
- Created timestamp.
- Updated timestamp.

### 5.3 Note

A note is a short text description attached to recorded time.

Examples:

- “Wrote tender responses for questions 1 and 2.”
- “Reviewed commercial assumptions.”
- “Updated project tracker and risk notes.”

Notes should be editable and visible in daily and monthly views.

### 5.4 Daily target

A daily target is the number of hours the user intends to record for a working day.

Example:

- Monday target: 8 hours.
- Friday target: 7.5 hours.

V1 may start with a single default target, e.g. 8 hours per day, and later support per-day configuration.

### 5.5 Overlay widget

A compact always-on-top window that sits above other screens and lets the user control tracking without opening the main app.

### 5.6 Monthly target and overtime

A monthly target is the total expected working time for a selected month.

Example:

- Monthly target: 40 hours.
- Actual tracked time: 44.5 hours.
- Overtime difference: +4.5 hours.

The overtime difference is calculated as:

```text
actual monthly hours - target monthly hours
```

Positive values represent overtime. Negative values represent hours under target.

The app should also show the previous month’s overtime difference so the user can compare whether their overtime position is improving, worsening, or balancing out over time.

---

## 6. Functional requirements

## 6.1 Project management

### Requirement PM-1: Add project manually

The user must be able to create a project from within the app.

Minimum fields:

- Project code.
- Project name.

Optional fields:

- Colour.
- Description.
- Active/inactive status.

### Requirement PM-2: Paste project codes

The user must be able to paste a list of project codes into the app.

The app should support pasted text where each line is one project, for example:

```text
GC-TENDER | GC Tender Project
OPS-ADMIN | Operations Admin
BD-2026 | Business Development 2026
```

The app should also tolerate simpler input:

```text
GC-TENDER
OPS-ADMIN
BD-2026
```

If only a code is supplied, project name may default to the same value.

### Requirement PM-3: Edit project

The user must be able to edit a project’s name, code, colour, and active status.

### Requirement PM-4: Archive project

The user must be able to mark a project inactive without deleting historical time.

Inactive projects should not appear in the default quick-switch list, but should remain available in historical reports.

---

## 6.2 Timer tracking

### Requirement TT-1: Start timer

The user must be able to start timing against a selected project.

Starting the timer should:

- Set the selected project as active.
- Begin counting elapsed time.
- Update the overlay widget.

### Requirement TT-2: Pause timer

The user must be able to pause timing.

Pausing should:

- Stop incrementing elapsed time.
- Preserve time already recorded.
- Keep the active project visible as the most recent project.

### Requirement TT-3: Resume timer

The user must be able to resume timing against the last selected project.

### Requirement TT-4: Switch project

The user must be able to switch from one project to another.

Switching should:

- Stop timing against the previous project.
- Add elapsed time to that project’s total for the day.
- Start timing against the newly selected project.

### Requirement TT-5: No exact interval requirement

V1 does not need to store an exact sequence of start and stop intervals.

The app should store accurate total duration per project per day, but exact session history is optional.

---

## 6.3 Overlay widget

### Requirement OW-1: Always-on-top widget

The app must include a compact overlay widget that can sit above other windows.

The overlay should show:

- Current project code/name.
- Current running duration.
- Today’s total tracked time.
- Timer status: running or paused.

### Requirement OW-2: Quick pause/resume

The overlay must allow the user to pause and resume the timer.

### Requirement OW-3: Quick project switch

The overlay must allow the user to switch project without opening the full app.

The switch interaction should be fast and keyboard-friendly where practical.

### Requirement OW-4: Add note from overlay

The overlay must allow the user to add a short text note to the current project/day.

The note interaction should require minimal steps:

1. Click or shortcut “Add note”.
2. Type note.
3. Save.

### Requirement OW-5: Overlay positioning

The user must be able to move the overlay to a convenient place on screen.

The app should remember the overlay position between launches.

### Requirement OW-6: Overlay compact mode

The overlay should have a compact form that remains unobtrusive while still showing the essential timer information.

---

## 6.4 First activity prompt

### Requirement FP-1: First mouse movement prompt

When the app detects the first mouse movement or first meaningful activity of the day, it should prompt the user to start timing.

The prompt should appear only if:

- No time has yet been recorded for the day, or
- The timer has not yet been started that day.

### Requirement FP-2: Prompt actions

The prompt should offer:

- Start timing.
- Choose project.
- Dismiss.
- Do not remind me today.

### Requirement FP-3: Avoid excessive prompting

The prompt must not repeatedly interrupt the user.

If dismissed, it should wait a sensible amount of time before showing again, or not show again that day depending on the selected action.

---

## 6.5 Daily targets

### Requirement DT-1: Set daily target

The user must be able to set a target number of hours for a day.

Default target should be configurable, e.g. 8 hours.

### Requirement DT-2: Show target progress

The app should show progress toward the daily target.

Examples:

- 5h 30m / 8h tracked.
- 2h 30m remaining.
- Target reached.

### Requirement DT-3: Target status

The app should clearly indicate whether the day is:

- Under target.
- On target.
- Over target.

### Requirement DT-4: Monthly target calculation

The app must calculate a monthly target total for the selected month.

For V1, the monthly target may be calculated from daily targets across working days, or manually overridden by the user.

Example:

- Weekly/monthly target shown as 40 hours where applicable.
- Actual tracked time shown as 44.5 hours.
- Overtime difference shown as +4.5 hours.

### Requirement DT-5: Monthly overtime difference

The app must calculate the selected month’s overtime difference using:

```text
actual hours - target hours
```

The result should be displayed clearly as:

- Positive overtime, e.g. `+4.5h`.
- On target, e.g. `0h`.
- Under target, e.g. `-2h`.

### Requirement DT-6: Previous month overtime difference

The app must show the previous month’s overtime difference alongside the selected month’s overtime difference.

Example:

- This month: `+4.5h`.
- Last month: `-1.0h`.

This should appear in both the dashboard and the monthly export.

---

## 6.6 Fill rest of day

### Requirement FR-1: Fill rest of day with project

The user must be able to fill the remaining time up to the daily target with a selected project.

Example:

- Daily target: 8h.
- Already tracked: 6h 15m.
- User selects “Fill rest of day with GC Tender”.
- App adds 1h 45m to GC Tender.

### Requirement FR-2: Fill confirmation

Before applying the fill, the app should show a confirmation:

- Target hours.
- Already tracked hours.
- Time to be added.
- Project receiving the added time.

### Requirement FR-3: Fill source tracking

Time added through this feature should be marked with source `fill-rest-of-day`.

This helps distinguish actively timed work from later correction.

### Requirement FR-4: Fill should not reduce time

If the user has already met or exceeded the target, the app should not add negative time.

Instead, it should show that the daily target has already been met.

---

## 6.7 Manual editing

### Requirement ME-1: Edit daily project totals

The user must be able to manually adjust the recorded duration for a project on a specific day.

### Requirement ME-2: Add manual time

The user must be able to manually add time to a project for a specific day.

### Requirement ME-3: Delete time entry

The user must be able to remove a time entry or reduce a project’s recorded time.

### Requirement ME-4: Edit notes

The user must be able to add, edit, and delete notes associated with a project/day.

### Requirement ME-5: Audit indication

The app should indicate when time was manually edited.

V1 does not require a full audit log, but should at least preserve the source or modified timestamp.

---

## 6.8 Notes

### Requirement NO-1: Add note to current project

The user must be able to add a note to the project currently being tracked.

### Requirement NO-2: Add note to existing time

The user must be able to add a note to a project/day after the time has already been recorded.

### Requirement NO-3: Multiple notes per project/day

The app should support multiple notes for the same project on the same day.

### Requirement NO-4: Notes in reports

Monthly exports should include notes, either inline under each project/day or in a separate notes section.

### Requirement NO-5: Notes are text-only in V1

V1 notes are typed text only.

No audio recording, attachments, speech-to-text, or rich text formatting is required.

---

## 6.9 Break reminders

### Requirement BR-1: Configurable break interval

The user must be able to set a break reminder interval.

Examples:

- Every 30 minutes.
- Every 60 minutes.
- Every 90 minutes.

### Requirement BR-2: Break reminder prompt

When the interval is reached, the app should prompt the user to take a break.

The prompt should offer:

- Start break.
- Remind me later.
- Skip this break.

### Requirement BR-3: Grind mode

The user must be able to disable break reminders using a mode labelled “Grind mode”.

When Grind mode is enabled:

- Break reminders are suppressed.
- The UI should clearly indicate that reminders are off.

### Requirement BR-4: Breaks and tracked time

For V1, breaks do not need to be tracked as separate time categories unless the user pauses the timer.

---

## 6.10 Monthly dashboard

### Requirement DB-1: Monthly project summary

The dashboard must show total hours by project for the selected month.

### Requirement DB-2: Daily totals

The dashboard should show tracked time by day for the month.

### Requirement DB-3: Target performance

The dashboard should show how many days met, missed, or exceeded the daily target.

### Requirement DB-4: Monthly target, actual hours, and overtime

The dashboard must clearly show the selected month’s target hours, actual tracked hours, and overtime difference.

The dashboard should include a prominent monthly summary area showing:

- Monthly target hours.
- Actual tracked hours.
- Overtime difference for the selected month.
- Overtime difference for the previous month.

Example:

| Metric | Value |
|---|---:|
| Target hours | 40.0h |
| Actual hours | 44.5h |
| This month overtime | +4.5h |
| Last month overtime | -1.0h |

The UI should make positive, zero, and negative overtime states visually distinct without relying on colour alone.

### Requirement DB-5: Overtime trend

The dashboard should indicate whether the current month’s overtime difference is higher, lower, or unchanged compared with the previous month.

Examples:

- “Overtime is 5.5h higher than last month.”
- “Overtime is 2.0h lower than last month.”
- “Overtime is unchanged from last month.”

### Requirement DB-6: Fun summary insights

The dashboard should include lightweight summary insights, such as:

- Most-worked project.
- Quietest day.
- Busiest day.
- Number of project switches.
- Total hours tracked.
- Average tracked hours per working day.

### Requirement DB-7: Visual clarity

Dashboard charts should be simple and readable.

Suggested visualisations:

- Bar chart: hours by project.
- Calendar-style heatmap or daily bar chart: hours by day.
- Donut or stacked bar: project distribution.

---

## 6.11 Monthly export

### Requirement EX-1: Generate monthly report

The user must be able to generate a report for a selected month.

The report should include:

- Month and year.
- Monthly target hours.
- Actual tracked hours.
- Overtime difference for the selected month.
- Overtime difference for the previous month.
- Total hours.
- Hours by project.
- Daily breakdown.
- Notes.
- Target summary.

### Requirement EX-2: Printable format

The report must be printable.

### Requirement EX-3: PDF export

The app must support exporting the monthly report as a PDF.

### Requirement EX-4: Clean report layout

The report should be designed for practical review, not just raw data.

It should include:

- Clear title.
- Summary totals.
- Target hours, actual hours, and overtime difference.
- Previous-month overtime comparison.
- Project table.
- Daily breakdown table.
- Notes section.

---

## 7. User journeys

## 7.1 First setup

1. User opens the app.
2. App asks the user to set a default daily target.
3. User adds project codes manually or pastes a list.
4. User chooses whether break reminders are enabled.
5. App shows main dashboard and overlay.

## 7.2 Start work for the day

1. User first moves mouse or starts using the computer.
2. App prompts: “Start timing?”
3. User selects a project.
4. Timer starts.
5. Overlay shows project and elapsed time.

## 7.3 Switch project from overlay

1. User clicks project name in overlay.
2. Quick switch list appears.
3. User selects another project.
4. App saves elapsed time to previous project.
5. New project starts immediately.

## 7.4 Add note from overlay

1. User clicks “Add note”.
2. Small note field opens.
3. User types: “Wrote tender responses for questions 1 and 2.”
4. User saves.
5. Note is attached to the current project/day.

## 7.5 Correct missing time

1. User opens today’s view.
2. App shows 6h 15m tracked against an 8h target.
3. User chooses “Fill rest of day”.
4. User selects project.
5. App confirms it will add 1h 45m.
6. User confirms.
7. Daily target is met.

## 7.6 Month-end export

1. User opens monthly dashboard.
2. User selects the relevant month.
3. User reviews project totals and notes.
4. User makes any manual edits.
5. User exports PDF or prints the report.

---

## 8. Data requirements

## 8.1 Suggested entities

### projects

- `id`
- `code`
- `name`
- `colour`
- `description`
- `is_active`
- `created_at`
- `updated_at`

### daily_project_time

- `id`
- `date`
- `project_id`
- `duration_minutes`
- `source`
- `created_at`
- `updated_at`

### notes

- `id`
- `date`
- `project_id`
- `time_entry_id` optional
- `text`
- `created_at`
- `updated_at`

### daily_targets

- `id`
- `date`
- `target_minutes`
- `created_at`
- `updated_at`

### monthly_target_overrides

- `id`
- `month`
- `target_minutes`
- `created_at`
- `updated_at`

This table is optional for V1, but recommended if the user needs to override calculated monthly targets, e.g. setting a month target directly to 40 hours.

### settings

- `key`
- `value`

Potential settings:

- Default daily target.
- Monthly target override.
- Break reminder interval.
- Grind mode enabled/disabled.
- Overlay position.
- Overlay compact mode.
- First activity prompt enabled/disabled.

---

## 9. UX requirements

### 9.1 Design principles

The app should feel:

- Simple.
- Calm.
- Fast.
- Low-friction.
- Trustworthy.
- Slightly playful in the dashboard, without undermining professional reporting.

### 9.2 Interaction principles

- Most common actions should be available from the overlay.
- Starting, pausing, and switching projects should be one or two clicks.
- Manual correction should feel acceptable, not like an error state.
- The app should avoid guilt-heavy language around missed tracking.
- Reports should look clean enough to share or file.

### 9.3 Accessibility

The app should support:

- Keyboard navigation for key flows.
- Visible focus states.
- Sufficient colour contrast.
- Reduced motion settings where animations are used.
- Clear text labels, not icon-only controls for critical actions.

---

## 10. Notifications and prompts

### 10.1 Prompt types

The app may show prompts for:

- First activity of the day.
- Break reminder.
- Target not yet reached near end of day.
- Confirmation before filling rest of day.

### 10.2 Prompt behaviour

Prompts should be useful but not intrusive.

Each prompt should include an obvious dismissal option and should not repeatedly reappear after dismissal.

---

## 11. Reporting requirements

### 11.1 Monthly report contents

The monthly report should include:

1. Report title.
2. Month/year.
3. Monthly target hours.
4. Actual tracked hours.
5. Overtime difference for the selected month.
6. Overtime difference for the previous month.
7. Hours by project.
8. Daily breakdown.
9. Notes grouped by project and/or date.
10. Target summary.
11. Export timestamp.

### 11.2 Monthly overtime summary example

| Metric | Value |
|---|---:|
| Target hours | 40.0h |
| Actual hours | 44.5h |
| This month overtime | +4.5h |
| Last month overtime | -1.0h |

### 11.3 Report table example

| Project code | Project name | Hours | Notes count |
|---|---:|---:|---:|
| GC-TENDER | GC Tender Project | 42.5 | 8 |
| OPS-ADMIN | Operations Admin | 11.0 | 3 |
| BD-2026 | Business Development 2026 | 6.5 | 2 |

### 11.4 Daily breakdown example

| Date | Total hours | Projects | Target status |
|---|---:|---|---|
| 2026-07-01 | 8.0 | GC-TENDER, OPS-ADMIN | Met |
| 2026-07-02 | 7.5 | GC-TENDER | Under |

---

## 12. Settings requirements

The settings screen should include:

- Default daily target.
- Monthly target override.
- Break reminder interval.
- Grind mode on/off.
- First activity prompt on/off.
- Overlay always-on-top on/off.
- Overlay compact mode.
- Data location/export backup option.

---

## 13. Error handling

### 13.1 Project import errors

If pasted project codes cannot be parsed, the app should show which lines need attention.

### 13.2 Export errors

If PDF export fails, the app should explain what happened and allow the user to try again.

### 13.3 Timer conflict errors

Only one project should be actively timed at once.

If the app detects conflicting timer state, it should resolve safely by pausing the current timer and asking the user to confirm the correct active project.

---

## 14. Privacy and security

### 14.1 Local data

All V1 data should remain on the user’s machine.

### 14.2 No account required

V1 should not require account creation, login, or external authentication.

### 14.3 No voice/audio data

V1 must not record or store audio.

### 14.4 Data export

The user should be able to export monthly reports. A later version may add full database backup/export.

---

## 15. Performance requirements

- Overlay controls should respond immediately.
- Timer display should update smoothly without high CPU usage.
- App launch should be quick enough for daily use.
- Monthly dashboard should load quickly for typical personal usage volumes.
- PDF export should complete within a few seconds for a normal monthly report.

---

## 16. Acceptance criteria

### V1 is acceptable when:

1. User can add and edit project codes manually.
2. User can paste a list of project codes.
3. User can start, pause, resume, and switch project timers.
4. Overlay shows active project and elapsed time.
5. Overlay supports pause/resume and project switching.
6. User can add typed notes to recorded time.
7. User can manually edit time totals.
8. User can set a daily target.
9. User can fill the remaining target time with a selected project.
10. App prompts user to start timing on first activity of the day.
11. App can remind user to take breaks at a configurable interval.
12. User can enable Grind mode to turn break reminders off.
13. Monthly dashboard shows hours by project and daily totals.
14. Monthly dashboard clearly shows target hours, actual hours, this month’s overtime difference, and last month’s overtime difference.
15. User can generate a printable/PDF monthly report.
16. PDF report clearly shows target hours, actual hours, this month’s overtime difference, and last month’s overtime difference.
17. App works locally on Windows without requiring login.

---

## 17. Suggested V1 release phases

### Phase 1: Core tracking

- Project creation/editing.
- Timer start/pause/resume/switch.
- Local SQLite storage.
- Basic today view.

### Phase 2: Overlay

- Always-on-top widget.
- Quick pause/resume.
- Quick project switch.
- Add note from overlay.

### Phase 3: Corrections and targets

- Daily target setting.
- Manual editing.
- Fill rest of day.
- Target progress indicators.

### Phase 4: Dashboard and export

- Monthly dashboard.
- Project totals.
- Daily breakdown.
- Notes display.
- Printable/PDF export.

### Phase 5: Reminders and polish

- First activity prompt.
- Break reminders.
- Grind mode.
- Settings screen.
- Installer/package polish.

---

## 18. Future version ideas

Potential V2+ features:

- Speech-to-text notes.
- Calendar integration.
- Project import from external systems.
- Cloud backup.
- Multi-device sync.
- Team reporting.
- Exact timeline/session history.
- Smart suggestions based on previous project patterns.
- Automatic idle detection.
- Weekly reports.
- Invoice-ready exports.
- CSV export.
- Keyboard global shortcuts.

---

## 19. Open questions

1. Should the app support multiple daily targets by weekday, or only one default target for V1?
2. Should notes appear in the monthly PDF grouped by date, by project, or both?
3. Should manual edits require a note explaining the change?
4. Should the overlay be visible on startup by default?
5. Should the app start automatically with Windows?
6. Should idle detection be included in V1, or only the first activity prompt?
7. What exact project code paste formats should be supported initially?

---

## 20. Recommended V1 product stance

The app should not try to be a forensic activity tracker. It should be a practical, forgiving time ledger.

The key design principle is:

> Make the correct thing easy, and make correction normal.

For V1, success means the user can track enough time, with enough context, to produce a reliable month-end report without feeling like they spent the month maintaining the tracker itself.

---

## 21. UI component inventory

### 21.1 App shell

- Main window frame.
- Sidebar navigation.
- Top bar / page header.
- Settings button.
- Month selector.
- Global status indicator: running / paused / idle.
- App tray icon / system tray menu.

### 21.2 Always-on-top overlay widget

- Overlay container.
- Current project display.
- Running timer display.
- Today’s total time display.
- Pause / resume button.
- Switch project button.
- Add note button.
- Compact mode toggle.
- Drag handle.
- Minimise / collapse button.
- “Open full app” button.

### 21.3 Project management

- Project list.
- Project search/filter.
- Project card / row.
- Add project form.
- Edit project form.
- Paste project codes importer.
- Import preview table.
- Project colour picker.
- Active / inactive toggle.
- Archive project confirmation.

### 21.4 Timer controls

- Start timer button.
- Pause timer button.
- Resume timer button.
- Stop/end current timing button.
- Project selector.
- Quick switch project menu.
- Recent projects list.
- Timer status badge.
- Daily tracked total counter.

### 21.5 Today view

- Today summary panel.
- Daily target progress bar.
- Time remaining indicator.
- Project time breakdown.
- Editable daily project rows.
- Add manual time button.
- Fill rest of day button.
- Notes list.
- Add note field.
- Edit note action.
- Delete note action.

### 21.6 Manual editing

- Time edit modal.
- Duration input.
- Date picker.
- Project picker.
- Source label: timer / manual / fill-rest-of-day.
- Save changes button.
- Delete time confirmation.
- Modified indicator.

### 21.7 Notes

- Note input field.
- Note composer modal / popover.
- Note list item.
- Note timestamp.
- Note project tag.
- Edit note button.
- Delete note button.
- Notes section in daily view.
- Notes section in monthly report.

### 21.8 Daily targets and overtime

- Daily target input.
- Monthly target summary card.
- Actual hours summary card.
- This month overtime card.
- Last month overtime card.
- Overtime difference badge.
- Target status badge: under / met / over.
- Monthly target override input.

### 21.9 Fill rest of day

- Fill rest of day button.
- Fill project selector.
- Fill confirmation modal.
- Target hours display.
- Already tracked display.
- Time to add display.
- Confirm fill button.
- Cancel button.

### 21.10 Break reminders

- Break reminder settings panel.
- Break interval selector.
- Break reminder prompt.
- Start break button.
- Remind me later button.
- Skip break button.
- Grind mode toggle.
- Grind mode status badge.

### 21.11 First activity prompt

- First activity notification.
- Start timing button.
- Choose project button.
- Dismiss button.
- Do not remind me today button.

### 21.12 Monthly dashboard

- Month selector.
- Monthly summary cards.
- Hours by project chart.
- Daily totals chart.
- Project distribution chart.
- Target performance summary.
- Overtime comparison panel.
- Fun insights cards:
  - Most-worked project.
  - Busiest day.
  - Quietest day.
  - Average hours per working day.
  - Number of project switches.
- Project totals table.
- Daily breakdown table.

### 21.13 Monthly export / print preview

- Report preview screen.
- Export PDF button.
- Print button.
- Monthly report header.
- Target vs actual summary.
- Overtime comparison block.
- Hours by project table.
- Daily breakdown table.
- Notes section.
- Export timestamp.
- PDF export error message.

### 21.14 Settings

- Default daily target setting.
- Monthly target override setting.
- Break reminder interval setting.
- Grind mode toggle.
- First activity prompt toggle.
- Overlay always-on-top toggle.
- Overlay compact mode setting.
- Overlay position reset.
- Data location / backup option.
- Start with Windows toggle.

### 21.15 Notifications and confirmations

- Toast notification.
- Confirmation modal.
- Error banner.
- Empty state.
- Loading state.
- Success message.
- Unsaved changes warning.

### 21.16 Reusable base components

- Button.
- Icon button.
- Text input.
- Number input.
- Textarea.
- Select dropdown.
- Combobox / searchable select.
- Toggle switch.
- Checkbox.
- Radio group.
- Date picker.
- Time duration input.
- Modal.
- Popover.
- Tooltip.
- Badge.
- Card.
- Table.
- Tabs.
- Progress bar.
- Chart container.
- Divider.
- Empty state panel.
- Keyboard shortcut hint.
