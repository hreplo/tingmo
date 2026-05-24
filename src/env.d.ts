/// <reference types="vite/client" />

export {};

interface TingMoAPI {
  onVoiceStateChange: (cb: (data: { state: string }) => void) => () => void;
  onAudioLevel: (cb: (level: number) => void) => () => void;
  onRecognitionDone: (cb: (data: { charCount: number; durationMs: number }) => void) => () => void;
  openSettings: () => Promise<void>;
  finishRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  reportCaptureError: (message: string) => Promise<void>;
  copyText: (text: string) => Promise<void>;
  transcribe: (audioBuffer: ArrayBuffer, language?: string, opts?: {
    translate?: boolean; translateTarget?: string; dictionary?: Array<{word: string; replace: string}>;
    polishMode?: string; customPrompt?: string;
  }) => Promise<void>;
  onTranslateMode: (cb: (data: { enabled: boolean }) => void) => () => void;
  onRefineFailed: (cb: (data: { error: string }) => void) => () => void;
  setTranslateModifier: (keyName: string) => Promise<void>;
  setRecordingHotkey: (keyName: string) => Promise<void>;
  getStats: () => Promise<{ totalDurationMs: number; totalCharCount: number; totalSessions: number }>;
  getOverview: () => Promise<{ totalDurationMs: number; totalCharCount: number; totalSessions: number; todayDurationMs: number; todayCharCount: number; todaySessions: number; recentDays: Array<{ date: string; durationMs: number; charCount: number }> }>;
  getHistory: () => Promise<Array<{ id: string; text: string; charCount: number; timestamp: number }>>;
  clearHistory: () => Promise<void>;
  // LLM / Refinement
  getApiKey: () => Promise<string>;
  setApiKey: (key: string) => Promise<void>;
  saveLlmSettings: (settings: { refineEnabled?: boolean; llmModel?: string; llmBaseUrl?: string; asrProvider?: string }) => Promise<void>;
  initRefinement: () => Promise<boolean>;
  getRefinementStatus: () => Promise<{ ready: boolean; provider: string | null }>;
  getSystemLocale: () => Promise<string>;
  setUiLanguage: (lang: string) => Promise<void>;
  // App settings persistence
  loadAppSettings: () => Promise<Record<string, unknown>>;
  saveAppSettings: (settings: Record<string, unknown>) => Promise<void>;
  onSettingsChanged: (cb: (data: { muteOnRecord?: boolean; recordMode?: string }) => void) => () => void;

  // Auto-update
  onUpdateAvailable: (cb: (data: { version: string }) => void) => () => void;
  onUpdateProgress: (cb: (data: { percent: number }) => void) => () => void;
  onUpdateDownloaded: (cb: () => void) => () => void;
  checkForUpdates: () => Promise<{ updateAvailable: boolean; version: string | null; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<void>;
}

declare global {
  interface Window {
    tingmo: TingMoAPI;
  }
}
