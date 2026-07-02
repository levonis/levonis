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
          if (!id.includes('node_modules')) return undefined;
          // Keep CommonJS helpers with the main vendor bundle so route
          // chunks never end up importing them back (production TDZ risk).
          if (id.includes('commonjsHelpers')) return 'vendor';

          // Heavy libraries — split into their own chunks so first paint
          // only pays for what the landing route actually renders.
          if (id.includes('three') || id.includes('@react-three')) return 'three';
          if (id.includes('framer-motion')) return 'framer';
          if (id.includes('mapbox-gl')) return 'mapbox';
          // Keep Recharts/D3 in the general vendor graph. Splitting them into a
          // standalone manual chunk caused a production TDZ crash on Safari/iPad
          // ("Cannot access 'A' before initialization") before React mounted.
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor';
          if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('react-to-pdf')) return 'pdf';
          if (id.includes('html5-qrcode') || id.includes('qrcode.react')) return 'qr';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('date-fns')) return 'date-fns';
          if (id.includes('embla-carousel')) return 'carousel';
          if (
            id.includes('react-dom') ||
            id.includes('react-router') ||
            id.includes('/react/') ||
            id.includes('scheduler')
          ) {
            return 'react-vendor';
          }
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
