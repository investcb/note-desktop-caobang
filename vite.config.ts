import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Vite config cho Tauri v2:
// - cổng dev cố định 1420 (Tauri devUrl trỏ vào đây)
// - build đa trang: app chính (index.html) + widget (widget.html)
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: '0.0.0.0',
      watch: {ignored: ['**/src-tauri/**']},
    },
    build: {
      target: 'esnext',
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          widget: path.resolve(__dirname, 'widget.html'),
        },
      },
    },
  };
});
