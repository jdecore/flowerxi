import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  integrations: [svelte()],
  vite: {
    plugins: [wasm()],
    optimizeDeps: { exclude: ['@huggingface/transformers'] },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            transformers: ['@huggingface/transformers', 'onnxruntime-web'],
            charts: ['d3-scale', 'd3-shape', 'layercake'],
          },
        },
      },
    },
  },
});
