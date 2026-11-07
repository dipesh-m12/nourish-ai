/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Light, calm palette. Primary green passes 4.5:1 contrast with white text.
      colors: {
        bg: '#F7F6F2',
        card: '#FFFFFF',
        ink: '#1C2321',
        muted: '#5B6660',
        line: '#E7E4DC',
        primary: { DEFAULT: '#1F7A55', soft: '#E6F2EB', dark: '#17603F' },
        accent: { DEFAULT: '#E07A5F', soft: '#FBEDE8' },
        danger: '#B42318',
      },
      // Custom fonts need one family per weight in React Native.
      fontFamily: {
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        serif: ['Lora_600SemiBold'],
        'serif-bold': ['Lora_700Bold'],
      },
    },
  },
  plugins: [],
};
