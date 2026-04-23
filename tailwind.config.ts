import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0f',
        surface: '#12121a',
        'surface-2': '#1a1a26',
        'surface-3': '#22223a',
        border: '#2a2a40',
        'border-light': '#3a3a55',
        primary: '#6366f1',
        'primary-hover': '#4f46e5',
        'primary-glow': 'rgba(99,102,241,0.3)',
        secondary: '#8b5cf6',
        accent: '#06b6d4',
        'accent-glow': 'rgba(6,182,212,0.3)',
        success: '#22c55e',
        'success-glow': 'rgba(34,197,94,0.3)',
        danger: '#ef4444',
        'danger-glow': 'rgba(239,68,68,0.3)',
        warning: '#f59e0b',
        text: '#e2e8f0',
        'text-muted': '#94a3b8',
        'text-faint': '#475569',
        neon: '#00f5ff',
        'neon-purple': '#bf00ff',
        'neon-green': '#00ff88',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(99,102,241,0.4), 0 0 40px rgba(99,102,241,0.2)',
        'glow-accent': '0 0 20px rgba(6,182,212,0.4), 0 0 40px rgba(6,182,212,0.2)',
        'glow-success': '0 0 20px rgba(34,197,94,0.4)',
        'glow-danger': '0 0 20px rgba(239,68,68,0.4)',
        'glow-neon': '0 0 30px rgba(0,245,255,0.5)',
        card: '0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -2px rgba(0,0,0,0.3)',
        'card-hover': '0 20px 25px -5px rgba(0,0,0,0.5)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-in-up': 'slide-in-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        countdown: 'countdown 1s ease-in-out',
        'bounce-subtle': 'bounce-subtle 0.5s ease-in-out',
        shimmer: 'shimmer 2s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(99,102,241,0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(99,102,241,0.6), 0 0 60px rgba(99,102,241,0.3)' },
        },
        'slide-in-up': {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        countdown: {
          '0%': { transform: 'scale(1.5)', opacity: '0' },
          '50%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.8)', opacity: '0' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient':
          'radial-gradient(at 40% 20%, hsla(228,100%,74%,0.1) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(355,100%,93%,0.05) 0px, transparent 50%)',
      },
    },
  },
  plugins: [],
};

export default config;
