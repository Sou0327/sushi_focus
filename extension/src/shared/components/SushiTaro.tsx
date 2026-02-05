import type { Theme } from '@/shared/types';

interface SushiTaroProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  style?: React.CSSProperties;
  /** テーマを外部から渡す（リスナー重複回避のため） */
  theme?: Theme;
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
  '2xl': 'w-12 h-12',
};

export function SushiTaro({ className = '', size = 'md', style, theme = 'dark' }: SushiTaroProps) {
  const imageSrc = theme === 'dark'
    ? '/assets/sushi_jiro.png'  // ダークモード: 寿司次郎
    : '/assets/sushi_taro.png'; // ライトモード: 寿司太郎
  const altText = theme === 'dark' ? 'Sushi Jiro' : 'Sushi Taro';

  return (
    <img
      src={imageSrc}
      alt={altText}
      className={`object-contain ${sizeClasses[size]} ${className}`}
      style={style}
    />
  );
}
