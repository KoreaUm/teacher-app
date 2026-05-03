const { app, BrowserWindow, ipcMain, shell, screen, dialog, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync, execSync } = require('child_process');
const os = require('os');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
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
const gotSingleInstanceLock = app.requestSingleInstanceLock();
const AI_MODEL_DOWNLOADS = {
  local_lite: {
    label: 'Local AI Lite',
    settingKey: 'ai_local_lite_model_path',
    recommendedFile: 'qwen2.5-3b-instruct-q4.gguf',
    downloadUrl: '',
    filesUrl: ''
  },
  local_basic: {
    label: 'Gemma 4 E2B Basic',
    settingKey: 'ai_local_basic_model_path',
    recommendedFile: 'gemma-4-E2B-it-Q4_K_M.gguf',
    downloadUrl: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf?download=true',
    filesUrl: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/tree/main'
  },
  local_pro: {
    label: 'Gemma 4 E4B Pro',
    settingKey: 'ai_local_pro_model_path',
    recommendedFile: 'gemma-4-E4B-it-Q4_K_M.gguf',
    downloadUrl: 'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf?download=true',
    filesUrl: 'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/tree/main'
  }
};
const AI_RUNTIME_DOWNLOAD_URL = 'https://github.com/ggml-org/llama.cpp/releases/latest';
const OLLAMA_INSTALLER_URL = 'https://ollama.com/download/OllamaSetup.exe';
const OLLAMA_MODELS = {
  local_lite: 'qwen2.5:3b',
  local_basic: 'gemma4:e2b',
  local_pro: 'gemma4:e4b'
};
let updateState = {
  status: 'idle',
  version: app.getVersion(),
  message: '',
  progress: 0,
  info: null,
};

