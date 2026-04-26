const { app, BrowserWindow, ipcMain, shell, screen, dialog, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

const AppDatabase = require('./src/database.js');
const SQLiteDatabase = require('better-sqlite3');

let db;
let mainWindow;
let tray = null;
let isQuitting = false;
let isWidgetMode   = false;
let widgetInterval = null;
let savedBounds    = null;
let isClosingAfterCloudSync = false;
let activeDbUserId = '';
let updateState = {
  status: 'idle',
  version: app.getVersion(),
  message: '',
  progress: 0,
  info: null,
};

function setUpdateState(next) {
  updateState = Object.assign({}, updateState, next || {});
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', updateState);
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    setUpdateState({
      status: 'dev',
      message: '개발 실행에서는 자동 업데이트를 확인하지 않습니다.',
      progress: 0,
    });
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    setUpdateState({
      status: 'checking',
      message: '업데이트를 확인하는 중입니다.',
      progress: 0,
    });
  });

  autoUpdater.on('update-available', (info) => {
    setUpdateState({
      status: 'available',
      message: `새 버전 ${info?.version || ''} 이(가) 있습니다.`,
      progress: 0,
      info,
    });
  });

  autoUpdater.on('update-not-available', () => {
    setUpdateState({
      status: 'idle',
      message: '현재 최신 버전입니다.',
      progress: 0,
      info: null,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdateState({
      status: 'downloading',
      message: `업데이트 다운로드 중... ${Math.round(progress?.percent || 0)}%`,
      progress: progress?.percent || 0,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateState({
      status: 'downloaded',
      message: `새 버전 ${info?.version || ''} 다운로드가 완료되었습니다. 재시작 후 설치할 수 있습니다.`,
      progress: 100,
      info,
    });
  });

  autoUpdater.on('error', (error) => {
    setUpdateState({
      status: 'error',
      message: error?.message || '업데이트 확인 중 문제가 발생했습니다.',
      progress: 0,
    });
  });
}

function openDatabaseForUser(userId = '', options = {}) {
  const nextUserId = String(userId || '');
  if (db && activeDbUserId === nextUserId) return db;

  const nextPath = AppDatabase.getPathForUser(nextUserId);
  const legacyPath = AppDatabase.getDefaultPath();
  const migrationMarkerPath = path.join(path.dirname(nextPath), '.legacy_migrated');
  if (options.migrateLegacy === true && nextUserId && !fs.existsSync(nextPath) && fs.existsSync(legacyPath) && !fs.existsSync(migrationMarkerPath)) {
    fs.mkdirSync(path.dirname(nextPath), { recursive: true });
    fs.copyFileSync(legacyPath, nextPath);
    removeSqliteSidecars(nextPath);
    fs.writeFileSync(migrationMarkerPath, `${nextUserId}\n${new Date().toISOString()}`, 'utf8');
  }

  if (db) {
    try { db.close(); } catch (_) {}
  }
  db = new AppDatabase({ userId: nextUserId });
  activeDbUserId = nextUserId;
  return db;
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  mainWindow.setSkipTaskbar(false);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return tray;

  try {
    const iconPath = fs.existsSync(path.join(__dirname, 'assets/icon.ico'))
      ? path.join(__dirname, 'assets/icon.ico')
      : path.join(__dirname, 'assets/app-icon.png');
    tray = new Tray(iconPath);
    tray.setToolTip('교사 업무 관리');
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: '열기',
        click: () => showMainWindow(),
      },
      {
        label: '완전 종료',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]));
    tray.on('click', () => showMainWindow());
    tray.on('double-click', () => showMainWindow());
  } catch (error) {
    console.error('tray creation failed', error);
    tray = null;
  }
  return tray;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 800,
    minWidth: 1100,
    minHeight: 680,
    frame: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

  mainWindow.on('close', async (event) => {
    if (isQuitting || !mainWindow || mainWindow.isDestroyed()) return;
    if (isClosingAfterCloudSync) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    isClosingAfterCloudSync = true;
    let syncResult = { ok: true };

    try {
      syncResult = await Promise.race([
        mainWindow.webContents.executeJavaScript(
          'window.appSyncBeforeClose ? window.appSyncBeforeClose() : Promise.resolve({ ok: true, skipped: true })',
          true
        ),
        new Promise((resolve) => setTimeout(() => resolve({
          ok: false,
          reason: 'timeout',
          message: '클라우드 저장 시간이 오래 걸리고 있습니다.',
        }), 5000)),
      ]);
    } catch (error) {
      console.error('cloud sync before close failed', error);
      syncResult = {
        ok: false,
        reason: 'sync-failed',
        message: error?.message || '클라우드 저장에 실패했습니다.',
      };
    }

    if (!syncResult || syncResult.ok === false) {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['로컬에 저장하고 종료', '종료 취소'],
        defaultId: 0,
        cancelId: 1,
        title: '클라우드 저장 실패',
        message: '인터넷에 연결되어 있지 않거나 클라우드 저장이 완료되지 않았습니다.',
        detail: '변경사항은 이 컴퓨터의 로컬 저장소에는 저장되어 있습니다.\n\n다른 컴퓨터와 동기화하려면 나중에 인터넷이 연결된 상태에서 앱을 다시 실행해 주세요.',
      });

      if (result.response === 1) {
        isClosingAfterCloudSync = false;
        return;
      }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
      mainWindow.setSkipTaskbar(true);
    }
    isClosingAfterCloudSync = false;
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((error) => {
          setUpdateState({
            status: 'error',
            message: error?.message || '업데이트 확인에 실패했습니다.',
          });
        });
      }, 1500);
    }
  });

  // 위젯 모드 중 최소화되면 즉시 복원
  mainWindow.on('minimize', () => {
    if (isWidgetMode && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) mainWindow.restore();
      }, 50);
    }
  });
}

