import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages sert le site depuis un sous-chemin (/Projet-PaieAI/) alors que
// Netlify ou un domaine dédié le servent depuis la racine. Le chemin est donc
// injecté au build plutôt que codé en dur.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pdf: ['pdfjs-dist'],
          charts: ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