function getAiModelDir() {
  const dir = path.join(app.getPath('userData'), 'ai-models');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getAiRuntimeDir() {
  const dir = path.join(app.getPath('userData'), 'ai-runtime');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function findAiRuntimePath() {
  const runtimeDir = getAiRuntimeDir();
  const candidates = [
    path.join(runtimeDir, 'llama-server.exe'),
    path.join(runtimeDir, 'llama-cli.exe'),
    path.join(runtimeDir, 'llama.exe')
  ];
  return candidates.find((candidate) => {
    try { return fs.existsSync(candidate) && fs.statSync(candidate).isFile(); } catch { return false; }
  }) || '';
}

function testAiRuntimePath(runtimePath) {
  if (!runtimePath) return { ok: false, message: '실행 엔진 파일이 없습니다.' };
  try {
    const result = spawnSync(runtimePath, ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true
    });
    if (result.error) return { ok: false, message: result.error.message };
    if (result.status === 0) return { ok: true, message: '실행 엔진 실행 테스트를 통과했습니다.' };
    const detail = String(result.stderr || result.stdout || '').trim();
    return { ok: false, message: detail || `실행 엔진 테스트가 종료 코드 ${result.status}로 끝났습니다.` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function findOllamaPath() {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
    path.join(process.env.ProgramFiles || '', 'Ollama', 'ollama.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Ollama', 'ollama.exe')
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { if (fs.existsSync(candidate)) return candidate; } catch {}
  }
  try {
    const found = execSync('where.exe ollama', {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    }).split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (found) return found;
  } catch {}
  return '';
}

function getOllamaModelForEngine(engine) {
  return OLLAMA_MODELS[engine] || OLLAMA_MODELS.local_lite;
}

function isStudentSensitivePage(page) {
  return /학생|상담|성적|출석|관찰|수업|상담 일지|성적관리|학생 명단|AI 분석/i.test(String(page || ''));
}

function anonymizeSensitiveText(text) {
  let value = String(text || '');
  value = value.replace(/01[016789]-?\d{3,4}-?\d{4}/g, '[전화번호]');
  value = value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[이메일]');
  value = value.replace(/\b\d{6}-\d{7}\b/g, '[주민번호]');
  value = value.replace(/\b\d{1,2}\s*학년\s*\d{1,2}\s*반\s*\d{1,2}\s*번\b/g, '[학년반번호]');
  value = value.replace(/\b\d{1,2}\s*반\s*\d{1,2}\s*번\b/g, '[반번호]');
  value = value.replace(/\b\d{4,6}\b/g, '[번호]');
  value = value.replace(/([가-힣]{2,4})(?=\s*(학생|군|양|님|:|은|는|이|가|을|를|의))/g, '[학생]');
  return value;
}

function pickContextValue(context, label) {
  const escaped = String(label || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(context || '').match(new RegExp(`^${escaped}:\\s*(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

function buildCounselingFollowUpFromContext(context, question) {
  const ctx = String(context || '');
  const q = String(question || '');
  if (!/상담 페이지 저장 기록|상담기록/.test(ctx)) return '';
  if (!/후속|조치|다음|어떻게|상담|면담|지도|관리|도와|해야|하나|계획|방안|방법|문제|갈등|관계/.test(q)) return '';
  const student = pickContextValue(ctx, '학생') || pickContextValue(ctx, '질문 대상 학생') || '해당 학생';
  const topic = pickContextValue(ctx, '주제') || '확인 필요';
  const summary = pickContextValue(ctx, '요약') || pickContextValue(ctx, '상담 내용') || '확인 필요';
  const risk = pickContextValue(ctx, '유형/상태/위험도').split('/').map((s) => s.trim()).pop() || '확인 필요';
  const follow = pickContextValue(ctx, '기존 후속 조치') || '후속 조치 미기록';
  const nextAction = pickContextValue(ctx, '다음 조치') || '';
  const nextDate = pickContextValue(ctx, '후속 예정일') || '미지정';
  const flags = pickContextValue(ctx, '위험 신호') || '없음';
  return [
    `${student} 학생의 현재 상담 기록 기준으로 정리하면 다음과 같습니다.`,
    '',
    `- 상담 주제: ${topic}`,
    `- 핵심 요약: ${summary}`,
    `- 현재 위험도: ${risk}`,
    `- 기존 후속 조치: ${follow}`,
    nextAction ? `- 다음 조치: ${nextAction}` : '- 다음 조치: 확인 필요',
    `- 후속 예정일: ${nextDate}`,
    `- 기록된 위험 신호: ${flags || '없음'}`,
    '',
    '권장 후속 조치:',
    '1. 관련 학생을 각각 따로 상담하여 사실관계, 감정 상태, 원하는 해결 방향을 확인합니다.',
    `2. ${student} 학생에게 2~3일 안에 짧은 재상담 시간을 잡아 관계 변화와 등교·수업 참여 상태를 확인합니다.`,
    '3. 두 학생을 바로 대면시키기보다, 각각의 입장을 확인한 뒤 필요할 때만 중재 자리를 마련합니다.',
    '4. 상담 기록에 다음 확인일과 담당 교사의 관찰 포인트를 구체적으로 남깁니다.',
    '5. 갈등이 반복되거나 결석·정서 변화·폭력 징후가 보이면 보호자 또는 전문상담교사 연계를 검토합니다.',
    '',
    '확인 필요: 상담 기록에 없는 성적, 가정 상황, 심리 상태는 추측하지 않았습니다.'
  ].join('\n');
}

function containsCjkChinese(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''));
}

function requestOllamaJson(pathname, body = null, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: pathname,
      method: body ? 'POST' : 'GET',
      timeout: timeoutMs,
      headers: body ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      } : {}
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, data: raw ? JSON.parse(raw) : {} });
        } catch (err) {
          resolve({ ok: false, statusCode: res.statusCode, error: err.message, raw });
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('Ollama 응답 시간이 초과되었습니다.'));
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    if (data) req.write(data);
    req.end();
  });
}

async function getOllamaStatus(engine = 'local_lite') {
  const ollamaPath = findOllamaPath();
  const model = getOllamaModelForEngine(engine);
  if (!ollamaPath) {
    return {
      installed: false,
      running: false,
      modelInstalled: false,
      ready: false,
      model,
      message: 'Ollama가 설치되어 있지 않습니다. 로컬 AI 자동 설치를 눌러 주세요.'
    };
  }
  const tags = await requestOllamaJson('/api/tags', null, 5000);
  const running = !!tags.ok;
  const models = Array.isArray(tags.data?.models) ? tags.data.models : [];
  const modelInstalled = models.some((item) => item.name === model || item.model === model || String(item.name || item.model || '').startsWith(`${model}:`));
  return {
    installed: true,
    running,
    modelInstalled,
    ready: running && modelInstalled,
    path: ollamaPath,
    model,
    message: !running
      ? 'Ollama는 설치되어 있지만 아직 실행 중이 아닙니다. 자동 설치/확인을 누르면 실행을 시도합니다.'
      : modelInstalled
        ? `${model} 모델이 준비되어 있습니다. 로컬 AI는 외부 전송 없이 이 PC에서 실행됩니다.`
        : `${model} 모델이 아직 없습니다. 자동 설치/확인을 누르면 모델을 다운로드합니다.`
  };
}

function startOllamaServer(ollamaPath) {
  if (!ollamaPath) return;
  try {
    const child = spawn(ollamaPath, ['serve'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
  } catch {}
}

function downloadFile(url, destination, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const handle = (currentUrl) => {
      httpsGet(currentUrl, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          handle(new URL(res.headers.location, currentUrl).toString());
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`다운로드 실패: HTTP ${res.statusCode}`));
          return;
        }
        const total = Number(res.headers['content-length'] || 0);
        let received = 0;
        res.on('data', (chunk) => {
          received += chunk.length;
          if (total && onProgress) onProgress({ received, total, percent: Math.min(99, Math.round((received / total) * 100)) });
        });
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', reject);
    };
    handle(url);
  });
}

function httpsGet(url, callback) {
  return require(url.startsWith('https:') ? 'https' : 'http').get(url, callback);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const onData = options.onData;
    const spawnOptions = Object.assign({}, options);
    delete spawnOptions.onData;
    const child = spawn(command, args, {
      windowsHide: true,
      ...spawnOptions
    });
    let output = '';
    const handleData = (data) => {
      const text = data.toString();
      output += text;
      if (onData) onData(text);
    };
    child.stdout?.on('data', handleData);
    child.stderr?.on('data', handleData);
    child.on('error', (err) => resolve({ ok: false, error: err.message, output }));
    child.on('close', (code) => resolve({ ok: code === 0, code, output }));
  });
}

async function waitForOllamaReady(ollamaPath, timeoutMs = 45000) {
  startOllamaServer(ollamaPath);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tags = await requestOllamaJson('/api/tags', null, 3000);
    if (tags.ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

async function getAiEngineStatus(engine) {
  const selectedEngine = engine || db.getSetting('ai_engine', 'local_lite');
  const modelDir = getAiModelDir();
  const runtimeDir = getAiRuntimeDir();
  if (selectedEngine === 'cloud' || selectedEngine === 'claude' || selectedEngine === 'gemini') {
    const provider = selectedEngine === 'cloud' ? db.getSetting('ai_provider', 'claude') : selectedEngine;
    const label = provider === 'gemini' ? 'Gemini 외부 AI' : 'Claude 외부 AI';
    const hasKey = !!db.getSetting('ai_api_key', '');
    return {
      engine: selectedEngine,
      provider,
      ready: hasKey,
      label,
      message: hasKey ? `${label} API 키가 설정되어 있습니다. 입력 내용은 외부 AI 서버로 전송될 수 있습니다.` : `${label}를 쓰려면 API 키가 필요합니다.`,
      modelDir,
      runtimeDir
    };
  }
  const meta = AI_MODEL_DOWNLOADS[selectedEngine];
  if (!meta) return { engine: selectedEngine, ready: false, label: selectedEngine, message: '알 수 없는 AI 엔진입니다.', modelDir, runtimeDir };
  const ollamaStatus = await getOllamaStatus(selectedEngine);
  return {
    engine: selectedEngine,
    ready: ollamaStatus.ready,
    label: `${meta.label} · Ollama`,
    model: ollamaStatus.model,
    ollamaPath: ollamaStatus.path || '',
    ollamaInstalled: ollamaStatus.installed,
    ollamaRunning: ollamaStatus.running,
    ollamaModelInstalled: ollamaStatus.modelInstalled,
    modelDir,
    runtimeDir,
    message: ollamaStatus.message
  };
/*
  const configuredPath = db.getSetting(meta.settingKey, '');
  const candidates = [
    configuredPath,
    path.join(modelDir, meta.recommendedFile)
  ].filter(Boolean);
  const foundPath = candidates.find((candidate) => {
    try { return fs.existsSync(candidate) && fs.statSync(candidate).isFile(); } catch { return false; }
  }) || '';
  const runtimePath = findAiRuntimePath();
  let message = `${meta.recommendedFile} 모델 파일을 선택하거나 ai-models 폴더에 넣어 주세요.`;
  if (foundPath && !runtimePath) {
    message = `모델 파일은 준비됐지만 실행 엔진(llama.cpp)이 아직 없습니다. ai-runtime 폴더에 llama-server.exe 또는 llama-cli.exe를 넣어 주세요.`;
  } else if (foundPath && runtimePath) {
    message = `모델과 실행 엔진이 준비되어 있습니다: ${path.basename(foundPath)} / ${path.basename(runtimePath)}`;
  }
  return {
    engine: selectedEngine,
    ready: !!foundPath && !!runtimePath,
    label: meta.label,
    modelPath: foundPath || configuredPath,
    runtimePath,
    modelDir,
    runtimeDir,
    downloadUrl: meta.downloadUrl,
    runtimeDownloadUrl: AI_RUNTIME_DOWNLOAD_URL,
    message
  };
*/
}

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

function hideWindowToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (!tray) {
    mainWindow.minimize();
    mainWindow.setSkipTaskbar(false);
    return;
  }

  mainWindow.hide();
  mainWindow.setSkipTaskbar(true);
}

function createWindow() {
  const { nativeImage } = require('electron');
  const icoPath = path.join(__dirname, 'assets/icon.ico');
  const pngPath = path.join(__dirname, 'assets/app-icon.png');
  const winIcon = fs.existsSync(icoPath)
    ? nativeImage.createFromPath(icoPath)
    : fs.existsSync(pngPath)
      ? nativeImage.createFromPath(pngPath)
      : null;

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 800,
    minWidth: 1100,
    minHeight: 680,
    frame: false,
    ...(winIcon && !winIcon.isEmpty() ? { icon: winIcon } : {}),
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
      hideWindowToTray();
    }
    isClosingAfterCloudSync = false;
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (winIcon && !winIcon.isEmpty()) mainWindow.setIcon(winIcon);
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

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.setAppUserModelId('com.teacher.app');

  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    openDatabaseForUser('');
    setupAutoUpdater();
    createTray();
    createWindow();
    app.on('activate', () => {
      showMainWindow();
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin' && !isQuitting) return;
  if (isQuitting) app.quit();
});

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-restore', () => { if (mainWindow) { mainWindow.restore(); mainWindow.focus(); } });
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
ipcMain.handle('get-ai-engine-status', async (e, engine) => {
  try {
    return await getAiEngineStatus(engine);
  } catch (err) {
    return { ready: false, error: err.message };
  }
});
ipcMain.handle('select-ai-model-file', async (e, engine) => {
  try {
    const meta = AI_MODEL_DOWNLOADS[engine];
    if (!meta) return { error: '로컬 AI 엔진을 먼저 선택해 주세요.' };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: `${meta.label} 모델 파일 선택`,
      properties: ['openFile'],
      filters: [
        { name: 'GGUF Model', extensions: ['gguf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths?.[0]) return { cancelled: true };
    db.setSetting(meta.settingKey, result.filePaths[0]);
    return await getAiEngineStatus(engine);
  } catch (err) {
    return { error: err.message };
  }
});
ipcMain.handle('open-ai-model-folder', () => {
  try {
    return shell.openPath(getAiModelDir());
  } catch (err) {
    return err.message;
  }
});
ipcMain.handle('open-ai-runtime-folder', () => {
  try {
    return shell.openPath(getAiRuntimeDir());
  } catch (err) {
    return err.message;
  }
});
ipcMain.handle('open-ai-model-download', (e, engine) => {
  const meta = AI_MODEL_DOWNLOADS[engine] || AI_MODEL_DOWNLOADS.local_basic;
  return shell.openExternal(meta.downloadUrl);
});
ipcMain.handle('open-ai-runtime-download', () => shell.openExternal(AI_RUNTIME_DOWNLOAD_URL));
ipcMain.handle('install-ollama-ai', async (e, engine = 'local_lite') => {
  const sendProgress = (payload) => {
    try {
      e.sender.send('ollama-install-progress', Object.assign({
        step: '',
        message: '',
        percent: null,
        detail: ''
      }, payload || {}));
    } catch {}
  };
  try {
    const targetEngine = AI_MODEL_DOWNLOADS[engine] ? engine : 'local_lite';
    const model = getOllamaModelForEngine(targetEngine);
    sendProgress({ step: 'check', percent: 5, message: 'Ollama 설치 여부를 확인하는 중입니다.' });
    let ollamaPath = findOllamaPath();

    if (!ollamaPath) {
      const installerPath = path.join(app.getPath('temp'), 'OllamaSetup.exe');
      sendProgress({ step: 'download-installer', percent: 10, message: 'Ollama 설치 파일을 다운로드하는 중입니다.' });
      await downloadFile(OLLAMA_INSTALLER_URL, installerPath, (progress) => {
        sendProgress({
          step: 'download-installer',
          percent: Math.max(10, Math.min(35, Math.round(10 + (progress.percent * 0.25)))),
          message: `Ollama 설치 파일 다운로드 중... ${progress.percent}%`
        });
      });
      sendProgress({ step: 'run-installer', percent: 40, message: 'Ollama 설치 파일을 실행했습니다. 설치 창을 완료해 주세요.' });
      shell.openPath(installerPath);
      return {
        success: false,
        needsUserAction: true,
        message: 'Ollama 설치 파일을 실행했습니다. 설치 창에서 설치를 완료한 뒤 다시 "로컬 AI 자동 설치/확인"을 눌러 주세요.'
      };
    }

    sendProgress({ step: 'start', percent: 20, message: 'Ollama를 실행하고 응답을 기다리는 중입니다.' });
    const serverReady = await waitForOllamaReady(ollamaPath);
    if (!serverReady) {
      return {
        success: false,
        message: 'Ollama를 실행하지 못했습니다. Windows 트레이에서 Ollama가 실행 중인지 확인한 뒤 다시 시도해 주세요.'
      };
    }

    sendProgress({ step: 'model-check', percent: 35, message: `${model} 모델 설치 여부를 확인하는 중입니다.` });
    const before = await getOllamaStatus(targetEngine);
    if (!before.modelInstalled) {
      sendProgress({ step: 'model-download', percent: 40, message: `${model} 모델을 다운로드하는 중입니다. 처음에는 오래 걸릴 수 있습니다.` });
      let lastProgressAt = 0;
      const pulled = await runCommand(ollamaPath, ['pull', model], {
        timeout: 60 * 60 * 1000,
        onData: (text) => {
          const compact = text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\r/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean).slice(-1)[0] || '';
          const match = compact.match(/(\d{1,3})%/);
          const now = Date.now();
          if (now - lastProgressAt < 700 && !match) return;
          lastProgressAt = now;
          const pullPercent = match ? Math.min(100, Number(match[1])) : null;
          sendProgress({
            step: 'model-download',
            percent: pullPercent == null ? 45 : Math.round(40 + (pullPercent * 0.45)),
            message: pullPercent == null ? `${model} 모델 다운로드 중...` : `${model} 모델 다운로드 중... ${pullPercent}%`,
            detail: compact
          });
        }
      });
      if (!pulled.ok) {
        return {
          success: false,
          message: `모델 다운로드에 실패했습니다. 인터넷 연결을 확인해 주세요.\n${pulled.error || pulled.output || ''}`
        };
      }
    }

    sendProgress({ step: 'test', percent: 90, message: '로컬 AI가 실제로 답변하는지 테스트하는 중입니다.' });
    const test = await requestOllamaJson('/api/generate', {
      model,
      prompt: '한국어로 짧게 "로컬 AI 준비 완료"라고 답하세요.',
      stream: false
    }, 60000);
    if (!test.ok) {
      return {
        success: false,
        message: `모델은 준비됐지만 테스트 호출에 실패했습니다. ${test.error || test.raw || ''}`
      };
    }

    db.setSetting('ai_engine', targetEngine);
    db.setSetting('ai_ollama_model', model);
    sendProgress({ step: 'done', percent: 100, message: '로컬 AI 준비가 완료되었습니다.' });
    return {
      success: true,
      message: `${model} 로컬 AI 준비가 완료되었습니다. 입력 내용은 외부 서버로 전송되지 않습니다.`,
      status: await getOllamaStatus(targetEngine)
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle('apply-ai-engine', async (e, engine) => {
  try {
    if (engine) db.setSetting('ai_engine', engine);
    const status = await getAiEngineStatus(engine);
    if (!status.ready) return Object.assign({}, status, { applied: false });
    if (status.runtimePath) {
      const runtimeCheck = testAiRuntimePath(status.runtimePath);
      if (!runtimeCheck.ok) {
        return Object.assign({}, status, {
          ready: false,
          applied: false,
          message: `실행 엔진 파일은 찾았지만 실행 테스트에 실패했습니다. ${runtimeCheck.message}`
        });
      }
    }
    return Object.assign({}, status, { applied: true, message: `${status.label} 엔진을 사용할 준비가 되었습니다.` });
  } catch (err) {
    return { ready: false, applied: false, error: err.message };
  }
});
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

ipcMain.handle('ai-extract-estimate-image', async (e, apiKey, model, provider, file) => {
  try {
    if (!file || !file.data) return { error: '파일 정보가 올바르지 않습니다.' };
    const system = '견적서에서 품목 정보를 추출하여 JSON 배열만 출력하세요. 각 요소는 {"name":"품목명","spec":"규격","qty":수량,"price":단가} 형식이며 숫자는 쉼표 없이 순수 숫자입니다. 코드블록이나 설명 없이 JSON 배열만 출력하세요.';
    const userPrompt = '이 견적서에서 품목 목록을 추출해서 JSON 배열로 출력하세요.';
    const isPdf = file.mimeType === 'application/pdf';
    const options = isPdf
      ? { system, userPrompt, document: { data: file.data } }
      : { system, userPrompt, image: file };
    if (provider === 'gemini') return await runGemini(apiKey, model, '', options);
    return await runClaude(apiKey, model, '', options);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('parse-excel-estimate', async (e, bufferData) => {
  try {
    const xlsx = require('xlsx');
    const buf = Buffer.from(bufferData);
    const wb = xlsx.read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    return { rows };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('ai-generate-official-doc', async (e, apiKey, model, provider, inputJson) => {
  try {
    const system = `당신은 대한민국 공공언어 전문가로, 한국공공언어진흥원 공문서 작성법 기준에 따라 학교 공문을 작성합니다.

[핵심 규칙]
## 구조
- 두문: 수신 / (경유) / 제목
- 본문: 관련근거(있으면 1.로) → 핵심내용(항목별)
- 끝. 또는 붙임 뒤에 끝.

## 제목
- 내용 전체를 포괄하는 명사구
- 모호한 표현('우리 기관' 등) 금지

## 항목 기호 순서
- 첫째: 1., 2., 3. / 둘째: 가., 나., 다. / 셋째: 1), 2) / 넷째: 가), 나)
- 항목 문장은 '-다' 형 평서형 종결어미로 끝냄

## 날짜·시간·금액
- 날짜: 2026. 4. 28.(월) — 점 뒤 한 칸, 일 뒤 반드시 점
- 기간: 2026. 4. 28.~5. 2.
- 시간: 24시각제 쌍점 — 09:00, 13:30
- 금액: 금13,500원(금일만삼천오백원)

## 붙임
- 각 파일 개별 기재, 묶지 않음
- 붙임  1. 파일명 1부.
        2. 파일명 1부.  끝.
- 단일 파일: 붙임  파일명 1부.  끝.

## 끝.
- 본문이 끝나면 두 칸 띄우고 끝.
- 붙임이 있으면 붙임 표시문 끝에 두 칸 띄우고 끝.

## 표현 원칙
1. 사실성: 육하원칙, 중복표현('2월달→2월', '기간 동안→기간', '새로 신설→신설') 금지
2. 용이성: 외래어 한글화 후 괄호에 원어 — 연구 개발(R&D)
3. 명확성: 호응 맞추기, 명사 나열 형태 지양
4. 비고압성: '절대·필히·엄금' 지양, 명령형→안내형
5. 비표지성: '불우 이웃→어려운 이웃', 순서 없으면 가나다순
6. 수요자 중심: '민원 접수→민원 신청', '여권 교부→여권 수령'

## 출력 형식
- 제목 줄부터 끝. 까지만 출력 (수신·발신명의·기안자·시행번호 등 결문 서식 제외)
- 설명·마크다운 없이 공문 텍스트만 출력
- 빈 항목은 임의로 채우지 말고 [ ] 로 표시`;

    const userPrompt = `다음 정보를 바탕으로 학교 공문 본문(제목~끝.)을 작성해 주세요:\n\n${inputJson}`;
    const options = { system, userPrompt, maxTokens: 2048 };
    if (provider === 'gemini') return await runGemini(apiKey, model, '', options);
    return await runClaude(apiKey, model, '', options);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('ai-assistant-chat', async (e, payload = {}) => {
  try {
    const apiKey = String(payload.apiKey || '');
    const provider = String(payload.provider || 'claude');
    const model = String(payload.model || '');
    const page = String(payload.page || '현재 페이지');
    const sensitive = !!payload.sensitive || isStudentSensitivePage(page);
    const question = sensitive ? anonymizeSensitiveText(payload.question || '') : String(payload.question || '');
    const context = sensitive ? anonymizeSensitiveText(payload.context || '') : String(payload.context || '');
    if (!apiKey || !question) return { error: 'AI 설정 또는 질문이 비어 있습니다.' };
    const directCounselingAnswer = buildCounselingFollowUpFromContext(context, question);
    if (directCounselingAnswer) return { result: directCounselingAnswer };
    const options = {
      system: [
        '당신은 교사 업무 관리 앱 안의 AI 도우미입니다.',
        '사용자는 교사이며, 학생 상담/공문/시간표/할일/학사 업무를 빠르게 처리하려고 합니다.',
        sensitive ? '입력 내용은 외부 전송 전 익명화되었습니다. 실제 이름, 번호, 연락처를 추정하거나 복원하지 마세요.' : '',
        '학생 상담과 개인정보는 매우 민감하므로 단정적 진단, 의료적 판단, 낙인 표현을 피하고 학교 절차와 교사의 최종 판단을 존중하세요.',
        '한국어로 짧고 실무적으로 답하세요.'
      ].filter(Boolean).join('\n'),
      userPrompt: `현재 페이지: ${page}\n\n${context ? `앱에 저장된 관련 맥락:\n${context}\n\n` : ''}사용자 질문:\n${question}`,
      maxTokens: 1200
    };
    if (provider === 'gemini') return await runGemini(apiKey, model || 'gemini-2.5-flash', '', options);
    return await runClaude(apiKey, model || 'claude-haiku-4-5', '', options);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('ai-local-chat', async (e, payload = {}) => {
  try {
    const engine = String(payload.engine || db.getSetting('ai_engine', 'local_lite'));
    const model = getOllamaModelForEngine(engine);
    const question = String(payload.question || '').trim();
    const context = String(payload.context || '').trim();
    const page = String(payload.page || '현재 페이지');
    if (!question) return { error: '질문이 비어 있습니다.' };
    const directCounselingAnswer = buildCounselingFollowUpFromContext(context, question);
    if (directCounselingAnswer) return { result: directCounselingAnswer };
    const status = await getOllamaStatus(engine);
    if (!status.ready) return { error: status.message || '로컬 AI가 아직 준비되지 않았습니다.' };
    const buildPrompt = (retryText = '') => [
        '당신은 교사 업무 관리 앱 안의 로컬 AI 도우미입니다.',
        '반드시 한국어로만 답하세요. 중국어, 일본어, 영어 문장을 섞지 마세요.',
        '학생을 부를 때는 "同学" 같은 중국어 표현을 절대 쓰지 말고 "학생" 또는 "해당 학생"이라고 쓰세요.',
        '학생 상담, 성적, 개인정보는 민감하므로 외부 전송 없이 로컬에서만 답합니다.',
        context ? '아래 앱 저장 기록을 최우선 근거로 사용하세요. 기록에 없는 사실은 만들지 마세요.' : '',
        '짧고 빠르게 답하세요. 기본 답변은 500자 이내로 제한합니다.',
        '의학적 진단, 낙인 표현, 단정적 판단을 피하고 교사가 활용할 수 있는 실무 문장으로 도와주세요.',
        `현재 페이지: ${page}`,
        '',
        context ? `앱에 저장된 관련 맥락:\n${context}\n` : '',
        retryText ? `이전 답변에 한국어가 아닌 문자가 섞였습니다. 아래 질문에 대해 다시 한국어로만 답하세요.\n${retryText}` : `사용자 질문: ${question}`
      ].join('\n');
    const runLocal = (prompt) => requestOllamaJson('/api/generate', {
      model,
      stream: false,
      prompt,
      options: {
        temperature: 0.2,
        num_predict: context ? 760 : 420
      }
    }, 120000);
    let result = await runLocal(buildPrompt());
    if (!result.ok) return { error: result.error || result.raw || 'Ollama 호출에 실패했습니다.' };
    let answer = result.data?.response || '';
    if (containsCjkChinese(answer)) {
      const retry = await runLocal(buildPrompt(`질문: ${question}\n\n금지: 중국어 한자 표현, 同学, 您, 请, 成绩报告 같은 중국어 표현`));
      if (retry.ok && retry.data?.response) answer = retry.data.response;
    }
    return { result: answer };
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
  if (options.document?.data) {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: options.document.data,
      },
    });
  }
  const body = JSON.stringify({
    model,
    max_tokens: options.maxTokens || 1024,
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

// ── 에듀파인 CDP 매크로 ───────────────────────────────────────────────────────
// Chrome / Edge 모두 지원 (Chromium 기반 공통 DevTools Protocol)

let _macroStopWsUrl = null;

// HTTP GET → JSON
function cdpHttpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(2500, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// WebSocket 클라이언트 프레임 인코딩 (마스킹 포함)
function wsEncode(text) {
  const payload = Buffer.from(text, 'utf8');
  const mask = crypto.randomBytes(4);
  const len = payload.length;
  const hdr = len <= 125
    ? [0x81, 0x80 | len, mask[0], mask[1], mask[2], mask[3]]
    : [0x81, 0xFE, (len >> 8) & 0xFF, len & 0xFF, mask[0], mask[1], mask[2], mask[3]];
  const header = Buffer.from(hdr);
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
  return Buffer.concat([header, masked]);
}

// WebSocket 서버 프레임 디코딩 (비마스킹)
function wsDecode(buf) {
  if (buf.length < 2) return null;
  let len = buf[1] & 0x7F;
  let off = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2); off = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2)); off = 10;
  }
  if (buf.length < off + len) return null;
  return { text: buf.slice(off, off + len).toString('utf8'), rest: buf.slice(off + len) };
}

// CDP Runtime.evaluate 실행
function cdpEval(wsUrl, expression, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.createConnection(parseInt(u.port) || 9222, u.hostname);
    let buf = Buffer.alloc(0);
    let upgraded = false;
    const timer = setTimeout(() => { sock.destroy(); reject(new Error('CDP 응답 시간 초과')); }, timeoutMs);

    sock.on('connect', () => {
      sock.write(
        `GET ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\n` +
        `Upgrade: websocket\r\nConnection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });

    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!upgraded) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx < 0) return;
        upgraded = true;
        buf = buf.slice(idx + 4);
        sock.write(wsEncode(JSON.stringify({
          id: 1, method: 'Runtime.evaluate',
          params: { expression, awaitPromise: true, returnByValue: true },
        })));
      }
      let parsed;
      while ((parsed = wsDecode(buf)) !== null) {
        buf = parsed.rest;
        try {
          const msg = JSON.parse(parsed.text);
          if (msg.id === 1) { clearTimeout(timer); sock.destroy(); resolve(msg.result || msg); return; }
        } catch (_) {}
      }
    });

    sock.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

