import { useTranslation } from '@/i18n/TranslationContext';
import { useTheme } from '@/theme/ThemeContext';

const GITHUB_URL = 'https://github.com/Sou0327/sushi_focus';
const GITHUB_RELEASES_URL = 'https://github.com/Sou0327/sushi_focus/releases';

export default function CTA() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const characterImage = theme === 'dark' ? '/sushi_jiro.webp' : '/sushi_taro.webp';

  return (
    <section className="section">
      <div className="container">
        <div className="max-w-3xl mx-auto">
          <div className="card border-gradient p-10 lg:p-12 text-center fade-in-up">
            {/* Icon */}
            <img src={characterImage} alt="Sushi Focus mascot" loading="lazy" width={96} height={96} className="w-24 h-24 object-contain mb-6 float inline-block mx-auto" />

            {/* Title */}
            <h2 className="section-title mb-4">{t('cta.title')}</h2>
            <p className="text-lg text-sf-text-secondary mb-8 max-w-xl mx-auto">
              {t('cta.subtitle')}
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary text-base px-8 py-4"
              >
                <DownloadIcon className="w-5 h-5" />
                {t('cta.download')}
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary text-base px-8 py-4"
              >
                <StarIcon className="w-5 h-5" />
                {t('cta.github')}
              </a>
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

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}
