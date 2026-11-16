import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(import.meta.dirname, 'index.html'),
          plan: path.resolve(import.meta.dirname, 'plan.html'),
          summaries: path.resolve(import.meta.dirname, 'summaries.html'),
          quizzes: path.resolve(import.meta.dirname, 'quizzes.html'),
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
