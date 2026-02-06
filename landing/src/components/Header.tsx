import { useState } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';
import { useTheme } from '@/theme/ThemeContext';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';

const GITHUB_URL = 'https://github.com/Sou0327/sushi_focus';

export default function Header() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const characterImage = theme === 'dark' ? '/sushi_jiro.webp' : '/sushi_taro.webp';

  return (
    <header className="header">
      <div className="header-inner">
        {/* Logo */}
        <a href="/" className="logo">
          <img src={characterImage} alt="Sushi Focus" width={32} height={32} className="logo-icon w-8 h-8 object-contain" />
          <span className="logo-text">{t('common.sushiFocus')}</span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <a href="#features" className="nav-link">
            {t('nav.features')}
          </a>
          <a href="#demo" className="nav-link">
            {t('nav.demo')}
          </a>
          <a href="#installation" className="nav-link">
            {t('nav.installation')}
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link flex items-center gap-1.5"
          >
            <GitHubIcon className="w-4 h-4" />
            GitHub
          </a>
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-sf-text-secondary hover:text-sf-text hover:bg-sf-bg-elevated transition-colors"
            aria-label={mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-controls="mobile-navigation"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <nav id="mobile-navigation" className="md:hidden border-t border-sf-border-subtle">
          <div className="px-4 py-4 space-y-1">
            <a
              href="#features"
              className="block px-4 py-3 rounded-lg text-sf-text-secondary hover:text-sf-text hover:bg-sf-bg-elevated transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.features')}
            </a>
            <a
              href="#demo"
              className="block px-4 py-3 rounded-lg text-sf-text-secondary hover:text-sf-text hover:bg-sf-bg-elevated transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.demo')}
            </a>
            <a
              href="#installation"
              className="block px-4 py-3 rounded-lg text-sf-text-secondary hover:text-sf-text hover:bg-sf-bg-elevated transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.installation')}
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-sf-text-secondary hover:text-sf-text hover:bg-sf-bg-elevated transition-colors"
            >
              <GitHubIcon className="w-5 h-5" />
              GitHub
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}