app.whenReady().then(() => {
  openDatabaseForUser('');
  setupAutoUpdater();
  createTray();
  createWindow();
  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin' && !isQuitting) return;
  if (isQuitting) app.quit();
});

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());
ipcMain.on('window-always-on-top', (e, flag) => mainWindow.setAlwaysOnTop(flag));
ipcMain.on('window-set-opacity', (e, val) => mainWindow.setOpacity(Math.max(0.1, Math.min(1, Number(val)))));
ipcMain.handle('window-get-opacity', () => mainWindow.getOpacity());
ipcMain.handle('get-update-status', () => updateState);
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    setUpdateState({
      status: 'dev',
      message: '개발 실행에서는 자동 업데이트를 확인하지 않습니다.',
      progress: 0,
    });
    return updateState;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    setUpdateState({
      status: 'error',
      message: error?.message || '업데이트 확인에 실패했습니다.',
      progress: 0,
    });
  }
  return updateState;
});
ipcMain.handle('download-update', async () => {
  if (!app.isPackaged) return updateState;
  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    setUpdateState({
      status: 'error',
      message: error?.message || '업데이트 다운로드에 실패했습니다.',
      progress: 0,
    });
  }
  return updateState;
});
ipcMain.handle('quit-and-install-update', () => {
  if (!app.isPackaged) return false;
  setImmediate(() => {
    isQuitting = true;
    autoUpdater.quitAndInstall(false, true);
  });
  return true;
});
ipcMain.handle('get-app-meta', () => {
  try {
    const asarPath = path.join(process.resourcesPath, 'app.asar');
    let patchedAt = '';
    if (fs.existsSync(asarPath)) {
      patchedAt = fs.statSync(asarPath).mtime.toISOString();
    }
    return {
      version: app.getVersion(),
      patchedAt,
      packaged: app.isPackaged,
    };
  } catch (err) {
    return {
      version: app.getVersion(),
      patchedAt: '',
      packaged: app.isPackaged,
      error: err.message,
    };
  }
});

ipcMain.on('window-widget-mode', (e, active) => {
  isWidgetMode = active;
  if (active) {
    // 현재 크기 저장
    savedBounds = mainWindow.getBounds();
    // 주 화면 전체 크기로 확장
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow.setBounds({ x: 0, y: 0, width, height });
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setSkipTaskbar(true);
    // 클릭을 투명 영역만 통과시킴 (카드 영역은 렌더러에서 관리)
    mainWindow.setIgnoreMouseEvents(false);
  } else {
    if (widgetInterval) { clearInterval(widgetInterval); widgetInterval = null; }
    mainWindow.setSkipTaskbar(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setIgnoreMouseEvents(false);
    // 저장된 크기로 복원
    if (savedBounds) {
      mainWindow.setBounds(savedBounds);
      savedBounds = null;
    }
    mainWindow.focus();
  }
});

ipcMain.handle('switch-user-database', (e, uid, options = {}) => {
  const safeUid = String(uid || '').trim();
  openDatabaseForUser(safeUid, options || {});
  return {
    success: true,
    userId: activeDbUserId,
    dbPath: db.getPath(),
  };
});

ipcMain.handle('get-setting', (e, key, def) => db.getSetting(key, def));
ipcMain.handle('set-setting', (e, key, val) => db.setSetting(key, val));
ipcMain.handle('get-all-settings', () => db.getAllSettings());
ipcMain.handle('export-backup', async () => {
  try {
    const defaultName = `teacher_app_backup_${formatFileTimestamp(new Date())}.db`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '백업 파일 저장',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
    });
    if (result.canceled || !result.filePath) {
      return { cancelled: true };
    }

    await db.backupTo(result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { error: err.message };
  }
});
ipcMain.handle('import-backup', async () => {
  let rollbackPath = '';
  let dbPath = '';
  try {
    const openResult = await dialog.showOpenDialog(mainWindow, {
      title: '복원할 백업 파일 선택',
      properties: ['openFile'],
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
    });
    if (openResult.canceled || !openResult.filePaths.length) {
      return { cancelled: true };
    }

    const backupPath = openResult.filePaths[0];
    const confirm = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['복원', '취소'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: '백업 복원 확인',
      message: '현재 데이터를 선택한 백업 파일로 덮어씁니다.',
      detail: '복원 후 앱 화면이 자동으로 새로고침됩니다.',
    });
    if (confirm.response !== 0) {
      return { cancelled: true };
    }

    validateBackupFile(backupPath);
    dbPath = db.getPath();
    rollbackPath = path.join(app.getPath('temp'), `teacher_app_restore_${formatFileTimestamp(new Date())}.db`);
    await db.backupTo(rollbackPath);
    db.close();
    removeSqliteSidecars(dbPath);
    fs.copyFileSync(backupPath, dbPath);
    openDatabaseForUser(activeDbUserId);
    if (fs.existsSync(rollbackPath)) fs.rmSync(rollbackPath, { force: true });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }
    return { success: true, filePath: backupPath };
  } catch (err) {
    try {
      if (rollbackPath && dbPath && fs.existsSync(rollbackPath)) {
        removeSqliteSidecars(dbPath);
        fs.copyFileSync(rollbackPath, dbPath);
        removeSqliteSidecars(dbPath);
      }
      openDatabaseForUser(activeDbUserId);
    } catch (_) {}
    if (rollbackPath && fs.existsSync(rollbackPath)) {
      try { fs.rmSync(rollbackPath, { force: true }); } catch (_) {}
    }
    return { error: err.message };
  }
});

