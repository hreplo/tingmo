import { app, BrowserWindow, ipcMain, session, Tray } from 'electron';
import { autoUpdater } from 'electron-updater';
import { join } from 'path';
import { createTray, updateTrayState, updateTrayLanguage } from './tray';
import { startHotkey, stopHotkey, setHotkeyCallback, setHotkeyReleaseCallback, setEscCallback, waitForHotkeyRelease } from './hotkey';
import { injectText } from './text-inserter';
import { ensureModel } from '../src/services/model-downloader';
import { duckSystemAudio, unduckSystemAudio } from './audio-ducking';
import { addRecordingStats, addHistoryEntry, loadStats, loadHistory, clearHistory, loadOverview } from './stats-history';

// Single instance lock — prevent double tray icon
let gotTheLock = false;
if (app) {
  gotTheLock = app.requestSingleInstanceLock();
}

if (!gotTheLock) {
  if (app) app.quit();
} else {
  app.on('second-instance', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      if (settingsWindow.isMinimized()) settingsWindow.restore();
      settingsWindow.show();
      settingsWindow.focus();
    } else {
      createSettingsWindow();
    }
  });
}

const koffi = require('koffi');

// Strip DWM shadow/border from transparent frameless window
function stripDwmFrame(win: BrowserWindow): void {
  try {
    const dwmapi = koffi.load('dwmapi.dll');
    const DwmSetWindowAttribute = dwmapi.func(
      'DwmSetWindowAttribute', 'int32', ['void*', 'uint32', 'void*', 'uint32'],
    );
    const hwnd = koffi.as(win.getNativeWindowHandle(), 'void*');

    // Disable non-client rendering (removes DWM border/shadow)
    const policy = Buffer.alloc(4);
    policy.writeInt32LE(2, 0); // DWMNCRP_DISABLED = 2 (was 1, try 2 for more aggressive)
    DwmSetWindowAttribute(hwnd, 2, koffi.as(policy, 'void*'), 4); // DWMWA_NCRENDERING_POLICY = 2
  } catch { /* ignore */ }
}

let floatingWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let downloadWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

type VoiceState = 'idle' | 'recording' | 'recognizing' | 'refining' | 'success' | 'error';

let currentState: VoiceState = 'idle';
let floatingReady = false;
let pendingState: VoiceState | null = null;
let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
let recordingStartedAt: number = 0;
let translateMode: boolean = false;
let translateModifierVK: number = 0xA1; // default: VK_RSHIFT
let recordMode: 'toggle' | 'hold' = 'toggle';

function getDataPath(filename: string): string {
  return join(app.getPath('userData'), 'data', filename);
}

