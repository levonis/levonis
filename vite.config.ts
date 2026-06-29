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
    // Trim modulepreload graph: the initial HTML must NOT preload heavy lazy chunks
    // (three.js, html2canvas, jspdf, qr, charts, motion, sanitize, day-picker) — they
    // should load only when the route that needs them is visited. This dramatically
    // improves LCP on the homepage (saves ~493 KiB of unused JS preloaded eagerly).
    modulePreload: {
      resolveDependencies: (_filename, deps) => {
        const HEAVY = [
          'vendor-html2canvas',
          'vendor-jspdf',
          'vendor-sanitize',
          'vendor-capacitor',
          'vendor-canvg',
        ];
        return deps.filter((d) => !HEAVY.some((h) => d.includes(h)));
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          // CRITICAL: React + the entire React ecosystem MUST live in ONE chunk so
          // that any library doing `import * as React from 'react'` (radix, framer,
          // react-router, etc.) cannot evaluate before React initializes. Splitting
          // these caused a TDZ crash ("Cannot access 'gr' before initialization")
          // in production, leaving the app stuck on the green background.
          return 'vendor';
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
