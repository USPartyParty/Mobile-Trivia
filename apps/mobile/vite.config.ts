import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');

  const isProduction = mode === 'production';

  return {
    plugins: [
      react({
        // Enable fast refresh for React components
        fastRefresh: true,
      }),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        devOptions: {
          enabled: !isProduction, // Enable PWA in development for testing
          type: 'module',
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest}'],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
                },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'font',
              handler: 'CacheFirst',
              options: {
                cacheName: 'font-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 Year
                },
              },
            },
            // Example: Caching API calls (adjust based on your needs)
            // {
            //   urlPattern: new RegExp('^/api/'),
            //   handler: 'NetworkFirst',
            //   options: {
            //     cacheName: 'api-cache',
            //     networkTimeoutSeconds: 10,
            //     expiration: {
            //       maxEntries: 50,
            //       maxAgeSeconds: 60 * 60 * 24, // 1 Day
            //     },
            //   },
            // },
          ],
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo.svg'],
        manifest: {
          name: 'Taps Tokens Trivia - Mobile',
          short_name: 'Trivia Mobile',
          description: 'Join and play Taps Tokens Trivia from your phone!',
          theme_color: '#4f46e5', // Indigo 600
          background_color: '#ffffff',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],

    // Development server settings
    server: {
      port: 5174, // Different port from tablet app
      strictPort: true,
      host: true, // Listen on all addresses
      open: true, // Auto-open browser
      cors: true, // Enable CORS
      proxy: {
        // Proxy API requests to backend during development
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
        // Proxy Socket.IO requests
        '/socket.io': {
          target: env.VITE_SOCKET_URL || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
          ws: true, // Enable WebSocket proxying
        },
      },
    },

    // Build optimizations for mobile
    build: {
      target: 'es2017', // Target modern browsers, good for mobile
      outDir: 'dist',
      assetsDir: 'assets',
      minify: isProduction ? 'terser' : false,
      sourcemap: !isProduction,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['@heroicons/react', 'clsx', 'tailwind-merge'],
            socket: ['socket.io-client', 'axios'],
            qr: ['html5-qrcode'],
          },
        },
      },
      chunkSizeWarningLimit: 600, // Slightly lower limit for mobile
    },

    // Preview server configuration
    preview: {
      port: 4174, // Port for `vite preview`
      strictPort: true,
      host: true,
      open: true,
    },

    // Path resolving
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@components': resolve(__dirname, 'src/components'),
        '@pages': resolve(__dirname, 'src/pages'),
        '@hooks': resolve(__dirname, 'src/hooks'),
        '@store': resolve(__dirname, 'src/store'),
        '@utils': resolve(__dirname, 'src/utils'),
        '@assets': resolve(__dirname, 'src/assets'),
        '@types': resolve(__dirname, 'src/types'),
        '@services': resolve(__dirname, 'src/services'),
        '@context': resolve(__dirname, 'src/context'),
      },
    },

    // TypeScript support
    esbuild: {
      jsxInject: `import React from 'react'`, // Auto-import React
    },

    // Environment variable handling
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:3000'),
      'process.env.VITE_SOCKET_URL': JSON.stringify(env.VITE_SOCKET_URL || 'http://localhost:3000'),
      'process.env.VITE_APP_VERSION': JSON.stringify(env.npm_package_version || '0.1.0'),
    },

    // Optimized dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'socket.io-client',
        'axios',
        'zustand',
        'clsx',
        'tailwind-merge',
        'html5-qrcode',
      ],
    },
  };
});