// Chrome/Edge 실행 경로 탐색
function findBrowserPath() {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft\\Edge\\Application\\msedge.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe'),
  ].filter(Boolean);
  return candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

// ── IPC 핸들러 ────────────────────────────────────────────────────────────────

// 에듀파인 탭 감지
ipcMain.removeHandler('macro-cdp-check');
ipcMain.handle('macro-cdp-check', async () => {
  try {
    const tabs = await cdpHttpGet('http://localhost:9222/json/list');
    const eduTab = Array.isArray(tabs) ? tabs.find((t) =>
      (t.url || '').includes('klef.cbe.go.kr') ||
      (t.url || '').includes('keris_ui') ||
      (t.url || '').includes('edufine') ||
      (t.title || '').includes('에듀파인') ||
      (t.title || '').includes('케리스') ||
      (t.title || '').includes('품의')
    ) : null;
    return { connected: true, tabCount: tabs.length, eduTab: eduTab || null };
  } catch {
    return { connected: false };
  }
});

// 브라우저를 디버그 모드로 실행 (전용 프로필 — 로그인 유지됨)
ipcMain.removeHandler('macro-launch-debug-browser');
ipcMain.handle('macro-launch-debug-browser', () => {
  const browserPath = findBrowserPath();
  if (!browserPath) return { error: 'Chrome 또는 Edge를 찾을 수 없습니다.' };
  const profileDir = path.join(os.homedir(), 'EdufineMacroProfile');
  const child = spawn(browserPath, [
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-background-mode',
    'https://klef.cbe.go.kr/keris_ui/main.do',
  ], { detached: true, stdio: 'ignore' });
  child.unref();
  const name = browserPath.includes('msedge') ? 'Edge' : 'Chrome';
  return { ok: true, browser: name };
});

