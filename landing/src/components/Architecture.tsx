import { useTranslation } from '@/i18n/TranslationContext';
import { useTheme } from '@/theme/ThemeContext';

export default function Architecture() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const characterImage = theme === 'dark' ? '/sushi_jiro.webp' : '/sushi_taro.webp';

  return (
    <section id="architecture" className="section bg-sf-bg-elevated">
      <div className="container">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="section-title mb-4">{t('architecture.title')}</h2>
          <p className="text-lg text-sf-text-secondary">{t('architecture.subtitle')}</p>
        </div>

        {/* Architecture Diagram */}
        <div className="card max-w-4xl mx-auto p-8 lg:p-12 fade-in-up">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-0">
            {/* Claude Code */}
            <div className="arch-node">
              <div className="arch-box primary">
                <span className="text-3xl mb-2">🤖</span>
                <span className="text-xs font-bold">{t('architecture.flow.claudeCode')}</span>
              </div>
              <span className="mt-3 text-xs text-sf-text-muted">({t('architecture.flow.aiAgent')})</span>
            </div>

            {/* Arrow 1 */}
            <div className="arch-arrow hidden lg:flex">
              <div className="arch-arrow-line" />
              <div className="mt-2 text-center">
                <div className="text-xs font-bold text-sf-salmon">{t('architecture.flow.httpPost')}</div>
                <div className="text-[10px] text-sf-text-muted">{t('architecture.flow.agentEvents')}</div>
              </div>
            </div>
            <div className="lg:hidden flex flex-col items-center my-2">
              <div className="w-0.5 h-8 bg-gradient-to-b from-sf-salmon to-sf-wasabi" />
              <div className="text-xs text-sf-text-muted mt-1">{t('architecture.flow.httpPost')}</div>
            </div>

            {/* Daemon */}
            <div className="arch-node">
              <div className="arch-box secondary">
                <img src={characterImage} alt="Sushi Focus daemon" loading="lazy" width={40} height={40} className="w-10 h-10 object-contain mb-2" />
                <span className="text-xs font-bold">{t('architecture.flow.daemon')}</span>
                <span className="text-[10px] opacity-75">:41593</span>
              </div>
              <span className="mt-3 text-xs text-sf-text-muted">({t('architecture.flow.nodejs')})</span>
            </div>

            {/* Arrow 2 */}
            <div className="arch-arrow hidden lg:flex">
              <div className="arch-arrow-line" />
              <div className="mt-2 text-center">
                <div className="text-xs font-bold text-sf-wasabi">{t('architecture.flow.websocket')}</div>
                <div className="text-[10px] text-sf-text-muted">{t('architecture.flow.daemonEvent')}</div>
              </div>
            </div>
            <div className="lg:hidden flex flex-col items-center my-2">
              <div className="w-0.5 h-8 bg-gradient-to-b from-sf-wasabi to-sf-gold" />
              <div className="text-xs text-sf-text-muted mt-1">{t('architecture.flow.websocket')}</div>
            </div>

            {/* Chrome Extension */}
            <div className="arch-node">
              <div className="arch-box tertiary">
                <span className="text-3xl mb-2">🌐</span>
                <span className="text-xs font-bold">{t('architecture.flow.extension')}</span>
              </div>
              <span className="mt-3 text-xs text-sf-text-muted">({t('architecture.flow.mv3')})</span>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-12 pt-8 border-t border-sf-border">
            <div className="flex flex-wrap justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gradient-to-br from-[var(--sf-salmon)] to-[var(--sf-salmon-deep)]" />
                <span className="text-sf-text-secondary">{t('architecture.flow.aiAgentEventsLegend')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gradient-to-br from-[var(--sf-wasabi)] to-[#5A7A4A]" />
                <span className="text-sf-text-secondary">{t('architecture.flow.focusControl')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
