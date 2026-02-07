import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';
import { useTheme } from '@/theme/ThemeContext';

export default function DemoTerminal() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [isRunning, setIsRunning] = useState(false);
  const characterImage = theme === 'dark' ? '/sushi_jiro.webp' : '/sushi_taro.webp';
  const demoLines = [
    { type: 'command', text: t('demo.terminal.command') },
    { type: 'info', text: t('demo.terminal.starting') },
    { type: 'info', text: `📂 ${t('demo.terminal.analyzing')}` },
    { type: 'info', text: t('demo.terminal.foundIssue') },
    { type: 'info', text: `✏️  ${t('demo.terminal.implementing')}` },
    { type: 'success', text: t('demo.terminal.testsPassing') },
    { type: 'success', text: `🎉 ${t('demo.terminal.complete')}` },
    { type: 'focus', text: `🍣 ${t('common.sushiFocus')}: ${t('demo.terminal.focusReturn')}` },
  ] as const;

  useEffect(() => {
    if (!isRunning) return;

    if (visibleLines < demoLines.length) {
      const timeout = setTimeout(() => {
        setVisibleLines((prev) => prev + 1);
      }, 800);
      return () => clearTimeout(timeout);
    } else {
      const resetTimeout = setTimeout(() => {
        setVisibleLines(0);
        setIsRunning(false);
      }, 3000);
      return () => clearTimeout(resetTimeout);
    }
  }, [demoLines.length, isRunning, visibleLines]);

  const startDemo = () => {
    setVisibleLines(0);
    setIsRunning(true);
  };

  return (
    <section id="demo" className="section bg-sf-bg-elevated">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="section-title mb-4">{t('demo.title')}</h2>
            <p className="text-lg text-sf-text-secondary">{t('demo.subtitle')}</p>
          </div>

          {/* Terminal */}
          <div className="terminal fade-in-up">
            {/* Header */}
            <div className="terminal-header">
              <div className="terminal-dots">
                <span className="terminal-dot red" />
                <span className="terminal-dot yellow" />
                <span className="terminal-dot green" />
              </div>
              <span className="text-sm text-sf-text-muted font-mono">~/project</span>
              <button
                type="button"
                onClick={startDemo}
                disabled={isRunning}
                className="btn btn-primary text-xs px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? t('demo.controls.running') : t('demo.controls.run')}
              </button>
            </div>

            {/* Body */}
            <div className="terminal-body">
              {demoLines.slice(0, visibleLines).map((line, index) => (
                <div
                  key={index}
                  className={`terminal-line ${line.type}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {line.text}
                </div>
              ))}

              {/* Cursor */}
              {isRunning && visibleLines < demoLines.length && (
                <span className="terminal-cursor" />
              )}

              {/* Idle State */}
              {!isRunning && visibleLines === 0 && (
                <div className="text-center py-16">
                  <img src={characterImage} alt="Sushi Focus mascot waiting" loading="lazy" width={80} height={80} className="w-20 h-20 object-contain mb-4 float inline-block mx-auto" />
                  <p className="text-sf-text-muted">{t('demo.terminal.running')}</p>
                  <p className="text-sm text-sf-text-dim mt-2">{t('demo.controls.clickToStart')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