ipcMain.handle('get-students', () => db.getStudents());
ipcMain.handle('add-student', (e, data) => db.addStudent(data));
ipcMain.handle('update-student', (e, id, data) => db.updateStudent(id, data));
ipcMain.handle('delete-student', (e, id) => db.deleteStudent(id));
ipcMain.handle('import-students-csv', (e, rows) => db.importStudentsCSV(rows));

ipcMain.handle('get-attendance', (e, date) => db.getAttendance(date));
ipcMain.handle('get-attendance-range', (e, start, end) => db.getAttendanceRange(start, end));
ipcMain.handle('set-attendance', (e, data) => db.setAttendance(data));
ipcMain.handle('get-attendance-stats', (e, year, month) => db.getAttendanceStats(year, month));

ipcMain.handle('get-counseling', (e, filter) => db.getCounseling(filter));
ipcMain.handle('add-counseling', (e, data) => db.addCounseling(data));
ipcMain.handle('update-counseling', (e, id, data) => db.updateCounseling(id, data));
ipcMain.handle('delete-counseling', (e, id) => db.deleteCounseling(id));

ipcMain.handle('get-observations', (e, filter) => db.getObservations(filter));
ipcMain.handle('add-observation', (e, data) => db.addObservation(data));
ipcMain.handle('update-observation', (e, id, data) => db.updateObservation(id, data));
ipcMain.handle('delete-observation', (e, id) => db.deleteObservation(id));

ipcMain.handle('get-lessons', (e, filter) => db.getLessons(filter));
ipcMain.handle('add-lesson', (e, data) => db.addLesson(data));
ipcMain.handle('update-lesson', (e, id, data) => db.updateLesson(id, data));
ipcMain.handle('delete-lesson', (e, id) => db.deleteLesson(id));

ipcMain.handle('get-assessments', () => db.getAssessments());
ipcMain.handle('add-assessment', (e, data) => db.addAssessment(data));
ipcMain.handle('update-assessment', (e, id, data) => db.updateAssessment(id, data));
ipcMain.handle('delete-assessment', (e, id) => db.deleteAssessment(id));
ipcMain.handle('get-assessment-scores', (e, assessId) => db.getAssessmentScores(assessId));
ipcMain.handle('set-assessment-score', (e, data) => db.setAssessmentScore(data));

ipcMain.handle('get-submissions', (e, filter) => db.getSubmissions(filter));
ipcMain.handle('add-submission', (e, data) => db.addSubmission(data));
ipcMain.handle('update-submission', (e, id, data) => db.updateSubmission(id, data));
ipcMain.handle('delete-submission', (e, id) => db.deleteSubmission(id));
ipcMain.handle('get-submission-status', (e, submId) => db.getSubmissionStatus(submId));
ipcMain.handle('set-submission-status', (e, data) => db.setSubmissionStatus(data));

ipcMain.handle('get-todos', (e, includeDone) => db.getTodos(includeDone));
ipcMain.handle('add-todo', (e, data) => db.addTodo(data));
ipcMain.handle('update-todo', (e, id, data) => db.updateTodo(id, data));
ipcMain.handle('toggle-todo', (e, id) => db.toggleTodo(id));
ipcMain.handle('delete-todo', (e, id) => db.deleteTodo(id));
ipcMain.handle('replace-todos', (e, items) => db.replaceTodos(items));
ipcMain.handle('set-todo-gcal-id', (e, id, gcalId) => db.setTodoGcalId(id, gcalId));
ipcMain.handle('get-todo-gcal-id', (e, id) => db.getTodoGcalId(id));

// ── Google Calendar OAuth ─────────────────────────────────
ipcMain.handle('gcal-oauth-start', async (e, clientId, clientSecret) => {
  const http = require('http');
  const https = require('https');
  const { URL } = require('url');
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}`;
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar.events')}&` +
        `access_type=offline&prompt=consent`;
      shell.openExternal(authUrl);
      const timer = setTimeout(() => { server.close(); resolve({ error: '시간 초과' }); }, 120000);
      server.on('request', async (req, res) => {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        const code = url.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>✅ 연동 완료! 이 창을 닫으세요.</h2></body></html>');
        clearTimeout(timer); server.close();
        if (!code) return resolve({ error: '취소되었습니다.' });
        const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString();
        const tokenRes = await new Promise((r2) => {
          const req2 = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, rejectUnauthorized: false }, (res2) => {
            let d = ''; res2.on('data', c => d += c); res2.on('end', () => { try { r2(JSON.parse(d)); } catch { r2({}); } });
          }); req2.on('error', () => r2({})); req2.write(body); req2.end();
        });
        if (tokenRes.refresh_token) resolve({ refresh_token: tokenRes.refresh_token });
        else resolve({ error: tokenRes.error_description || '토큰 교환 실패' });
      });
    });
  });
});

