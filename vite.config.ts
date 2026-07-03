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

          // Heavy, lazy-only libraries: let Rollup place them INSIDE the async
          // chunks that import them (games, admin invoices, STL viewer, QR).
          // Returning undefined bypasses the vendor mega-chunk so a visitor
          // hitting the homepage doesn't parse Three.js / jsPDF / recharts.
          // Test on iOS Safari after any change here — an earlier attempt to
          // split these into standalone manual chunks caused TDZ crashes.
          if (
            /[\\/]node_modules[\\/](three|three-stdlib|three-mesh-bvh|@react-three[\\/][^\\/]+|jspdf|html2canvas|html5-qrcode|recharts|d3-[a-z-]+|react-image-crop|embla-carousel[a-z-]*|qrcode\.react)[\\/]/.test(id)
          ) {
            return undefined;
          }

          // Keep React runtime bundled together (small, needed on every page).
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