function readJSON<T>(filepath: string, fallback: T): T {
  try {
    const fs = require('fs');
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return fallback;
}

function writeJSON(filepath: string, data: unknown): void {
  const fs = require('fs');
  const dir = join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function loadRecordMode(): 'toggle' | 'hold' {
  const settings = readJSON<any>(getDataPath('settings.json'), {});
  return settings.recordMode || 'toggle';
}

// Key name → VK code mapping for translate modifier
const MODIFIER_VK_MAP: Record<string, number> = {
  '右 Shift': 0xA1, 'Right Shift': 0xA1, '오른쪽 Shift': 0xA1,
  '右 Ctrl': 0xA3, 'Right Ctrl': 0xA3, '오른쪽 Ctrl': 0xA3,
  '左 Shift': 0xA0, 'Left Shift': 0xA0, '왼쪽 Shift': 0xA0,
  '左 Ctrl': 0xA2, 'Left Ctrl': 0xA2, '왼쪽 Ctrl': 0xA2,
  '右 Alt': 0xA5, 'Right Alt': 0xA5, '오른쪽 Alt': 0xA5,
  '左 Alt': 0xA4, 'Left Alt': 0xA4, '왼쪽 Alt': 0xA4,
};

function clearAutoDismiss(): void {
  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }
}

// Recognition provider — lazy init
let recognitionProvider: any = null;
let recognitionReady = false;

async function initRecognition(): Promise<void> {
  try {
    const fs = require('fs');

    // Read ASR provider preference from settings
    let provider: 'local' | 'cloud' = 'local';
    try {
      const settingsPath = join(app.getPath('userData'), 'data', 'llm-settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        provider = settings.asrProvider || 'local';
      }
    } catch { /* use default */ }

    if (provider === 'cloud') {
      const { FunASRCloudProvider } = require('../src/services/funasr-cloud');

      // Read API credentials for cloud ASR
      let apiKey = '';
      let baseUrl = 'https://api.openai.com/v1';
      let model = 'whisper-1';
      try {
        const settingsPath = join(app.getPath('userData'), 'data', 'llm-settings.json');
        if (fs.existsSync(settingsPath)) {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
          model = settings.cloudAsrModel || 'whisper-1';
          baseUrl = settings.llmBaseUrl || baseUrl;
        }
        const apiKeyPath = join(app.getPath('userData'), 'data', 'apikey.enc');
        if (fs.existsSync(apiKeyPath)) {
          try {
            const encrypted = fs.readFileSync(apiKeyPath);
            apiKey = require('electron').safeStorage.decryptString(encrypted);
          } catch { /* key not decryptable */ }
        }
      } catch { /* use defaults */ }

      recognitionProvider = new FunASRCloudProvider(apiKey, baseUrl, model);
      recognitionReady = await recognitionProvider.initialize();
      console.log('[Main] Recognition ready (cloud):', recognitionReady);
    } else {
      const { SherpaASRProvider } = require('../src/services/funasr-sherpa');

      // 1. Bundled model (resources/models) — installed with the app
      // 2. Downloaded model (userData/models/funasr) — fallback / dev
      let funasrDir: string;
      const bundledDir = join(process.resourcesPath || '', 'models');
      const bundledModel = join(bundledDir, 'model.int8.onnx');
      const userModelDir = join(app.getPath('userData'), 'models', 'funasr');
      const userModel = join(userModelDir, 'model.int8.onnx');

      if (fs.existsSync(bundledModel)) {
        funasrDir = bundledDir;
      } else if (fs.existsSync(userModel)) {
        funasrDir = userModelDir;
      } else {
        // Neither bundled nor previously downloaded — download now
        await downloadModel(join(app.getPath('userData'), 'models'));
        funasrDir = join(app.getPath('userData'), 'models', 'funasr');
      }

      console.log('[Main] Loading SenseVoice model via sherpa-onnx from:', funasrDir);
      recognitionProvider = new SherpaASRProvider(funasrDir);
      recognitionReady = await recognitionProvider.initialize();
      console.log('[Main] Recognition ready (local):', recognitionReady);
    }
  } catch (err: any) {
    console.error('[Main] Failed to init recognition:', err.message);
    recognitionReady = false;
  }
}

// LLM provider — used for both refinement and translation
let refinementProvider: any = null;
let refinementReady = false;

async function initRefinement(): Promise<void> {
  try {
    const { safeStorage } = require('electron');
    const fs = require('fs');
    const apiKeyPath = join(app.getPath('userData'), 'data', 'apikey.enc');

    let apiKey = '';
    if (fs.existsSync(apiKeyPath)) {
      try {
        const encrypted = fs.readFileSync(apiKeyPath);
        apiKey = safeStorage.decryptString(encrypted);
      } catch { /* key not decryptable */ }
    }

    const settingsPath = join(app.getPath('userData'), 'data', 'llm-settings.json');
    let model = 'gpt-4o-mini';
    let baseUrl = 'https://api.openai.com/v1';
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        model = settings.llmModel || model;
        baseUrl = settings.llmBaseUrl || baseUrl;
      } catch { /* ignore */ }
    }

    // Provider is created whenever an API key exists — refineEnabled only
    // controls whether auto-refinement runs; translation always uses this.
    if (apiKey) {
      const { OpenAIProvider } = require('../src/services/llm-openai');
      refinementProvider = new OpenAIProvider({ apiKey, model, baseUrl });
      refinementReady = true;
      console.log('[Main] LLM ready:', model);
    } else {
      refinementProvider = null;
      refinementReady = false;
    }
  } catch (err: any) {
    console.error('[Main] Failed to init LLM:', err.message);
    refinementProvider = null;
    refinementReady = false;
  }
}

