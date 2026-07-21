/** @type {import('tailwindcss').Config} */
export default {
  content:   ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode:  'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'xs':       '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'card':     '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        'card-md':  '0 4px 12px -2px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        'card-lg':  '0 10px 20px -4px rgb(0 0 0 / 0.1)',
      },
      animation: {
        'slide-in-right': 'slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in':        'fadeIn 0.18s ease-out',
        'fade-up':        'fadeUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer':        'shimmer 1.5s infinite',
      },
      keyframes: {
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'shimmer': 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      },
      backgroundSize: {
        '200': '200% 100%',
      },
    },
  },
  plugins: [],
}
