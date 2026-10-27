import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: false,
    // UI flow tests drive a 550-node app through jsdom; give them headroom on a busy machine
    testTimeout: 20000,
  },
})
