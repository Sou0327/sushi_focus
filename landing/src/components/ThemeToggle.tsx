import { useTheme } from '@/theme/ThemeContext';
import { useTranslation } from '@/i18n/TranslationContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const toggleLabel = theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-sf-bg-elevated border border-sf-border hover:border-sf-accent transition-colors"
      aria-label={toggleLabel}
      title={toggleLabel}
    >
      <span className="text-lg">
        {theme === 'dark' ? '☀️' : '🌙'}
      </span>
    </button>
  );
}
