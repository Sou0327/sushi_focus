import { useTheme } from '@/theme/ThemeContext';
import { useTranslation } from '@/i18n/TranslationContext';

const GITHUB_RELEASES_URL = 'https://github.com/Sou0327/sushi_focus/releases';

export default function Hero() {
  const { theme } = useTheme();
  const { t, language } = useTranslation();
  const characterImage = theme === 'dark' ? '/sushi_jiro.webp' : '/sushi_taro.webp';

  return (
    <section className="section min-h-[90vh] flex items-center relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 70% 40%, var(--sf-salmon) 0%, transparent 60%)`,
        }}
      />

      <div className="container relative z-10">
        {/* Main Content - Asymmetric Layout */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Text Content - Wider */}
          <div className="lg:col-span-7 space-y-8">
            {/* Badge */}
            <div className="fade-in-up">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sf-bg-card border border-sf-border text-sm">
                <span className="w-2 h-2 rounded-full bg-sf-wasabi animate-pulse" />
                <span className="text-sf-text-secondary">{t('hero.badgeOpenSource')}</span>
                <span className="text-sf-text-muted">•</span>
                <span className="text-sf-text-muted">{t('hero.badgeLicense')}</span>
              </span>
            </div>

            {/* Title */}
            <div className="fade-in-up delay-100">
              <h1 className="hero-title">
                {language === 'ja' ? (
                  <>
                    <span className="block">AIエージェントに<span className="accent">おまかせ</span>開発</span>
                  </>
                ) : (
                  <>
                    <span className="block">Let AI Handle</span>
                    <span className="block">
                      Your <span className="accent">Focus</span>
                    </span>
                  </>
                )}
              </h1>
            </div>

            {/* Description */}
            <p className="fade-in-up delay-200 text-lg text-sf-text-secondary max-w-xl leading-relaxed">
              {t('hero.description')}
            </p>

            {/* CTA Buttons */}
            <div className="fade-in-up delay-300 flex flex-wrap gap-4">
              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <DownloadIcon className="w-5 h-5" />
                {t('hero.cta')}
              </a>
              <a href="#demo" className="btn btn-secondary">
                <PlayIcon className="w-5 h-5" />
                {t('hero.ctaSecondary')}
              </a>
            </div>

            {/* Stats */}
            <div className="fade-in-up delay-400 flex gap-8 pt-4">
              <div>
                <div className="text-2xl font-display font-bold text-sf-text">{t('hero.statsPlatform')}</div>
                <div className="text-sm text-sf-text-muted">{t('hero.statsSupported')}</div>
              </div>
              <div className="w-px bg-sf-border" />
              <div>
                <div className="text-2xl font-display font-bold text-sf-text">100%</div>
                <div className="text-sm text-sf-text-muted">{t('hero.statsFree')}</div>
              </div>
            </div>
          </div>

          {/* Character - Narrower, Floating */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative">
              {/* Glow ring */}
              <div
                className="absolute inset-0 rounded-full blur-3xl opacity-20"
                style={{ background: 'var(--sf-salmon)' }}
              />

              {/* Character */}
              <img
                src={characterImage}
                alt={theme === 'dark' ? 'Sushi Focus mascot Sushi Jiro' : 'Sushi Focus mascot Sushi Taro'}
                width={320}
                height={320}
                fetchPriority="high"
                className="relative w-56 h-56 md:w-72 md:h-72 lg:w-80 lg:h-80 object-contain float drop-shadow-2xl"
              />

              {/* Floating badges */}
              <div className="absolute -top-4 -right-4 bg-sf-bg-card border border-sf-border rounded-lg px-3 py-2 text-sm font-medium shadow-lg fade-in-up delay-400">
                <span className="text-sf-wasabi">✓</span> {t('hero.floatingTaskComplete')}
              </div>
              <div className="absolute -bottom-2 -left-4 bg-sf-bg-card border border-sf-border rounded-lg px-3 py-2 text-sm font-medium shadow-lg fade-in-up delay-500">
                <span className="text-sf-salmon">→</span> {t('hero.floatingFocusRestored')}
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
