import { app, BrowserWindow, ipcMain, session, Tray } from 'electron';
import { join } from 'path';
import { createTray, updateTrayState, updateTrayLanguage } from './tray';
import { startHotkey, stopHotkey, setHotkeyCallback, waitForHotkeyRelease } from './hotkey';
import { injectText } from './text-inserter';
import { ensureModel } from '../src/services/model-downloader';
import { duckSystemAudio, unduckSystemAudio } from './audio-ducking';
import { addRecordingStats, addHistoryEntry, loadStats, loadHistory, clearHistory } from './stats-history';

// Single instance lock — prevent double tray icon
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // User tried to launch a second instance — show the existing window
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
  const dwmapi = koffi.load('dwmapi.dll');
  const DwmSetWindowAttribute = dwmapi.func(
    'DwmSetWindowAttribute', 'int32', ['void*', 'uint32', 'void*', 'uint32'],
  );
  const hwnd = koffi.as(win.getNativeWindowHandle(), 'void*');
  const policy = Buffer.alloc(4);
  policy.writeInt32LE(1, 0); // DWMNCRP_DISABLED = 1
  DwmSetWindowAttribute(hwnd, 2, koffi.as(policy, 'void*'), 4); // DWMWA_NCRENDERING_POLICY = 2
}

let floatingWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let downloadWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

type VoiceState = 'idle' | 'recording' | 'recognizing' | 'refining' | 'success' | 'error';

let currentState: VoiceState = 'idle';
let floatingPosition: { x: number; y: number } | null = null;
let floatingReady = false;
let pendingState: VoiceState | null = null;
let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
let recordingStartedAt: number = 0;
let translateMode: boolean = false;
let translateModifierVK: number = 0xA1; // default: VK_RSHIFT
let recordingHotkeyVK: number = 0xA5; // default: VK_RMENU (右 Alt)

// Key name → VK code mapping
const VK_NAME_MAP: Record<string, number> = {
  '右 Shift': 0xA1, 'Right Shift': 0xA1,
  '右 Ctrl': 0xA3, 'Right Ctrl': 0xA3,
  '左 Shift': 0xA0, 'Left Shift': 0xA0,
  '左 Ctrl': 0xA2, 'Left Ctrl': 0xA2,
  '右 Alt': 0xA5, 'Right Alt': 0xA5,
  '左 Alt': 0xA4, 'Left Alt': 0xA4,
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
      // Read cloud ASR endpoint from settings
      let asrEndpoint = 'http://localhost:10095';
      let asrApiKey = '';
      try {
        const p = join(app.getPath('userData'), 'data', 'settings.json');
        if (fs.existsSync(p)) {
          const s = JSON.parse(fs.readFileSync(p, 'utf-8'));
          asrEndpoint = s.asrEndpoint || asrEndpoint;
          asrApiKey = s.asrApiKey || '';
        }
      } catch { /* use default */ }
      recognitionProvider = new FunASRCloudProvider({ endpoint: asrEndpoint, apiKey: asrApiKey });
      recognitionReady = await recognitionProvider.initialize();
      console.log('[Main] Recognition ready (cloud):', recognitionReady);
    } else {
      const { FunASRORTProvider } = require('../src/services/funasr-ort');

      const modelDir = join(app.getPath('userData'), 'models');
      const funasrDir = join(modelDir, 'funasr');
      const modelPath = join(funasrDir, 'paraformer-large-int8.onnx');

      // Download model on first launch if missing
      if (!fs.existsSync(modelPath)) {
        await downloadModel(modelDir);
      }

      console.log('[Main] Loading Paraformer model from:', modelPath);
      recognitionProvider = new FunASRORTProvider(funasrDir);
      recognitionReady = await recognitionProvider.initialize();
      console.log('[Main] Recognition ready (local):', recognitionReady);
    }
  } catch (err: any) {
    console.error('[Main] Failed to init recognition:', err.message);
    recognitionReady = false;
  }
}

// Refinement provider (LLM) — lazy init
let refinementProvider: any = null;
let refinementReady = false;

