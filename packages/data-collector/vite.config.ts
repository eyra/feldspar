import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Include JSX runtime automatically  
      jsxRuntime: 'automatic',
      // Include feldspar source files for Fast Refresh
      include: [
        '**/*.tsx',
        '**/*.ts', 
        '../feldspar/src/**/*.tsx',
        '../feldspar/src/**/*.ts'
      ]
    })
  ],
  server: {
    port: 3000,
    open: true,
    host: true,
    // Watch feldspar source files for changes
    fs: {
      allow: ['..'] // Allow serving files from parent directories
    },
    watch: {
      // Watch feldspar source directory for changes
      ignored: ['!**/packages/feldspar/src/**']
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          feldspar: ['@eyra/feldspar']
        }
      }
    }
  },
  optimizeDeps: {
    // Exclude feldspar from pre-bundling so it gets processed by Vite directly
    exclude: ['@eyra/feldspar']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
      // Remove the direct source alias for now to use built version
    }
  },
  publicDir: 'public',
  // Ensure compatibility with Python worker
  assetsInclude: ['**/*.whl', '**/*.tar.gz']
})
