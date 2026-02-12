import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0f',
          card: '#12121a',
          hover: '#1a1a25',
        },
        cyan: {
          glow: '#00f0ff',
          dim: '#00a0aa',
        },
        amber: {
          glow: '#f59e0b',
        },
        success: '#22c55e',
        danger: '#ef4444',
        muted: '#6b7280',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 240, 255, 0.2), 0 0 20px rgba(0, 240, 255, 0.1)' },
          '100%': { boxShadow: '0 0 10px rgba(0, 240, 255, 0.4), 0 0 40px rgba(0, 240, 255, 0.2)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
