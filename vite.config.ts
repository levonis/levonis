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
        // Trim heavy chunks from the eager modulepreload graph. They load only when
        // a route that imports them is visited.
        const HEAVY = [
          'vendor-three',
          'vendor-html2canvas',
          'vendor-jspdf',
          'vendor-qr',
          'vendor-sanitize',
          'vendor-carousel',
          'vendor-capacitor',
          'vendor-daypicker',
          'vendor-canvg',
          'vendor-charts',
        ];
        return deps.filter((d) => !HEAVY.some((h) => d.includes(h)));
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          // Heavy, route-lazy libs (no React top-level side effects)
          if (id.includes('html2canvas')) return 'vendor-html2canvas';
          if (id.includes('node_modules/jspdf/') || id.includes('node_modules/jspdf-autotable/')) return 'vendor-jspdf';
          if (id.includes('node_modules/canvg/')) return 'vendor-canvg';
          // NOTE: do NOT manualChunk three/html5-qrcode. Naming them caused Rollup
          // to emit bare side-effect imports (`import "./vendor-three-..."`) at the
          // top of the entry, eagerly loading 275KB on every page load. Leaving
          // them unnamed lets Rollup co-locate them with the dynamic-importer
          // chunks so they only load when a game route or the printer activation
          // panel is opened.
          if (id.includes('@supabase') || id.includes('postgrest') || id.includes('gotrue') || id.includes('realtime-js')) return 'vendor-supabase';
          if (id.includes('date-fns') || id.includes('dayjs')) return 'vendor-date';
          if (id.includes('dompurify') || id.includes('sanitize-html')) return 'vendor-sanitize';
          if (id.includes('@capacitor')) return 'vendor-capacitor';
          // Pure-function icon library — safe to peel off (no React top-level side effects beyond forwardRef wrap)
          if (id.includes('node_modules/lucide-react/')) return 'vendor-icons';
          // Recharts + d3 — only used on admin/analytics pages
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3-')) return 'vendor-charts';
          // Phase 3 split: framer-motion and @radix-ui peeled off vendor-react.
          // Both are statically imported by app code, so Rollup wires them as
          // sibling imports of vendor-react — they are fetched in parallel and
          // execute after React (which they import from), avoiding TDZ.
          // Keep tslib + scheduler + react* together in vendor-react to be safe.
          if (id.includes('node_modules/framer-motion/')) return 'vendor-motion';
          if (id.includes('node_modules/@radix-ui/')) return 'vendor-radix';
          return 'vendor-react';
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
    force: true,
  },
}));
