import { useTranslation } from '@/i18n/TranslationContext';

interface HeaderProps {
  connected: boolean;
  gitBranch?: string | null;
}

export function Header({ connected, gitBranch }: HeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          {connected && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-focus-success opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connected ? 'bg-focus-success' : 'bg-focus-error'}`} />
        </span>
        <div>
          <div className={`text-xs font-semibold tracking-wider uppercase ${connected ? 'text-focus-success' : 'text-focus-error'}`}>
            {connected ? t('header.connected') : t('header.offline')}
          </div>
          <div className="text-sm font-medium text-heading">{t('header.daemonName')}</div>
        </div>
      </div>
      {gitBranch && (
        <div className="flex items-center gap-1.5 bg-focus-surface border border-focus-border rounded-full px-3 py-1">
          <span className="material-symbols-outlined text-text-secondary text-base">call_split</span>
          <span className="text-xs text-text-secondary font-mono truncate max-w-[120px]">{gitBranch}</span>
        </div>
      )}
    </header>
  );
}
