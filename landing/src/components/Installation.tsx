import { useState } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';

const GITHUB_RELEASES_URL = 'https://github.com/Sou0327/sushi_focus/releases';

export default function Installation() {
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState<{ id: string; status: 'copied' | 'failed' } | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API not available');
      }

      await navigator.clipboard.writeText(text);
      setCopyStatus({ id, status: 'copied' });
    } catch {
      setCopyStatus({ id, status: 'failed' });
    } finally {
      window.setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const getCopyLabel = (id: string) => {
    if (copyStatus?.id !== id) return t('installation.copy.action');
    return copyStatus.status === 'copied' ? t('installation.copy.copied') : t('installation.copy.failed');
  };

  return (
    <section id="installation" className="section">
      <div className="container">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="section-title mb-4">{t('installation.title')}</h2>
          <p className="text-lg text-sf-text-secondary">{t('installation.subtitle')}</p>
        </div>

        {/* Installation Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {/* Chrome Extension */}
          <div className="card fade-in-up">
            <div className="card-icon bg-gradient-to-br from-[var(--sf-salmon)] to-[var(--sf-salmon-deep)]" style={{ border: 'none' }}>
              <span className="text-xl">🌐</span>
            </div>
            <h3 className="card-title">{t('installation.chromeExtension.title')}</h3>
            <ol className="space-y-3 text-sm text-sf-text-secondary">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sf-salmon text-white text-xs flex items-center justify-center font-bold">1</span>
                <a
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sf-salmon hover:underline"
                >
                  {t('installation.chromeExtension.step1')}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sf-salmon text-white text-xs flex items-center justify-center font-bold">2</span>
                <span>{t('installation.chromeExtension.step2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sf-salmon text-white text-xs flex items-center justify-center font-bold">3</span>
                <span>{t('installation.chromeExtension.step3')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sf-salmon text-white text-xs flex items-center justify-center font-bold">4</span>
                <span>{t('installation.chromeExtension.step4')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sf-salmon text-white text-xs flex items-center justify-center font-bold">5</span>
                <span>{t('installation.chromeExtension.step5')}</span>
              </li>
            </ol>
          </div>

          {/* Claude Code Plugin */}
          <div className="card fade-in-up delay-100">
            <div className="card-icon bg-gradient-to-br from-[var(--sf-wasabi)] to-[#5A7A4A]" style={{ border: 'none' }}>
              <span className="text-xl">🔌</span>
            </div>
            <h3 className="card-title">{t('installation.claudePlugin.title')}</h3>
            <p className="text-sm text-sf-text-secondary mb-4">
              {t('installation.claudePlugin.description')}
            </p>
            <div className="space-y-3">
              <div className="code-block">
                <div className="code-block-header">
                  <span>{t('installation.claudePlugin.step1Label')}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('claude plugin marketplace add github:Sou0327/sushi_focus', 'plugin1')}
                    className="copy-btn"
                    aria-label={t('installation.claudePlugin.copyStep1AriaLabel')}
                  >
                    {getCopyLabel('plugin1')}
                  </button>
                </div>
                <div className="code-block-content text-xs">
                  {t('installation.claudePlugin.command1')}
                </div>
              </div>
              <div className="code-block">
                <div className="code-block-header">
                  <span>{t('installation.claudePlugin.step2Label')}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('claude plugin install sushi-focus-daemon@sushi-focus', 'plugin2')}
                    className="copy-btn"
                    aria-label={t('installation.claudePlugin.copyStep2AriaLabel')}
                  >
                    {getCopyLabel('plugin2')}
                  </button>
                </div>
                <div className="code-block-content text-xs">
                  {t('installation.claudePlugin.command2')}
                </div>
              </div>
            </div>
          </div>

          {/* Build from Source */}
          <div className="card fade-in-up delay-200">
            <div className="card-icon bg-gradient-to-br from-[var(--sf-gold)] to-[#A68B52]" style={{ border: 'none' }}>
              <span className="text-xl">🛠️</span>
            </div>
            <h3 className="card-title">{t('installation.buildFromSource.title')}</h3>
            <p className="text-sm text-sf-text-secondary mb-4">
              {t('installation.buildFromSource.description')}
            </p>
            <ol className="space-y-2 text-sm text-sf-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-sf-gold font-bold">1.</span>
                <span>{t('installation.buildFromSource.step1')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sf-gold font-bold">2.</span>
                <span>{t('installation.buildFromSource.step2')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sf-gold font-bold">3.</span>
                <span>{t('installation.buildFromSource.step3')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sf-gold font-bold">4.</span>
                <span>{t('installation.buildFromSource.step4')}</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
