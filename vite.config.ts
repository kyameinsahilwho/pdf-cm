import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { vitePythonConversionPlugin } from './vite-python-plugin.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  root: __dirname,
  plugins: [
    react(),
    vitePythonConversionPlugin(__dirname),
  ],
  resolve: {
    alias: [
      { find: /^react$/, replacement: path.resolve(__dirname, 'node_modules/react') },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, 'node_modules/react-dom') },
      { find: /^react-dom\/client$/, replacement: path.resolve(__dirname, 'node_modules/react-dom/client') },
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(__dirname, 'node_modules/react/jsx-runtime.js') },
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js') },
      { find: '@/components/ui/toaster', replacement: path.resolve(__dirname, 'src/shims/toaster.tsx') },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      { find: 'next/link', replacement: path.resolve(__dirname, 'src/shims/next-link.tsx') },
      { find: 'next/navigation', replacement: path.resolve(__dirname, 'src/shims/next-navigation.ts') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  server: {
    fs: {
      allow: [__dirname],
    },
  },
})
