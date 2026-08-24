import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [wasm()],
    optimizeDeps: { exclude: ['@huggingface/transformers'] },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            transformers: ['@huggingface/transformers', 'onnxruntime-web'],
            reactCharts: ['react', 'react-dom', 'recharts'],
          },
        },
      },
    },
  },
});
