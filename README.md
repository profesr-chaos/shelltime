# Shelltime

Low-friction desktop time tracking for project-based work. Track hours per
project with a live timer or by hand, keep a small always-on-top overlay while
you work, book holiday and sick leave, and export a clean monthly timesheet.

Built with Electron, React and SQLite. Windows-first.

---

## Features

- **Per-project time tracking** — run a live timer on a project, switch between
  projects, or log time manually for any day.
- **Floating overlay** — a compact, always-on-top widget shows the active timer
  above whatever app you're in, with pause/resume, project switch and quick notes.
  Adjustable opacity and a compact mode.
- **Today** — daily total vs. target with a draggable progress marker that
  reassigns tracked time between projects, per-day navigation, and per-project
  notes.
- **Dashboard** — monthly overview: hours by project (donut), daily totals
  (bar chart, click any day to edit), efficiency/overtime KPIs, and insights.
- **Leave** — book **holiday** and **sick** days as ranges from a calendar
  (full or half day). Leave is credited at your daily target so time off doesn't
  drag your numbers down, and it's summarised on the dashboard.
- **Public-holiday aware** — working days and monthly targets automatically
  exclude public holidays for your region (any country/sub-region via
  [`date-holidays`](https://github.com/commenthol/date-holidays)).
- **Targets** — a default daily target, optional per-day overrides, and an
  optional monthly override.
- **Break reminders & idle auto-pause** — configurable break interval; the timer
  auto-pauses on inactivity, sleep or screen lock.
- **Exports** — a landscape **PDF** timesheet (project × day grid with totals and
  KPIs), an **Excel** (`.xlsx`) version of the same, and a one-click **database
  backup**.

## Tech stack

| Area | Choice |
| --- | --- |
| Desktop shell | Electron 33 |
| UI | React 18 + Tailwind CSS |
| Build | Vite 6 + `vite-plugin-electron`, TypeScript |
| Storage | SQLite via `better-sqlite3` (local, in the OS user-data dir) |
| Packaging | electron-builder (NSIS installer) |
| Reports | `exceljs` (Excel), Electron `printToPDF` (PDF) |
| Holidays | `date-holidays` |

## Getting started

Requires Node.js 18+ and the platform build tools needed to compile
`better-sqlite3` (on Windows: the "Desktop development with C++" workload).

```bash
npm install       # installs deps and rebuilds native modules for Electron
npm run dev        # launch the app with hot reload
npm test           # run the logic unit tests
```

## Building a release

```bash
npm run dist       # type-check, build, and produce a Windows installer
```

The installer is written to `release/` as `Shelltime Setup <version>.exe`. It is
**unsigned**, so Windows SmartScreen will warn on first run — choose
**More info → Run anyway**.

Upgrades install over an existing version and **preserve data**: the SQLite
database lives in the OS user-data directory (see below), separate from the
install folder, and schema changes are handled by an internal migration runner.

## Where your data lives

`%APPDATA%\Shelltime\shelltime.db` on Windows (open it from **Settings → Open
data folder**, or export a copy with **Back up database**). Uninstalling does not
delete it.

## Project structure

```
electron/        Electron main process, preload bridge, SQLite layer, timer engine
shared/          Types shared between main and renderer
src/             React renderer
  pages/         Today, Dashboard, Projects, Settings, Welcome, export views
  components/    UI components, charts, modals, the overlay
  hooks/ lib/    Timer/projects hooks and formatting helpers
tests/           Assert-based unit tests for the pure logic
```

## License

Private project. All rights reserved.
