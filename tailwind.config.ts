import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F5F0E8',
        blush: '#FAF7F2',
        rose: {
          DEFAULT: '#C8849A',
          light: '#E3C1CC',
          dark: '#B5566B',
        },
        mauve: {
          DEFAULT: '#5C4A3A',
          light: '#9C8B7E',
          dark: '#3D2E26',
        },
        champagne: '#D4B8A0',
        sage: '#8C7B6E',
        charcoal: '#3D2E26',
        warmgray: '#9C8B7E',
      },
      fontFamily: {
        playfair: ['var(--font-serif)', 'Georgia', 'serif'],
        nunito: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-pattern': "url(\"data:image/svg+xml,%3Csvg width='64' height='64' viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C8849A' fill-opacity='0.08'%3E%3Cpath d='M16 16h32v1H16zm0 15h32v1H16zm0 15h32v1H16z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'soft': '0 8px 24px rgba(61, 46, 38, 0.08)',
        'medium': '0 14px 40px rgba(61, 46, 38, 0.12)',
        'card': '0 2px 16px rgba(61, 46, 38, 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
