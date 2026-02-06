import { useTranslation } from '@/i18n/TranslationContext';

export default function LanguageToggle() {
  const { language, setLanguage, t } = useTranslation();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ja' : 'en');
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="px-3 py-2 rounded-lg bg-sf-bg-elevated border border-sf-border hover:border-sf-accent transition-colors text-sm font-medium text-sf-text"
      title={t('language.toggle')}
    >
      {language === 'en' ? 'EN' : 'JA'}
    </button>
  );
}
