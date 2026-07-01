import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import * as db from './db';
import { TimerEngine } from './timer';

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

function registerIpc() {
  ipcMain.handle('projects:list', (_e, includeInactive: boolean) => db.listProjects(includeInactive));
  ipcMain.handle('projects:create', (_e, input) => {
    const project = db.createProject(input);
    broadcast('projects:changed');
    return project;
  });
  ipcMain.handle('projects:update', (_e, id, patch) => {
    const project = db.updateProject(id, patch);
    broadcast('projects:changed');
    return project;
  });
  ipcMain.handle('projects:setActive', (_e, id, isActive) => {
    const project = db.setProjectActive(id, isActive);
    broadcast('projects:changed');
    return project;
  });
  ipcMain.handle('projects:delete', (_e, id) => {
    db.deleteProject(id);
    broadcast('projects:changed');
    if (timer.getState().activeProjectId === id) {
      timer.stopIfActiveProjectMissing();
      broadcast('timer:update', timer.getState());
    }
  });

  ipcMain.handle('entries:getDaily', (_e, date) => db.getDailyEntries(date));
  ipcMain.handle('entries:getDailyTotal', (_e, date) => db.getDailyTotalMinutes(date));
  ipcMain.handle('entries:set', (_e, date, projectId, durationMinutes, source) => {
    const entry = db.setDailyEntry(date, projectId, durationMinutes, source);
    if (date === todayStr()) {
      timer.resyncProjectTotal(projectId);
      broadcast('timer:update', timer.getState());
    }
    return entry;
  });
  ipcMain.handle('entries:delete', (_e, date, projectId) => {
    db.deleteDailyEntry(date, projectId);
    if (date === todayStr()) {
      timer.resyncProjectTotal(projectId);
      broadcast('timer:update', timer.getState());
    }
  });
  ipcMain.handle('entries:applyDelta', (_e, date, projectIds, deltaMinutes) => {
    // Persist any in-flight timer seconds first so this relative delta lands on an up-to-date base.
    if (date === todayStr()) timer.flushActive();
    db.applyTimeDelta(date, projectIds, deltaMinutes);
    if (date === todayStr()) {
      for (const projectId of projectIds as number[]) timer.resyncProjectTotal(projectId);
      broadcast('timer:update', timer.getState());
    }
  });

  ipcMain.handle('notes:list', (_e, date, projectId) => db.listNotes(date, projectId));
  ipcMain.handle('notes:add', (_e, date, projectId, text) => db.addNote(date, projectId, text));
  ipcMain.handle('notes:update', (_e, id, text) => db.updateNote(id, text));
  ipcMain.handle('notes:delete', (_e, id) => db.deleteNote(id));

  ipcMain.handle('settings:get', () => db.getSettings());
  ipcMain.handle('settings:update', (_e, patch) => {
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

  ipcMain.handle('targets:getDailyStatus', (_e, date) => db.getDailyTargetStatus(date));
  ipcMain.handle('targets:setDailyOverride', (_e, date, minutes) => db.setDailyTargetOverride(date, minutes));
  ipcMain.handle('targets:getMonthly', (_e, month) => db.getMonthlyTargetMinutes(month));
  ipcMain.handle('targets:setMonthlyOverride', (_e, month, minutes) => db.setMonthlyTargetOverride(month, minutes));

  ipcMain.handle('timer:getState', () => timer.getState());
  ipcMain.handle('timer:start', (_e, projectId) => {
    timer.start(projectId);
    broadcast('timer:update', timer.getState());
  });
  ipcMain.handle('timer:pause', () => {
    timer.pause();
    broadcast('timer:update', timer.getState());
  });
  ipcMain.handle('timer:resume', () => {
    timer.resume();
    broadcast('timer:update', timer.getState());
  });
  ipcMain.handle('timer:switch', (_e, projectId) => {
    timer.switchProject(projectId);
    broadcast('timer:update', timer.getState());
  });
  ipcMain.handle('timer:snoozeBreak', () => timer.resetBreakClock());

  ipcMain.handle('dashboard:getMonthlySummary', (_e, month) => db.getMonthlySummary(month));
  ipcMain.handle('notes:listForMonth', (_e, month) => db.listNotesForMonth(month));

  ipcMain.handle('export:pdf', async (_e, month) => {
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

  ipcMain.handle('export:print', async (_e, month) => {
    const printWin = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
    loadWindow(printWin, 'index.html', `?print=${month}`);
    await new Promise((resolve) => printWin.webContents.once('did-finish-load', () => resolve(undefined)));
    await new Promise((resolve) => setTimeout(resolve, 300));
    printWin.webContents.print({ printBackground: true, landscape: true }, () => printWin.destroy());
  });

  ipcMain.handle('overlay:setCompact', (_e, compact) => {
    db.updateSettings({ overlayCompact: compact });
    resizeOverlayWindow(compact ? 340 : 320, compact ? 44 : 220);
    broadcast('overlay:compactChanged', compact);
  });
  // Temporarily grow/shrink the overlay height (e.g. to show the compact-mode switch dropdown) without changing compact state.
  ipcMain.handle('overlay:setHeight', (_e, height: number) => {
    if (!overlayWindow) return;
    const [w] = overlayWindow.getSize();
    resizeOverlayWindow(w, Math.round(height));
  });
  ipcMain.handle('overlay:openMainWindow', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  ipcMain.handle('overlay:show', () => {
    if (!overlayWindow) return;
    overlayWindow.show();
    const settings = db.getSettings();
    resizeOverlayWindow(settings.overlayCompact ? 340 : 320, settings.overlayCompact ? 44 : 220);
    overlayWindow.setOpacity(settings.overlayOpacity);
  });
  ipcMain.handle('overlay:hide', () => overlayWindow?.hide());

  ipcMain.handle('app:getDataPath', () => app.getPath('userData'));
  ipcMain.handle('app:openDataFolder', () => shell.openPath(app.getPath('userData')));
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else mainWindow?.show();
  });
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