ipcMain.handle('gcal-refresh-token', async (e, clientId, clientSecret, refreshToken) => {
  const https = require('https');
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString();
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, rejectUnauthorized: false }, (r) => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ error: '파싱 오류' }); } });
    }); req.on('error', err => resolve({ error: err.message })); req.write(body); req.end();
  });
});

ipcMain.handle('gcal-add-event', async (e, accessToken, event) => {
  const https = require('https');
  const body = JSON.stringify(event);
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'www.googleapis.com', path: '/calendar/v3/calendars/primary/events', method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, rejectUnauthorized: false }, (r) => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ error: '파싱 오류' }); } });
    }); req.on('error', err => resolve({ error: err.message })); req.write(body); req.end();
  });
});

ipcMain.handle('gcal-delete-event', async (e, accessToken, eventId) => {
  const https = require('https');
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'www.googleapis.com', path: `/calendar/v3/calendars/primary/events/${eventId}`, method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` }, rejectUnauthorized: false }, (r) => { resolve({ status: r.statusCode }); });
    req.on('error', err => resolve({ error: err.message })); req.end();
  });
});

ipcMain.handle('get-ddays', () => db.getDdays());
ipcMain.handle('add-dday', (e, data) => db.addDday(data));
ipcMain.handle('delete-dday', (e, id) => db.deleteDday(id));

ipcMain.handle('get-timetable', () => db.getTimetable());
ipcMain.handle('set-timetable-cell', (e, data) => db.setTimetableCell(data));
ipcMain.handle('clear-timetable', () => db.clearTimetable());
ipcMain.handle('replace-timetable', (e, items) => db.replaceTimetable(items));

ipcMain.handle('get-daily-memo', (e, date) => db.getDailyMemo(date));
ipcMain.handle('set-daily-memo', (e, date, content) => db.setDailyMemo(date, content));
ipcMain.handle('get-daily-memos', (e, year, month) => db.getDailyMemos(year, month));

ipcMain.handle('open-url', (e, url) => shell.openExternal(url));
ipcMain.handle('open-path', (e, targetPath) => shell.openPath(targetPath));

ipcMain.handle('apply-app-patch', async () => {
  try {
    if (!app.isPackaged) {
      return { error: '설치된 프로그램에서만 패치 적용을 사용할 수 있습니다.' };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: '패치용 app.asar 선택',
      properties: ['openFile'],
      filters: [{ name: 'Patch Asar', extensions: ['asar'] }],
    });
    if (result.canceled || !result.filePaths.length) {
      return { cancelled: true };
    }

    const sourceAsar = result.filePaths[0];
    const targetAsar = path.join(process.resourcesPath, 'app.asar');
    const exePath = process.execPath;
    const cmdPath = path.join(app.getPath('userData'), 'apply_in_app_patch.cmd');
    const scriptPath = path.join(app.getPath('userData'), 'apply_in_app_patch.ps1');
    const logPath = path.join(app.getPath('userData'), 'apply_in_app_patch.log');
    const currentPid = process.pid;
    const cmdScript = `@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_in_app_patch.ps1" "%~1" "%~2" "%~3" "%~4" "%~5"
`;
    const script = `
$ErrorActionPreference = 'Stop'
$source = $args[0]
$target = $args[1]
$exe = $args[2]
$log = $args[3]
$pidToWait = [int]$args[4]

function Write-Log($message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message"
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}

Write-Log "patch script started"
for ($i = 0; $i -lt 120; $i++) {
  if (-not (Get-Process -Id $pidToWait -ErrorAction SilentlyContinue)) {
    break
  }
  Start-Sleep -Milliseconds 500
}

Write-Log "target process closed"
for ($i = 0; $i -lt 60; $i++) {
  try {
    Copy-Item -LiteralPath $source -Destination $target -Force
    Write-Log "app.asar copied"
    Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe)
    Write-Log "app restarted"
    exit 0
  } catch {
    Write-Log "retry $i failed: $($_.Exception.Message)"
    Start-Sleep -Milliseconds 500
  }
}

Write-Log "patch failed after retries"
exit 1
`;
    fs.writeFileSync(cmdPath, cmdScript, 'ascii');
    fs.writeFileSync(scriptPath, '\ufeff' + script.trimStart(), 'utf8');
    fs.writeFileSync(logPath, '', 'utf8');
    const child = spawn('cmd.exe', [
      '/c',
      cmdPath,
      sourceAsar,
      targetAsar,
      exePath,
      logPath,
      String(currentPid),
    ], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    setTimeout(() => app.quit(), 300);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('neis-get-meal', async (e, eduCode, schoolCode, date) => {
  try {
    const api = require('./src/neis-api.js');
    return await api.getMeal(eduCode, schoolCode, date);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('neis-get-calendar', async (e, eduCode, schoolCode, yearMonth) => {
  try {
    const api = require('./src/neis-api.js');
    return await api.getCalendar(eduCode, schoolCode, yearMonth);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('neis-search-schools', async (e, keyword) => {
  try {
    const api = require('./src/neis-api.js');
    return await api.searchSchools(keyword);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('neis-get-weather', async (e, region) => {
  try {
    const api = require('./src/neis-api.js');
    return await api.getWeather(region);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('ai-extract-todos', async (e, apiKey, model, provider, text) => {
  try {
    if (provider === 'gemini') {
      return await runGemini(apiKey, model, text, {
        system: "교사의 카카오톡, 문자, 공문에서 할일만 추출하세요. 한 줄에 하나씩 '- [ ] 할일내용 (기한: YYYY-MM-DD)' 형식으로 출력하세요. 기한이 없으면 날짜를 생략하고 설명은 쓰지 마세요.",
        userPrompt: `다음 텍스트에서 할일을 추출해 주세요:\n\n${text}`,
      });
    }
    return await runClaude(apiKey, model, text, {
      system: "교사의 카카오톡, 문자, 공문에서 할일만 추출하세요. 한 줄에 하나씩 '- [ ] 할일내용 (기한: YYYY-MM-DD)' 형식으로 출력하세요. 기한이 없으면 날짜를 생략하고 설명은 쓰지 마세요.",
      userPrompt: `다음 텍스트에서 할일을 추출해 주세요:\n\n${text}`,
    });
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('ai-extract-timetable', async (e, apiKey, model, provider, text) => {
  try {
    const options = {
      system: '교사의 시간표 메모를 읽고 JSON 배열만 출력하세요. 각 원소는 {"day_of_week":0-4,"period":1-7,"subject":"과목명","is_my_class":true|false} 형식입니다. 월=0, 화=1, 수=2, 목=3, 금=4 입니다. 빈칸은 출력하지 마세요. 설명, 코드블록, 마크다운 없이 JSON만 출력하세요.',
      userPrompt: `다음 메모에서 시간표를 구조화해 주세요:\n\n${text}`,
    };
    if (provider === 'gemini') {
      return await runGemini(apiKey, model, text, options);
    }
    return await runClaude(apiKey, model, text, options);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('ai-extract-timetable-image', async (e, apiKey, model, provider, image) => {
  try {
    if (!image || !image.data || !image.mimeType) {
      return { error: '이미지 정보가 올바르지 않습니다.' };
    }
    const options = {
      system: '시간표 사진을 보고 JSON 배열만 출력하세요. 각 요소는 {"day_of_week":0-4,"period":1-7,"subject":"과목명","is_my_class":true|false} 형식입니다. 월0, 화1, 수2, 목3, 금4 입니다. 빈칸은 출력하지 말고, 설명이나 코드블록 없이 JSON만 출력하세요. 본인 수업 여부가 확실하지 않으면 false로 두세요.',
      userPrompt: '첨부된 시간표 이미지를 읽고 주간 시간표를 JSON 배열로 구조화하세요.',
      image,
    };
    if (provider === 'gemini') {
      return await runGemini(apiKey, model, '', options);
    }
    return await runClaude(apiKey, model, '', options);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('import-class-timetable-excel', async (e, payload) => {
  try {
    const buffer = Buffer.from(String(payload?.data || ''), 'base64');
    const entries = await parseClassTimetableExcel(buffer);
    db.setSetting('class_timetable_json', JSON.stringify(entries));
    if (payload?.name) {
      db.setSetting('class_timetable_file_name', payload.name);
    }
    return { success: true, count: entries.length };
  } catch (err) {
    return { error: err.message };
  }
});

async function runClaude(apiKey, model, text, options = {}) {
  const https = require('https');
  const content = [];
  if (options.userPrompt || text) {
    content.push({ type: 'text', text: options.userPrompt || text });
  }
  if (options.image?.data && options.image?.mimeType) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: options.image.mimeType,
        data: options.image.data,
      },
    });
  }
  const body = JSON.stringify({
    model,
    max_tokens: 1024,
    system: options.system || '',
    messages: [{ role: 'user', content }],
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ result: json.content?.[0]?.text || '' });
        } catch (err) {
          resolve({ error: err.message });
        }
      });
    });

    req.on('error', (err) => resolve({ error: err.message }));
    req.write(body);
    req.end();
  });
}

async function runGemini(apiKey, model, text, options = {}) {
  const https = require('https');
  const parts = [];

  // 이미지가 있으면 먼저(Gemini는 이미지→텍스트 순서 권장)
  if (options.image?.data && options.image?.mimeType) {
    parts.push({ inline_data: { mime_type: options.image.mimeType, data: options.image.data } });
  }
  if (options.userPrompt || text) {
    parts.push({ text: options.userPrompt || text });
  }

  // 이미지 포함 시: 현재 사용 가능한 비전 모델로 자동 교체
  // gemini-2.5-pro 등 유료 전용 모델은 무료 비전 모델로 대체
  let useModel = model;
  if (options.image?.data) {
    const supportedVision = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];
    const isSupported = supportedVision.some((m) => useModel.startsWith(m));
    if (!isSupported) {
      useModel = 'gemini-2.0-flash'; // 현재 무료 비전 모델
    }
  }

  const bodyObj = {
    contents: [{ parts }],
    generationConfig: { maxOutputTokens: 2048 },
  };
  // systemInstruction은 일부 모델만 지원 - 있을 때만 포함
  if (options.system) {
    bodyObj.systemInstruction = { parts: [{ text: options.system }] };
  }
  const body = JSON.stringify(bodyObj);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${apiKey}`;

  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // API 오류 응답 처리
          if (json.error) {
            const msg = json.error.message || '';
            if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
              return resolve({ error: `Gemini 무료 한도 초과입니다. 설정에서 모델을 "gemini-2.0-flash"로 바꿔보세요.` });
            }
            return resolve({ error: `Gemini 오류: ${msg || JSON.stringify(json.error)}` });
          }
          // 안전 필터 차단
          const blockReason = json.promptFeedback?.blockReason;
          if (blockReason) {
            return resolve({ error: `Gemini 안전 필터 차단: ${blockReason}` });
          }
          const resultText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (!resultText && json.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
            return resolve({ error: 'Gemini 응답이 너무 깁니다. 더 간단한 이미지로 시도해 주세요.' });
          }
          resolve({ result: resultText });
        } catch (err) {
          resolve({ error: `응답 파싱 오류: ${err.message}` });
        }
      });
    });
    req.on('error', (err) => resolve({ error: `네트워크 오류: ${err.message}` }));
    req.write(body);
    req.end();
  });
}