// 데스크탑 바로가기 생성 (다음부터 로그인 상태 유지)
ipcMain.removeHandler('macro-create-shortcut');
ipcMain.handle('macro-create-shortcut', () => {
  const browserPath = findBrowserPath();
  if (!browserPath) return { error: 'Chrome 또는 Edge를 찾을 수 없습니다.' };
  const profileDir = path.join(os.homedir(), 'EdufineMacroProfile');
  const browserName = browserPath.includes('msedge') ? 'Edge' : 'Chrome';
  const desktopPath = path.join(os.homedir(), 'Desktop');
  const shortcutPath = path.join(desktopPath, '에듀파인(품의서매크로).lnk');
  const psScript = `
$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$sc.TargetPath = '${browserPath.replace(/'/g, "''")}'
$sc.Arguments = '--remote-debugging-port=9222 --user-data-dir="${profileDir}" --no-first-run https://klef.cbe.go.kr/keris_ui/main.do'
$sc.Description = '에듀파인 품의서 매크로용 브라우저'
$sc.Save()
`;
  try {
    const tmpFile = path.join(os.tmpdir(), `shortcut_${Date.now()}.ps1`);
    fs.writeFileSync(tmpFile, '﻿' + psScript, 'utf8');
    execSync(`powershell -ExecutionPolicy Bypass -NonInteractive -File "${tmpFile}"`, { windowsHide: true });
    fs.unlinkSync(tmpFile);
    return { ok: true, browser: browserName, path: shortcutPath };
  } catch (err) {
    return { error: err.message };
  }
});

