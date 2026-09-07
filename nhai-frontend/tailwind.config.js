/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind 4.2 — use the nativewind preset; content paths scan all source files
  content: [
    './App.{ts,tsx}',
    './index.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050C1A',
          900: '#0A1428',
          800: '#0D1F3C',
          700: '#102850',
          600: '#163468',
        },
        cyan: {
          aegis: '#00E5FF',
          dim: '#00B8CC',
          glow: '#4DFAFF',
          dark: '#003D45',
        },
        amber: {
          aegis: '#FFB800',
          dim: '#CC9200',
          glow: '#FFD966',
          dark: '#3D2C00',
        },
        success: '#00E676',
        warning: '#FFB800',
        danger: '#FF1744',
      },
    },
  },
  plugins: [],
};