async function parseClassTimetableExcel(buffer) {
  const { DOMParser } = require('@xmldom/xmldom');
  const files = await unzipWorkbook(buffer);
  const parser = new DOMParser();

  const workbookXml = asText(files['xl/workbook.xml']);
  if (!workbookXml) throw new Error('엑셀 파일을 읽지 못했습니다.');
  const workbookDoc = parser.parseFromString(workbookXml, 'text/xml');
  const relsDoc = parser.parseFromString(asText(files['xl/_rels/workbook.xml.rels']) || '<Relationships/>', 'text/xml');

  const firstSheet = workbookDoc.getElementsByTagName('sheet')[0];
  if (!firstSheet) throw new Error('시트를 찾지 못했습니다.');
  const relationId = firstSheet.getAttribute('r:id') || firstSheet.getAttribute('Id');
  const target = findSheetTarget(relsDoc, relationId);
  const sheetPath = normalizeSheetPath(target);
  const sheetXml = asText(files[sheetPath]);
  if (!sheetXml) throw new Error('시간표 시트를 찾지 못했습니다.');

  const sharedStrings = parseSharedStrings(parser, asText(files['xl/sharedStrings.xml']) || '');
  const sheetDoc = parser.parseFromString(sheetXml, 'text/xml');
  const matrix = parseWorksheet(sheetDoc, sharedStrings);
  const entries = matrixToClassTimetable(matrix);

  if (!entries.length) {
    throw new Error('학급 시간표 형식을 인식하지 못했습니다. NEIS 시간표 엑셀 파일인지 확인해 주세요.');
  }
  return entries;
}