// 중지 신호 전달
ipcMain.removeHandler('macro-stop');
ipcMain.handle('macro-stop', async () => {
  if (_macroStopWsUrl) {
    try { await cdpEval(_macroStopWsUrl, 'window.__macroStop=true;', 3000); } catch (_) {}
  }
  return { ok: true };
});

// CDP로 에듀파인 자동 입력
// 에듀파인 페이지 구조 진단
ipcMain.removeHandler('macro-diagnose');
ipcMain.handle('macro-diagnose', async (e, wsUrl) => {
  const diagScript = `(function() {
    function collectDoc(doc, depth) {
      if (!doc || depth > 4) return {};
      try {
        const inputs = [...doc.querySelectorAll('input')].map(el => ({
          type: el.type, ro: el.readOnly, dis: el.disabled,
          cls: el.className.slice(0,30), vis: el.offsetParent !== null,
          w: Math.round(el.getBoundingClientRect().width)
        })).slice(0, 15);
        const ceds = [...doc.querySelectorAll('[contenteditable]')].map(el => ({
          tag: el.tagName, cls: el.className.slice(0,30),
          vis: el.offsetParent !== null,
          txt: (el.textContent||'').slice(0,20)
        })).slice(0, 10);
        const btns = [...doc.querySelectorAll('button,input[type=button],input[type=submit],a[href="#"],a[onclick],span[onclick],td[onclick],div[onclick]')]
          .filter(el => el.offsetParent !== null)
          .map(el => ({
            tag: el.tagName,
            txt: (el.textContent||el.value||el.title||'').replace(/\\s+/g,' ').trim().slice(0,25),
            cls: el.className.slice(0,20)
          }))
          .filter(x => x.txt).slice(0, 20);
        const frames = [...doc.querySelectorAll('iframe')].map((f,i) => {
          let sub = {};
          try { if (f.contentDocument) sub = collectDoc(f.contentDocument, depth+1); } catch(_) {}
          return { i, src: (f.src||'').slice(0,60), id: f.id, name: f.name, sub };
        });
        return { inputs, ceds, btns, frames, url: (doc.location||{}).href || '' };
      } catch(e) { return { err: e.message }; }
    }
    return JSON.stringify(collectDoc(document, 0));
  })()`;
  try {
    const result = await cdpEval(wsUrl, diagScript, 15000);
    const val = result && (result.value ?? (result.result && result.result.value));
    return val ? JSON.parse(val) : { error: '진단 실패' };
  } catch (e) { return { error: e.message }; }
});

