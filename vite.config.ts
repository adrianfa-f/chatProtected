import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Cargar variables de entorno VITE_*
  const env = loadEnv(mode, process.cwd());

  // Obtener URLs de las variables de entorno
  const apiUrl = env.VITE_API_URL || 'http://localhost:4000';
  const wsUrl = env.VITE_WS_SERVER || 'ws://localhost:4000';

  // Construir política CSP dinámica
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self' ${apiUrl} ${wsUrl}`
  ].join('; ');

  return {
    plugins: [react()],
    server: {
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": csp
      }
    },
    resolve: {
      alias: {
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        util: 'util/',
        buffer: 'buffer/'
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
            if (id.includes('node_modules') && !id.includes('libsodium')) {
              return 'vendor';
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
      },
      chunkSizeWarningLimit: 1000
    }
  };
});