// Dictionary fuzzy correction — edit-distance based, catches homophone errors
// Only replace when edit distance ≤ 1 for keys ≤3 chars, or ≤2 for longer keys
function applyDictionary(text: string, dictionary: Array<{word: string; replace: string}>): string {
  for (const entry of dictionary) {
    const word = entry.word;
    const replace = entry.replace;
    if (text.includes(word)) continue; // exact match, nothing to fix

    const maxDist = word.length <= 3 ? 1 : 2;
    const wlen = word.length;

    // Sliding window: check substrings of similar length
    for (let i = 0; i <= text.length; i++) {
      for (let len = Math.max(1, wlen - 1); len <= Math.min(wlen + 2, text.length - i); len++) {
        const sub = text.slice(i, i + len);
        const dist = levenshtein(sub, word);
        if (dist <= maxDist && dist < wlen * 0.6) {
          text = text.slice(0, i) + replace + text.slice(i + len);
          console.log('[Main] Dict corrected:', JSON.stringify(sub), '→', JSON.stringify(replace), '(dist=' + dist + ')');
          break; // stop scanning this entry after first correction
        }
      }
    }
  }
  return text;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array(n + 1).fill(0).map((_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

async function isNetworkAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2000);
    await fetch('https://api.openai.com/v1/models', { method: 'HEAD', signal: controller.signal });
    return true;
  } catch {
    return false;
  }
}

function createDownloadWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 360,
    height: 120,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    center: true,
    title: '',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.loadURL(`data:text/html,
    <html><body style="margin:0;font-family:-apple-system,Segoe UI,sans-serif;
    background:#fff;display:flex;align-items:center;justify-content:center;height:100vh;
    border:3px solid #000;">
    <div style="text-align:center">
    <p id="msg" style="font-size:14px;font-weight:700;color:#000;margin:0 0 8px">
    正在下载语音模型...</p>
    <div id="bar" style="width:280px;height:6px;background:#eee;margin:0 auto">
    <div id="fill" style="width:0%;height:100%;background:#000"></div></div></div>
    <script>
    try {
      window.tingmo && window.tingmo.onModelProgress(function(p) {
        var m=document.getElementById('msg');
        var f=document.getElementById('fill');
        if(!m||!f)return;
        m.textContent=p.stage==='downloading'?'下载模型 '+p.percent+'%':p.stage==='extracting'?'解压中...':'';
        f.style.width=p.percent+'%';
      });
    } catch(e) {}
    </script></body></html>`);
  return win;
}

async function downloadModel(modelDir: string): Promise<void> {
  downloadWindow = createDownloadWindow();
  downloadWindow.show();

  try {
    await ensureModel(modelDir, (p) => {
      if (downloadWindow && !downloadWindow.isDestroyed()) {
        downloadWindow.webContents.send('model:progress', p);
      }
      if (p.stage === 'done') {
        setTimeout(() => {
          if (downloadWindow && !downloadWindow.isDestroyed()) {
            downloadWindow.close();
            downloadWindow = null;
          }
        }, 600);
      }
      if (p.stage === 'error') {
        console.error('[Main] Model download error:', p.error);
        setTimeout(() => {
          if (downloadWindow && !downloadWindow.isDestroyed()) {
            downloadWindow.close();
            downloadWindow = null;
          }
        }, 2000);
      }
    });
  } catch (err: any) {
    console.error('[Main] Model download failed:', err.message);
    if (downloadWindow && !downloadWindow.isDestroyed()) {
      downloadWindow.close();
      downloadWindow = null;
    }
  }
}

function createFloatingWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 160,
    height: 44,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.setBackgroundColor('#00000000');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  stripDwmFrame(win);

  // Ensure web contents also has no background
  win.webContents.on('did-finish-load', () => {
    win?.webContents.insertCSS('html,body,#root{background:transparent !important}');
  });
  floatingReady = false;

  // Always position from screen geometry — never use cached floatingPosition,
  // and don't listen for moved events (DWM adjustments cause drift).
  positionOnActiveDisplay(win);

  win.webContents.on('did-finish-load', () => {
    floatingReady = true;
    if (pendingTranslateMode !== null) {
      win.webContents.send('voice:translate-mode', { enabled: pendingTranslateMode });
      pendingTranslateMode = null;
    }
    if (pendingState) {
      win.webContents.send('voice:state-change', { state: pendingState });
      pendingState = null;
    }
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'));
  }

  return win;
}

function getCursorDisplay(): Electron.Display {
  const { screen } = require('electron');
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

// Position the floating window centered just above the taskbar.
// Uses screen bounds (stable, never changes) minus workArea (to measure
// taskbar height).  setBounds is used instead of setPosition — it sets
// both position AND size atomically, preventing DWM from applying subtle
// size adjustments that shift the window.
function positionOnActiveDisplay(win: BrowserWindow): void {
  const d = getCursorDisplay();
  const bounds = d.bounds;
  const wa = d.workArea;
  const taskbarH = (bounds.y + bounds.height) - (wa.y + wa.height);
  const x = Math.round(bounds.x + (bounds.width - 160) / 2);
  const y = bounds.y + bounds.height - taskbarH - 44 - 6;
  win.setBounds({ x, y, width: 160, height: 44 });
}

function showFloatingWindow(): void {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    floatingWindow = createFloatingWindow();
  }
  positionOnActiveDisplay(floatingWindow);
  floatingWindow.showInactive();
  // Override any DWM async adjustment after show
  setImmediate(() => {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      positionOnActiveDisplay(floatingWindow);
    }
  });
}

function hideFloatingWindow(): void {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.hide();
  }
}

let pendingTranslateMode: boolean | null = null;

function sendToRenderer(channel: string, data?: unknown): void {
  if (!floatingWindow || floatingWindow.isDestroyed()) return;
  if (floatingReady) {
    floatingWindow.webContents.send(channel, data);
  } else if (channel === 'voice:state-change') {
    pendingState = (data as { state: VoiceState }).state;
  } else if (channel === 'voice:translate-mode') {
    pendingTranslateMode = (data as { enabled: boolean }).enabled;
  }
}

function setVoiceState(state: VoiceState): void {
  // Track recording start time for stats
  if (state === 'recording' && currentState !== 'recording') {
    recordingStartedAt = Date.now();
    duckSystemAudio().catch(e => console.error('[Main] duck error:', e));
  } else if (currentState === 'recording' && state !== 'recording') {
    unduckSystemAudio().catch(e => console.error('[Main] unduck error:', e));
  }

  currentState = state;
  sendToRenderer('voice:state-change', { state });

  switch (state) {
    case 'recording':
      updateTrayState(tray, 'recording');
      break;
    case 'recognizing':
      updateTrayState(tray, 'recognizing');
      break;
    default:
      updateTrayState(tray, 'default');
  }
}