ipcMain.removeHandler('macro-fill-edufine-cdp');
ipcMain.handle('macro-fill-edufine-cdp', async (e, { wsUrl, items }) => {
  _macroStopWsUrl = wsUrl;

  const expression = `(async function() {
  window.__macroStop = false;
  const _items = ${JSON.stringify(items)};
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 재귀적으로 모든 doc 수집 (iframe 안의 iframe까지)
  function getAllDocs(root, _seen) {
    const seen = _seen || new Set();
    if (!root || seen.has(root)) return [];
    seen.add(root);
    const result = [root];
    try {
      [...root.querySelectorAll('iframe,frame')].forEach(f => {
        try { if (f.contentDocument) result.push(...getAllDocs(f.contentDocument, seen)); } catch(_) {}
      });
    } catch(_) {}
    return result;
  }

  // 표준 input 셀 수집
  function visibleInputs() {
    const results = [];
    getAllDocs(document).forEach(doc => {
      doc.querySelectorAll(
        'input[type="text"]:not([readonly]):not([disabled]),' +
        'input:not([type]):not([readonly]):not([disabled]),' +
        'input[type="number"]:not([readonly]):not([disabled])'
      ).forEach(el => {
        try { const r = el.getBoundingClientRect(); if (r.width > 5 && r.height > 5) results.push(el); } catch(_) {}
      });
    });
    return results;
  }

  // contenteditable 셀 수집 (KERIS 그리드 방식)
  function visibleEditables() {
    const results = [];
    getAllDocs(document).forEach(doc => {
      doc.querySelectorAll('[contenteditable="true"],[contenteditable=""]').forEach(el => {
        try {
          const tag = el.tagName;
          if (tag === 'BODY' || tag === 'HTML') return;
          const r = el.getBoundingClientRect();
          if (r.width > 5 && r.height > 5) results.push(el);
        } catch(_) {}
      });
    });
    return results;
  }

  // input 또는 contenteditable에 값 설정
  function setVal(el, val) {
    if (!el) return;
    const sVal = String(val);
    try { el.focus(); el.click(); } catch(_) {}
    if (el.getAttribute && el.getAttribute('contenteditable') !== null) {
      // contenteditable 셀
      try { el.textContent = ''; } catch(_) {}
      try {
        el.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, sVal);
      } catch(_) { el.textContent = sVal; }
      ['input','change','keyup','blur'].forEach(t => {
        try { el.dispatchEvent(new Event(t, { bubbles: true })); } catch(_) {}
      });
    } else {
      // 일반 input
      try {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        if (s && s.set) s.set.call(el, sVal); else el.value = sVal;
      } catch { el.value = sVal; }
      ['input','change','keyup','blur'].forEach(t => {
        try { el.dispatchEvent(new Event(t, { bubbles: true })); } catch(_) {}
      });
    }
  }

  // 행추가 버튼 탐색 (전체 doc, 부분 텍스트 매칭)
  function findAddBtn() {
    for (const doc of getAllDocs(document)) {
      const all = [...doc.querySelectorAll('button,input[type=button],input[type=submit],a,span,td,div,li')];
      const match = all.find(el => {
        const t = (el.textContent || el.value || el.title || (el.getAttribute && el.getAttribute('aria-label')) || '').replace(/\\s/g,'');
        return t.includes('행추가') || t.includes('행 추가') || t === '추가' || t === '내역추가' || t.includes('내역추가');
      });
      if (match) return match;
    }
    return null;
  }

  // 버튼 클릭 (click + MouseEvent 병행)
  function clickBtn(btn) {
    try {
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));
      btn.click();
    } catch(_) {}
  }

  const addBtn = findAddBtn();
  if (!addBtn) {
    // 어떤 버튼/클릭 요소가 있는지 수집해 반환
    const found = [];
    getAllDocs(document).forEach(doc => {
      [...doc.querySelectorAll('button,input[type=button],a,span,td,div')]
        .filter(el => el.offsetParent !== null)
        .forEach(el => {
          const t = (el.textContent||el.value||'').replace(/\\s+/g,' ').trim().slice(0,20);
          if (t) found.push(t);
        });
    });
    return JSON.stringify({ error: '행추가 버튼 없음', buttons: [...new Set(found)].slice(0,15) });
  }

  for (let i = 0; i < _items.length; i++) {
    if (window.__macroStop) return JSON.stringify({ stopped: true, count: i });
    const item = _items[i];

    const beforeInputs  = new Set(visibleInputs());
    const beforeEditables = new Set(visibleEditables());

    clickBtn(addBtn);
    await sleep(1500);

    // 새로 생긴 input 탐색
    const afterInputs    = visibleInputs();
    const afterEditables = visibleEditables();
    const newInputs      = afterInputs.filter(el => !beforeInputs.has(el));
    const newEditables   = afterEditables.filter(el => !beforeEditables.has(el));

    let targets;
    if (newInputs.length >= 2) {
      targets = newInputs;
    } else if (newEditables.length >= 2) {
      targets = newEditables;
    } else if (afterInputs.length > 0) {
      // 행 추가 안 됐지만 기존 input 마지막 행 사용 (이미 비어 있는 경우)
      const empty = afterInputs.filter(el => !(el.value||'').trim());
      targets = empty.length >= 2 ? empty : afterInputs.slice(-6);
    } else if (afterEditables.length > 0) {
      const empty = afterEditables.filter(el => !(el.textContent||'').trim());
      targets = empty.length >= 2 ? empty : afterEditables.slice(-6);
    } else {
      return JSON.stringify({
        error: '행 ' + (i+1) + ': 입력 셀 없음',
        detail: 'input=' + afterInputs.length + ' editable=' + afterEditables.length
      });
    }

    if (item.name  != null && targets[0]) { setVal(targets[0], item.name);  await sleep(200); }
    if (item.spec  != null && targets[1]) { setVal(targets[1], item.spec);  await sleep(200); }
    if (item.qty   != null && targets[2]) { setVal(targets[2], item.qty);   await sleep(200); }
    // 단가는 4번째 또는 5번째 셀 (비고 칸이 있을 수 있음)
    const pi = targets.length >= 5 ? 4 : targets.length >= 4 ? 3 : targets.length - 1;
    if (item.price != null && pi >= 0 && targets[pi]) { setVal(targets[pi], item.price); await sleep(200); }

    await sleep(300);
  }
  return JSON.stringify({ done: true, count: _items.length });
})()`;

  try {
    const result = await cdpEval(wsUrl, expression, 180000);
    const val = result && (result.value ?? (result.result && result.result.value));
    if (!val) return { error: '응답 없음: ' + JSON.stringify(result) };
    try { return JSON.parse(val); } catch { return { error: val }; }
  } catch (err) {
    return { error: err.message };
  } finally {
    _macroStopWsUrl = null;
  }
});
