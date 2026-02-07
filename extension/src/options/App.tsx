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

  const NAV_ITEMS: { id: SettingsSection; label: string; icon: string }[] = [
    { id: 'focus', label: t('nav.focusRules'), icon: '🥢' },
    { id: 'timer', label: t('nav.timerConfig'), icon: '⏱️' },
    { id: 'general', label: t('nav.generalSettings'), icon: '📜' },
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
      {/* 🏮 サイドバー - 暖簾風 */}
      <aside className="w-[280px] flex-shrink-0 bg-sushi-bg border-r-2 border-sushi-border flex flex-col">
        {/* ヘッダー - 暖簾 */}
        <div className="noren px-6 py-5 relative">
          <div className="absolute bottom-0 left-0 right-0 flex justify-around">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-6 h-2 bg-gradient-to-b from-transparent to-black/30 rounded-b-full"
              />
            ))}
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <SushiTaro size="xl" theme={theme} />
            <div>
              <div className="text-lg font-bold text-white drop-shadow-lg">{t('common.sushiFocus')}</div>
              <div className="text-xs text-sushi-rice/80">{t('common.settings')}</div>
            </div>
          </div>
        </div>

        {/* 木のカウンター縁 */}
        <div className="h-2 bg-gradient-to-r from-sushi-woodDark via-sushi-wood to-sushi-woodDark" />

        {/* ナビゲーション - お品書き風 */}
        <nav className="flex-1 p-4">
          <div className="mb-3 px-3">
            <span className="text-xs text-muted uppercase tracking-widest font-bold">お品書き</span>
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm transition-all mb-2 ${
                  isActive
                    ? 'bg-sushi-salmon/20 text-sushi-salmon border-l-4 border-sushi-salmon font-bold'
                    : 'text-subtle hover:bg-sushi-surface hover:text-heading'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* 厨房ステータス - 木札風 */}
        <div className="p-4">
          <div className="sushi-geta p-4">
            <div className="flex items-center gap-3">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center overflow-hidden
                ${connected
                  ? 'bg-sushi-wasabi/20 shadow-[0_0_10px_rgba(124,179,66,0.3)]'
                  : 'bg-sushi-tuna/20 grayscale opacity-60'
                }
              `}>
                <SushiTaro size="lg" theme={theme} />
              </div>
              <div>
                <div className={`text-sm font-bold ${connected ? 'text-sushi-wasabi' : 'text-sushi-tuna'}`}>
                  {connected ? t('options.daemon.active') : t('options.daemon.offline')}
                </div>
                <div className="text-xs text-muted">
                  {connected ? `v${daemonVersion || '?.?.?'} · localhost:41593` : t('options.daemon.offlineStatus')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* トップバー - 木のカウンター風 */}
        <header className="flex items-center justify-between px-8 py-4 bg-sushi-surface border-b-2 border-sushi-border">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">{t('common.settings')}</span>
            <span className="text-sushi-salmon">→</span>
            <span className="text-heading font-bold">
              {NAV_ITEMS.find(i => i.id === activeSection)?.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetDefaults}
              className="text-sm text-muted hover:text-sushi-tuna transition-colors flex items-center gap-1"
            >
              <span>🔄</span>
              {t('options.resetDefaults')}
            </button>
            <div
              className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 ${
                saveState === 'saved'
                  ? 'bg-sushi-wasabi/20 text-sushi-wasabi border border-sushi-wasabi/30'
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
                  <span>✅</span>
                  {t('common.saved')}
                </>
              )}
            </div>
          </div>
        </header>

        {/* コンテンツエリア */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-[800px] mx-auto">
            {activeSection === 'focus' && (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">🥢</span>
                  <h1 className="text-2xl font-bold text-heading">{t('options.focus.title')}</h1>
                </div>
                <p className="text-subtle mb-8 ml-12">
                  {t('options.focus.description')}
                </p>

                <div className="mb-8">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-heading mb-4 ml-2">
                    <span className="text-sushi-salmon">●</span>
                    {t('options.focus.behaviorTitle')}
                  </h2>

                  <div className="space-y-3">
                    {/* タスク完了時の IDE 復帰 */}
                    <div className="sushi-geta p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-sushi-salmon/20 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">🏃</span>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-heading">{t('options.focus.autoReturn')}</div>
                            <div className="text-xs text-muted mt-1">{t('options.focus.autoReturnDesc')}</div>
                          </div>
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
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">⏱️</span>
                  <h1 className="text-2xl font-bold text-heading">{t('options.timer.title')}</h1>
                </div>
                <p className="text-subtle mb-8 ml-12">
                  {t('options.timer.description')}
                </p>

                <div className="mb-8">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-heading mb-4 ml-2">
                    <span className="text-sushi-wasabi">●</span>
                    {t('options.timer.sectionTitle')}
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="sushi-geta p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">⏳</span>
                        <div className="text-xs font-bold tracking-widest uppercase text-muted">
                          {t('options.timer.returnCountdown')}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={Math.round(settings.doneCountdownMs / 1000)}
                          onChange={(e) => saveSettings({ doneCountdownMs: Number(e.target.value) * 1000 })}
                          min={1}
                          max={30}
                          className="w-full input text-3xl font-bold text-center text-sushi-salmon [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-muted text-sm shrink-0">{t('common.seconds')}</span>
                      </div>
                      <p className="text-xs text-muted mt-3">{t('options.timer.returnCountdownDesc')}</p>
                    </div>

                    <div className="sushi-geta p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">🧊</span>
                        <div className="text-xs font-bold tracking-widest uppercase text-muted">
                          {t('options.timer.focusCooldown')}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={Math.round(settings.doneCooldownMs / 60000)}
                          onChange={(e) => saveSettings({ doneCooldownMs: Number(e.target.value) * 60000 })}
                          min={1}
                          max={60}
                          className="w-full input text-3xl font-bold text-center text-sushi-wasabi [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-muted text-sm shrink-0">{t('common.minutes')}</span>
                      </div>
                      <p className="text-xs text-muted mt-3">{t('options.timer.focusCooldownDesc')}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'general' && (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">📜</span>
                  <h1 className="text-2xl font-bold text-heading">{t('options.general.title')}</h1>
                </div>
                <p className="text-subtle mb-8 ml-12">
                  {t('options.general.description')}
                </p>

                <div className="space-y-4">
                  {/* Language Selector */}
                  <div className="sushi-geta p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">🌐</span>
                      <div className="font-bold text-heading">{t('options.general.language')}</div>
                    </div>
                    <div className="text-sm text-muted mb-4 ml-8">
                      {t('options.general.languageDesc')}
                    </div>
                    <div className="flex gap-2 ml-8">
                      {(['en', 'ja'] as Language[]).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => handleLanguageChange(lang)}
                          className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${
                            language === lang
                              ? 'bg-sushi-salmon text-white shadow-[0_3px_0_0_#A03D30]'
                              : 'bg-sushi-bg border-2 border-sushi-border text-subtle hover:text-heading hover:border-sushi-salmon'
                          }`}
                        >
                          {lang === 'en' ? '🇺🇸 English' : '🇯🇵 日本語'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme Selector */}
                  <div className="sushi-geta p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">🎨</span>
                      <div className="font-bold text-heading">{t('options.general.theme')}</div>
                    </div>
                    <div className="text-sm text-muted mb-4 ml-8">
                      {t('options.general.themeDesc')}
                    </div>
                    <div className="flex gap-2 ml-8">
                      {(['dark', 'light'] as Theme[]).map((th) => (
                        <button
                          key={th}
                          onClick={() => handleThemeChange(th)}
                          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${
                            theme === th
                              ? 'bg-sushi-salmon text-white shadow-[0_3px_0_0_#A03D30]'
                              : 'bg-sushi-bg border-2 border-sushi-border text-subtle hover:text-heading hover:border-sushi-salmon'
                          }`}
                        >
                          <span className="text-lg">{th === 'dark' ? '🫘' : '🍚'}</span>
                          {t(`theme.${th}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Log Verbosity */}
                  <div className="sushi-geta p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">📝</span>
                      <div className="font-bold text-heading">{t('options.general.logVerbosity')}</div>
                    </div>
                    <div className="text-sm text-muted mb-4 ml-8">
                      {t('options.general.logVerbosityDesc')}
                    </div>
                    <div className="flex gap-2 ml-8">
                      {(['minimal', 'normal', 'verbose'] as LogVerbosity[]).map((level) => (
                        <button
                          key={level}
                          onClick={() => saveSettings({ logVerbosity: level })}
                          className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${
                            settings.logVerbosity === level
                              ? 'bg-sushi-wasabi text-white shadow-[0_3px_0_0_#3D6420]'
                              : 'bg-sushi-bg border-2 border-sushi-border text-subtle hover:text-heading hover:border-sushi-wasabi'
                          }`}
                        >
                          {t(`options.general.logLevel.${level}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Log Prompt Content */}
                  <div className="sushi-geta p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🔒</span>
                        <div>
                          <div className="font-bold text-heading">{t('options.general.logPromptContent')}</div>
                          <div className="text-sm text-muted">
                            {t('options.general.logPromptContentDesc')}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => saveSettings({ logPromptContent: !settings.logPromptContent })}
                        className={`relative w-12 h-7 rounded-full transition-colors ${
                          settings.logPromptContent ? 'bg-sushi-wasabi' : 'bg-sushi-border'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                          settings.logPromptContent ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* Daemon Connection */}
                  <div className="sushi-geta p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">🔌</span>
                      <div className="font-bold text-heading">{t('options.general.daemonConnection')}</div>
                    </div>
                    <div className="text-sm text-muted mb-4 ml-8">
                      {t('options.general.daemonConnectionDesc')}
                    </div>
                    <button
                      onClick={() => chrome.runtime.sendMessage({ type: 'reconnect' })}
                      className="ml-8 btn-secondary flex items-center gap-2"
                    >
                      <span className="text-lg">🔄</span>
                      {t('options.general.reconnect')}
                    </button>
                  </div>

                  {/* Reset to Defaults */}
                  <div className="sushi-geta p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">⚠️</span>
                      <div className="font-bold text-heading">{t('options.general.resetToDefaults')}</div>
                    </div>
                    <div className="text-sm text-muted mb-4 ml-8">
                      {t('options.general.resetToDefaultsDesc')}
                    </div>
                    <button
                      onClick={resetDefaults}
                      className="ml-8 btn-danger flex items-center gap-2"
                    >
                      <span className="text-lg">🗑️</span>
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
