/// <reference types="vite/client" />

export {};

interface TingMoAPI {
  onVoiceStateChange: (cb: (data: { state: string }) => void) => () => void;
  onAudioLevel: (cb: (level: number) => void) => () => void;
  onRecognitionDone: (cb: (data: { charCount: number; durationMs: number }) => void) => () => void;
  onInjectFailed: (cb: (data: { text: string }) => void) => () => void;
  openSettings: () => Promise<void>;
  finishRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  reportCaptureError: (message: string) => Promise<void>;
  retryInject: (text: string) => Promise<{ success: boolean }>;
  copyText: (text: string) => Promise<void>;
  transcribe: (audioBuffer: ArrayBuffer, language?: string, opts?: {
    translate?: boolean; translateTarget?: string; dictionary?: Array<{word: string; replace: string}>;
  }) => Promise<void>;
  onTranslateMode: (cb: (data: { enabled: boolean }) => void) => () => void;
  setTranslateModifier: (keyName: string) => Promise<void>;
  setRecordingHotkey: (keyName: string) => Promise<void>;
  getStats: () => Promise<{ totalDurationMs: number; totalCharCount: number; totalSessions: number }>;
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
  // Settings persistence
  loadAllSettings: () => Promise<Record<string, unknown> | null>;
  saveAllSettings: (settings: Record<string, unknown>) => Promise<void>;
}

declare global {
  interface Window {
    tingmo: TingMoAPI;
  }
}
