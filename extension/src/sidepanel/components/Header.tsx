import { useTranslation } from '@/i18n/TranslationContext';
import { useTheme } from '@/theme/useTheme';

interface HeaderProps {
  connected: boolean;
}

export function Header({ connected }: HeaderProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();

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
            {/* 🍣 寿司キャラステータスインジケーター（ダーク: 次郎 / ライト: 太郎） */}
            <div className="status-orb-container">
              <div className={`
                status-orb overflow-hidden !w-14 !h-14
                ${connected ? 'status-orb-connected' : 'status-orb-offline'}
              `}>
                <img
                  src={theme === 'dark' ? '/assets/sushi_jiro.png' : '/assets/sushi_taro.png'}
                  alt={theme === 'dark' ? 'Sushi Jiro' : 'Sushi Taro'}
                  className={`w-12 h-12 object-contain ${connected ? 'sushi-wobble' : 'grayscale opacity-50'}`}
                />
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

        </div>
      </div>

      {/* 木のカウンター - 洗練された縁取り */}
      <div className="wood-counter-refined" />
    </header>
  );
}
