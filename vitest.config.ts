import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

/*
 * Tests run on Vite rather than on Next, so the `?react` SVG convention needs
 * its own compiler here. It is the same convention next.config.ts hands to
 * SVGR, and neither side recolours: the icon pipeline already has.
 */
export default defineConfig({
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    css: true,
  },
})
