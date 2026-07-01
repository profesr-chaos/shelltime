**Shelltime** is a desktop time-tracking app for freelancers and consultants who need to hit a daily billable-hours target across multiple projects. The UI lives as a browser/desktop app plus a floating mini-widget. The mascot is a speedy snail (Shelltime gets it done, eventually).

---

### Navigation

A persistent dark sidebar runs down the left with the Shelltime logo at the top and four nav items: **Today**, **Dashboard**, **Projects**, and **Settings**. The active item is highlighted. The sidebar is narrow and unobtrusive — the content area takes up most of the screen.

---

### Today View (`Main_Today`)

This is the default landing screen. It answers the question: _"Where am I today?"_

**Header bar** shows the current date ("Today, July 28"), the day type ("Monday · Workday 142 of 2026"), and an orange **+ New Entry** button in the top-right corner.

**Three stat cards** sit below the header in a row:

- **Tracked** — total hours logged today (e.g. 6h 30m), with a small percentage vs. yesterday (+12%)
- **Daily Target** — the user's configured goal (e.g. 8h 0m)
- **Remaining** — hours still needed to hit target (e.g. 1h 30m), with a percentage indicator that turns red when behind

**Progress bar** spans the full width below the cards. It shows "4h 0m / 8h 0m" on the left and "50% · 4h 0m remaining" on the right. A snail icon sits at the tip of the filled portion — it slides along the bar as the day progresses.

**Project Distribution** is the main list below the progress bar. Each project the user has logged time to today appears as a row:

- A coloured dot and project code/name on the left (e.g. "GC-TENDER / General Construction Tender Phase 2")
- Total time logged to that project on the right (e.g. 01:30:00)
- A small pencil/edit icon on the far right of each row to manually adjust the entry
- The **currently active/running project** is highlighted with a warm amber background. Its timer shows live (e.g. 03:45:12 counting up in amber)

**Persistent bottom bar** is always visible while tracking. It shows:

- The active project label ("ACTIVE PROJECT / GC-TENDER") on the left
- The live session timer in large amber monospace digits ("02:14:37")
- An **Add Note** button and a **Switch** button (to switch active project without stopping)
- A large orange circular **Pause** button on the far right

---

### Dashboard / Monthly View (`Main_Monthly`)

Accessed via the **Dashboard** nav item. Answers: _"How did this month go?"_

**Month navigator** at the top: back/forward arrows around the month name ("July 2026"), plus **Export CSV** and **Settings** buttons top-right.

**Four stat cards** in a row:

- **Monthly Target** — configured goal for the month (e.g. 40.0h)
- **Actual Tracked** — what was actually logged (e.g. 44.5h), with +/- delta
- **Efficiency** — percentage of target achieved (e.g. 112%), with month-over-month delta
- **Last Month** — prior month's total for reference

**Left panel — "Hours by Project"**: A donut/ring chart showing the breakdown of tracked time by project. The centre shows total tracked vs. total available (e.g. "45.5h / 160h"). A legend below lists each project with its hours (GC-TENDER 22h, OPS-ADMIN 13h, BD-2026 8h, PERSONAL 2.5h, Remaining 114.5h).

**Right panel — "Daily Totals (working days)"**: A vertical bar chart where each bar represents one working day in the month.

- Bars that reach or exceed the daily target are orange/amber
- Bars that fall short are red
- A dashed horizontal line marks the 8h target
- An **Overtime alert** banner appears if the user has overworked vs. last month
- A hint below the chart reads: _"Under-target days are clickable — edit timings to correct."_
- **Clicking a red (under-target) bar** opens the **Edit Timings modal** for that specific day

---

### Edit Timings Modal (`Modal_EditDayTimings`)

This modal opens when a user clicks an under-target bar in the Dashboard bar chart. It lets them retroactively correct or add time entries for a past day.

**Header**: "Edit Timings" with the specific date ("Tue 8 Jul 2025") and a close (×) button.

**Progress section** at the top of the modal:

- Text summary: "4h 30m tracked of 8h 0m target"
- A progress bar (red fill, with the snail indicator at the fill tip)
- A warning row: ⚠ "Under target by 3h 30m" in amber

**Time entries list** — one row per project tracked that day:

- Project name (coloured dot + code): e.g. GC-TENDER, OPS-ADMIN, BD-2026
- An editable time field (e.g. 3h 0m, 1h 0m, 0h 30m)
- A trash/delete icon on each row
- A **+ Add time entry** link at the bottom to add a new project row

**Footer**: Cancel and **Save Changes** (primary orange) buttons.

---

### Fill Rest of Day Modal (`Modal_Card`)

This modal is for quickly allocating untracked remaining time to a single project so the day's target is met. Likely triggered from a "Fill rest of day" shortcut on the Today view.

**Three info pills** at the top:

- Daily Target (8h 0m)
- Tracked (6h 15m)
- **To Add** — highlighted in orange (1h 45m) — the gap to fill

**Project dropdown**: A selector labelled "Project to allocate" showing the currently selected project (e.g. "OPS-ADMIN (Operational Administration)"). The user picks which project absorbs the remaining time.

**Footer**: Cancel and **Confirm & Fill** (primary orange) buttons. Confirming adds a time entry for the calculated gap to the selected project.

---

### Project Management (`Project_Management_Preview`)

Accessed via the **Projects** nav item. A simple admin list of all configured projects.

**Header**: "Project Management" with a **Search** field and an **+ Add Project** orange button.

**Table** with columns: Code / Name, Status, Hours MTD (month-to-date). Each row shows:

- A coloured dot, project code, and full name (e.g. "GC-TENDER — General Construction Tender")
- A status badge: **ACTIVE** (green)
- Hours logged this month (e.g. 22.4h)

---

### Floating Widget — Compact State (`Widget_Compact`)

A minimal always-on-top pill that floats over other apps. Shows:

- The active project name in an amber tag (e.g. "GC-TENDER")
- The live session timer in monospace amber digits ("02:14:37")
- A pause icon button on the right

This is what the user sees when they're in another app (writing, coding, on a call) and just need to glance at their active timer.

---

### Floating Widget — Expanded State (`Widget_Expanded`)

The full widget panel. Expanding reveals:

- The active project amber tag and "8h 30m tracked" on the header row
- Large monospace timer ("02:14:37") centred
- A full-width orange **Pause** button
- Two icon-only buttons: Switch project, Add note

---

### Floating Widget — Break Reminder State (`Widget_Expanded - Break Reminder`)

When a break alarm fires (e.g. after 60 minutes of continuous work), the widget shifts to break state:

- The top section (project tag, timer, Pause button) **dims/mutes** — colours desaturated, opacity reduced — visually signalling it's not the focus right now
- A separator line divides the widget
- The bottom section appears at **full colour and contrast**: a bell/clock icon, "Time for a break", "60 min worked", and two buttons: **Take break** (primary, orange) and **Later** (ghost)

The user either takes the break (timer pauses) or dismisses it and keeps going.

---

### Design Language

- Dark sidebar, light content area
- Orange/amber as the primary action colour (buttons, active states, live timers)
- Red for under-target / warning states
- Monospace font for all time values
- Snail mascot sits on the progress bar tip across both the Today view and the Edit Timings modal — it inches forward as tracked time grows