function unzipWorkbook(buffer) {
  const yauzl = require('yauzl');
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error);
      const files = {};
      zip.readEntry();
      zip.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return reject(streamError);
          const chunks = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', () => {
            files[entry.fileName] = Buffer.concat(chunks);
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => resolve(files));
      zip.on('error', reject);
    });
  });
}

function asText(value) {
  return Buffer.isBuffer(value) ? value.toString('utf8') : '';
}

function formatFileTimestamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function removeSqliteSidecars(dbPath) {
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  if (fs.existsSync(walPath)) fs.rmSync(walPath, { force: true });
  if (fs.existsSync(shmPath)) fs.rmSync(shmPath, { force: true });
}

function validateBackupFile(filePath) {
  let tempDb;
  try {
    tempDb = new SQLiteDatabase(filePath, { readonly: true, fileMustExist: true });
    const integrity = tempDb.pragma('integrity_check', { simple: true });
    if (String(integrity).toLowerCase() !== 'ok') {
      throw new Error('선택한 파일이 올바른 백업 데이터가 아닙니다.');
    }
    const settingsTable = tempDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
      .get();
    if (!settingsTable) {
      throw new Error('교사앱 백업 파일이 아닙니다.');
    }
  } finally {
    if (tempDb) tempDb.close();
  }
}

function findSheetTarget(relsDoc, relationId) {
  const relationships = Array.from(relsDoc.getElementsByTagName('Relationship'));
  const relation = relationships.find((item) => item.getAttribute('Id') === relationId);
  return relation ? relation.getAttribute('Target') : 'worksheets/sheet1.xml';
}

function normalizeSheetPath(target) {
  if (!target) return 'xl/worksheets/sheet1.xml';
  return target.startsWith('xl/') ? target : `xl/${target.replace(/^\/+/, '')}`;
}

function parseSharedStrings(parser, xml) {
  if (!xml) return [];
  const doc = parser.parseFromString(xml, 'text/xml');
  return Array.from(doc.getElementsByTagName('si')).map((item) => normalizeCellText(item.textContent || ''));
}

