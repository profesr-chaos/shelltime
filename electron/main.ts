import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, screen, powerMonitor } from 'electron';
import path from 'node:path';
import * as db from './db';
import { TimerEngine } from './timer';
import { AttentionMonitor } from './attentionMonitor';
import { listCountries, listStates } from './holidays';
import { logicalDayStr } from '../shared/logicalDay';

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
let attention: AttentionMonitor;
let overlaySaveTimeout: ReturnType<typeof setTimeout> | null = null;

function todayStr(): string {
  return logicalDayStr();
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
          click: () => {
            if (state.status === 'running') {
              timer.pause();
              attention.notifyManualPause();
            } else {
              timer.resume();
              attention.notifyManualResume();
            }
            broadcast('timer:update', timer.getState());
          },
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

// Filename-safe export prefix from settings, falling back to the app name.
function exportPrefix(): string {
  const raw = db.getSettings().exportPrefix?.trim() || 'Shelltime';
  return raw.replace(/[\\/:*?"<>|]/g, '').trim() || 'Shelltime';
}

function showOverlayForPrompt() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.show();
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
      attention.notifyStop();
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

  handle('holidays:countries', () => listCountries());
  handle('holidays:states', (_e, country: string) => listStates(country));

  handle('leave:summary', (_e, month: string) => db.getLeaveSummary(month));
  handle('leave:list', () => db.listLeave());
  handle('leave:add', (_e, type, start: string, end: string, half: boolean) => {
    const record = db.addLeave(type, start, end, half);
    broadcast('projects:changed'); // the leave project may have just been created
    if (todayStr() >= record.startDate && todayStr() <= record.endDate) broadcast('timer:update', timer.getState());
    return record;
  });
  handle('leave:delete', (_e, id: number) => {
    db.deleteLeave(id);
    broadcast('projects:changed');
    broadcast('timer:update', timer.getState());
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
    broadcast('settings:changed', updated);
    return updated;
  });

  handle('targets:getDailyStatus', (_e, date) => db.getDailyTargetStatus(date));
  handle('targets:setDailyOverride', (_e, date, minutes) => db.setDailyTargetOverride(date, minutes));
  handle('targets:getMonthly', (_e, month) => db.getMonthlyTargetMinutes(month));
  handle('targets:setMonthlyOverride', (_e, month, minutes) => db.setMonthlyTargetOverride(month, minutes));

  handle('day:getFirstStart', (_e, date) => db.getDayFirstStartedAt(date));

  handle('timer:getState', () => timer.getState());
  handle('timer:start', (_e, projectId) => {
    timer.start(projectId);
    attention.notifyManualStart();
    broadcast('timer:update', timer.getState());
  });
  handle('timer:pause', () => {
    timer.pause();
    attention.notifyManualPause();
    broadcast('timer:update', timer.getState());
  });
  handle('timer:resume', () => {
    timer.resume();
    attention.notifyManualResume();
    broadcast('timer:update', timer.getState());
  });
  handle('timer:stop', () => {
    timer.stop();
    attention.notifyStop();
    broadcast('timer:update', timer.getState());
  });
  handle('timer:switch', (_e, projectId) => {
    const wasIdle = timer.getState().status === 'idle';
    timer.switchProject(projectId);
    attention.notifySwitch(wasIdle);
    broadcast('timer:update', timer.getState());
  });
  handle('timer:snoozeBreak', (_e, remindInMinutes?: number) => {
    attention.snoozeBreak(remindInMinutes);
  });
  handle('timer:resolveIdle', (_e, discard: boolean) => {
    attention.resolveIdle(discard);
  });
  handle('timer:resolveResume', (_e, discard: boolean) => {
    attention.resolveResume(discard);
  });

  handle('dashboard:getMonthlySummary', (_e, month) => db.getMonthlySummary(month));
  handle('notes:listForMonth', (_e, month) => db.listNotesForMonth(month));
  handle('projects:history', (_e, projectId) => db.getProjectHistory(projectId));

  handle('export:pdf', async (_e, month) => {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export monthly report',
      defaultPath: `${exportPrefix()}_${month}.pdf`,
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
      defaultPath: `${exportPrefix()}_${month}.xlsx`,
      filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }],
    });
    if (canceled || !filePath) return { ok: false, error: 'Export cancelled' };
    const { buildTimesheetWorkbook } = await import('./timesheetXlsx');
    const buffer = await buildTimesheetWorkbook(db.getMonthlySummary(month), db.getSettings().userName?.trim() || 'Shelltime');
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
  // Custom drag: the renderer distinguishes click vs drag, then repositions the frameless window here.
  handle('overlay:setPosition', (_e, x: number, y: number) => {
    if (!overlayWindow) return;
    overlayWindow.setPosition(Math.round(x), Math.round(y));
    if (overlaySaveTimeout) clearTimeout(overlaySaveTimeout);
    overlaySaveTimeout = setTimeout(() => db.updateSettings({ overlayPosition: { x: Math.round(x), y: Math.round(y) } }), 400);
  });
  handle('overlay:openMainWindow', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  handle('overlay:show', () => {
    if (!overlayWindow) return;
    const alreadyVisible = overlayWindow.isVisible();
    overlayWindow.show();
    const settings = db.getSettings();
    const w = settings.overlayCompact ? 340 : 320;
    const h = settings.overlayCompact ? 44 : 220;
    resizeOverlayWindow(w, h);
    overlayWindow.setOpacity(settings.overlayOpacity);
    // Clicking "Pop out" when it's already showing means "I lost it" — recenter on the cursor's screen.
    if (alreadyVisible) {
      const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const x = Math.round(workArea.x + (workArea.width - w) / 2);
      const y = Math.round(workArea.y + (workArea.height - h) / 2);
      overlayWindow.setPosition(x, y);
      overlayWindow.focus();
      db.updateSettings({ overlayPosition: { x, y } });
    }
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
  });

  attention = new AttentionMonitor(
    timer,
    {
      onIdlePrompt: (payload) => {
        showOverlayForPrompt();
        broadcast('idle:prompt', payload);
      },
      onIdleResolved: () => broadcast('idle:resolved'),
      onResumePrompt: (payload) => {
        showOverlayForPrompt();
        broadcast('resume:prompt', payload);
      },
      onResumeResolved: () => broadcast('resume:resolved'),
      onBreakPrompt: (minutesWorked) => broadcast('break:prompt', minutesWorked),
      onBreakDismissed: () => broadcast('break:dismissed'),
      onStateChange: () => broadcast('timer:update', timer.getState()),
    },
    { getSettings: () => db.getSettings(), powerMonitor }
  );

  registerIpc();
  createMainWindow();
  createOverlayWindow();
  const rebuildTrayMenu = createTray();
  setInterval(rebuildTrayMenu, 5000);

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
