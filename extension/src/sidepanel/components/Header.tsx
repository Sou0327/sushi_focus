import { useTranslation } from '@/i18n/TranslationContext';

interface HeaderProps {
  connected: boolean;
  gitBranch?: string | null;
}

export function Header({ connected, gitBranch }: HeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="relative overflow-hidden header-glass">
      {/* 🏮 暖簾 (Noren) Style Header - より洗練されたデザイン */}
      <div className="noren-refined px-4 py-4">
        {/* 暖簾の垂れ下がり部分 - 控えめだけど存在感あり */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-around pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="noren-flap-refined"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            {/* 🍣 ステータスインジケーター - より視認性高く */}
            <div className="status-orb-container">
              <div className={`
                status-orb
                ${connected ? 'status-orb-connected' : 'status-orb-offline'}
              `}>
                <span className={`text-2xl ${connected ? 'sushi-wobble' : ''}`}>
                  {connected ? '🍣' : '💤'}
                </span>
              </div>
              {/* 接続時のパルスリング */}
              {connected && (
                <div className="status-pulse-ring" />
              )}
            </div>

            <div className="flex flex-col">
              {/* ステータステキスト - クリアで読みやすく */}
              <span className={`
                status-label
                ${connected ? 'status-label-connected' : 'status-label-offline'}
              `}>
                {connected ? t('header.connected') : t('header.offline')}
              </span>
              {/* タイトル */}
              <span className="header-title">
                {t('header.daemonName')}
                {connected && <span className="ml-1 sparkle-mini">✨</span>}
              </span>
            </div>
          </div>

          {/* Git Branch - 木札風バッジ */}
          {gitBranch && (
            <div className="git-badge">
              <span className="git-icon">🌿</span>
              <span className="git-branch">{gitBranch}</span>
            </div>
          )}
        </div>

        {/* 🏮 提灯デコレーション - 右上に控えめに */}
        <div className="absolute top-1 right-2 flex gap-2 opacity-60">
          {['🏮'].map((lantern, i) => (
            <span
              key={i}
              className="text-xl lantern-gentle"
              style={{ animationDelay: `${i * 0.8}s` }}
            >
              {lantern}
            </span>
          ))}
        </div>
      </div>

      {/* 木のカウンター - 洗練された縁取り */}
      <div className="wood-counter-refined" />
    </header>
  );
}
