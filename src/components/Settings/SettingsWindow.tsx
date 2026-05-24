import React, { useState, useEffect } from 'react';
import { useSettingsStore, TranslateLang, UILanguage } from '../../store/settings';
import { useI18n } from '../../i18n/context';
import { HotkeyRecorder } from './HotkeyRecorder';
import { NbSelect } from './NbSelect';
import { HomePanel } from './HomePanel';
import { DictionaryPanel } from './DictionaryPanel';
import { UpdatePanel } from './UpdatePanel';
import { MicDevicePicker } from './MicDevicePicker';

type Tab = 'home' | 'dictionary' | 'model' | 'settings';

function extractModifier(hotkey: string, fallback: string): string {
  const parts = hotkey.split(' + ');
  return parts.length > 1 ? parts[parts.length - 1] : fallback;
}

const TRANS_LANGS: { value: TranslateLang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
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

const LLM_MODELS = ['gpt-4o-mini', 'gpt-4.1-nano', 'claude-haiku-4-5', 'deepseek-chat', 'qwen-turbo'];
const LLM_LABELS: Record<string, string> = {
  'gpt-4o-mini': 'GPT-4o-mini', 'gpt-4.1-nano': 'GPT-4.1 Nano', 'claude-haiku-4-5': 'Claude Haiku 4.5',
  'deepseek-chat': 'DeepSeek Chat', 'qwen-turbo': '通义千问 Turbo',
};

export const SettingsWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const { t } = useI18n();
  const {
    asrProvider, setAsrProvider,
    hotkey, setHotkey, resetHotkey,
    translateHotkey, setTranslateHotkey, resetTranslateHotkey,
    launchAtStartup, setLaunchAtStartup,
    muteOnRecord, setMuteOnRecord,
    useDictionary, setUseDictionary,
    refineEnabled, setRefineEnabled,
    llmApiKey, setLlmApiKey,
    llmModel, setLlmModel,
    llmBaseUrl, setLlmBaseUrl,
    selectedMicDeviceId, setSelectedMicDeviceId,
    // translation reuses LLM config — just pick target language
    translateTarget, setTranslateTarget,
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

  // Sync tray menu changes (mute-on-record, record mode) back to Zustand
  useEffect(() => {
    return (window.tingmo as any)?.onSettingsChanged?.((data: { muteOnRecord?: boolean; recordMode?: string }) => {
      if (typeof data.muteOnRecord === 'boolean') setMuteOnRecord(data.muteOnRecord);
      if (typeof data.recordMode === 'string') {
        // recordMode changes are handled by main process directly
      }
    });
  }, [setMuteOnRecord]);

  const navItems: { key: Tab; label: string }[] = [
    { key: 'home',       label: t('nav.home') },
    { key: 'dictionary', label: t('nav.dictionary') },
    { key: 'model',      label: t('nav.model') },
    { key: 'settings',   label: t('nav.settings') },
  ];

  return (
    <div className="nb-shell">
      <nav className="nb-sidebar">
        <div className="nb-sidebar-top">
          <div className="nb-sidebar-brand"><span className="nb-dot" /><span>{t('brand.name')}</span></div>
          <div className="nb-sidebar-nav">
            {navItems.map((item) => (
              <button key={item.key} className={`nb-nav-item ${activeTab === item.key ? 'active' : ''}`} onClick={() => setActiveTab(item.key)}>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="nb-sidebar-bottom"><div className="nb-sidebar-ver">v0.3.0</div></div>
      </nav>

      <main className="nb-main">
        {activeTab === 'home' && <HomePanel />}
        {activeTab === 'dictionary' && <DictionaryPanel />}

        {activeTab === 'model' && (
          <>
            {/* ASR Model */}
            <section className="nb-section">
              <h2 className="nb-section-title"><span className="nb-tag accent">{t('model.asrSection')}</span></h2>
              <div className="nb-card">
                <div className="nb-row">
                  <span className="nb-label">{t('settings.voiceMode')}</span>
                  <div className="nb-segmented">
                    <button className={`nb-seg ${asrProvider === 'local' ? 'active' : ''}`} onClick={() => setAsrProvider('local')}>{t('settings.voiceMode.local')}</button>
                    <button className={`nb-seg ${asrProvider === 'cloud' ? 'active' : ''}`} onClick={() => setAsrProvider('cloud')}>{t('settings.voiceMode.cloud')}</button>
                  </div>
                </div>
                {asrProvider === 'cloud' && (
                  <>
                    <div className="nb-hr" />
                    <div className="nb-row">
                      <span className="nb-label">{t('settings.apiKey')}</span>
                      <input className="nb-input" type="password" value={llmApiKey} onChange={(e) => setLlmApiKey(e.target.value)} placeholder="sk-..." />
                    </div>
                  </>
                )}
                {asrProvider === 'local' && (
                  <>
                    <div className="nb-hr" />
                    <div className="nb-row"><span className="nb-label">{t('model.asrEngine')}</span><span className="nb-value">{t('model.asrEngineValue')}</span></div>
                    <div className="nb-hr" />
                    <div className="nb-row"><span className="nb-label">{t('model.inferenceFramework')}</span><span className="nb-value">{t('model.inferenceFrameworkValue')}</span></div>
                  </>
                )}
              </div>
            </section>

            {/* LLM Model */}
            <section className="nb-section">
              <h2 className="nb-section-title"><span className="nb-tag accent">{t('model.llmSection')}</span></h2>
              <div className="nb-card">
                <div className="nb-row">
                  <span className="nb-label">{t('settings.enableRefine')}</span>
                  <label className="nb-toggle"><input type="checkbox" checked={refineEnabled} onChange={(e) => setRefineEnabled(e.target.checked)} /><span className="nb-toggle-slider" /></label>
                </div>
                {refineEnabled && (
                  <>
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
                  </>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === 'settings' && (
          <>
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
                  <HotkeyRecorder currentHotkey={translateHotkey}
                    onHotkeyChange={(key) => { setTranslateHotkey(key); window.tingmo?.setTranslateModifier(extractModifier(key, 'Right Shift')); }}
                    onReset={() => { resetTranslateHotkey(); window.tingmo?.setTranslateModifier('Right Shift'); }}
                  />
                </div>
              </div>
            </section>

            <section className="nb-section">
              <h2 className="nb-section-title"><span className="nb-tag accent">{t('section.voice')}</span></h2>
              <div className="nb-card">
                <div className="nb-row">
                  <span className="nb-label">{t('settings.micDevice')}</span>
                  <MicDevicePicker value={selectedMicDeviceId} onChange={setSelectedMicDeviceId} />
                </div>
                <div className="nb-hr" />
                <div className="nb-row">
                  <span className="nb-label">{t('settings.muteOnRecord')}</span>
                  <label className="nb-toggle"><input type="checkbox" checked={muteOnRecord} onChange={(e) => setMuteOnRecord(e.target.checked)} /><span className="nb-toggle-slider" /></label>
                </div>
              </div>
            </section>

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
                  <span className="nb-value" style={{ fontSize: 12, color: refineEnabled ? '#000' : '#999' }}>
                    {refineEnabled ? `LLM (${llmModel || 'gpt-4o-mini'})` : t('settings.translateEngine.disabled')}
                  </span>
                </div>
              </div>
            </section>

            <section className="nb-section">
              <h2 className="nb-section-title"><span className="nb-tag accent">{t('section.options')}</span></h2>
              <div className="nb-card">
                <div className="nb-row">
                  <span className="nb-label">{t('settings.launchAtStartup')}</span>
                  <label className="nb-toggle"><input type="checkbox" checked={launchAtStartup} onChange={(e) => setLaunchAtStartup(e.target.checked)} /><span className="nb-toggle-slider" /></label>
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

            <section className="nb-section">
              <h2 className="nb-section-title"><span className="nb-tag accent">{t('section.about')}</span></h2>
              <div className="nb-card">
                <p className="nb-about-name">{t('about.appName')}</p>
                <p className="nb-about-desc">{t('about.description')}</p>
                <div className="nb-meta">
                  <span>SenseVoice</span><span className="meta-dot">·</span>
                  <span>sherpa-onnx</span><span className="meta-dot">·</span>
                  <span>Electron</span><span className="meta-dot">·</span>
                  <span>React</span>
                </div>
              </div>
            </section>

            <section className="nb-section">
              <h2 className="nb-section-title"><span className="nb-tag accent">{t('section.update')}</span></h2>
              <div className="nb-card"><UpdatePanel /></div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};