function createSettingsWindow(showOnboarding = false): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 900,
    minHeight: 660,
    resizable: true,
    title: 'TINGMO · 设置',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const hash = showOnboarding ? '/onboarding' : '/settings';
  if (process.env.NODE_ENV === 'development') {
    settingsWindow.loadURL('http://localhost:5173/#' + hash);
  } else {
    settingsWindow.loadFile(join(__dirname, '../dist/index.html'), { hash });
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// ── Hotkey callbacks ──────────────────────────────────────

function handleHotkeyPress(): void {
  clearAutoDismiss();

  // Detect translate modifier key for translation mode
  const user32 = koffi.load('user32.dll');
  const GetAsyncKeyState = user32.func('GetAsyncKeyState', 'int16', ['int32']);
  const modifierDown = (GetAsyncKeyState(translateModifierVK) & 0x8000) !== 0;

  // Reset sticky translateMode when starting a new recording without modifier
  if (currentState === 'idle') {
    translateMode = modifierDown;
  }

  if (recordMode === 'hold') {
    // Hold mode: press to start recording, release to stop
    if (currentState === 'idle') {
      showFloatingWindow();
      if (translateMode) {
        sendToRenderer('voice:translate-mode', { enabled: true });
      }
      setVoiceState('recording');
    } else if (currentState === 'error' || currentState === 'success') {
      hideFloatingWindow();
      setVoiceState('idle');
      translateMode = false;
    }
    return;
  }

  // Toggle mode: each press toggles state
  switch (currentState) {
    case 'idle': {
      showFloatingWindow();
      // Send translate-mode BEFORE voice-state so the renderer knows
      // it's a translation recording before it starts capturing audio.
      if (translateMode) {
        sendToRenderer('voice:translate-mode', { enabled: true });
      }
      setVoiceState('recording');
      break;
    }
    case 'recording': {
      setVoiceState('recognizing');
      break;
    }
    case 'error':
    case 'success': {
      hideFloatingWindow();
      setVoiceState('idle');
      translateMode = false;
      break;
    }
  }
}

function handleHotkeyRelease(): void {
  if (recordMode === 'hold' && currentState === 'recording') {
    setVoiceState('recognizing');
  }
}

function handleEscPress(): void {
  if (currentState !== 'idle') {
    console.log('[Main] Esc pressed — cancelling');
    clearAutoDismiss();
    hideFloatingWindow();
    setVoiceState('idle');
    translateMode = false;
    sendToRenderer('voice:state-change', { state: 'idle' });
  }
}

setHotkeyCallback(() => handleHotkeyPress());
setHotkeyReleaseCallback(() => handleHotkeyRelease());
setEscCallback(() => handleEscPress());

// App Lifecycle
if (app) {
  app.whenReady().then(async () => {
  // Migrate data from old "tingmo" dir to "TingMo" (package.json name was lowercased)
  try {
    const fs = require('fs');
    const path = require('path');
    const oldDir = path.join(app.getPath('appData'), 'tingmo');
    const newDir = app.getPath('userData');
    if (oldDir !== newDir && fs.existsSync(oldDir) && !fs.existsSync(path.join(newDir, 'data'))) {
      console.log('[Main] Migrating data from', oldDir, 'to', newDir);
      fs.cpSync(oldDir, newDir, { recursive: true });
    }
  } catch { /* ignore */ }

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media';
  });

  ipcMain.handle('settings:open', () => {
    createSettingsWindow();
  });

  // ── App settings persistence ──────────────────────────
  ipcMain.handle('settings:load-app-settings', () => {
    return readJSON<any>(getDataPath('settings.json'), {});
  });

  ipcMain.handle('settings:save-app-settings', (_event, settings: Record<string, unknown>) => {
    try {
      const filepath = getDataPath('settings.json');
      const existing = readJSON<any>(filepath, {});
      Object.assign(existing, settings);
      writeJSON(filepath, existing);
      if (typeof settings.recordMode === 'string') {
        recordMode = (settings as any).recordMode;
      }
      if (typeof settings.launchAtStartup === 'boolean') {
        app.setLoginItemSettings({ openAtLogin: settings.launchAtStartup as boolean });
      }
    } catch (err: any) {
      console.error('[Main] Failed to save settings:', err.message);
    }
  });

  ipcMain.handle('stats:get', () => loadStats());
  ipcMain.handle('stats:overview', () => loadOverview());
  ipcMain.handle('history:get', () => loadHistory());
  ipcMain.handle('history:clear', () => { clearHistory(); });
  ipcMain.handle('settings:set-translate-modifier', (_event, keyName: string) => {
    translateModifierVK = MODIFIER_VK_MAP[keyName] ?? 0xA1;
    console.log('[Main] Translate modifier set to', keyName, 'VK =', translateModifierVK);
  });

  // System locale detection
  ipcMain.handle('settings:get-system-locale', () => {
    const locale = app.getLocale() || 'zh-CN';
    let lang: string;
    if (locale === 'zh-TW' || locale === 'zh-HK' || locale === 'zh-MO') lang = 'zh-TW';
    else if (locale.startsWith('zh')) lang = 'zh-CN';
    else if (locale.startsWith('ja')) lang = 'ja';
    else if (locale.startsWith('ko')) lang = 'ko';
    else lang = 'en';
    console.log('[Main] System locale:', locale, '→', lang);
    return lang;
  });

  ipcMain.handle('settings:set-ui-language', (_event, lang: string) => {
    updateTrayLanguage(tray, lang, createSettingsWindow);
  });

  // LLM / Refinement settings
  ipcMain.handle('settings:get-api-key', () => {
    try {
      const fs = require('fs');
      const { safeStorage } = require('electron');
      const apiKeyPath = join(app.getPath('userData'), 'data', 'apikey.enc');
      if (fs.existsSync(apiKeyPath)) {
        const encrypted = fs.readFileSync(apiKeyPath);
        return safeStorage.decryptString(encrypted);
      }
    } catch { /* ignore */ }
    return '';
  });

  ipcMain.handle('settings:set-api-key', (_event, key: string) => {
    try {
      const fs = require('fs');
      const { safeStorage } = require('electron');
      const dir = join(app.getPath('userData'), 'data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const encrypted = safeStorage.encryptString(key);
      fs.writeFileSync(join(dir, 'apikey.enc'), encrypted);
    } catch (err: any) {
      console.error('[Main] Failed to save API key:', err.message);
    }
  });

  ipcMain.handle('settings:save-llm-settings', (_event, settings: { refineEnabled?: boolean; llmModel?: string; llmBaseUrl?: string; asrProvider?: string }) => {
    try {
      const fs = require('fs');
      const dir = join(app.getPath('userData'), 'data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const settingsPath = join(dir, 'llm-settings.json');
      let existing: any = {};
      if (fs.existsSync(settingsPath)) {
        try { existing = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch { /* ignore */ }
      }
      Object.assign(existing, settings);
      fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2));
    } catch (err: any) {
      console.error('[Main] Failed to save LLM settings:', err.message);
    }
  });

  ipcMain.handle('settings:init-refinement', async () => {
    await initRefinement();
    return refinementReady;
  });

  ipcMain.handle('settings:refinement-status', () => {
    return { ready: refinementReady, provider: refinementProvider?.name || null };
  });

  ipcMain.handle('voice:finish-recording', () => {
    if (currentState === 'recording') {
      setVoiceState('recognizing');
    }
  });

  ipcMain.handle('voice:cancel-recording', () => {
    hideFloatingWindow();
    setVoiceState('idle');
    translateMode = false;
  });

  ipcMain.handle('voice:capture-error', (_event, message: string) => {
    console.error('[Main] Audio capture error:', message);
    setVoiceState('idle');
  });

  // Audio transcription from renderer
  ipcMain.handle('voice:transcribe', async (_event, audioBuffer: ArrayBuffer, language?: string, options?: {
    translate?: boolean; translateTarget?: string; dictionary?: Array<{word: string; replace: string}>;
    polishMode?: string; customPrompt?: string;
  }) => {
    try {
      console.log('[Main] Transcribe: buffer =', audioBuffer.byteLength, 'bytes, lang =', language);
      const buf = Buffer.from(audioBuffer);
      let text: string;

      // Start key-release wait now — runs in parallel with ASR
      const releasePromise = waitForHotkeyRelease(150);

      // Debug WAV save — non-blocking, off the critical path
      setImmediate(() => {
        try {
          const fs = require('fs');
          const debugDir = join(process.env.APPDATA || '', 'TingMo', 'debug_recordings');
          if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
          fs.writeFileSync(join(debugDir, `tingmo_${Date.now()}.wav`), buf);
        } catch { /* ignore */ }
      });

      if (recognitionReady && recognitionProvider) {
        console.log('[Main] Running ASR...');
        const result = await recognitionProvider.transcribe(buf, 16000, language);
        text = result.text;
        console.log('[Main] ASR result:', text);

        // Filter silence hallucinations — SenseVoice outputs spurious words for near-silent input
        const stripped = text.replace(/[，。？、！，,.\s　]/g, '').trim();
        const HALLUCINATIONS = new Set([
          'yeah', 'yeah.', 'yeah。', 'Yeah', 'Yeah.',
          'um', 'Um', 'uh', 'Uh', 'hmm', 'Hmm',
          '嗯', '嗯。', '啊', '啊。', '哦', '哦。',
          '.', '。', '...', '……',
        ]);
        if (stripped.length < 2 || HALLUCINATIONS.has(text.trim())) {
          console.log('[Main] Silence hallucination filtered:', text);
          setVoiceState('idle');
          hideFloatingWindow();
          translateMode = false;
          return;
        }
      } else {
        throw new Error('ASR model not loaded. Please check model files or switch to cloud ASR.');
      }

      // Dictionary fuzzy correction — always runs, offline or online
      if (options?.dictionary && options.dictionary.length > 0 && text.length > 0) {
        text = applyDictionary(text, options.dictionary);
        console.log('[Main] After dictionary:', text.slice(0, 80));
      }

      // Check if auto-refinement is enabled in settings
      let refineEnabled = false;
      try {
        const fs = require('fs');
        const settingsPath = join(app.getPath('userData'), 'data', 'llm-settings.json');
        if (fs.existsSync(settingsPath)) {
          refineEnabled = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')).refineEnabled ?? false;
        }
      } catch { /* use default */ }

      // LLM Refinement — only if enabled AND not translating
      let originalText = text;
      if (refineEnabled && refinementReady && refinementProvider && text.trim().length > 0 && !options?.translate) {
        const online = await isNetworkAvailable();
        if (online) {
          try {
            setVoiceState('refining');
            const result = await refinementProvider.refine(text, {
              language,
              dictionary: options?.dictionary ?? [],
              polishMode: (options as any)?.polishMode || 'structured',
              customPrompt: (options as any)?.customPrompt || '',
            });
            text = result.refinedText;
            console.log('[Main] Refined:', text.slice(0, 80));
          } catch (err: any) {
            console.error('[Main] Refine failed, using raw ASR:', err.message);
            sendToRenderer('voice:refine-failed', { error: err.message });
          }
        } else {
          console.log('[Main] Offline — skipping refinement');
        }
      }

      // LLM Translation — uses same provider as refinement, different prompt
      if (options?.translate && text.trim()) {
        const target = options.translateTarget || 'en';
        console.log('[Main] Translating to', target, ':', text.slice(0, 40));
        if (refinementReady && refinementProvider) {
          const online = await isNetworkAvailable();
          if (online) {
            try {
              setVoiceState('refining');
              const result = await refinementProvider.translate(text, target, {
                language,
                dictionary: options?.dictionary ?? [],
              });
              text = result.refinedText;
              console.log('[Main] Translated:', text.slice(0, 80));
            } catch (err: any) {
              console.error('[Main] Translation failed:', err.message);
              text = `[${target.toUpperCase()}] ${text}`;
            }
          } else {
            console.log('[Main] Offline — translation skipped');
            text = `[${target.toUpperCase()}] ${text}`;
          }
        } else {
          console.log('[Main] No LLM provider — prepending language tag');
          text = `[${target.toUpperCase()}] ${text}`;
        }
      }

      console.log('[Main] Injecting text:', text.slice(0, 40));
      await releasePromise;

      const injectResult = await injectText(text);
      const durationMs = Date.now() - recordingStartedAt;
      addRecordingStats(durationMs, text.length);
      addHistoryEntry(text, text.length, originalText, refinementProvider?.name || null);

      setVoiceState('success');
      sendToRenderer('voice:recognition-done', { charCount: injectResult.charCount, durationMs: injectResult.durationMs });
    } catch (err: any) {
      console.error('[Main] Transcription error:', err.message);
      setVoiceState('idle');
    }
  });


  // DEBUG: save WAV for testing
  ipcMain.handle('debug:save-wav', async (_event, buffer: ArrayBuffer, filename: string) => {
    try {
      const fs = require('fs');
      const dir = join(app.getPath('userData'), 'debug_recordings');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(join(dir, filename), Buffer.from(buffer));
      console.log('[Debug] Saved:', join(dir, filename), 'size:', buffer.byteLength);
    } catch (err: any) {
      console.error('[Debug] Save failed:', err.message);
    }
  });

  ipcMain.handle('voice:copy-text', async (_event, text: string) => {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
  });

  // ── Auto-update ─────────────────────────────────────
  if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'development') {
    autoUpdater.logger = console;
    autoUpdater.autoDownload = false;

    autoUpdater.on('update-available', (info) => {
      console.log('[Updater] Update available:', info.version);
      if (floatingWindow && !floatingWindow.isDestroyed()) {
        floatingWindow.webContents.send('update:available', { version: info.version });
      }
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('update:available', { version: info.version });
      }
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[Updater] No update available');
    });

    autoUpdater.on('download-progress', (progress) => {
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('update:progress', { percent: progress.percent });
      }
    });

    autoUpdater.on('update-downloaded', () => {
      console.log('[Updater] Update downloaded');
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('update:downloaded', {});
      }
    });

    autoUpdater.on('error', (err) => {
      console.error('[Updater] Error:', err.message);
    });

    ipcMain.handle('update:check', async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        return { updateAvailable: !!result?.updateInfo, version: result?.updateInfo?.version || null };
      } catch (err: any) {
        return { updateAvailable: false, version: null, error: err.message };
      }
    });

    ipcMain.handle('update:download', async () => {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('update:install', () => {
      autoUpdater.quitAndInstall();
    });

    // Check for updates 5s after startup (non-blocking)
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.log('[Updater] Initial check failed:', err.message);
      });
    }, 5000);
  }

  // Init recognition in background
  initRecognition();

  // Load record mode from persisted settings
  recordMode = loadRecordMode();

  const initLocale = app.getLocale()?.startsWith('zh') ? 'zh-CN' : 'en';
  tray = createTray(initLocale, createSettingsWindow, recordMode, (mode) => {
    recordMode = mode;
    const filepath = getDataPath('settings.json');
    const existing = readJSON<any>(filepath, {});
    existing.recordMode = mode;
    writeJSON(filepath, existing);
  }, true, (enabled) => {
    // Mute on record toggle — persist and notify renderer
    const filepath = getDataPath('settings.json');
    const existing = readJSON<any>(filepath, {});
    existing.muteOnRecord = enabled;
    writeJSON(filepath, existing);
    sendToRenderer('settings:changed', { muteOnRecord: enabled });
  });
  startHotkey();

  // Show onboarding on first launch
  const settingsPath = getDataPath('settings.json');
  if (!require('fs').existsSync(settingsPath)) {
    createSettingsWindow(true);
  }
});

if (app) {
  app.on('window-all-closed', () => {
    // Don't quit — stays in tray
  });

  app.on('before-quit', () => {
    stopHotkey();
  });

  app.on('activate', () => {
    // On tray click
  });
}

} // end if (app) main process guard
