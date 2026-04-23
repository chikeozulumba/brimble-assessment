/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#3ddc84',
          dim:     'rgba(61,220,132,0.12)',
          glow:    'rgba(61,220,132,0.25)',
        },
      },
      animation: {
        'led-pulse': 'led-pulse 2.4s ease-in-out infinite',
        'slide-down': 'slide-down 0.2s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':   'fade-in 0.18s ease',
      },
      keyframes: {
        'led-pulse':  { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
        'slide-down': { from: { opacity: 0, transform: 'translateY(-8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'fade-in':    { from: { opacity: 0 }, to: { opacity: 1 } },
      },
    },
  },
  plugins: [],
};
