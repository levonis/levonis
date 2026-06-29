import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      "Cache-Control": "no-store",
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    target: 'es2020',
    // Keep CommonJS helpers out of route chunks. Rollup can otherwise place
    // them inside a lazy page chunk (e.g. admin-pages), making vendor code import
    // back from that page chunk and triggering production TDZ crashes such as
    // "Cannot access 'gr' before initialization" on Android Chrome.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('commonjsHelpers')) return 'vendor';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
  esbuild: mode === 'production'
    ? { drop: ['console', 'debugger'], legalComments: 'none' }
    : undefined,
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "react-router-dom"],
  },
}));
