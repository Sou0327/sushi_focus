/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // CSS Variable-based colors for theme support
        sf: {
          bg: 'var(--sf-bg)',
          'bg-elevated': 'var(--sf-bg-elevated)',
          'bg-card': 'var(--sf-bg-card)',
          border: 'var(--sf-border)',
          'border-subtle': 'var(--sf-border-subtle)',
          text: 'var(--sf-text)',
          'text-secondary': 'var(--sf-text-secondary)',
          'text-muted': 'var(--sf-text-muted)',
          'text-dim': 'var(--sf-text-dim)',
          accent: 'var(--sf-accent)',
          'accent-glow': 'var(--sf-accent-glow)',
          salmon: 'var(--sf-salmon)',
          'salmon-deep': 'var(--sf-salmon-deep)',
          wasabi: 'var(--sf-wasabi)',
          gold: 'var(--sf-gold)',
          wood: 'var(--sf-wood)',
          'wood-light': 'var(--sf-wood-light)',
          copper: 'var(--sf-copper)',
          'copper-glow': 'var(--sf-copper-glow)',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', '"Noto Serif JP"', 'Georgia', 'serif'],
        'display-jp': ['"Noto Serif JP"', '"Cormorant Garamond"', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'monospace'],
      },
      animation: {
        'fade-in': 'fade-in 0.6s ease forwards',
        'fade-in-up': 'fade-in-up 0.6s ease forwards',
        'float': 'float 4s ease-in-out infinite',
        'cursor-blink': 'cursor-blink 1s step-end infinite',
      },
      keyframes: {
        'fade-in': {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        'fade-in-up': {
          'from': {
            opacity: '0',
            transform: 'translateY(1.5rem)',
          },
          'to': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'float': {
          '0%, 100%': {
            transform: 'translateY(0) rotate(-2deg)',
          },
          '50%': {
            transform: 'translateY(-12px) rotate(2deg)',
          },
        },
        'cursor-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
