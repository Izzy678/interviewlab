import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import path from 'path'

// Custom plugin to handle ?import&react syntax (alias to ?react)
const svgImportPlugin = () => ({
  name: 'svg-import-alias',
  resolveId(id: string) {
    // Transform ?import&react to ?react for vite-plugin-svgr
    if (id.includes('?import&react')) {
      return id.replace('?import&react', '?react');
    }
    return null;
  },
});

// https://vite.dev/config/
export default defineConfig(() => ({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    svgImportPlugin(),
    svgr({
      // Support named ReactComponent export (for ?react syntax)
      svgrOptions: {
        exportType: 'named',
        namedExport: 'ReactComponent',
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: '**/*.svg?react',
    }),
  ],
  server: {
    allowedHosts: true as const,
    hmr: false,
  },
  build: {
    // Reduce memory pressure in constrained environments
    sourcemap: false,
    minify: 'esbuild',
    // Smaller chunk limit to avoid large memory allocations
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Keep React + React DOM in one chunk. Avoid a catch-all "vendor"
        // chunk that depends on React — that creates a circular import and
        // crashes production with: Cannot read properties of undefined
        // (reading 'useLayoutEffect').
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react";
          }
          if (id.includes("@supabase")) return "vendor-supabase";
        },
      },
    },
    // Reduce CSS processing memory
    cssMinify: 'esbuild',
  },
}))
