import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0b0d10',
        panel: '#111418',
        panelSoft: '#151922',
        border: '#252a33',
        muted: '#8f98a8',
        text: '#f5f7fb',
        accent: '#7dd3fc',
        success: '#4ade80',
        warning: '#facc15',
        danger: '#fb7185'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(125, 211, 252, 0.16), 0 16px 48px rgba(0, 0, 0, 0.34)'
      },
      animation: {
        'fade-in': 'fadeIn 180ms ease-out',
        'slide-up': 'slideUp 220ms ease-out'
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
};

export default config;
