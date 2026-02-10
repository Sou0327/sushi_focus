import { useState, useEffect } from 'react';
import { ToggleSwitch } from '@/shared/components/ToggleSwitch';
import { SushiTaro } from '@/shared/components/SushiTaro';
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

  const NAV_ITEMS: { id: SettingsSection; label: string }[] = [
    { id: 'focus', label: t('nav.focusRules') },
    { id: 'timer', label: t('nav.timerConfig') },
    { id: 'general', label: t('nav.generalSettings') },
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
      theme: 'light',
      logVerbosity: 'normal',
      daemonAuthToken: '',
    });
    setLanguage('en');
    setTheme('light');
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
      <div className="h-screen bg-sushi-bg flex items-center justify-center">
        <div className="text-center">
          <SushiTaro size="2xl" className="mb-4 animate-sushi-roll mx-auto" theme={theme} />
          <div className="text-subtle">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-sushi-bg">
      {/* Sidebar */}
      <aside className="w-[260px] flex-shrink-0 bg-sushi-bg border-r border-sushi-border flex flex-col">
        {/* Header */}
        <div className="noren px-5 py-4 relative">
          <div className="absolute bottom-0 left-0 right-0 flex justify-around pointer-events-none">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="noren-flap-refined"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <SushiTaro size="xl" theme={theme} />
            <div>
              <div className="text-lg font-bold text-white">{t('common.sushiFocus')}</div>
              <div className="text-xs text-white/60">{t('common.settings')}</div>
            </div>
          </div>
        </div>

        <div className="h-1 bg-gradient-to-r from-sushi-woodDark via-sushi-wood to-sushi-woodDark" />

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="mb-3 px-3">
            <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">{t('common.settings')}</span>
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center px-4 py-2.5 rounded-lg text-left text-sm transition-colors mb-1 ${
                  isActive
                    ? 'bg-sushi-salmon/15 text-sushi-salmon border-l-2 border-sushi-salmon font-semibold'
                    : 'text-subtle hover:bg-sushi-surface hover:text-heading'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Daemon status */}
        <div className="p-4">
          <div className="sushi-geta p-3">
            <div className="flex items-center gap-3">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center overflow-hidden
                ${connected
                  ? 'bg-sushi-wasabi/15'
                  : 'bg-sushi-tuna/15 grayscale opacity-60'
                }
              `}>
                <SushiTaro size="md" theme={theme} />
              </div>
              <div>
                <div className={`text-sm font-medium ${connected ? 'text-sushi-wasabi' : 'text-sushi-tuna'}`}>
                  {connected ? t('options.daemon.active') : t('options.daemon.offline')}
                </div>
                <div className="text-[10px] text-muted">
                  {connected ? `v${daemonVersion || '?.?.?'} · :41593` : t('options.daemon.offlineStatus')}
                </div>
                <div className="text-[10px] text-muted">
                  ext v{chrome.runtime.getManifest().version}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-8 py-3 bg-sushi-surface border-b border-sushi-border">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">{t('common.settings')}</span>
            <span className="text-sushi-salmon">→</span>
            <span className="text-heading font-semibold">
              {NAV_ITEMS.find(i => i.id === activeSection)?.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetDefaults}
              className="text-sm text-muted hover:text-sushi-tuna transition-colors"
            >
              {t('options.resetDefaults')}
            </button>
            <div
              className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-2 ${
                saveState === 'saved'
                  ? 'bg-sushi-wasabi/15 text-sushi-wasabi border border-sushi-wasabi/30'
                  : 'bg-sushi-bg text-muted border border-sushi-border'
              }`}
            >
              {saveState === 'saving' ? (
                <>
                  <SushiTaro size="sm" className="animate-spin" theme={theme} />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <span className="text-sushi-wasabi">✓</span>
                  {t('common.saved')}
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-[720px] mx-auto">
            {activeSection === 'focus' && (
              <>
                <h1 className="text-xl font-bold text-heading mb-1">{t('options.focus.title')}</h1>
                <p className="text-sm text-subtle mb-6">{t('options.focus.description')}</p>

                <div className="mb-6">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-heading mb-3">
                    <span className="w-2 h-2 rounded-full bg-sushi-salmon" />
                    {t('options.focus.behaviorTitle')}
                  </h2>

                  <div className="space-y-3">
                    <div className="sushi-geta p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-heading">{t('options.focus.autoReturn')}</div>
                          <div className="text-xs text-muted mt-0.5">{t('options.focus.autoReturnDesc')}</div>
                        </div>
                        <ToggleSwitch
                          checked={settings.enableDoneFocus}
                          onChange={(checked) => saveSettings({ enableDoneFocus: checked })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'timer' && (
              <>
                <h1 className="text-xl font-bold text-heading mb-1">{t('options.timer.title')}</h1>
                <p className="text-sm text-subtle mb-6">{t('options.timer.description')}</p>

                <div className="mb-6">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-heading mb-3">
                    <span className="w-2 h-2 rounded-full bg-sushi-wasabi" />
                    {t('options.timer.sectionTitle')}
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="sushi-geta p-4">
                      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                        {t('options.timer.returnCountdown')}
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={Math.round(settings.doneCountdownMs / 1000)}
                          onChange={(e) => saveSettings({ doneCountdownMs: Number(e.target.value) * 1000 })}
                          min={1}
                          max={30}
                          className="w-full input text-2xl font-bold text-center text-sushi-salmon [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-muted text-sm shrink-0">{t('common.seconds')}</span>
                      </div>
                      <p className="text-xs text-muted mt-2">{t('options.timer.returnCountdownDesc')}</p>
                    </div>

                    <div className="sushi-geta p-4">
                      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                        {t('options.timer.focusCooldown')}
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={Math.round(settings.doneCooldownMs / 60000)}
                          onChange={(e) => saveSettings({ doneCooldownMs: Number(e.target.value) * 60000 })}
                          min={1}
                          max={60}
                          className="w-full input text-2xl font-bold text-center text-sushi-wasabi [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-muted text-sm shrink-0">{t('common.minutes')}</span>
                      </div>
                      <p className="text-xs text-muted mt-2">{t('options.timer.focusCooldownDesc')}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'general' && (
              <>
                <h1 className="text-xl font-bold text-heading mb-1">{t('options.general.title')}</h1>
                <p className="text-sm text-subtle mb-6">{t('options.general.description')}</p>

                <div className="space-y-3">
                  {/* Language */}
                  <div className="sushi-geta p-4">
                    <div className="font-medium text-heading mb-0.5">{t('options.general.language')}</div>
                    <div className="text-xs text-muted mb-3">{t('options.general.languageDesc')}</div>
                    <div className="flex gap-2">
                      {(['en', 'ja'] as Language[]).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => handleLanguageChange(lang)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            language === lang
                              ? 'bg-sushi-salmon text-white'
                              : 'bg-sushi-bg border border-sushi-border text-subtle hover:text-heading hover:border-sushi-salmon'
                          }`}
                        >
                          {lang === 'en' ? 'English' : '日本語'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme */}
                  <div className="sushi-geta p-4">
                    <div className="font-medium text-heading mb-0.5">{t('options.general.theme')}</div>
                    <div className="text-xs text-muted mb-3">{t('options.general.themeDesc')}</div>
                    <div className="flex gap-2">
                      {(['dark', 'light'] as Theme[]).map((th) => (
                        <button
                          key={th}
                          onClick={() => handleThemeChange(th)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            theme === th
                              ? 'bg-sushi-salmon text-white'
                              : 'bg-sushi-bg border border-sushi-border text-subtle hover:text-heading hover:border-sushi-salmon'
                          }`}
                        >
                          {t(`theme.${th}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Log Verbosity */}
                  <div className="sushi-geta p-4">
                    <div className="font-medium text-heading mb-0.5">{t('options.general.logVerbosity')}</div>
                    <div className="text-xs text-muted mb-3">{t('options.general.logVerbosityDesc')}</div>
                    <div className="flex gap-2">
                      {(['minimal', 'normal', 'verbose'] as LogVerbosity[]).map((level) => (
                        <button
                          key={level}
                          onClick={() => saveSettings({ logVerbosity: level })}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            settings.logVerbosity === level
                              ? 'bg-sushi-wasabi text-white'
                              : 'bg-sushi-bg border border-sushi-border text-subtle hover:text-heading hover:border-sushi-wasabi'
                          }`}
                        >
                          {t(`options.general.logLevel.${level}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Log Prompt Content */}
                  <div className="sushi-geta p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-heading">{t('options.general.logPromptContent')}</div>
                        <div className="text-xs text-muted mt-0.5">{t('options.general.logPromptContentDesc')}</div>
                      </div>
                      <button
                        onClick={() => saveSettings({ logPromptContent: !settings.logPromptContent })}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                          settings.logPromptContent ? 'bg-sushi-wasabi' : 'bg-sushi-border'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          settings.logPromptContent ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* Auth Token */}
                  <div className="sushi-geta p-4">
                    <div className="font-medium text-heading mb-0.5">{t('options.general.daemonAuthToken')}</div>
                    <div className="text-xs text-muted mb-3">{t('options.general.daemonAuthTokenDesc')}</div>
                    <input
                      type="password"
                      value={settings.daemonAuthToken ?? ''}
                      onChange={(e) => saveSettings({ daemonAuthToken: e.target.value })}
                      placeholder={t('options.general.daemonAuthTokenPlaceholder')}
                      className="input w-full text-sm"
                      autoComplete="off"
                    />
                  </div>

                  {/* Daemon Connection */}
                  <div className="sushi-geta p-4">
                    <div className="font-medium text-heading mb-0.5">{t('options.general.daemonConnection')}</div>
                    <div className="text-xs text-muted mb-3">{t('options.general.daemonConnectionDesc')}</div>
                    <button
                      onClick={() => chrome.runtime.sendMessage({ type: 'reconnect' })}
                      className="btn-secondary flex items-center gap-2 text-sm"
                    >
                      {t('options.general.reconnect')}
                    </button>
                  </div>

                  {/* Reset */}
                  <div className="sushi-geta p-4">
                    <div className="font-medium text-heading mb-0.5">{t('options.general.resetToDefaults')}</div>
                    <div className="text-xs text-muted mb-3">{t('options.general.resetToDefaultsDesc')}</div>
                    <button
                      onClick={resetDefaults}
                      className="btn-danger flex items-center gap-2 text-sm"
                    >
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
