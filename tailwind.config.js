/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef9f4', 100: '#d6f1e6', 200: '#aee3cf', 300: '#7ccfb1',
          400: '#48b48f', 500: '#2a9974', 600: '#1d7c5e', 700: '#1a644d',
          800: '#18503f', 900: '#154234', 950: '#0a261f',
        },
        accent: {
          50: '#fff8ed', 100: '#ffefd4', 200: '#ffdba8', 300: '#ffc070',
          400: '#ff9a37', 500: '#fe7c0f', 600: '#ef6205', 700: '#c64a07',
          800: '#9d3b0e', 900: '#7e3310', 950: '#451704',
        },
        neutral: {
          50: '#f7f8f8', 100: '#eef0f0', 200: '#dadedf', 300: '#bbc1c2',
          400: '#919b9d', 500: '#727e80', 600: '#5d6769', 700: '#4d5557',
          800: '#414849', 900: '#383d3e', 950: '#212526',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        cardLg: '0 10px 30px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.18s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
