import plugin from 'tailwindcss/plugin';

/** Scales with the Text size setting (--fs on <html>, see src/lib/appearance.ts). */
const scaled = (rem, lineHeight) => [`calc(${rem} * var(--fs, 1))`, { lineHeight: `calc(${lineHeight} * var(--fs, 1))` }];
const accentShade = (n) => `rgb(var(--accent-${n}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontSize: {
      8: scaled('0.5rem', '0.75rem'),
      9: scaled('0.5625rem', '0.875rem'),
      10: scaled('0.625rem', '0.875rem'),
      11: scaled('0.6875rem', '1rem'),
      xs: scaled('0.75rem', '1rem'),
      sm: scaled('0.875rem', '1.25rem'),
      base: scaled('1rem', '1.5rem'),
      lg: scaled('1.125rem', '1.75rem'),
      xl: scaled('1.25rem', '1.75rem'),
      '2xl': scaled('1.5rem', '2rem'),
      '3xl': scaled('1.875rem', '2.25rem'),
      '4xl': scaled('2.25rem', '2.5rem'),
    },
    extend: {
      // The app's accent colour (Settings → Appearance): CSS variables, so it
      // can change at runtime. Green stays green where it means something
      // (protein, within goal).
      colors: {
        accent: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, accentShade(n)])),
      },
    },
  },
  plugins: [
    // compact: styles that apply in Compact mode (Settings → Appearance).
    plugin(({ addVariant }) => {
      addVariant('compact', ':is([data-density="compact"] &)');
    }),
  ],
};