function parseWorksheet(sheetDoc, sharedStrings) {
  const rows = new Map();
  Array.from(sheetDoc.getElementsByTagName('row')).forEach((rowNode) => {
    const rowIndex = Number(rowNode.getAttribute('r') || 0);
    const rowMap = new Map();
    Array.from(rowNode.getElementsByTagName('c')).forEach((cellNode) => {
      const ref = cellNode.getAttribute('r') || '';
      const colIndex = columnRefToIndex(ref.replace(/\d+/g, ''));
      if (!colIndex) return;
      const value = readCellValue(cellNode, sharedStrings);
      if (value) rowMap.set(colIndex, value);
    });
    if (rowMap.size) rows.set(rowIndex, rowMap);
  });
  return rows;
}

function readCellValue(cellNode, sharedStrings) {
  const type = cellNode.getAttribute('t') || '';
  const valueNode = cellNode.getElementsByTagName('v')[0];
  const inlineNode = cellNode.getElementsByTagName('is')[0];
  if (type === 'inlineStr' && inlineNode) {
    return normalizeCellText(inlineNode.textContent || '');
  }
  if (!valueNode) return '';
  const raw = valueNode.textContent || '';
  if (type === 's') {
    return normalizeCellText(sharedStrings[Number(raw)] || '');
  }
  return normalizeCellText(raw);
}

function normalizeCellText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function columnRefToIndex(ref) {
  if (!ref) return 0;
  let index = 0;
  for (let i = 0; i < ref.length; i += 1) {
    index = index * 26 + (ref.charCodeAt(i) - 64);
  }
  return index;
}

function matrixToClassTimetable(rows) {
  const weekdayMap = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4 };
  let headerRowIndex = 0;
  let dayColumns = [];

  // ① 헤더 행 탐지: 월/화/수/목/금 이 가장 많이 포함된 행
  for (const [rowIndex, rowMap] of rows.entries()) {
    const matches = [];
    for (const [colIndex, value] of rowMap.entries()) {
      const label = normalizeCellText(value);
      const weekday = Object.keys(weekdayMap).find((key) => label.startsWith(key) || label.includes(key + '요일'));
      if (weekday !== undefined) matches.push({ colIndex, day: weekdayMap[weekday] });
    }
    if (matches.length > dayColumns.length) {
      headerRowIndex = rowIndex;
      // 월~금(0~4)만 사용, 토·일 제외
      dayColumns = matches.filter(m => m.day <= 4).sort((a, b) => a.colIndex - b.colIndex);
    }
  }

  if (dayColumns.length < 3) {
    dayColumns = [2, 3, 4, 5, 6].map((colIndex, idx) => ({ colIndex, day: idx }));
  }

  const entries = [];
  let pendingPeriod = null; // "N교시" 행에서 저장해 둔 교시 번호

  const sortedRows = Array.from(rows.entries())
    .filter(([rowIndex]) => rowIndex > headerRowIndex)
    .sort((a, b) => a[0] - b[0]);

  for (const [, rowMap] of sortedRows) {
    const colAval = normalizeCellText(rowMap.get(1) || ''); // 열 A = colIndex 1

    // ② "N교시" 패턴 감지 (NEIS 형식) 또는 순수 숫자
    const periodFromKorean = colAval.match(/^(\d{1,2})\s*교시/);
    const periodFromDigit   = /^\d{1,2}$/.test(colAval) ? Number(colAval) : null;
    const detectedPeriod    = periodFromKorean ? Number(periodFromKorean[1]) : periodFromDigit;

    if (detectedPeriod && detectedPeriod >= 1 && detectedPeriod <= 12) {
      // 교시 마커 행 → 다음 줄의 과목을 위해 저장 후 스킵
      pendingPeriod = detectedPeriod;
      continue;
    }

    // ③ 과목 행: pendingPeriod 가 있으면 과목 추출
    const usePeriod = pendingPeriod;
    pendingPeriod = null;
    if (!usePeriod) continue;

    dayColumns.forEach(({ colIndex, day }) => {
      let subject = normalizeCellText(rowMap.get(colIndex) || '');
      // 교사명 괄호 제거: "회계 원리(송대섭)" → "회계 원리"
      subject = subject.replace(/\s*\([^)]*\)\s*$/, '').trim();
      subject = subject.replace(/^\-+$/, '').replace(/^\s*없음\s*$/i, '');
      // "N학년 …" 형태의 반 이름 행은 건너뜀
      if (!subject || /^\d+학년/.test(subject)) return;
      entries.push({ day_of_week: day, period: usePeriod, subject, is_my_class: false });
    });
  }

  const deduped = new Map();
  entries.forEach((entry) => deduped.set(`${entry.day_of_week}_${entry.period}`, entry));
  return Array.from(deduped.values()).sort((a, b) =>
    a.period !== b.period ? a.period - b.period : a.day_of_week - b.day_of_week
  );
}

