/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Restrained, "designed" palette — mostly neutral, one accent.
        bg: '#0b0b0e',
        surface: '#131317',
        elevated: '#1a1a20',
        border: 'rgba(255,255,255,0.08)',
        'border-strong': 'rgba(255,255,255,0.14)',
        ink: '#ececee',
        muted: '#9a9aa3',
        faint: '#65656e',
        accent: {
          DEFAULT: '#7c5cff',
          soft: 'rgba(124,92,255,0.14)',
          hover: '#8d70ff'
        },
        ok: '#3fb950',
        warn: '#d29922',
        danger: '#f85149'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      fontSize: {
        xs: ['11px', '16px'],
        sm: ['13px', '20px'],
        base: ['14px', '21px'],
        lg: ['16px', '24px']
      },
      borderRadius: {
        lg: '10px',
        xl: '12px',
        '2xl': '16px'
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.4)',
        pop: '0 12px 32px -12px rgba(0,0,0,0.7)'
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        breathe: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } }
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        breathe: 'breathe 2s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
