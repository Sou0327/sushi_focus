import { useState, useEffect } from 'react';
import { ToggleSwitch } from '@/shared/components/ToggleSwitch';
import { useTranslation } from '@/i18n/TranslationContext';
import { useTheme } from '@/theme/useTheme';
import type { ExtensionSettings, Language, LogVerbosity, Theme } from '@/shared/types';

type SettingsSection = 'focus' | 'timer' | 'general';

export default function App() {
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>('focus');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [daemonVersion, setDaemonVersion] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const NAV_ITEMS: { id: SettingsSection; label: string; icon: string }[] = [
    { id: 'focus', label: t('nav.focusRules'), icon: 'psychology' },
    { id: 'timer', label: t('nav.timerConfig'), icon: 'hourglass_top' },
    { id: 'general', label: t('nav.generalSettings'), icon: 'settings' },
  ];

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'get_settings' }, (response) => {
      if (response?.settings) {
        setSettings(response.settings);
      }
    });
    chrome.runtime.sendMessage({ type: 'get_connection_status' }, (response) => {
      if (response) {
        setConnected(response.connected ?? false);
        setDaemonVersion(response.version ?? null);
      }
    });
  }, []);

  const saveSettings = (updates: Partial<ExtensionSettings>) => {
    if (!settings) return;
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    setSaveState('saving');
    chrome.runtime.sendMessage({ type: 'update_settings', settings: updates }, () => {
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    });
  };

  const resetDefaults = () => {
    saveSettings({
      mode: 'normal',
      homeTabId: null,
      homeWindowId: null,
      enableDoneFocus: true,
      doneCountdownMs: 1500,
      doneCooldownMs: 45000,
      distractionDomains: ['netflix.com', 'tiktok.com', 'youtube.com', 'x.com', 'twitter.com', 'instagram.com', 'twitch.tv', 'reddit.com'],
      alwaysFocusOnDone: true,
      enabled: true,
      language: 'en',
      theme: 'dark',
      logVerbosity: 'normal',
    });
    setLanguage('en');
    setTheme('dark');
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    saveSettings({ language: lang });
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    saveSettings({ theme: newTheme });
  };

  if (!settings) {
    return (
      <div className="h-screen bg-focus-bg flex items-center justify-center">
        <div className="text-text-secondary">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-focus-bg">
      {/* Sidebar */}
      <aside className="w-[264px] flex-shrink-0 bg-focus-bg border-r border-focus-border flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-focus-primary text-2xl">bolt</span>
            <span className="text-lg font-bold text-heading font-display">{t('common.focusFlow')}</span>
          </div>
        </div>

        <nav className="flex-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors mb-1 ${
                  isActive
                    ? 'bg-surface-highlight text-heading border-l-4 border-focus-primary pl-2'
                    : 'text-text-secondary hover:bg-focus-surface hover:text-heading'
                }`}
              >
                <span className={`material-symbols-outlined text-lg ${isActive ? 'text-focus-primary' : ''}`}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 mx-3 mb-3 bg-focus-surface rounded-xl border border-focus-border">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-focus-success opacity-75" />}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connected ? 'bg-focus-success' : 'bg-focus-error'}`} />
            </span>
            <span className="text-sm font-medium text-heading">{connected ? t('options.daemon.active') : t('options.daemon.offline')}</span>
          </div>
          <div className="mt-1 text-xs text-text-secondary ml-[18px]">
            {connected ? `v${daemonVersion || '?.?.?'} · localhost:41593` : t('options.daemon.offlineStatus')}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-focus-border">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>{t('common.settings')}</span>
            <span className="text-dim">{'>'}</span>
            <span className="text-heading font-medium">
              {NAV_ITEMS.find(i => i.id === activeSection)?.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetDefaults}
              className="text-sm text-text-secondary hover:text-heading transition-colors"
            >
              {t('options.resetDefaults')}
            </button>
            <button
              disabled
              className={`px-4 py-2 text-sm font-medium rounded-lg cursor-default flex items-center gap-1.5 transition-colors ${
                saveState === 'saved' ? 'bg-focus-success/20 text-focus-success' : 'bg-focus-primary/50 text-heading/70'
              }`}
            >
              {saveState === 'saving' ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">check</span>
                  {t('common.saved')}
                </>
              )}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-[800px] mx-auto">
            {activeSection === 'focus' && (
              <>
                <h1 className="text-2xl font-bold text-heading mb-2">{t('options.focus.title')}</h1>
                <p className="text-text-secondary mb-8">
                  {t('options.focus.description')}
                </p>

                <div className="mb-8">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-heading mb-4">
                    <span className="material-symbols-outlined text-focus-primary">psychology</span>
                    {t('options.focus.behaviorTitle')}
                  </h2>

                  <div className="space-y-3">
                    {/* タスク完了時の IDE 復帰 */}
                    <div className="flex items-center justify-between bg-focus-surface border border-focus-border rounded-xl p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-focus-bg rounded-lg flex items-center justify-center">
                          <span className="material-symbols-outlined text-focus-primary">code</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-heading">{t('options.focus.autoReturn')}</div>
                          <div className="text-xs text-text-secondary">{t('options.focus.autoReturnDesc')}</div>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={settings.enableDoneFocus}
                        onChange={(checked) => saveSettings({ enableDoneFocus: checked })}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'timer' && (
              <>
                <h1 className="text-2xl font-bold text-heading mb-2">{t('options.timer.title')}</h1>
                <p className="text-text-secondary mb-8">
                  {t('options.timer.description')}
                </p>

                <div className="mb-8">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-heading mb-4">
                    <span className="material-symbols-outlined text-focus-primary">hourglass_top</span>
                    {t('options.timer.sectionTitle')}
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
                      <div className="text-[10px] font-semibold tracking-widest uppercase text-text-secondary mb-3">
                        {t('options.timer.returnCountdown')}
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={Math.round(settings.doneCountdownMs / 1000)}
                          onChange={(e) => saveSettings({ doneCountdownMs: Number(e.target.value) * 1000 })}
                          min={1}
                          max={30}
                          className="w-full bg-focus-bg border border-focus-border rounded-lg px-4 py-3 text-2xl font-bold text-heading text-center focus:outline-none focus:ring-2 focus:ring-focus-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-text-secondary text-sm shrink-0">{t('common.seconds')}</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-2">{t('options.timer.returnCountdownDesc')}</p>
                    </div>

                    <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
                      <div className="text-[10px] font-semibold tracking-widest uppercase text-text-secondary mb-3">
                        {t('options.timer.focusCooldown')}
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={Math.round(settings.doneCooldownMs / 60000)}
                          onChange={(e) => saveSettings({ doneCooldownMs: Number(e.target.value) * 60000 })}
                          min={1}
                          max={60}
                          className="w-full bg-focus-bg border border-focus-border rounded-lg px-4 py-3 text-2xl font-bold text-heading text-center focus:outline-none focus:ring-2 focus:ring-focus-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-text-secondary text-sm shrink-0">{t('common.minutes')}</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-2">{t('options.timer.focusCooldownDesc')}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'general' && (
              <>
                <h1 className="text-2xl font-bold text-heading mb-2">{t('options.general.title')}</h1>
                <p className="text-text-secondary mb-8">
                  {t('options.general.description')}
                </p>

                <div className="space-y-4">
                  {/* Language Selector */}
                  <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
                    <div className="font-medium text-heading mb-1">{t('options.general.language')}</div>
                    <div className="text-sm text-text-secondary mb-3">
                      {t('options.general.languageDesc')}
                    </div>
                    <div className="flex gap-2">
                      {(['en', 'ja'] as Language[]).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => handleLanguageChange(lang)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            language === lang
                              ? 'bg-focus-primary text-white'
                              : 'bg-focus-bg border border-focus-border text-subtle hover:text-heading hover:border-focus-primary'
                          }`}
                        >
                          {t(`language.${lang}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme Selector */}
                  <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
                    <div className="font-medium text-heading mb-1">{t('options.general.theme')}</div>
                    <div className="text-sm text-text-secondary mb-3">
                      {t('options.general.themeDesc')}
                    </div>
                    <div className="flex gap-2">
                      {(['dark', 'light'] as Theme[]).map((th) => (
                        <button
                          key={th}
                          onClick={() => handleThemeChange(th)}
                          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            theme === th
                              ? 'bg-focus-primary text-white'
                              : 'bg-focus-bg border border-focus-border text-subtle hover:text-heading hover:border-focus-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">
                            {th === 'dark' ? 'dark_mode' : 'light_mode'}
                          </span>
                          {t(`theme.${th}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Log Verbosity */}
                  <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
                    <div className="font-medium text-heading mb-1">{t('options.general.logVerbosity')}</div>
                    <div className="text-sm text-text-secondary mb-3">
                      {t('options.general.logVerbosityDesc')}
                    </div>
                    <div className="flex gap-2">
                      {(['minimal', 'normal', 'verbose'] as LogVerbosity[]).map((level) => (
                        <button
                          key={level}
                          onClick={() => saveSettings({ logVerbosity: level })}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            settings.logVerbosity === level
                              ? 'bg-focus-primary text-white'
                              : 'bg-focus-bg border border-focus-border text-subtle hover:text-heading hover:border-focus-primary'
                          }`}
                        >
                          {t(`options.general.logLevel.${level}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
                    <div className="font-medium text-heading mb-1">{t('options.general.daemonConnection')}</div>
                    <div className="text-sm text-text-secondary mb-3">
                      {t('options.general.daemonConnectionDesc')}
                    </div>
                    <button
                      onClick={() => chrome.runtime.sendMessage({ type: 'reconnect' })}
                      className="flex items-center gap-2 px-4 py-2 bg-focus-bg border border-focus-border rounded-lg text-sm text-subtle hover:text-heading hover:border-focus-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">refresh</span>
                      {t('options.general.reconnect')}
                    </button>
                  </div>

                  <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
                    <div className="font-medium text-heading mb-1">{t('options.general.resetToDefaults')}</div>
                    <div className="text-sm text-text-secondary mb-3">
                      {t('options.general.resetToDefaultsDesc')}
                    </div>
                    <button
                      onClick={resetDefaults}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">restart_alt</span>
                      {t('options.general.resetSettings')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
