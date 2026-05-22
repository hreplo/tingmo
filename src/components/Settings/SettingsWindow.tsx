import React, { useState, useEffect } from 'react';
import { useSettingsStore, TranslateLang, UILanguage } from '../../store/settings';
import { useI18n } from '../../i18n/context';
import { HotkeyRecorder } from './HotkeyRecorder';
import { NbSelect } from './NbSelect';
import { HistoryPanel } from './HistoryPanel';
import { DictionaryPanel } from './DictionaryPanel';

type Tab = 'history' | 'dictionary' | 'model' | 'settings' | 'about';

function extractModifier(hotkey: string): string {
  const parts = hotkey.split(' + ');
  return parts.length > 1 ? parts[parts.length - 1] : '右 Shift';
}

const TRANS_LANGS: { value: TranslateLang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
];

const LANG_OPTIONS: { value: UILanguage; label: string }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en',    label: 'English' },
  { value: 'ja',    label: '日本語' },
  { value: 'ko',    label: '한국어' },
];

const LLM_MODELS = [
  'gpt-4o-mini',
  'gpt-4.1-nano',
  'claude-haiku-4-5',
  'deepseek-chat',
  'qwen-turbo',
];

const LLM_LABELS: Record<string, string> = {
  'gpt-4o-mini': 'GPT-4o-mini',
  'gpt-4.1-nano': 'GPT-4.1 Nano',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'deepseek-chat': 'DeepSeek Chat',
  'qwen-turbo': '通义千问 Turbo',
};

