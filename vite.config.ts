import { defineConfig } from 'vite'
import path             from 'node:path'
import electron from 'vite-plugin-electron/simple'
import { startup } from 'vite-plugin-electron'
import react            from '@vitejs/plugin-react'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        onstart() {
          const env = { ...process.env }
          delete env.ELECTRON_RUN_AS_NODE
          startup(['.', '--no-sandbox'], { env })
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            rollupOptions: {
              output: {
                format:               'cjs',
                entryFileNames:       '[name].cjs',
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
      renderer: process.env.NODE_ENV === 'test' ? undefined : {},
    }),
  ],
})
