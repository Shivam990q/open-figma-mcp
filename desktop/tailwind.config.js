/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0a0f',
          soft: '#0f0f16',
          card: '#14141d'
        },
        line: 'rgba(255,255,255,0.08)',
        brand: {
          DEFAULT: '#8b5cf6',
          50: '#f5f3ff',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          fuchsia: '#d946ef'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(139,92,246,0.45)',
        card: '0 8px 30px -12px rgba(0,0,0,0.6)'
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
        'radial-fade': 'radial-gradient(1200px 600px at 50% -10%, rgba(139,92,246,0.18), transparent)'
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'pulse-ring': { '0%': { transform: 'scale(0.8)', opacity: '0.7' }, '100%': { transform: 'scale(2)', opacity: '0' } }
      },
      animation: {
        shimmer: 'shimmer 2.5s linear infinite',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite'
      }
    }
  },
  plugins: []
}
