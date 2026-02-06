import type { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';
import { useTranslation } from '@/i18n/TranslationContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <a
        href="#main-content"
        className="skip-nav"
      >
        {t('common.skipToContent')}
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
