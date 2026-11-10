/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves the site under /<repo>/. Set VITE_BASE in CI (P3.6); local dev uses '/'.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  // Serve MapLibre's own ESM files in dev (as in production). Pre-bundling it breaks the main-thread/worker pairing.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
