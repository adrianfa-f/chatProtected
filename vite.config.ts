import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      // SOLO MODIFICAMOS ESTA LÍNEA: Añadimos connect-src con los orígenes necesarios
      "Content-Security-Policy":
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "connect-src 'self' http://localhost:4000 ws://localhost:4000;" // ← Esta es la modificación clave
    }
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        chunkFileNames: 'chunks/[hash:16].js',
        assetFileNames: 'assets/[hash:16].[ext]',
        entryFileNames: '[hash:16].js',
        manualChunks(id) {
          if (id.includes('libsodium-wrappers')) {
            return 'crypto';
          }
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      format: {
        comments: false,
        beautify: false
      },
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['Date.now', 'Date.parse', 'performance.now']
      }
    }
  }
});