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
    cssMinify: true,
    target: 'es2020',
    // Trim modulepreload graph: the initial HTML must NOT preload heavy lazy chunks
    // (three.js, html2canvas, jspdf, qr, charts, motion, sanitize, day-picker) — they
    // should load only when the route that needs them is visited. This dramatically
    // improves LCP on the homepage (saves ~493 KiB of unused JS preloaded eagerly).
    modulePreload: {
      resolveDependencies: (_filename, deps) => {
        const HEAVY = [
          'vendor-three',
          'vendor-html2canvas',
          'vendor-jspdf',
          'vendor-qr',
          'vendor-charts',
          'vendor-motion',
          'vendor-sanitize',
          'vendor-carousel',
          'vendor-capacitor',
          'vendor-daypicker',
        ];
        return deps.filter((d) => !HEAVY.some((h) => d.includes(h)));
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          // Heavy, lazy-loaded libs into their own chunks
          if (id.includes('html2canvas')) return 'vendor-html2canvas';
          if (id.includes('node_modules/jspdf/') || id.includes('node_modules/jspdf-autotable/')) return 'vendor-jspdf';
          if (id.includes('node_modules/canvg/')) return 'vendor-canvg';
          if (id.includes('node_modules/three/')) return 'vendor-three';
          if (id.includes('html5-qrcode') || id.includes('jsqr')) return 'vendor-qr';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'vendor-motion';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('react-day-picker')) return 'vendor-daypicker';
          if (id.includes('@supabase') || id.includes('postgrest') || id.includes('gotrue') || id.includes('realtime-js')) return 'vendor-supabase';
          if (id.includes('lucide-react') || id.includes('react-icons')) return 'vendor-icons';
          if (id.includes('date-fns') || id.includes('dayjs')) return 'vendor-date';
          if (id.includes('embla-carousel') || id.includes('swiper')) return 'vendor-carousel';
          if (id.includes('dompurify') || id.includes('sanitize-html')) return 'vendor-sanitize';
          if (id.includes('@capacitor')) return 'vendor-capacitor';
          // CRITICAL: Bundle React + all React-dependent UI libs together to guarantee load order.
          // Radix, router, query, forms, etc. import React at module top-level — splitting them
          // causes "Cannot read properties of undefined (reading 'forwardRef')" if React loads after.
          if (
            id.includes('/react/') || id.includes('/react-dom/') ||
            id.includes('react/jsx-runtime') || id.includes('scheduler') ||
            id.includes('@radix-ui') ||
            id.includes('@react-three') ||
            id.includes('react-router') ||
            id.includes('@tanstack') ||
            id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod') ||
            id.includes('sonner') || id.includes('cmdk') || id.includes('vaul') || id.includes('input-otp')
          ) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
  esbuild: mode === 'production'
    ? { drop: ['console', 'debugger'] }
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
