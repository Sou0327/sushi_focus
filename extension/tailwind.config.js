/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        focus: {
          primary: '#135bec',
          secondary: '#1E40AF',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
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
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.75rem',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'countdown': 'countdown 1.5s linear forwards',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'cursor-blink': 'cursor-blink 1.2s step-end infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(19, 91, 236, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(19, 91, 236, 0.8)' },
        },
        'countdown': {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      boxShadow: {
        'primary-glow': '0 0 20px rgba(19, 91, 236, 0.2)',
      },
    },
  },
  plugins: [],
};
