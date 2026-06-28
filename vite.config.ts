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
        // Merge tiny chunks (<10 KB) to reduce the long waterfall on first paint
        // — PageSpeed showed 22 chained micro-chunks delaying LCP by ~3s.
        experimentalMinChunkSize: 10_000,
        manualChunks: (id) => {
          // Group app page modules so the browser fetches one chunk per area
          // instead of dozens of tiny per-route requests on slow networks.
          // Public pages (Home, ProductDetail, Cart, ...) stay on their own
          // default per-route chunks — only admin/community/merchant get bundled.
          if (!id.includes('node_modules')) {
            const norm = id.replace(/\\/g, '/');
            if (norm.includes('/src/pages/Admin')) return 'admin-pages';
            if (norm.includes('/src/pages/Community') || norm.includes('/src/pages/community/')) return 'community-pages';
            if (norm.includes('/src/pages/Merchant') || norm.includes('/src/pages/Storefront')) return 'merchant-pages';
            return undefined;
          }
          // Only split libs that are SAFE (no internal circular deps that break in prod).
          // recharts/d3, framer-motion, @radix-ui all have internal cross-imports that
          // TDZ-crash when split into separate chunks — leave them with vendor-react.
          if (id.includes('html2canvas')) return 'vendor-html2canvas';
          if (id.includes('node_modules/jspdf/') || id.includes('node_modules/jspdf-autotable/')) return 'vendor-jspdf';
          if (id.includes('node_modules/canvg/')) return 'vendor-canvg';
          if (id.includes('@supabase') || id.includes('postgrest') || id.includes('gotrue') || id.includes('realtime-js')) return 'vendor-supabase';
          if (id.includes('dompurify') || id.includes('sanitize-html')) return 'vendor-sanitize';
          if (id.includes('@capacitor')) return 'vendor-capacitor';
          if (id.includes('node_modules/lucide-react/')) return 'vendor-icons';
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
