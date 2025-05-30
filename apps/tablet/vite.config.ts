import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [
      react({
        // Enable fast refresh for React components
        fastRefresh: true,
        // Add babel plugins if needed
        babel: {
          plugins: [],
        },
      }),
    ],
    
    // Development server settings
    server: {
      port: 5173,
      strictPort: true,
      host: true, // Listen on all addresses
      open: true, // Auto-open browser
      cors: true, // Enable CORS
      proxy: {
        // Proxy API requests to backend during development
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
          ws: true, // Enable WebSocket proxying
        },
      },
    },
    
    // Build optimizations
    build: {
      target: 'es2015', // Target browsers supporting ES2015
      outDir: 'dist',
      assetsDir: 'assets',
      minify: isProduction ? 'terser' : false,
      sourcemap: !isProduction,
      rollupOptions: {
        output: {
          manualChunks: {
            // Split chunks for better caching
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['@heroicons/react', 'clsx', 'tailwind-merge'],
            socket: ['socket.io-client', 'axios'],
          },
        },
      },
      // Reduce build size
      chunkSizeWarningLimit: 1000,
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
      },
    },
    
    // TypeScript support
    esbuild: {
      jsxInject: `import React from 'react'`, // Auto-import React
    },
    
    // Environment variable handling
    define: {
      // Make environment variables available to the client
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL),
      'process.env.VITE_SOCKET_URL': JSON.stringify(process.env.VITE_SOCKET_URL),
      'process.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version),
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
      ],
    },
  };
});
