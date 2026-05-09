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
          if (id.includes('node_modules/three/')) return 'vendor-three';
          if (id.includes('html5-qrcode') || id.includes('jsqr')) return 'vendor-qr';
          if (id.includes('@supabase') || id.includes('postgrest') || id.includes('gotrue') || id.includes('realtime-js')) return 'vendor-supabase';
          if (id.includes('date-fns') || id.includes('dayjs')) return 'vendor-date';
          if (id.includes('dompurify') || id.includes('sanitize-html')) return 'vendor-sanitize';
          if (id.includes('@capacitor')) return 'vendor-capacitor';
          // Pure-function icon library — safe to peel off (no React top-level side effects beyond forwardRef wrap)
          if (id.includes('node_modules/lucide-react/')) return 'vendor-icons';
          // KEEP: recharts/d3 + framer-motion + radix all bundled with React core to
          // avoid production TDZ. Past attempts to split them caused
          // "Cannot access before initialization" stuck on splash.
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
