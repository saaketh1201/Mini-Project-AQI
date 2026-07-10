/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        aeris: {
          base: '#030D18',
          surface: '#071526',
          elevated: '#0C1E35',
          overlay: '#112540',
          border: '#1E3A5A',
          'border-subtle': '#1A3048',
          accent: '#00C2B8',
          'accent-dim': '#00897E',
          blue: '#4A9EFF',
          amber: '#F5A623',
        },
        ink: {
          primary: '#E2EEF8',
          secondary: '#7BA5C4',
          muted: '#3D6080',
        },
        aqi: {
          good: '#22C55E',
          moderate: '#EAB308',
          usg: '#F97316',
          unhealthy: '#EF4444',
          'very-unhealthy': '#A855F7',
          hazardous: '#991B1B',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
