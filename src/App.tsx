import React, { useEffect } from 'react';
import { I18nProvider } from './i18n/context';
import { useSettingsStore } from './store/settings';
import { FloatingWindow } from './components/FloatingWindow';
import { SettingsWindow } from './components/Settings/SettingsWindow';
import { ErrorBoundary } from './components/ErrorBoundary';

const AppInner: React.FC = () => {
  const isSettings = window.location.hash === '#/settings';

  if (isSettings) {
    return <SettingsWindow />;
  }

  return <FloatingWindow />;
};

export const App: React.FC = () => {
  const setUiLanguage = useSettingsStore((s) => s.setUiLanguage);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const hydrated = useSettingsStore((s) => s._hydrated);

  useEffect(() => {
    hydrate().then(() => {
      window.tingmo?.getSystemLocale().then((locale) => {
        if (locale) setUiLanguage(locale as any);
      }).catch(() => {});
    });
  }, [hydrate, setUiLanguage]);

  if (!hydrated) return null;

  return (
    <ErrorBoundary>
      <I18nProvider>
        <AppInner />
      </I18nProvider>
    </ErrorBoundary>
  );
};
