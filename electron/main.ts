import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, powerMonitor } from 'electron';
import path from 'node:path';
import * as db from './db';
import { TimerEngine } from './timer';

// Wrap every IPC handler so a thrown error is logged in the main process (and still rejects the
// renderer promise) instead of failing silently and, e.g., leaving a screen blank.
function handle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await listener(event, ...args);
    } catch (err) {
      console.error(`IPC "${channel}" failed:`, err);
      throw err;
    }
  });
}

process.env.APP_ROOT = path.join(__dirname, '..');
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
const ICON_PATH = path.join(process.env.APP_ROOT, 'resources', 'icon.png');

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let timer: TimerEngine;
let overlaySaveTimeout: ReturnType<typeof setTimeout> | null = null;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadWindow(win: BrowserWindow, htmlFile: string, extra?: string) {
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(`${VITE_DEV_SERVER_URL}${htmlFile}${extra ?? ''}`);
  } else {
    win.loadFile(path.join(RENDERER_DIST, htmlFile), extra ? { search: extra.replace(/^\?/, '') } : undefined);
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    icon: ICON_PATH,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  loadWindow(mainWindow, 'index.html');

  mainWindow.on('close', (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createOverlayWindow() {
  const settings = db.getSettings();
  const pos = settings.overlayPosition;
  const size = settings.overlayCompact ? { width: 340, height: 44 } : { width: 320, height: 220 };

  overlayWindow = new BrowserWindow({
    ...size,
    x: pos?.x,
    y: pos?.y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    opacity: settings.overlayOpacity,
    alwaysOnTop: settings.overlayAlwaysOnTop,
    skipTaskbar: true,
    hasShadow: false,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  loadWindow(overlayWindow, 'overlay.html');
  if (settings.overlayAlwaysOnTop) overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  overlayWindow.on('moved', () => {
    if (!overlayWindow) return;
    const [x, y] = overlayWindow.getPosition();
    if (overlaySaveTimeout) clearTimeout(overlaySaveTimeout);
    overlaySaveTimeout = setTimeout(() => db.updateSettings({ overlayPosition: { x, y } }), 400);
  });

  overlayWindow.on('close', (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      overlayWindow?.hide();
    }
  });
}

function createTray() {
  tray = new Tray(ICON_PATH);
  const rebuildMenu = () => {
    const state = timer.getState();
    tray!.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open Shelltime', click: () => mainWindow?.show() },
        { label: 'Show overlay', click: () => overlayWindow?.show() },
        { type: 'separator' },
        {
          label: state.status === 'running' ? 'Pause timer' : 'Resume timer',
          enabled: state.activeProjectId !== null,
          click: () => (state.status === 'running' ? timer.pause() : timer.resume()),
        },
        { type: 'separator' },
        {
          label: 'Quit Shelltime',
          click: () => {
            (app as any).isQuitting = true;
            app.quit();
          },
        },
      ])
    );
  };
  rebuildMenu();
  tray.on('click', () => mainWindow?.show());
  tray.setToolTip('Shelltime');
  return rebuildMenu;
}

function resizeOverlayWindow(width: number, height: number) {
  if (!overlayWindow) return;
  // setSize can silently no-op on a non-resizable window on Windows; toggling resizable works around it.
  overlayWindow.setResizable(true);
  overlayWindow.setSize(width, height);
  overlayWindow.setResizable(false);
}

function broadcast(channel: string, ...args: unknown[]) {
  for (const win of [mainWindow, overlayWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
  }
}

function pauseTimerForIdle() {
  if (timer.getState().status !== 'running') return;
  timer.pause();
  broadcast('timer:update', timer.getState());
}

// Auto-pause a running timer when the machine goes idle/asleep/locked, so you don't bank time while away.
function startIdleMonitor() {
  powerMonitor.on('suspend', pauseTimerForIdle);
  powerMonitor.on('lock-screen', pauseTimerForIdle);
  setInterval(() => {
    const idleMinutes = db.getSettings().autoPauseIdleMinutes;
    if (idleMinutes <= 0) return;
    if (powerMonitor.getSystemIdleTime() >= idleMinutes * 60) pauseTimerForIdle();
  }, 30_000);
}

function registerIpc() {
  handle('projects:list', (_e, includeInactive: boolean) => db.listProjects(includeInactive));
  handle('projects:create', (_e, input) => {
    const project = db.createProject(input);
    broadcast('projects:changed');
    return project;
  });
  handle('projects:update', (_e, id, patch) => {
    const project = db.updateProject(id, patch);
    broadcast('projects:changed');
    return project;
  });
  handle('projects:setActive', (_e, id, isActive) => {
    const project = db.setProjectActive(id, isActive);
    broadcast('projects:changed');
    return project;
  });
  handle('projects:delete', (_e, id) => {
    db.deleteProject(id);
    broadcast('projects:changed');
    if (timer.getState().activeProjectId === id) {
      timer.stopIfActiveProjectMissing();
      broadcast('timer:update', timer.getState());
    }
  });

  handle('entries:getDaily', (_e, date) => db.getDailyEntries(date));
  handle('entries:getDailyTotal', (_e, date) => db.getDailyTotalMinutes(date));
  handle('entries:set', (_e, date, projectId, durationMinutes, source) => {
    const entry = db.setDailyEntry(date, projectId, durationMinutes, source);
    if (date === todayStr()) {
      timer.resyncProjectTotal(projectId);
      broadcast('timer:update', timer.getState());
    }
    return entry;
  });
  handle('entries:delete', (_e, date, projectId) => {
    db.deleteDailyEntry(date, projectId);
    if (date === todayStr()) {
      timer.resyncProjectTotal(projectId);
      broadcast('timer:update', timer.getState());
    }
  });
  handle('entries:applyDelta', (_e, date, projectIds, deltaMinutes) => {
    // Persist any in-flight timer seconds first so this relative delta lands on an up-to-date base.
    if (date === todayStr()) timer.flushActive();
    db.applyTimeDelta(date, projectIds, deltaMinutes);
    if (date === todayStr()) {
      for (const projectId of projectIds as number[]) timer.resyncProjectTotal(projectId);
      broadcast('timer:update', timer.getState());
    }
  });

  handle('holidays:list', (_e, month) => db.listHolidays(month));
  handle('holidays:add', (_e, date) => {
    const entry = db.addHoliday(date);
    broadcast('projects:changed'); // the HOLIDAY project may have just been created
    if (date === todayStr()) broadcast('timer:update', timer.getState());
    return entry;
  });
  handle('holidays:addRange', (_e, start: string, end: string) => {
    const booked = db.addHolidayRange(start, end);
    if (booked.length) broadcast('projects:changed'); // the HOLIDAY project may have just been created
    if (booked.includes(todayStr())) broadcast('timer:update', timer.getState());
    return booked;
  });
  handle('holidays:remove', (_e, date) => {
    db.removeHoliday(date);
    if (date === todayStr()) broadcast('timer:update', timer.getState());
  });

  handle('notes:list', (_e, date, projectId) => db.listNotes(date, projectId));
  handle('notes:add', (_e, date, projectId, text) => db.addNote(date, projectId, text));
  handle('notes:update', (_e, id, text) => db.updateNote(id, text));
  handle('notes:delete', (_e, id) => db.deleteNote(id));

  handle('settings:get', () => db.getSettings());
  handle('settings:update', (_e, patch) => {
    const updated = db.updateSettings(patch);
    if ('startWithWindows' in patch) {
      app.setLoginItemSettings({ openAtLogin: !!patch.startWithWindows });
    }
    if (overlayWindow) {
      if ('overlayAlwaysOnTop' in patch) overlayWindow.setAlwaysOnTop(!!patch.overlayAlwaysOnTop, 'screen-saver');
      if ('overlayCompact' in patch) {
        resizeOverlayWindow(patch.overlayCompact ? 340 : 320, patch.overlayCompact ? 44 : 220);
        broadcast('overlay:compactChanged', patch.overlayCompact);
      }
      if ('overlayOpacity' in patch) overlayWindow.setOpacity(updated.overlayOpacity);
    }
    return updated;
  });

  handle('targets:getDailyStatus', (_e, date) => db.getDailyTargetStatus(date));
  handle('targets:setDailyOverride', (_e, date, minutes) => db.setDailyTargetOverride(date, minutes));
  handle('targets:getMonthly', (_e, month) => db.getMonthlyTargetMinutes(month));
  handle('targets:setMonthlyOverride', (_e, month, minutes) => db.setMonthlyTargetOverride(month, minutes));

  handle('timer:getState', () => timer.getState());
  handle('timer:start', (_e, projectId) => {
    timer.start(projectId);
    broadcast('timer:update', timer.getState());
  });
  handle('timer:pause', () => {
    timer.pause();
    broadcast('timer:update', timer.getState());
  });
  handle('timer:resume', () => {
    timer.resume();
    broadcast('timer:update', timer.getState());
  });
  handle('timer:switch', (_e, projectId) => {
    timer.switchProject(projectId);
    broadcast('timer:update', timer.getState());
  });
  handle('timer:snoozeBreak', () => timer.resetBreakClock());

  handle('dashboard:getMonthlySummary', (_e, month) => db.getMonthlySummary(month));
  handle('notes:listForMonth', (_e, month) => db.listNotesForMonth(month));

  handle('export:pdf', async (_e, month) => {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export monthly report',
      defaultPath: `Shelltime-${month}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { ok: false, error: 'Export cancelled' };
    try {
      const printWin = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
      loadWindow(printWin, 'index.html', `?print=${month}`);
      await new Promise((resolve) => printWin.webContents.once('did-finish-load', () => resolve(undefined)));
      await new Promise((resolve) => setTimeout(resolve, 300));
      const pdfBuffer = await printWin.webContents.printToPDF({ printBackground: true, pageSize: 'A4', landscape: true });
      const fs = await import('node:fs/promises');
      await fs.writeFile(filePath, pdfBuffer);
      printWin.destroy();
      return { ok: true, filePath };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'PDF export failed' };
    }
  });

  handle('backup:database', async () => {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      title: 'Back up database',
      defaultPath: `shelltime-backup-${todayStr()}.db`,
      filters: [{ name: 'SQLite database', extensions: ['db'] }],
    });
    if (canceled || !filePath) return { ok: false, error: 'Backup cancelled' };
    await db.backupDatabase(filePath);
    return { ok: true, filePath };
  });

  handle('export:xlsx', async (_e, month: string) => {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export timesheet (Excel)',
      defaultPath: `Shelltime-${month}.xlsx`,
      filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }],
    });
    if (canceled || !filePath) return { ok: false, error: 'Export cancelled' };
    const { buildTimesheetWorkbook } = await import('./timesheetXlsx');
    const buffer = await buildTimesheetWorkbook(db.getMonthlySummary(month));
    const fs = await import('node:fs/promises');
    await fs.writeFile(filePath, buffer);
    return { ok: true, filePath };
  });

  handle('export:print', async (_e, month) => {
    const printWin = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
    loadWindow(printWin, 'index.html', `?print=${month}`);
    await new Promise((resolve) => printWin.webContents.once('did-finish-load', () => resolve(undefined)));
    await new Promise((resolve) => setTimeout(resolve, 300));
    printWin.webContents.print({ printBackground: true, landscape: true }, () => printWin.destroy());
  });

  handle('overlay:setCompact', (_e, compact) => {
    db.updateSettings({ overlayCompact: compact });
    resizeOverlayWindow(compact ? 340 : 320, compact ? 44 : 220);
    broadcast('overlay:compactChanged', compact);
  });
  // Temporarily grow/shrink the overlay height (e.g. to show the compact-mode switch dropdown) without changing compact state.
  handle('overlay:setHeight', (_e, height: number) => {
    if (!overlayWindow) return;
    const [w] = overlayWindow.getSize();
    resizeOverlayWindow(w, Math.round(height));
  });
  handle('overlay:openMainWindow', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  handle('overlay:show', () => {
    if (!overlayWindow) return;
    overlayWindow.show();
    const settings = db.getSettings();
    resizeOverlayWindow(settings.overlayCompact ? 340 : 320, settings.overlayCompact ? 44 : 220);
    overlayWindow.setOpacity(settings.overlayOpacity);
  });
  handle('overlay:hide', () => overlayWindow?.hide());

  handle('app:getDataPath', () => app.getPath('userData'));
  handle('app:openDataFolder', () => shell.openPath(app.getPath('userData')));
}

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData');
  db.initDb(userDataDir);

  const settings = db.getSettings();
  app.setLoginItemSettings({ openAtLogin: settings.startWithWindows });

  timer = new TimerEngine({
    onUpdate: (state) => broadcast('timer:update', state),
    onBreakPrompt: (minutesWorked) => broadcast('break:prompt', minutesWorked),
  });

  registerIpc();
  createMainWindow();
  createOverlayWindow();
  const rebuildTrayMenu = createTray();
  setInterval(rebuildTrayMenu, 5000);
  startIdleMonitor();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else mainWindow?.show();
  });
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  // Persist any in-flight timer seconds so quitting mid-session doesn't lose them.
  timer?.flushActive();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
