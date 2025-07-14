import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const apiUrl = env.VITE_API_URL || 'http://localhost:4000'
  const wsUrl = env.VITE_WS_SERVER || 'ws://localhost:4000'

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self' ${apiUrl} ${wsUrl}`
  ].join('; ')

  return {
    plugins: [
      react(),
      nodePolyfills({ include: ['crypto', 'stream'], globals: { Buffer: true } }),
      VitePWA({
        registerType: 'autoUpdate',
        filename: 'sw.js',
        manifestFilename: 'manifest.json',
        includeAssets: ['favicon.ico', 'icon-192x192.png', 'icon-512x512.png'],
        manifest: {
          name: 'Chat Protected',
          short_name: 'Chat',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#000000',
          icons: [
            { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg}'],
          runtimeCaching: [
            // 1) TODAS las llamadas a /api van directo a red
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api'),
              handler: 'NetworkOnly'
            },
            // 2) El resto de recursos (estáticos) cache con StaleWhileRevalidate
            {
              urlPattern: ({ url }) =>
                !url.pathname.startsWith('/api') &&
                !url.protocol.startsWith('ws'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-cache',
                expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 }
              }
            }
          ]
        }
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
            if (id.includes('libsodium-wrappers')) return 'crypto'
            if (id.includes('node_modules') && !id.includes('libsodium'))
              return 'vendor'
          }
        }
      },
      minify: 'terser',
      terserOptions: {
        format: { comments: false, beautify: false },
        compress: {
          drop_debugger: true,
          pure_funcs: ['Date.now', 'Date.parse', 'performance.now']
        }
      },
      chunkSizeWarningLimit: 1000
    }
  }
})