async function initRefinement(): Promise<void> {
  try {
    const { safeStorage } = require('electron');
    const fs = require('fs');
    const apiKeyPath = join(app.getPath('userData'), 'data', 'apikey.enc');

    // Read encrypted API key
    let apiKey = '';
    if (fs.existsSync(apiKeyPath)) {
      try {
        const encrypted = fs.readFileSync(apiKeyPath);
        apiKey = safeStorage.decryptString(encrypted);
      } catch { /* key not decryptable */ }
    }

    // Read settings for model/baseUrl
    const settingsPath = join(app.getPath('userData'), 'data', 'llm-settings.json');
    let model = 'gpt-4o-mini';
    let baseUrl = 'https://api.openai.com/v1';
    let refineEnabled = false;
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        model = settings.llmModel || model;
        baseUrl = settings.llmBaseUrl || baseUrl;
        refineEnabled = settings.refineEnabled ?? false;
      } catch { /* ignore */ }
    }

    if (apiKey && refineEnabled) {
      const { OpenAIProvider } = require('../src/services/llm-openai');
      refinementProvider = new OpenAIProvider({ apiKey, model, baseUrl });
      refinementReady = true;
      console.log('[Main] Refinement ready:', model);
    } else {
      refinementProvider = null;
      refinementReady = false;
      console.log('[Main] Refinement disabled (no API key or turned off)');
    }
  } catch (err: any) {
    console.error('[Main] Failed to init refinement:', err.message);
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
    window.tingmo.onModelProgress(function(p) {
      document.getElementById('msg').textContent =
        p.stage==='downloading'?'下载模型 '+p.percent+'%':
        p.stage==='extracting'?'解压中...':'';
      document.getElementById('fill').style.width=p.percent+'%';
    });
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
    width: 140,
    height: 48,
    transparent: true,
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

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  stripDwmFrame(win);
  floatingReady = false;

  if (floatingPosition) {
    win.setPosition(floatingPosition.x, floatingPosition.y);
  } else {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    win.setPosition(Math.round((width - 140) / 2), height - 56);
  }

  win.on('moved', () => {
    const [x, y] = win.getPosition();
    floatingPosition = { x, y };
  });

  win.webContents.on('did-finish-load', () => {
    floatingReady = true;
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

function showFloatingWindow(): void {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    floatingWindow = createFloatingWindow();
  }
  floatingWindow.showInactive();
}

function hideFloatingWindow(): void {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.hide();
  }
}

function sendToRenderer(channel: string, data?: unknown): void {
  if (!floatingWindow || floatingWindow.isDestroyed()) return;
  if (floatingReady) {
    floatingWindow.webContents.send(channel, data);
  } else if (channel === 'voice:state-change') {
    pendingState = (data as { state: VoiceState }).state;
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

function createSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 900,
    minHeight: 600,
    resizable: true,
    title: 'TINGMO · 设置',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    settingsWindow.loadURL('http://localhost:5173/#/settings');
  } else {
    settingsWindow.loadFile(join(__dirname, '../dist/index.html'), { hash: '/settings' });
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// ── Hotkey callback ──────────────────────────────────────────
setHotkeyCallback(async (pressed: boolean) => {
  if (!pressed) return;

  clearAutoDismiss();

  // Detect translate modifier key for translation mode
  const user32 = koffi.load('user32.dll');
  const GetAsyncKeyState = user32.func('GetAsyncKeyState', 'int16', ['int32']);
  const modifierDown = (GetAsyncKeyState(translateModifierVK) & 0x8000) !== 0;
  if (modifierDown && currentState === 'idle') {
    translateMode = true;
  }

  switch (currentState) {
    case 'idle': {
      showFloatingWindow();
      setVoiceState('recording');
      // Send translate mode to renderer
      if (translateMode) {
        sendToRenderer('voice:translate-mode', { enabled: true });
      }
      break;
    }
    case 'recording': {
      setVoiceState('recognizing');
      break;
    }
    case 'error':
    case 'success': {
      // Dismiss floating window, go back to idle
      hideFloatingWindow();
      setVoiceState('idle');
      translateMode = false;
      break;
    }
  }
});

// ── App Lifecycle ────────────────────────────────────────────
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media';
  });

  ipcMain.handle('settings:open', () => {
    createSettingsWindow();
  });

  ipcMain.handle('stats:get', () => loadStats());
  ipcMain.handle('history:get', () => loadHistory());
  ipcMain.handle('history:clear', () => { clearHistory(); });
  ipcMain.handle('settings:set-translate-modifier', (_event, keyName: string) => {
    translateModifierVK = VK_NAME_MAP[keyName] ?? 0xA1;
    console.log('[Main] Translate modifier set to', keyName, 'VK =', translateModifierVK);
  });

  ipcMain.handle('settings:set-hotkey', (_event, hotkeyName: string) => {
    const vk = VK_NAME_MAP[hotkeyName];
    if (vk && vk !== recordingHotkeyVK) {
      recordingHotkeyVK = vk;
      console.log('[Main] Recording hotkey changed to', hotkeyName, 'VK =', vk);
      stopHotkey();
      startHotkey(vk);
    }
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

  // Settings persistence — unified settings.json in userData
  const SETTINGS_PATH = join(app.getPath('userData'), 'data', 'settings.json');

  ipcMain.handle('settings:load-all', () => {
    try {
      const fs = require('fs');
      if (fs.existsSync(SETTINGS_PATH)) {
        return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      }
    } catch { /* file doesn't exist yet */ }
    return null;
  });

  ipcMain.handle('settings:save-all', (_event, settings: Record<string, unknown>) => {
    try {
      const fs = require('fs');
      const dir = join(app.getPath('userData'), 'data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('[Main] Failed to save settings:', err.message);
    }
  });

  ipcMain.handle('voice:finish-recording', () => {
    if (currentState === 'recording') {
      setVoiceState('recognizing');
    }
  });

  ipcMain.handle('voice:cancel-recording', () => {
    hideFloatingWindow();
    setVoiceState('idle');
  });

  ipcMain.handle('voice:capture-error', (_event, message: string) => {
    console.error('[Main] Audio capture error:', message);
    setVoiceState('error');
    sendToRenderer('voice:inject-failed', { text: message });
  });

  // Audio transcription from renderer
  ipcMain.handle('voice:transcribe', async (_event, audioBuffer: ArrayBuffer, language?: string, options?: {
    translate?: boolean; translateTarget?: string; dictionary?: Array<{word: string; replace: string}>;
  }) => {
    try {
      console.log('[Main] Transcribe: buffer =', audioBuffer.byteLength, 'bytes, lang =', language);
      const buf = Buffer.from(audioBuffer);
      let text: string;

      if (recognitionReady && recognitionProvider) {
        console.log('[Main] Running Paraformer...');
        const result = await recognitionProvider.transcribe(buf, 16000, language);
        text = result.text;
        console.log('[Main] Paraformer result:', text);
      } else {
        // Fallback to mock if model not ready
        console.log('[Main] Using mock (model not ready)');
        await new Promise(r => setTimeout(r, 300));
        text = '这是一段测试文本，通过听墨语音输入法识别。';
      }

      // Dictionary fuzzy correction — always runs, offline or online
      if (options?.dictionary && options.dictionary.length > 0 && text.length > 0) {
        text = applyDictionary(text, options.dictionary);
        console.log('[Main] After dictionary:', text.slice(0, 80));
      }

      // LLM Refinement — remove filler words, auto-structure, dictionary-aware
      let originalText = text;
      if (refinementReady && refinementProvider && text.trim().length > 0 && !options?.translate) {
        const online = await isNetworkAvailable();
        if (online) {
          try {
            setVoiceState('refining');
            const result = await refinementProvider.refine(text, {
              language,
              dictionary: options?.dictionary ?? [],
            });
            text = result.refinedText;
            console.log('[Main] Refined:', text.slice(0, 80));
          } catch (err: any) {
            console.error('[Main] Refine failed, using raw ASR:', err.message);
          }
        } else {
          console.log('[Main] Offline — skipping refinement');
        }
      }

      // LLM Translation
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
          text = `[${target.toUpperCase()}] ${text}`;
        }
      }

      console.log('[Main] Injecting text:', text.slice(0, 40));
      await waitForHotkeyRelease();
      const injectResult = await injectText(text);
      if (injectResult.success) {
        const durationMs = Date.now() - recordingStartedAt;
        addRecordingStats(durationMs, text.length);
        addHistoryEntry(text, text.length, originalText, refinementProvider?.name || null);
        setVoiceState('success');
        sendToRenderer('voice:recognition-done', {
          charCount: injectResult.charCount,
          durationMs: injectResult.durationMs,
        });
        autoDismissTimer = setTimeout(() => {
          hideFloatingWindow();
          setVoiceState('idle');
        }, 1500);
      } else {
        setVoiceState('error');
        sendToRenderer('voice:inject-failed', { text });
      }
    } catch (err: any) {
      console.error('[Main] Transcription error:', err.message);
      setVoiceState('error');
      autoDismissTimer = setTimeout(() => {
        hideFloatingWindow();
        setVoiceState('idle');
      }, 2000);
    }
  });

  ipcMain.handle('voice:retry-inject', async (_event, text: string) => {
    const result = await injectText(text);
    if (result.success) {
      setVoiceState('success');
      sendToRenderer('voice:recognition-done', {
        charCount: result.charCount,
        durationMs: result.durationMs,
      });
      autoDismissTimer = setTimeout(() => {
        hideFloatingWindow();
        setVoiceState('idle');
      }, 1500);
    }
    return result;
  });

  ipcMain.handle('voice:copy-text', async (_event, text: string) => {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
  });

  // Init recognition in background
  initRecognition();

  const initLocale = app.getLocale()?.startsWith('zh') ? 'zh-CN' : 'en';
  tray = createTray(initLocale, createSettingsWindow, () => {
    recognitionReady = false;
    recognitionProvider = null;
    initRecognition();
  });
  // Read recording hotkey from settings, default to Right Alt
  try {
    const fs = require('fs');
    const settingsPath = join(app.getPath('userData'), 'data', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (s.hotkey) {
        recordingHotkeyVK = VK_NAME_MAP[s.hotkey] ?? 0xA5;
      }
    }
  } catch { /* use default */ }
  startHotkey(recordingHotkeyVK);

  // Show settings on first launch so user knows the app started
  createSettingsWindow();
});

app.on('window-all-closed', () => {
  // Don't quit — stays in tray
});

app.on('before-quit', () => {
  stopHotkey();
});

app.on('activate', () => {
  // On tray click
});
