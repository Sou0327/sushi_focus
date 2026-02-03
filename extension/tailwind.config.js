/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 🍣 Sushi Theme Colors - MAXIMUM SUSHI MODE
        sushi: {
          // Primary - マグロ/サーモン系
          salmon: '#E85D4C',
          salmonGlow: '#FF6B5B',
          tuna: '#C84B3D',
          tunaDeep: '#8B2500',
          // Secondary - 醤油ダーク
          shoyu: '#2C1810',
          shoyuLight: '#4A2C1C',
          // Accent - ワサビグリーン（激辛）
          wasabi: '#7CB342',
          wasabiDark: '#558B2F',
          wasabiNeon: '#8FFF00',
          wasabiGlow: '#ADFF2F',
          // Neutral - シャリ/木
          rice: '#FFF8E7',
          riceWarm: '#F5E6C8',
          riceGlow: '#FFFEF0',
          wood: '#8B5A2B',
          woodDark: '#5D3A1A',
          woodLight: '#C4956A',
          bamboo: '#D4B896',
          // 海苔ダーク
          nori: '#1A2F1A',
          noriLight: '#2D4A2D',
          // ガリピンク
          ginger: '#FFB6C1',
          gingerDark: '#FF8BA7',
          gingerGlow: '#FFD1DC',
          // 卵焼きイエロー
          tamago: '#FFD700',
          tamagoLight: '#FFF3B0',
          // イクラオレンジ
          ikura: '#FF6347',
          ikuraGlow: '#FF7F50',
          // ウニゴールド
          uni: '#DAA520',
          uniGlow: '#FFD700',
          // エビピンク
          ebi: '#FFA07A',
          ebiGlow: '#FFB6C1',
        },
        // Semantic mappings
        focus: {
          primary: '#E85D4C',
          secondary: '#7CB342',
          success: '#7CB342',
          warning: '#FFD700',
          error: '#C84B3D',
          bg: 'var(--focus-bg)',
          surface: 'var(--focus-surface)',
          border: 'var(--focus-border)',
        },
        'surface-highlight': 'var(--surface-highlight)',
        'text-secondary': 'var(--text-secondary)',
        'background-dark': 'var(--focus-bg)',
        'terminal-bg': 'var(--terminal-bg)',
        'heading': 'var(--text-heading)',
        'subtle': 'var(--text-subtle)',
        'muted': 'var(--text-muted)',
        'dim': 'var(--text-dim)',
      },
      fontFamily: {
        display: ['"Noto Sans JP"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        // 筆文字風（実際にはNoto Sans JP太字で代用）
        fude: ['"Noto Sans JP"', 'serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backgroundImage: {
        // 和柄パターン（青海波）
        'seigaiha': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M50 50c0-13.807-11.193-25-25-25S0 36.193 0 50s11.193 25 25 25 25-11.193 25-25zm50 0c0-13.807-11.193-25-25-25S50 36.193 50 50s11.193 25 25 25 25-11.193 25-25z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        'noren': 'linear-gradient(180deg, var(--noren-top) 0%, var(--noren-bottom) 100%)',
        // 回転寿司コンベアグラデーション
        'conveyor': 'linear-gradient(90deg, #2C1810 0%, #4A2C1C 50%, #2C1810 100%)',
        // 提灯グラデーション
        'lantern': 'radial-gradient(ellipse at center, #FF6B5B 0%, #C84B3D 50%, #8B2500 100%)',
        // 木目
        'woodgrain': 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(139, 90, 43, 0.1) 2px, rgba(139, 90, 43, 0.1) 4px)',
      },
      animation: {
        // 基本アニメーション
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'countdown': 'countdown 1.5s linear forwards',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'cursor-blink': 'cursor-blink 1.2s step-end infinite',

        // 🍣 寿司アニメーション
        'sushi-roll': 'sushi-roll 2s ease-in-out infinite',
        'sushi-bounce': 'sushi-bounce 0.5s ease-in-out',
        'sushi-spin': 'sushi-spin 1s ease-in-out',
        'sushi-float': 'sushi-float 3s ease-in-out infinite',

        // 🔥 派手なやつ
        'neon-pulse': 'neon-pulse 1.5s ease-in-out infinite',
        'rainbow-glow': 'rainbow-glow 3s linear infinite',
        'shake-wasabi': 'shake-wasabi 0.5s ease-in-out',
        'wiggle': 'wiggle 1s ease-in-out infinite',

        // 🌊 流れるアニメーション
        'conveyor-flow': 'conveyor-flow 20s linear infinite',
        'steam': 'steam 2s ease-in-out infinite',
        'steam-rise': 'steam-rise 3s ease-in-out infinite',
        'noren-sway': 'noren-sway 4s ease-in-out infinite',

        // ✨ キラキラ
        'sparkle': 'sparkle 1.5s ease-in-out infinite',
        'twinkle': 'twinkle 2s ease-in-out infinite',

        // 🎉 祝い系
        'celebrate': 'celebrate 0.6s ease-in-out',
        'pop-in': 'pop-in 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'slide-up': 'slide-up 0.4s ease-out',

        // 🏮 提灯
        'lantern-swing': 'lantern-swing 3s ease-in-out infinite',
        'lantern-glow': 'lantern-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(232, 93, 76, 0.5)' },
          '50%': { boxShadow: '0 0 25px rgba(232, 93, 76, 0.9), 0 0 50px rgba(232, 93, 76, 0.4)' },
        },
        'countdown': {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        // 🍣 寿司が揺れる
        'sushi-roll': {
          '0%, 100%': { transform: 'rotate(0deg) scale(1)' },
          '25%': { transform: 'rotate(15deg) scale(1.1)' },
          '75%': { transform: 'rotate(-15deg) scale(1.1)' },
        },
        'sushi-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'sushi-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'sushi-float': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-8px) rotate(5deg)' },
        },
        // 🔥 ネオンパルス
        'neon-pulse': {
          '0%, 100%': {
            textShadow: '0 0 5px currentColor, 0 0 10px currentColor, 0 0 20px currentColor',
            filter: 'brightness(1)'
          },
          '50%': {
            textShadow: '0 0 10px currentColor, 0 0 20px currentColor, 0 0 40px currentColor, 0 0 80px currentColor',
            filter: 'brightness(1.2)'
          },
        },
        'rainbow-glow': {
          '0%': { filter: 'hue-rotate(0deg) brightness(1.1)' },
          '100%': { filter: 'hue-rotate(360deg) brightness(1.1)' },
        },
        'shake-wasabi': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        // 🌊 コンベア流れ
        'conveyor-flow': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'steam': {
          '0%, 100%': { opacity: '0.3', transform: 'translateY(0) scale(1)' },
          '50%': { opacity: '0.7', transform: 'translateY(-8px) scale(1.2)' },
        },
        'steam-rise': {
          '0%': { opacity: '0', transform: 'translateY(0) scale(0.5)' },
          '50%': { opacity: '0.6' },
          '100%': { opacity: '0', transform: 'translateY(-30px) scale(1.5)' },
        },
        'noren-sway': {
          '0%, 100%': { transform: 'skewX(0deg) scaleY(1)' },
          '25%': { transform: 'skewX(2deg) scaleY(1.02)' },
          '75%': { transform: 'skewX(-2deg) scaleY(0.98)' },
        },
        // ✨ キラキラ
        'sparkle': {
          '0%, 100%': { opacity: '0', transform: 'scale(0) rotate(0deg)' },
          '50%': { opacity: '1', transform: 'scale(1) rotate(180deg)' },
        },
        'twinkle': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.8)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
        // 🎉 お祝い
        'celebrate': {
          '0%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.2) rotate(-5deg)' },
          '50%': { transform: 'scale(1.3) rotate(5deg)' },
          '75%': { transform: 'scale(1.2) rotate(-3deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '80%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        // 🏮 提灯
        'lantern-swing': {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        'lantern-glow': {
          '0%, 100%': {
            boxShadow: '0 0 10px rgba(232, 93, 76, 0.5), inset 0 0 20px rgba(255, 200, 100, 0.3)'
          },
          '50%': {
            boxShadow: '0 0 30px rgba(232, 93, 76, 0.8), 0 0 60px rgba(232, 93, 76, 0.4), inset 0 0 30px rgba(255, 200, 100, 0.5)'
          },
        },
      },
      boxShadow: {
        'primary-glow': '0 0 20px rgba(232, 93, 76, 0.3)',
        'wood': '0 4px 6px -1px rgba(93, 58, 26, 0.3)',
        'geta': 'inset 0 -4px 0 0 rgba(93, 58, 26, 0.5)',
        // 🔥 ネオン系
        'neon-salmon': '0 0 10px #E85D4C, 0 0 20px #E85D4C, 0 0 40px #E85D4C',
        'neon-wasabi': '0 0 10px #7CB342, 0 0 20px #7CB342, 0 0 40px #7CB342',
        'neon-tamago': '0 0 10px #FFD700, 0 0 20px #FFD700, 0 0 40px #FFD700',
        // 🏮 提灯シャドウ
        'lantern': '0 5px 30px rgba(232, 93, 76, 0.4), inset 0 0 20px rgba(255, 200, 100, 0.2)',
        'lantern-hover': '0 8px 40px rgba(232, 93, 76, 0.6), inset 0 0 30px rgba(255, 200, 100, 0.4)',
        // 木の下駄（強調版）
        'geta-deep': 'inset 0 -3px 0 0 rgba(139, 90, 43, 0.4), 0 6px 0 0 #5D3A1A, 0 8px 10px rgba(0,0,0,0.3)',
      },
      // 🎨 グラデーション
      backgroundSize: {
        'auto': 'auto',
        'cover': 'cover',
        'contain': 'contain',
        '200%': '200% 200%',
      },
    },
  },
  plugins: [],
};
