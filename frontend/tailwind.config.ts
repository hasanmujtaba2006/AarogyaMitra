import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // High-contrast accessibility theme
        kiosk: {
          dark: '#0f172a',       // Deep navy background for high text contrast
          light: '#f8fafc',      // Soft off-white to prevent glare
          primary: '#2563eb',    // High-visibility blue for primary actions
          success: '#16a34a',    // Bright green for proceed/success actions
          warning: '#ea580c',    // Bright orange for triage/alerts
          danger: '#dc2626',     // High-contrast red for emergency
          accent: '#7c3aed',     // Purple accents for secondary actions
          textPrimary: '#0f172a',
          textMuted: '#475569',
        }
      },
      fontSize: {
        // Large scale default for easy reading on outdoor screens
        'kiosk-xl': '1.75rem',
        'kiosk-2xl': '2.25rem',
        'kiosk-3xl': '3rem',
      },
      spacing: {
        'touch-target': '4.5rem', // Minimum 72px touch targets for ease of pressing
      }
    },
  },
  plugins: [],
}
export default config