export const SettingsWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const { t } = useI18n();
  const {
    asrProvider, setAsrProvider,
    language, setLanguage,
    hotkey, setHotkey, resetHotkey,
    translateHotkey, setTranslateHotkey, resetTranslateHotkey,
    launchAtStartup, setLaunchAtStartup,
    muteOnRecord, setMuteOnRecord,
    useDictionary, setUseDictionary,
    translateTarget, setTranslateTarget,
    refineEnabled, setRefineEnabled,
    llmApiKey, setLlmApiKey,
    llmModel, setLlmModel,
    llmBaseUrl, setLlmBaseUrl,
    uiLanguage, setUiLanguage,
  } = useSettingsStore();

  useEffect(() => {
    window.tingmo?.setApiKey(llmApiKey);
  }, [llmApiKey]);

  useEffect(() => {
    window.tingmo?.saveLlmSettings({ refineEnabled, llmModel, llmBaseUrl, asrProvider });
    window.tingmo?.initRefinement();
  }, [refineEnabled, llmModel, llmBaseUrl, asrProvider]);

  useEffect(() => {
    window.tingmo?.setUiLanguage(uiLanguage);
  }, [uiLanguage]);

  const navItems: { key: Tab; label: string }[] = [
    { key: 'history',    label: t('nav.history') },
    { key: 'dictionary', label: t('nav.dictionary') },
    { key: 'model',      label: t('nav.model') },
    { key: 'settings',   label: t('nav.settings') },
    { key: 'about',      label: t('nav.about') },
  ];

  return (
    <div className="nb-shell">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <nav className="nb-sidebar">
        <div className="nb-sidebar-top">
          <div className="nb-sidebar-brand">
            <span className="nb-dot" />
            <span>{t('brand.name')}</span>
          </div>
          <div className="nb-sidebar-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`nb-nav-item ${activeTab === item.key ? 'active' : ''}`}
                onClick={() => setActiveTab(item.key)}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="nb-sidebar-bottom">
          <div className="nb-sidebar-ver">v0.2.0</div>
        </div>
      </nav>

      {/* ── Main Content ─────────────────────────────────── */}
      <main className="nb-main">
        {activeTab === 'history' && <HistoryPanel />}
        {activeTab === 'dictionary' && <DictionaryPanel />}

        {activeTab === 'model' && (
          <section className="nb-section">
            <h2 className="nb-section-title">
              <span className="nb-tag accent">{t('section.model')}</span>
            </h2>
            <div className="nb-card">
              <div className="nb-row"><span className="nb-label">{t('model.asrEngine')}</span><span className="nb-value">{t('model.asrEngineValue')}</span></div>
              <div className="nb-hr" />
              <div className="nb-row"><span className="nb-label">{t('model.punctuationModel')}</span><span className="nb-value">{t('model.punctuationModelValue')}</span></div>
              <div className="nb-hr" />
              <div className="nb-row"><span className="nb-label">{t('model.vad')}</span><span className="nb-value">{t('model.vadValue')}</span></div>
              <div className="nb-hr" />
              <div className="nb-row"><span className="nb-label">{t('model.inferenceFramework')}</span><span className="nb-value">{t('model.inferenceFrameworkValue')}</span></div>
              <div className="nb-hr" />
              <div className="nb-row"><span className="nb-label">{t('model.size')}</span><span className="nb-value">{t('model.sizeValue')}</span></div>
            </div>
          </section>
        )}

        {activeTab === 'settings' && (
          <>
            {/* Voice */}
            <section className="nb-section">
              <h2 className="nb-section-title"><span className="nb-tag accent">{t('section.voice')}</span></h2>
              <div className="nb-card">
                <div className="nb-row">
                  <span className="nb-label">{t('settings.voiceMode')}</span>
                  <div className="nb-segmented">
                    <button className={`nb-seg ${asrProvider === 'local' ? 'active' : ''}`} onClick={() => setAsrProvider('local')}>{t('settings.voiceMode.local')}</button>
                    <button className={`nb-seg ${asrProvider === 'cloud' ? 'active' : ''}`} onClick={() => setAsrProvider('cloud')}>{t('settings.voiceMode.cloud')}</button>
                  </div>
                </div>
                <div className="nb-hr" />
                <div className="nb-row">
                  <span className="nb-label">{t('settings.recognitionLanguage')}</span>
                  <div className="nb-segmented">
                    <button className={`nb-seg ${language === 'zh' ? 'active' : ''}`} onClick={() => setLanguage('zh')}>{t('settings.language.zh')}</button>
                    <button className={`nb-seg ${language === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>{t('settings.language.en')}</button>
                  </div>
                </div>
              </div>
            </section>

            {/* Keybinds */}
            <section className="nb-section">
              <h2 className="nb-section-title"><span className="nb-tag accent">{t('section.keybind')}</span></h2>
              <div className="nb-card">
                <div className="nb-row">
                  <span className="nb-label">{t('settings.voiceInput')}</span>
                  <HotkeyRecorder currentHotkey={hotkey} onHotkeyChange={(key) => { setHotkey(key); window.tingmo?.setRecordingHotkey(key); }} onReset={() => { resetHotkey(); window.tingmo?.setRecordingHotkey('右 Alt'); }} />
                </div>
                <div className="nb-hr" />
                <div className="nb-row">
                  <span className="nb-label">{t('settings.translateInput')}</span>
                  <HotkeyRecorder
                    currentHotkey={translateHotkey}
                    onHotkeyChange={(key) => { setTranslateHotkey(key); window.tingmo?.setTranslateModifier(extractModifier(key)); }}
                    onReset={() => { resetTranslateHotkey(); window.tingmo?.setTranslateModifier('右 Shift'); }}
                  />
                </div>
              </div>
            </section>

            {/* Translation */}
            <section className="nb-section">
              <h2 className="nb-section-title"><span className="nb-tag accent">{t('section.translate')}</span></h2>
              <div className="nb-card">
                <div className="nb-row">
                  <span className="nb-label">{t('settings.targetLanguage')}</span>
                  <NbSelect value={translateTarget} options={TRANS_LANGS} onChange={(v) => setTranslateTarget(v as TranslateLang)} />
                </div>
                <div className="nb-hr" />
                <div className="nb-row">
                  <span className="nb-label">{t('settings.translateEngine')}</span>
                  <span className="nb-value" style={{ fontSize: 12 }}>{refineEnabled ? `LLM (${llmModel})` : t('settings.translateEngine.disabled')}</span>
                </div>
              </div>
            </section>

            {/* Options */}
            <section className="nb-section">
              <h2 className="nb-section-title"><span className="nb-tag accent">{t('section.options')}</span></h2>
              <div className="nb-card">
                <div className="nb-row">
                  <span className="nb-label">{t('settings.launchAtStartup')}</span>
                  <label className="nb-toggle"><input type="checkbox" checked={launchAtStartup} onChange={(e) => setLaunchAtStartup(e.target.checked)} /><span className="nb-toggle-slider" /></label>
                </div>
                <div className="nb-hr" />
                <div className="nb-row">
                  <span className="nb-label">{t('settings.muteOnRecord')}</span>
                  <label className="nb-toggle"><input type="checkbox" checked={muteOnRecord} onChange={(e) => setMuteOnRecord(e.target.checked)} /><span className="nb-toggle-slider" /></label>
                </div>
                <div className="nb-hr" />
                <div className="nb-row">
                  <span className="nb-label">{t('settings.useDictionary')}</span>
                  <label className="nb-toggle"><input type="checkbox" checked={useDictionary} onChange={(e) => setUseDictionary(e.target.checked)} /><span className="nb-toggle-slider" /></label>
                </div>
                <div className="nb-hr" />
                <div className="nb-row">
                  <span className="nb-label">{t('settings.uiLanguage')}</span>
                  <NbSelect value={uiLanguage} options={LANG_OPTIONS} onChange={(v) => setUiLanguage(v as UILanguage)} />
                </div>
              </div>
            </section>

            {/* LLM */}
            <section className="nb-section">
              <h2 className="nb-section-title"><span className="nb-tag accent">{t('section.llm')}</span></h2>
              <div className="nb-card">
                <div className="nb-row">
                  <span className="nb-label">{t('settings.enableRefine')}</span>
                  <label className="nb-toggle"><input type="checkbox" checked={refineEnabled} onChange={(e) => setRefineEnabled(e.target.checked)} /><span className="nb-toggle-slider" /></label>
                </div>
                <div className="nb-hr" />
                <div className="nb-row">
                  <span className="nb-label">{t('settings.apiKey')}</span>
                  <input className="nb-input" type="password" value={llmApiKey} onChange={(e) => setLlmApiKey(e.target.value)} placeholder={t('settings.apiKeyPlaceholder')} />
                </div>
                <div className="nb-hr" />
                <div className="nb-row">
                  <span className="nb-label">{t('settings.model')}</span>
                  <NbSelect value={llmModel} options={LLM_MODELS.map((m) => ({ value: m, label: LLM_LABELS[m] || m }))} onChange={(v) => setLlmModel(v)} />
                </div>
                <div className="nb-hr" />
                <div className="nb-row">
                  <span className="nb-label">{t('settings.apiEndpoint')}</span>
                  <input className="nb-input" type="text" value={llmBaseUrl} onChange={(e) => setLlmBaseUrl(e.target.value)} placeholder={t('settings.apiEndpointPlaceholder')} />
                </div>
                <div className="nb-hr" />
              </div>
            </section>
          </>
        )}

        {activeTab === 'about' && (
          <section className="nb-section">
            <h2 className="nb-section-title"><span className="nb-tag accent">{t('section.about')}</span></h2>
            <div className="nb-card">
              <p className="nb-about-name">{t('about.appName')}</p>
              <p className="nb-about-desc">{t('about.description')}</p>
              <div className="nb-meta">
                <span>Electron</span><span className="meta-dot">·</span>
                <span>React</span><span className="meta-dot">·</span>
                <span>TypeScript</span><span className="meta-dot">·</span>
                <span>Paraformer</span><span className="meta-dot">·</span>
                <span>ONNX</span>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
