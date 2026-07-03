/// <reference types="vitest" />
import path from 'path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/tradutor-libras/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  // Transformers.js usa imports dinâmicos internos (onnxruntime-web, tokenizers)
  // que o Vite não deve pre-bundleizar.
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
