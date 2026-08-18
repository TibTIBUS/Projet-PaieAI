/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0f172a', soft: '#334155', mute: '#64748b' },
        brand: {
          50: '#eef6ff', 100: '#d9ecff', 200: '#bcdeff', 300: '#8ec8ff',
          400: '#59a8ff', 500: '#3385fb', 600: '#1f66f0', 700: '#1a51dc',
          800: '#1c44b2', 900: '#1d3d8c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.18)',
      },
    },
  },
  plugins: [],
};
