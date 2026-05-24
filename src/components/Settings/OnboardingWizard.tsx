import React, { useState } from 'react';
import { useI18n } from '../../i18n/context';
import { useSettingsStore } from '../../store/settings';

interface Props {
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<Props> = ({ onComplete }) => {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const asrProvider = useSettingsStore((s) => s.asrProvider);
  const setAsrProvider = useSettingsStore((s) => s.setAsrProvider);

  const steps = [
    {
      title: t('onboarding.welcomeTitle'),
      desc: t('onboarding.welcomeDesc'),
    },
    {
      title: t('onboarding.hotkeyTitle'),
      desc: t('onboarding.hotkeyDesc'),
    },
    {
      title: t('onboarding.modeTitle'),
      desc: '',
    },
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', padding: 40, textAlign: 'center',
    }}>
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 32, fontWeight: 700 }}>TINGMO</span>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {steps.map((_, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i === step ? '#000' : i < step ? '#FF5A1F' : '#ddd',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px', color: '#000' }}>
        {steps[step].title}
      </h2>

      {step === 0 && (
        <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, maxWidth: 400 }}>
          {steps[0].desc}
        </p>
      )}

      {step === 1 && (
        <div style={{ fontSize: 13, color: '#666', lineHeight: 1.8, maxWidth: 400 }}>
          <p>{steps[1].desc}</p>
          <div style={{
            background: '#f5f5f5', borderRadius: 8, padding: '12px 20px',
            marginTop: 12, fontFamily: 'monospace', fontSize: 14,
          }}>
            <div><strong>{t('hotkey.key.rightAlt')}</strong> — {t('onboarding.voiceHotkey')}</div>
            <div style={{ marginTop: 4 }}><strong>{t('hotkey.key.rightAlt')} + {t('hotkey.key.rightShift')}</strong> — {t('onboarding.translateHotkey')}</div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ maxWidth: 400 }}>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
            {t('onboarding.modeDesc')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => { setAsrProvider('local'); }}
              style={{
                padding: '16px 24px', borderRadius: 8, border: asrProvider === 'local' ? '2px solid #000' : '2px solid #ddd',
                background: asrProvider === 'local' ? '#000' : '#fff',
                color: asrProvider === 'local' ? '#fff' : '#000',
                cursor: 'pointer', fontSize: 14, fontWeight: 600,
              }}
            >
              {t('onboarding.local')}
              <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4, opacity: 0.7 }}>
                {t('onboarding.localDesc')}
              </div>
            </button>
            <button
              onClick={() => { setAsrProvider('cloud'); }}
              style={{
                padding: '16px 24px', borderRadius: 8, border: asrProvider === 'cloud' ? '2px solid #000' : '2px solid #ddd',
                background: asrProvider === 'cloud' ? '#000' : '#fff',
                color: asrProvider === 'cloud' ? '#fff' : '#000',
                cursor: 'pointer', fontSize: 14, fontWeight: 600,
              }}
            >
              {t('onboarding.cloud')}
              <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4, opacity: 0.7 }}>
                {t('onboarding.cloudDesc')}
              </div>
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 40, display: 'flex', gap: 12 }}>
        {step > 0 && (
          <button className="nb-btn" onClick={() => setStep(step - 1)}>
            {t('onboarding.back')}
          </button>
        )}
        {step < 2 ? (
          <button className="nb-btn" onClick={() => setStep(step + 1)} style={{ background: '#000', color: '#fff', border: 'none' }}>
            {t('onboarding.next')}
          </button>
        ) : (
          <button className="nb-btn" onClick={onComplete} style={{ background: '#FF5A1F', color: '#fff', border: 'none' }}>
            {t('onboarding.start')}
          </button>
        )}
      </div>

      {step < 2 && (
        <button
          onClick={onComplete}
          style={{ marginTop: 16, background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 12 }}
        >
          {t('onboarding.skip')}
        </button>
      )}
    </div>
  );
};