function matrixToClassTimetable(rows) {
  const weekdayMap = {
    '월': 0,
    '화': 1,
    '수': 2,
    '목': 3,
    '금': 4,
  };
  let headerRowIndex = 0;
  let dayColumns = [];

  for (const [rowIndex, rowMap] of rows.entries()) {
    const matches = [];
    for (const [colIndex, value] of rowMap.entries()) {
      const label = normalizeCellText(value);
      const weekday = Object.keys(weekdayMap).find((key) => label.startsWith(key) || label.includes(`${key}요일`));
      if (weekday !== undefined) {
        matches.push({ colIndex, day: weekdayMap[weekday] });
      }
    }
    if (matches.length > dayColumns.length) {
      headerRowIndex = rowIndex;
      dayColumns = matches.filter((match) => match.day <= 4).sort((a, b) => a.colIndex - b.colIndex);
    }
  }

  if (dayColumns.length < 3) {
    dayColumns = [2, 4, 5, 6, 12].map((colIndex, idx) => ({ colIndex, day: idx }));
  }

  const entries = [];
  let pendingPeriod = null;
  const sortedRows = Array.from(rows.entries())
    .filter(([rowIndex]) => rowIndex > headerRowIndex)
    .sort((a, b) => a[0] - b[0]);

  for (const [, rowMap] of sortedRows) {
    const firstCol = normalizeCellText(rowMap.get(1) || '');
    const periodMatch = firstCol.match(/^(\d{1,2})\s*교시/);
    const periodDigit = /^\d{1,2}$/.test(firstCol) ? Number(firstCol) : null;
    const detectedPeriod = periodMatch ? Number(periodMatch[1]) : periodDigit;

    if (detectedPeriod && detectedPeriod >= 1 && detectedPeriod <= 12) {
      pendingPeriod = detectedPeriod;
      continue;
    }

    if (!pendingPeriod) continue;
    const usePeriod = pendingPeriod;
    pendingPeriod = null;

    dayColumns.forEach(({ colIndex, day }) => {
      const rawCell = normalizeCellText(rowMap.get(colIndex) || '');
      const parsedCell = parseClassTimetableCell(rawCell);
      if (!parsedCell.subject || /^\d+학년/.test(parsedCell.subject)) return;
      entries.push({
        day_of_week: day,
        period: usePeriod,
        subject: parsedCell.subject,
        teacher: parsedCell.teacher,
        is_my_class: false,
      });
    });
  }

  const deduped = new Map();
  entries.forEach((entry) => deduped.set(`${entry.day_of_week}_${entry.period}`, entry));
  return Array.from(deduped.values()).sort((a, b) =>
    a.period !== b.period ? a.period - b.period : a.day_of_week - b.day_of_week
  );
}

function parseClassTimetableCell(value) {
  const cleaned = normalizeCellText(value).replace(/^\-+$/, '').replace(/^\s*없음\s*$/i, '');
  if (!cleaned) return { subject: '', teacher: '' };

  const match = cleaned.match(/^(.*?)(?:\(([^()]*)\))?\s*$/);
  return {
    subject: normalizeCellText(match?.[1] || cleaned),
    teacher: normalizeCellText(match?.[2] || ''),
  };
}

ipcMain.removeHandler('ai-extract-timetable');
ipcMain.handle('ai-extract-timetable', async (e, apiKey, model, provider, text) => {
  try {
    const options = {
      system: 'Read a teacher timetable memo and return only a JSON array. Each item must be {"day_of_week":0-4,"period":1-7,"subject":"exact cell text","is_my_class":true|false}. Preserve the visible cell text exactly as written. Do not split room numbers or remove leading numbers such as "107음악". IMPORTANT: cells that start with symbols such as "*202기업" or "*201기업" are real classes, not notes or empty cells. Keep the leading "*" in subject exactly. Do not guess missing cells. Do not output markdown or explanations.',
      userPrompt: `Convert the following timetable note into JSON. If a class text begins with *, keep it exactly, for example "*202기업".\n\n${text}`,
    };
    if (provider === 'gemini') {
      return await runGemini(apiKey, model, text, options);
    }
    return await runClaude(apiKey, model, text, options);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.removeHandler('ai-extract-timetable-image');
ipcMain.handle('ai-extract-timetable-image', async (e, apiKey, model, provider, image) => {
  try {
    if (!image || !image.data || !image.mimeType) {
      return { error: '이미지 정보가 올바르지 않습니다.' };
    }
    const options = {
      system: 'Read the timetable image and return only a JSON array. Each item must be {"day_of_week":0-4,"period":1-7,"subject":"exact cell text","is_my_class":true|false}. Preserve each visible cell text exactly. Do not split room numbers or locations from the subject text. If a cell shows "107음악", keep subject as "107음악". IMPORTANT: a leading asterisk is part of the class text. Cells like "*202기업", "*202가정", or "*201기업" must be extracted as real classes and the "*" must remain in subject. Do not treat "*" as a bullet, footnote, or empty marker. Do not guess unclear cells. Do not output markdown or explanations.',
      userPrompt: 'Extract the visible weekly timetable from this image into JSON. Pay special attention to small leading symbols: keep subjects that begin with * exactly, such as "*202기업".',
      image,
    };
    if (provider === 'gemini') {
      return await runGemini(apiKey, model, '', options);
    }
    return await runClaude(apiKey, model, '', options);
  } catch (err) {
    return { error: err.message };
  }
});
