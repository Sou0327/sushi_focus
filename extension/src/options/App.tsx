import { useState, useEffect } from 'react';
import { ToggleSwitch } from '@/shared/components/ToggleSwitch';
import type { ExtensionSettings } from '@/shared/types';

type SettingsSection = 'focus' | 'timer' | 'blocklist' | 'general';

const NAV_ITEMS: { id: SettingsSection; label: string; icon: string }[] = [
  { id: 'focus', label: 'Focus Rules', icon: 'psychology' },
  { id: 'timer', label: 'Timer Config', icon: 'hourglass_top' },
  { id: 'blocklist', label: 'Blocklist', icon: 'domain_disabled' },
  { id: 'general', label: 'General Settings', icon: 'settings' },
];

export default function App() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>('focus');
  const [newDomain, setNewDomain] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [daemonVersion, setDaemonVersion] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

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
      mode: 'force',
      homeTabId: null,
      homeWindowId: null,
      enableDoneFocus: true,
      doneCountdownMs: 1500,
      doneCooldownMs: 45000,
      distractionDomains: ['netflix.com', 'tiktok.com', 'youtube.com', 'x.com', 'twitter.com', 'instagram.com', 'twitch.tv', 'reddit.com'],
      alwaysFocusOnDone: false,
      enabled: true,
    });
  };

  const addDomain = () => {
    if (!settings || !newDomain.trim()) return;
    const domain = newDomain.trim().toLowerCase();
    if (settings.distractionDomains.includes(domain)) {
      setNewDomain('');
      return;
    }
    saveSettings({ distractionDomains: [...settings.distractionDomains, domain] });
    setNewDomain('');
  };

  const removeDomain = (domain: string) => {
    if (!settings) return;
    saveSettings({ distractionDomains: settings.distractionDomains.filter(d => d !== domain) });
  };

  if (!settings) {
    return (
      <div className="h-screen bg-background-dark text-gray-100 flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background-dark text-gray-100">
      {/* Sidebar */}
      <aside className="w-[264px] flex-shrink-0 bg-focus-bg border-r border-focus-border flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-focus-primary text-2xl">bolt</span>
            <span className="text-lg font-bold text-white font-display">FocusFlow</span>
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
                    ? 'bg-surface-highlight text-white border-l-4 border-focus-primary pl-2'
                    : 'text-text-secondary hover:bg-focus-surface hover:text-white'
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
            <span className="text-sm font-medium text-white">{connected ? 'Daemon Active' : 'Daemon Offline'}</span>
          </div>
          <div className="mt-1 text-xs text-text-secondary ml-[18px]">
            {connected ? `v${daemonVersion || '?.?.?'} · localhost:3000` : 'Offline'}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-focus-border">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>Settings</span>
            <span className="text-gray-600">{'>'}</span>
            <span className="text-white font-medium">
              {NAV_ITEMS.find(i => i.id === activeSection)?.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetDefaults}
              className="text-sm text-text-secondary hover:text-white transition-colors"
            >
              Reset Defaults
            </button>
            <button
              disabled
              className={`px-4 py-2 text-sm font-medium rounded-lg cursor-default flex items-center gap-1.5 transition-colors ${
                saveState === 'saved' ? 'bg-focus-success/20 text-focus-success' : 'bg-focus-primary/50 text-white/70'
              }`}
            >
              {saveState === 'saving' ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">check</span>
                  Saved
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
                <h1 className="text-2xl font-bold text-white mb-2">Focus Settings</h1>
                <p className="text-text-secondary mb-8">
                  Configure how FocusFlow manages your environment during deep work sessions. Customize automation triggers and cooldown periods.
                </p>

                <div className="mb-8">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
                    <span className="material-symbols-outlined text-focus-primary">psychology</span>
                    Focus Behavior
                  </h2>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-focus-surface border border-focus-border rounded-xl p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-focus-bg rounded-lg flex items-center justify-center">
                          <span className="material-symbols-outlined text-focus-primary">code</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">Auto-return to IDE</div>
                          <div className="text-xs text-text-secondary">Automatically switch context back when build succeeds</div>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={settings.enableDoneFocus}
                        onChange={(checked) => saveSettings({ enableDoneFocus: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between bg-focus-surface border border-focus-border rounded-xl p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-focus-bg rounded-lg flex items-center justify-center">
                          <span className="material-symbols-outlined text-focus-primary">public</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">Always return on completion</div>
                          <div className="text-xs text-text-secondary">Return to Home tab even when not on a distraction site</div>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={settings.alwaysFocusOnDone}
                        onChange={(checked) => saveSettings({ alwaysFocusOnDone: checked })}
                        disabled={!settings.enableDoneFocus}
                      />
                    </div>

                    <div className="flex items-center justify-between bg-focus-surface border border-focus-border rounded-xl p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-focus-bg rounded-lg flex items-center justify-center">
                          <span className="material-symbols-outlined text-focus-primary">smart_toy</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">AI Gen Blocking</div>
                          <div className="text-xs text-text-secondary">Block distraction sites during active AI generation</div>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={settings.mode === 'force'}
                        onChange={(checked) => saveSettings({ mode: checked ? 'force' : 'normal' })}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'timer' && (
              <>
                <h1 className="text-2xl font-bold text-white mb-2">Cooldown &amp; Timing</h1>
                <p className="text-text-secondary mb-8">
                  Configure countdown and cooldown durations for focus sessions.
                </p>

                <div className="mb-8">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
                    <span className="material-symbols-outlined text-focus-primary">hourglass_top</span>
                    Cooldown &amp; Timing
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
                      <div className="text-[10px] font-semibold tracking-widest uppercase text-text-secondary mb-3">
                        Return Countdown
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={Math.round(settings.doneCountdownMs / 1000)}
                          onChange={(e) => saveSettings({ doneCountdownMs: Number(e.target.value) * 1000 })}
                          min={1}
                          max={30}
                          className="w-full bg-focus-bg border border-focus-border rounded-lg px-4 py-3 text-2xl font-bold text-white text-center focus:outline-none focus:ring-2 focus:ring-focus-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-text-secondary text-sm shrink-0">seconds</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-2">Delay before forcing focus back to IDE.</p>
                    </div>

                    <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
                      <div className="text-[10px] font-semibold tracking-widest uppercase text-text-secondary mb-3">
                        Focus Cooldown
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={Math.round(settings.doneCooldownMs / 60000)}
                          onChange={(e) => saveSettings({ doneCooldownMs: Number(e.target.value) * 60000 })}
                          min={1}
                          max={60}
                          className="w-full bg-focus-bg border border-focus-border rounded-lg px-4 py-3 text-2xl font-bold text-white text-center focus:outline-none focus:ring-2 focus:ring-focus-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-text-secondary text-sm shrink-0">minutes</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-2">Minimum break time between heavy focus sessions.</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'blocklist' && (
              <>
                <h1 className="text-2xl font-bold text-white mb-2">Distraction Domains</h1>
                <p className="text-text-secondary mb-8">
                  Manage the list of websites that trigger auto-return when tasks complete.
                </p>

                <div className="mb-8">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
                    <span className="material-symbols-outlined text-focus-primary">domain_disabled</span>
                    Distraction Domains
                  </h2>

                  <div className="flex gap-2 mb-6">
                    <div className="flex-1 relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">link</span>
                      <input
                        type="text"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                        placeholder="Add a domain (e.g. twitter.com)..."
                        className="w-full bg-focus-surface border border-focus-border rounded-xl pl-10 pr-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-focus-primary"
                      />
                    </div>
                    <button
                      onClick={addDomain}
                      className="flex items-center gap-1.5 px-5 py-3 bg-focus-primary text-white text-sm font-medium rounded-xl hover:bg-blue-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">add</span>
                      Add
                    </button>
                  </div>

                  {settings.distractionDomains.length > 0 && (
                    <>
                      <div className="text-[10px] font-semibold tracking-widest uppercase text-text-secondary mb-3">
                        Blocked List
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {settings.distractionDomains.map((domain) => (
                          <div
                            key={domain}
                            className="group flex items-center gap-2 bg-focus-surface border border-focus-border rounded-full px-3 py-1.5 hover:border-red-500/50 transition-colors"
                          >
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                              alt=""
                              className="w-4 h-4 rounded-sm"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <span className="text-sm text-gray-300">{domain}</span>
                            <button
                              onClick={() => removeDomain(domain)}
                              className="text-gray-500 hover:text-red-400 transition-colors ml-0.5"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {settings.distractionDomains.length === 0 && (
                    <div className="text-text-secondary text-center py-8">
                      No distraction domains configured
                    </div>
                  )}
                </div>
              </>
            )}

            {activeSection === 'general' && (
              <>
                <h1 className="text-2xl font-bold text-white mb-2">General Settings</h1>
                <p className="text-text-secondary mb-8">
                  Connection management and system settings.
                </p>

                <div className="space-y-4">
                  <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
                    <div className="font-medium text-white mb-1">Daemon Connection</div>
                    <div className="text-sm text-text-secondary mb-3">
                      The daemon should be running at http://127.0.0.1:3000
                    </div>
                    <button
                      onClick={() => chrome.runtime.sendMessage({ type: 'reconnect' })}
                      className="flex items-center gap-2 px-4 py-2 bg-focus-bg border border-focus-border rounded-lg text-sm text-gray-300 hover:text-white hover:border-focus-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">refresh</span>
                      Reconnect
                    </button>
                  </div>

                  <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
                    <div className="font-medium text-white mb-1">Reset to Defaults</div>
                    <div className="text-sm text-text-secondary mb-3">
                      Restore all settings to their default values
                    </div>
                    <button
                      onClick={resetDefaults}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">restart_alt</span>
                      Reset Settings
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
