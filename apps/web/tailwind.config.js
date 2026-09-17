/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#080c08',
          panel: '#0b100b',
          surface: '#0a0f0a',
          dark: '#070b07',
          amber: '#f59e0b',
          amberBright: '#fbbf24',
          amberDim: '#92400e',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Share Tech Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        display: ['"Chakra Petch"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
