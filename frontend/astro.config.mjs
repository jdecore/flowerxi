import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

export default defineConfig({
  integrations: [svelte()],
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            webllm: ['@mlc-ai/web-llm'],
            charts: ['apexcharts', 'svelte-apexcharts', 'recharts', 'd3-scale', 'd3-shape', 'layercake'],
          },
        },
      },
    },
  },
});
