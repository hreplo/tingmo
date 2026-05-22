import { create } from 'zustand';

export type ASRProvider = 'local' | 'cloud';
export type RecordMode = 'toggle' | 'hold';
export type Language = 'zh' | 'en';
export type TranslateLang = 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es';
export type UILanguage = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko';

export interface DictEntry {
  word: string;
  replace: string;
}

export interface SettingsState {
  asrProvider: ASRProvider;
  recordMode: RecordMode;
  language: Language;
  hotkey: string;
  translateHotkey: string;
  launchAtStartup: boolean;
  muteOnRecord: boolean;
  useDictionary: boolean;
  translateTarget: TranslateLang;
  dictionary: DictEntry[];
  refineEnabled: boolean;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl: string;
  uiLanguage: UILanguage;
  _hydrated: boolean;

  setAsrProvider: (p: ASRProvider) => void;
  setRecordMode: (mode: RecordMode) => void;
  setLanguage: (lang: Language) => void;
  setHotkey: (key: string) => void;
  setTranslateHotkey: (key: string) => void;
  setLaunchAtStartup: (enabled: boolean) => void;
  setMuteOnRecord: (enabled: boolean) => void;
  setUseDictionary: (enabled: boolean) => void;
  setTranslateTarget: (lang: TranslateLang) => void;
  addDictEntry: (entry: DictEntry) => void;
  removeDictEntry: (index: number) => void;
  resetHotkey: () => void;
  resetTranslateHotkey: () => void;
  setRefineEnabled: (enabled: boolean) => void;
  setLlmApiKey: (key: string) => void;
  setLlmModel: (model: string) => void;
  setLlmBaseUrl: (url: string) => void;
  setUiLanguage: (lang: UILanguage) => void;
  hydrate: () => Promise<void>;
}

const DEFAULT_HOTKEY = '右 Alt';
const DEFAULT_TRANSLATE_HOTKEY = '右 Alt + 右 Shift';

type PersistedSettings = Omit<SettingsState, 'llmApiKey' | '_hydrated' | keyof SettingsState extends infer K ? K extends `${infer _}` ? never : K : never>;

function getPersistable(state: SettingsState): PersistedSettings {
  const { llmApiKey: _, _hydrated: __, ...rest } = state as any;
  // Strip setter functions and hydrate
  const result: any = {};
  for (const [k, v] of Object.entries(rest)) {
    if (typeof v !== 'function' && k !== 'hydrate') result[k] = v;
  }
  return result as PersistedSettings;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useSettingsStore = create<SettingsState>((set, get) => ({
  asrProvider: 'local',
  recordMode: 'toggle',
  language: 'zh',
  hotkey: DEFAULT_HOTKEY,
  translateHotkey: DEFAULT_TRANSLATE_HOTKEY,
  launchAtStartup: false,
  muteOnRecord: true,
  useDictionary: true,
  translateTarget: 'en',
  dictionary: [],
  refineEnabled: false,
  llmApiKey: '',
  llmModel: 'gpt-4o-mini',
  llmBaseUrl: 'https://api.openai.com/v1',
  uiLanguage: 'zh-CN',
  _hydrated: false,

  hydrate: async () => {
    try {
      const saved = await window.tingmo?.loadAllSettings();
      if (saved && typeof saved === 'object') {
        set({ ...saved, _hydrated: true });
        return;
      }
    } catch { /* file doesn't exist yet, use defaults */ }
    set({ _hydrated: true });
  },

  setAsrProvider: (p) => { set({ asrProvider: p }); scheduleSave(get); },
  setRecordMode: (mode) => { set({ recordMode: mode }); scheduleSave(get); },
  setLanguage: (lang) => { set({ language: lang }); scheduleSave(get); },
  setHotkey: (key) => { set({ hotkey: key }); scheduleSave(get); },
  setTranslateHotkey: (key) => { set({ translateHotkey: key }); scheduleSave(get); },
  setLaunchAtStartup: (enabled) => { set({ launchAtStartup: enabled }); scheduleSave(get); },
  setMuteOnRecord: (enabled) => { set({ muteOnRecord: enabled }); scheduleSave(get); },
  setUseDictionary: (enabled) => { set({ useDictionary: enabled }); scheduleSave(get); },
  setTranslateTarget: (lang) => { set({ translateTarget: lang }); scheduleSave(get); },
  addDictEntry: (entry) => { set((s) => ({ dictionary: [...s.dictionary, entry] })); scheduleSave(get); },
  removeDictEntry: (index) => { set((s) => ({ dictionary: s.dictionary.filter((_, i) => i !== index) })); scheduleSave(get); },
  resetHotkey: () => { set({ hotkey: DEFAULT_HOTKEY }); scheduleSave(get); },
  resetTranslateHotkey: () => { set({ translateHotkey: DEFAULT_TRANSLATE_HOTKEY }); scheduleSave(get); },
  setRefineEnabled: (enabled) => { set({ refineEnabled: enabled }); scheduleSave(get); },
  setLlmApiKey: (key) => set({ llmApiKey: key }),
  setLlmModel: (model) => { set({ llmModel: model }); scheduleSave(get); },
  setLlmBaseUrl: (url) => { set({ llmBaseUrl: url }); scheduleSave(get); },
  setUiLanguage: (lang) => { set({ uiLanguage: lang }); scheduleSave(get); },
}));

function scheduleSave(get: () => SettingsState): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const state = get();
    if (!state._hydrated) return;
    window.tingmo?.saveAllSettings(getPersistable(state));
  }, 500);
}
