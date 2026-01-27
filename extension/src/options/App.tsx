import { useState, useEffect } from 'react';
import type { ExtensionSettings } from '@/shared/types';

type SettingsSection = 'focus' | 'distraction' | 'advanced';

const SECTION_LABELS: Record<SettingsSection, { label: string; icon: string }> = {
  focus: { label: 'Focus Settings', icon: '🎯' },
  distraction: { label: 'Distraction Domains', icon: '📵' },
  advanced: { label: 'Advanced', icon: '⚙️' },
};

const COUNTDOWN_OPTIONS = [
  { value: 1000, label: '1 second' },
  { value: 1500, label: '1.5 seconds' },
  { value: 2000, label: '2 seconds' },
  { value: 3000, label: '3 seconds' },
];

const COOLDOWN_OPTIONS = [
  { value: 30000, label: '30 seconds' },
  { value: 45000, label: '45 seconds' },
  { value: 60000, label: '1 minute' },
  { value: 120000, label: '2 minutes' },
];

export default function App() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>('focus');
  const [newDomain, setNewDomain] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'get_settings' }, (response) => {
      if (response?.settings) {
        setSettings(response.settings);
      }
    });
  }, []);

  const saveSettings = (updates: Partial<ExtensionSettings>) => {
    if (!settings) return;

    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);

    chrome.runtime.sendMessage({
      type: 'update_settings',
      settings: updates,
    }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const addDomain = () => {
    if (!settings || !newDomain.trim()) return;

    const domain = newDomain.trim().toLowerCase();
    if (settings.distractionDomains.includes(domain)) {
      setNewDomain('');
      return;
    }

    const newDomains = [...settings.distractionDomains, domain];
    saveSettings({ distractionDomains: newDomains });
    setNewDomain('');
  };

  const removeDomain = (domain: string) => {
    if (!settings) return;

    const newDomains = settings.distractionDomains.filter((d) => d !== domain);
    saveSettings({ distractionDomains: newDomains });
  };

  if (!settings) {
    return (
      <div className="min-h-screen bg-focus-bg text-gray-100 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-focus-bg text-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="text-3xl">🎯</span>
            FocusFlow Settings
          </h1>
          {saved && (
            <div className="mt-2 text-focus-success text-sm">
              ✓ Settings saved
            </div>
          )}
        </header>

        <div className="flex gap-6">
          {/* Sidebar */}
          <nav className="w-48 flex-shrink-0">
            <div className="flex flex-col gap-1">
              {(Object.keys(SECTION_LABELS) as SettingsSection[]).map((section) => {
                const info = SECTION_LABELS[section];
                const isActive = activeSection === section;

                return (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    className={`flex items-center gap-2 p-3 rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-focus-primary text-white'
                        : 'text-gray-300 hover:bg-focus-surface'
                    }`}
                  >
                    <span>{info.icon}</span>
                    <span>{info.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content */}
          <main className="flex-1">
            {activeSection === 'focus' && (
              <div className="card">
                <h2 className="text-lg font-bold mb-4">Focus Settings</h2>

                {/* need_input Focus */}
                <div className="mb-6">
                  <label className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Auto-focus on Input Required</div>
                      <div className="text-sm text-gray-400">
                        Immediately return to home tab when agent needs input
                      </div>
                    </div>
                    <div className="text-focus-primary font-medium">
                      Always On
                    </div>
                  </label>
                </div>

                {/* done Focus */}
                <div className="mb-6">
                  <label className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Auto-focus on Task Complete</div>
                      <div className="text-sm text-gray-400">
                        Return to home tab when task finishes (distraction sites only)
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableDoneFocus}
                      onChange={(e) => saveSettings({ enableDoneFocus: e.target.checked })}
                      className="w-5 h-5 rounded accent-focus-primary"
                    />
                  </label>
                </div>

                {/* Countdown Duration */}
                <div className="mb-6">
                  <label className="block">
                    <div className="font-medium mb-2">Return Countdown</div>
                    <select
                      value={settings.doneCountdownMs}
                      onChange={(e) => saveSettings({ doneCountdownMs: Number(e.target.value) })}
                      className="input"
                    >
                      {COUNTDOWN_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className="text-sm text-gray-400 mt-1">
                      Time before auto-returning to home tab
                    </div>
                  </label>
                </div>

                {/* Cooldown Duration */}
                <div className="mb-6">
                  <label className="block">
                    <div className="font-medium mb-2">Cooldown Period</div>
                    <select
                      value={settings.doneCooldownMs}
                      onChange={(e) => saveSettings({ doneCooldownMs: Number(e.target.value) })}
                      className="input"
                    >
                      {COOLDOWN_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className="text-sm text-gray-400 mt-1">
                      Minimum time between auto-returns
                    </div>
                  </label>
                </div>
              </div>
            )}

            {activeSection === 'distraction' && (
              <div className="card">
                <h2 className="text-lg font-bold mb-4">Distraction Domains</h2>
                <p className="text-gray-400 mb-4">
                  Auto-return on task complete only activates when you're browsing these sites.
                </p>

                {/* Add Domain */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                    placeholder="e.g., facebook.com"
                    className="input flex-1"
                  />
                  <button onClick={addDomain} className="btn-primary">
                    Add
                  </button>
                </div>

                {/* Domain List */}
                <div className="flex flex-wrap gap-2">
                  {settings.distractionDomains.map((domain) => (
                    <div
                      key={domain}
                      className="flex items-center gap-2 bg-focus-surface border border-focus-border rounded-full px-3 py-1"
                    >
                      <span className="text-sm">{domain}</span>
                      <button
                        onClick={() => removeDomain(domain)}
                        className="text-gray-400 hover:text-focus-error"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {settings.distractionDomains.length === 0 && (
                  <div className="text-gray-500 text-center py-4">
                    No distraction domains configured
                  </div>
                )}
              </div>
            )}

            {activeSection === 'advanced' && (
              <div className="card">
                <h2 className="text-lg font-bold mb-4">Advanced Settings</h2>

                <div className="mb-6">
                  <div className="font-medium mb-2">Daemon Connection</div>
                  <div className="text-sm text-gray-400 mb-2">
                    The daemon should be running at http://127.0.0.1:3000
                  </div>
                  <button
                    onClick={() => chrome.runtime.sendMessage({ type: 'reconnect' })}
                    className="btn-secondary"
                  >
                    🔄 Reconnect
                  </button>
                </div>

                <div className="mb-6">
                  <div className="font-medium mb-2">Reset to Defaults</div>
                  <button
                    onClick={() => {
                      if (confirm('Reset all settings to defaults?')) {
                        saveSettings({
                          mode: 'force',
                          enableDoneFocus: true,
                          doneCountdownMs: 1500,
                          doneCooldownMs: 45000,
                          distractionDomains: [
                            'netflix.com',
                            'tiktok.com',
                            'youtube.com',
                            'x.com',
                            'twitter.com',
                            'instagram.com',
                            'twitch.tv',
                            'reddit.com',
                          ],
                        });
                      }
                    }}
                    className="btn-danger"
                  >
                    Reset Settings
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
