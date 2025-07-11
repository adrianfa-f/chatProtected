import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const apiUrl = env.VITE_API_URL || 'http://localhost:4000';
  const wsUrl = env.VITE_WS_SERVER || 'ws://localhost:4000';

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self' ${apiUrl} ${wsUrl}`
  ].join('; ');

  return {
    plugins: [
      react(),
      // Polyfills para módulos de Node
      nodePolyfills({
        include: ['crypto', 'stream'],
        globals: { Buffer: true }
      })
    ],
    server: {
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": csp
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
          /* drop_console: true, */
          drop_debugger: true,
          pure_funcs: ['Date.now', 'Date.parse', 'performance.now']
        }
      },
      chunkSizeWarningLimit: 1000
    }
  };
});