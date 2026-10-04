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
    /*
     * **Bounded workers, because the terminology tests reload the module graph.**
     * A vocabulary is captured once at import, so each of those cases calls
     * `vi.resetModules()` and imports a feature's whole tree again — five files
     * doing that at once saturated the machine and four unrelated tests timed
     * out at 155 seconds apiece. They were not failing: they were not being run.
     * A test that fails on contention teaches people to re-run rather than to
     * look.
     */
    maxWorkers: 4,
    minWorkers: 1,
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    css: true,
  },
})
